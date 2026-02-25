import PurchaseOrder from '../models/PurchaseOrder.js';
import Item from '../models/Item.js';
import Transaction from '../models/Transaction.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';

// @desc    Get all purchase orders
// @route   GET /api/purchase-orders
// @access  Private
export const getPurchaseOrders = async (req, res, next) => {
    try {
        const { status = '', page = 1, limit = 10 } = req.query;
        const query = {};

        if (status) {
            query.status = status;
        }

        const orders = await PurchaseOrder.find(query)
            .populate('vendor', 'name companyName')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await PurchaseOrder.countDocuments(query);

        sendResponse(res, 200, {
            orders,
            totalPages: Math.ceil(total / limit),
            currentPage: Number(page),
            totalOrders: total
        }, 'Purchase orders fetched successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Get single purchase order
// @route   GET /api/purchase-orders/:id
// @access  Private
export const getPurchaseOrder = async (req, res, next) => {
    try {
        const order = await PurchaseOrder.findById(req.params.id)
            .populate('vendor')
            .populate('items.item', 'name sku barcode');

        if (!order) {
            return sendError(res, 404, 'Purchase order not found');
        }
        sendResponse(res, 200, order, 'Purchase order fetched successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Create new purchase order
// @route   POST /api/purchase-orders
// @access  Private
export const createPurchaseOrder = async (req, res, next) => {
    try {
        const { vendor, items, orderDate, expectedDeliveryDate, notes } = req.body;

        // Generate Order Number
        const count = await PurchaseOrder.countDocuments();
        const orderNumber = `PO-${String(count + 1).padStart(5, '0')}`;

        const order = await PurchaseOrder.create({
            orderNumber,
            vendor,
            items,
            orderDate,
            expectedDeliveryDate,
            notes,
            user: req.user._id,
        });

        sendResponse(res, 201, order, 'Purchase order created successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Update purchase order status
// @route   PATCH /api/purchase-orders/:id/status
// @access  Private
export const updatePOStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        const order = await PurchaseOrder.findById(req.params.id);

        if (!order) {
            return sendError(res, 404, 'Purchase order not found');
        }

        // Logic for inventory update when status becomes 'received'
        if (status === 'received' && order.status !== 'received') {
            for (const lineItem of order.items) {
                const itemDoc = await Item.findById(lineItem.item);
                if (itemDoc) {
                    const previousQuantity = itemDoc.quantity;
                    itemDoc.quantity += lineItem.quantity;
                    await itemDoc.save();

                    // Create transaction record
                    await Transaction.create({
                        item: lineItem.item,
                        type: 'inward',
                        quantity: lineItem.quantity,
                        reason: `Purchase Order ${order.orderNumber}`,
                        user: req.user._id,
                        previousQuantity,
                        newQuantity: itemDoc.quantity,
                    });
                }
            }
        }

        order.status = status;
        await order.save();

        sendResponse(res, 200, order, `Purchase order status updated to ${status}`);
    } catch (error) {
        next(error);
    }
};
