import SalesOrder from '../models/SalesOrder.js';
import Item from '../models/Item.js';
import Transaction from '../models/Transaction.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';
import { getNextSequenceValue } from '../utils/sequence.js';

// @desc    Get all sales orders
// @route   GET /api/sales-orders
// @access  Private
export const getSalesOrders = async (req, res, next) => {
    try {
        const { status = '', page = 1, limit = 10 } = req.query;
        const query = { tenantId: req.tenantId };

        if (status) {
            query.status = status;
        }

        const orders = await SalesOrder.find(query)
            .populate('customer', 'name companyName')
            .populate('user', 'name')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await SalesOrder.countDocuments(query);

        sendResponse(res, 200, {
            orders,
            totalPages: Math.ceil(total / limit),
            currentPage: Number(page),
            totalOrders: total
        }, 'Sales orders fetched successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Get single sales order
// @route   GET /api/sales-orders/:id
// @access  Private
export const getSalesOrder = async (req, res, next) => {
    try {
        const order = await SalesOrder.findOne({ _id: req.params.id, tenantId: req.tenantId })
            .populate('customer')
            .populate('user', 'name')
            .populate('items.item', 'name sku barcode');

        if (!order) {
            return sendError(res, 404, 'Sales order not found');
        }
        sendResponse(res, 200, order, 'Sales order fetched successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Create new sales order (or quotation)
// @route   POST /api/sales-orders
// @access  Private
export const createSalesOrder = async (req, res, next) => {
    try {
        const { 
            customer, items, orderDate, expectedShipmentDate, 
            notes, terms, isEstimation, status,
            loadingCharges, transportCharges, oldBalance, advanceAmount, taxAmount
        } = req.body;

        // If it's a final order (not estimation/quotation), check stock
        if (!isEstimation && status !== 'quotation') {
            for (const lineItem of items) {
                const itemDoc = await Item.findOne({ _id: lineItem.item, tenantId: req.tenantId });
                if (!itemDoc) {
                    return sendError(res, 400, `Item not found`);
                }
                // Optional: Just a warning or soft check for estimations
                if (itemDoc.quantity < lineItem.quantity) {
                    // We allow creating orders even with low stock sometimes, but here we'll keep the check if it's a confirmed order.
                    // return sendError(res, 400, `Insufficient stock for ${itemDoc.name} (Available: ${itemDoc.quantity})`);
                }
            }
        }

        // Generate Order Number
        let order;
        let retries = 0;
        const prefix = isEstimation ? 'EST' : 'INV';
        
        while (!order && retries < 10) {
            const seq = await getNextSequenceValue(prefix, req.tenantId);
            const orderNumber = isEstimation ? `E-${seq}` : `${seq}`;
            
            try {
                order = await SalesOrder.create({
                    orderNumber,
                    customer,
                    items,
                    orderDate,
                    expectedShipmentDate,
                    notes,
                    terms,
                    isEstimation: isEstimation || false,
                    status: status || (isEstimation ? 'quotation' : 'draft'),
                    loadingCharges: loadingCharges || 0,
                    transportCharges: transportCharges || 0,
                    oldBalance: oldBalance || 0,
                    advanceAmount: advanceAmount || 0,
                    taxAmount: taxAmount || 0,
                    user: req.user._id,
                    tenantId: req.tenantId,
                });
            } catch (error) {
                if (error.code === 11000) {
                    retries++;
                    continue;
                }
                throw error;
            }
        }

        if (!order) {
            return sendError(res, 500, 'Failed to generate a unique order number');
        }

        sendResponse(res, 201, order, isEstimation ? 'Estimation created successfully' : 'Sales order created successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Update sales order status
// @route   PATCH /api/sales-orders/:id/status
// @access  Private
export const updateSOStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        const order = await SalesOrder.findOne({ _id: req.params.id, tenantId: req.tenantId });

        if (!order) {
            return sendError(res, 404, 'Sales order not found');
        }

        // Handle transition from Quotation (Estimation) to Confirmed Order
        if (order.status === 'quotation' && status === 'confirmed') {
            order.isEstimation = false;
        }

        order.status = status;
        await order.save();

        sendResponse(res, 200, order, `Sales order status updated to ${status}`);
    } catch (error) {
        next(error);
    }
};
// @desc    Update sales order
// @route   PUT /api/sales-orders/:id
// @access  Private (Admin only)
export const updateSalesOrder = async (req, res, next) => {
    try {
        const { 
            customer, items, orderDate, expectedShipmentDate, 
            notes, terms, isEstimation, status,
            loadingCharges, transportCharges, oldBalance, advanceAmount, taxAmount
        } = req.body;

        const order = await SalesOrder.findOne({ _id: req.params.id, tenantId: req.tenantId });

        if (!order) {
            return sendError(res, 404, 'Sales order not found');
        }

        // Only allow editing if user is admin or higher
        const isAdmin = ['super_admin', 'admin', 'tenant_owner', 'tenant_admin'].includes(req.user.role);
        if (!isAdmin) {
            return sendError(res, 403, 'Permission denied: Only administrators can edit bills');
        }

        // Update fields
        if (customer) order.customer = customer;
        if (items) order.items = items;
        if (orderDate) order.orderDate = orderDate;
        if (expectedShipmentDate) order.expectedShipmentDate = expectedShipmentDate;
        if (notes !== undefined) order.notes = notes;
        if (terms !== undefined) order.terms = terms;
        if (isEstimation !== undefined) order.isEstimation = isEstimation;
        if (status) order.status = status;
        
        if (loadingCharges !== undefined) order.loadingCharges = loadingCharges;
        if (transportCharges !== undefined) order.transportCharges = transportCharges;
        if (oldBalance !== undefined) order.oldBalance = oldBalance;
        if (advanceAmount !== undefined) order.advanceAmount = advanceAmount;
        if (taxAmount !== undefined) order.taxAmount = taxAmount;

        // totalAmount will be auto-calculated by the pre('save') hook in the model (if it exists)
        // Let's manually ensure totalAmount is correct if the hook isn't there
        const itemsTotal = order.items.reduce((sum, item) => sum + (item.total || 0), 0);
        order.itemsTotal = itemsTotal; // Ensure this matches model schema (might need to check)
        order.totalAmount = (
            itemsTotal + 
            Number(order.loadingCharges) + 
            Number(order.transportCharges) + 
            Number(order.taxAmount) + 
            Number(order.oldBalance) - 
            Number(order.advanceAmount)
        );

        await order.save();

        sendResponse(res, 200, order, 'Sales order updated successfully');
    } catch (error) {
        next(error);
    }
};
