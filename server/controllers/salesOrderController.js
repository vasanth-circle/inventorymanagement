import SalesOrder from '../models/SalesOrder.js';
import Item from '../models/Item.js';
import Transaction from '../models/Transaction.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';

// @desc    Get all sales orders
// @route   GET /api/sales-orders
// @access  Private
export const getSalesOrders = async (req, res, next) => {
    try {
        const { status = '', page = 1, limit = 10 } = req.query;
        const query = {};

        if (status) {
            query.status = status;
        }

        const orders = await SalesOrder.find(query)
            .populate('customer', 'name companyName')
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
        const order = await SalesOrder.findById(req.params.id)
            .populate('customer')
            .populate('items.item', 'name sku barcode');

        if (!order) {
            return sendError(res, 404, 'Sales order not found');
        }
        sendResponse(res, 200, order, 'Sales order fetched successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Create new sales order
// @route   POST /api/sales-orders
// @access  Private
export const createSalesOrder = async (req, res, next) => {
    try {
        const { customer, items, orderDate, expectedShipmentDate, notes, terms } = req.body;

        // Generate Order Number (Simple logic)
        const count = await SalesOrder.countDocuments();
        const orderNumber = `SO-${String(count + 1).padStart(5, '0')}`;

        const order = await SalesOrder.create({
            orderNumber,
            customer,
            items,
            orderDate,
            expectedShipmentDate,
            notes,
            terms,
            user: req.user._id,
        });

        sendResponse(res, 201, order, 'Sales order created successfully');
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
        const order = await SalesOrder.findById(req.params.id);

        if (!order) {
            return sendError(res, 404, 'Sales order not found');
        }

        // Logic for inventory update when status becomes 'shipped'
        if (status === 'shipped' && order.status !== 'shipped') {
            for (const lineItem of order.items) {
                const itemDoc = await Item.findById(lineItem.item);
                if (itemDoc) {
                    const previousQuantity = itemDoc.quantity;
                    itemDoc.quantity -= lineItem.quantity;
                    await itemDoc.save();

                    // Create transaction record
                    await Transaction.create({
                        item: lineItem.item,
                        type: 'outward',
                        quantity: lineItem.quantity,
                        reason: `Sales Order ${order.orderNumber}`,
                        user: req.user._id,
                        previousQuantity,
                        newQuantity: itemDoc.quantity,
                    });
                }
            }
        }

        order.status = status;
        await order.save();

        sendResponse(res, 200, order, `Sales order status updated to ${status}`);
    } catch (error) {
        next(error);
    }
};
