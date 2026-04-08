import PurchaseOrder from '../models/PurchaseOrder.js';
import Item from '../models/Item.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';
import { getNextSequenceValue } from '../utils/sequence.js';

// @desc    Get all purchase orders
// @route   GET /api/purchase-orders
// @access  Private
export const getPurchaseOrders = async (req, res, next) => {
    try {
        const { status = '', page = 1, limit = 10 } = req.query;
        const query = { tenantId: req.tenantId };

        if (status) {
            query.status = status;
        }

        const orders = await PurchaseOrder.find(query)
            .populate('vendor', 'name companyName')
            .populate('items.item', 'name sku barcode')
            .populate({ path: 'user', model: User, select: 'name' })
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
        const order = await PurchaseOrder.findOne({ _id: req.params.id, tenantId: req.tenantId })
            .populate('vendor')
            .populate('items.item', 'name sku barcode')
            .populate({ path: 'user', model: User, select: 'name' });

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

        // Generate Order Number with retry logic
        let order;
        let retries = 0;
        while (!order && retries < 10) {
            const seq = await getNextSequenceValue('PO', req.tenantId);
            const orderNumber = `PO-${String(seq).padStart(5, '0')}`;
            
            try {
                order = await PurchaseOrder.create({
                    orderNumber,
                    vendor,
                    items,
                    orderDate,
                    expectedDeliveryDate,
                    notes,
                    user: req.user._id,
                    tenantId: req.tenantId,
                });
            } catch (error) {
                // If it's a duplicate key error on orderNumber, retry with next sequence
                if (error.code === 11000 && (error.message.includes('orderNumber') || (error.keyPattern && error.keyPattern.orderNumber))) {
                    retries++;
                    continue;
                }
                throw error;
            }
        }

        if (!order) {
            return sendError(res, 500, 'Failed to generate a unique order number after multiple attempts');
        }

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
        const order = await PurchaseOrder.findOne({ _id: req.params.id, tenantId: req.tenantId });

        if (!order) {
            return sendError(res, 404, 'Purchase order not found');
        }

        // Logic for inventory update is now handled in receivePurchaseOrder
        // If status is updated manually without receiving items, we just update the text
        if (status === 'received' && order.status !== 'received') {
            return sendError(res, 400, "Please use the 'Receive Order' feature to mark this PO as received.");
        }

        order.status = status;
        await order.save();

        sendResponse(res, 200, order, `Purchase order status updated to ${status}`);
    } catch (error) {
        next(error);
    }
};

// @desc    Receive purchase order and update stock
// @route   POST /api/purchase-orders/:id/receive
// @access  Private
export const receivePurchaseOrder = async (req, res, next) => {
    try {
        const { receivedItems } = req.body; 
        const order = await PurchaseOrder.findOne({ _id: req.params.id, tenantId: req.tenantId });

        if (!order) {
            return sendError(res, 404, 'Purchase order not found');
        }

        if (order.status === 'received') {
            return sendError(res, 400, 'Purchase order is already received');
        }

        if (!receivedItems || !Array.isArray(receivedItems)) {
            return sendError(res, 400, 'Invalid items data received');
        }

        for (const rItem of receivedItems) {
            const itemDoc = await Item.findOne({ _id: rItem.item, tenantId: req.tenantId });
            if (itemDoc) {
                const previousQuantity = itemDoc.quantity || 0;
                const recQty = parseFloat(rItem.receivedQuantity) || 0;
                const dmgQty = parseFloat(rItem.damagedQuantity) || 0;
                const batchNum = rItem.batchNumber || `PO-${order.orderNumber}`;
                const rate = parseFloat(rItem.price) || itemDoc.price;

                if (recQty > 0 || dmgQty > 0) {
                    // Update total quantities
                    itemDoc.quantity = (itemDoc.quantity || 0) + recQty;
                    if (dmgQty > 0) {
                        itemDoc.damagedQuantity = (itemDoc.damagedQuantity || 0) + dmgQty;
                    }

                    // Handle Batches
                    if (!itemDoc.batches) itemDoc.batches = [];
                    let batch = itemDoc.batches.find(b => b.price === rate && b.batchNumber === batchNum);
                    
                    if (batch) {
                        batch.quantity += recQty;
                    } else {
                        itemDoc.batches.push({
                            batchNumber: batchNum,
                            quantity: recQty,
                            price: rate,
                            receivedDate: Date.now()
                        });
                        batch = itemDoc.batches[itemDoc.batches.length - 1];
                    }

                    await itemDoc.save();

                    // Create transaction record
                    await Transaction.create({
                        item: rItem.item,
                        type: 'inward',
                        quantity: recQty,
                        damagedQuantity: dmgQty,
                        reason: `PO ${order.orderNumber} Received`,
                        user: req.user._id,
                        previousQuantity,
                        newQuantity: itemDoc.quantity,
                        batchId: batch._id,
                        batchNumber: batch.batchNumber,
                        tenantId: req.tenantId,
                    });
                }
            }
        }

        order.status = 'received';
        await order.save();

        sendResponse(res, 200, order, 'Purchase order received successfully');
    } catch (error) {
        next(error);
    }
};
