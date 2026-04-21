import Dispatch from '../models/Dispatch.js';
import SalesOrder from '../models/SalesOrder.js';
import Item from '../models/Item.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';
import { tenantQuery } from '../utils/tenantQuery.js';

// @desc    Create a new dispatch record
// @route   POST /api/dispatches
// @access  Private
export const createDispatch = async (req, res, next) => {
    try {
        const { order: orderId, vehicleNumber, driverPhone, items, notes } = req.body;

        const order = await SalesOrder.findOne({ _id: orderId, ...tenantQuery(req) });
        if (!order) {
            return sendError(res, 404, 'Sales order not found');
        }

        // Validate over-dispatch
        const pastDispatches = await Dispatch.find({ order: orderId, ...tenantQuery(req) });
        let fullyDispatchedItemsCount = 0;

        for (const dispatchItem of items) {
            const orderItem = order.items.find(oi => oi.item.toString() === dispatchItem.item.toString());
            if (!orderItem) return sendError(res, 400, `Item ${dispatchItem.item} not found in order`);

            const pastDispatchedQty = pastDispatches.reduce((sum, d) => {
                const match = d.items.find(di => di.item.toString() === dispatchItem.item.toString());
                return sum + (match ? match.quantity : 0);
            }, 0);

            // Use stockQty if available, fallback to quantity (for legacy orders)
            const targetedStockLimit = orderItem.stockQty || orderItem.quantity;
            const pendingQty = targetedStockLimit - pastDispatchedQty;
            
            if (dispatchItem.quantity > pendingQty) {
                return sendError(res, 400, `Cannot dispatch ${dispatchItem.quantity} units. Only ${pendingQty} pending physically for this item.`);
            }

            if (dispatchItem.quantity + pastDispatchedQty >= targetedStockLimit) {
                fullyDispatchedItemsCount++;
            }
        }

        // Generate a dispatch number
        const date = new Date();
        const dateStr = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
        const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
        const dispatchNumber = `DSP-${dateStr}-${randomStr}`;

        // Create the dispatch
        const dispatch = await Dispatch.create({
            order: orderId,
            dispatchNumber,
            tenantId: req.tenantId,
            vehicleNumber,
            driverPhone,
            items,
            notes,
            createdBy: req.user._id,
        });

        // Update inventory and create transactions
        for (const dispatchItem of items) {
            const itemDoc = await Item.findOne({ _id: dispatchItem.item, ...tenantQuery(req) });
            if (itemDoc) {
                const previousQuantity = itemDoc.quantity;
                const dispatchQty = Number(dispatchItem.quantity);
                
                // Find corresponding Sales Order item to get batchId
                const orderItem = order.items.find(oi => oi.item.toString() === dispatchItem.item.toString());
                const batchId = orderItem?.batchId;
                let usedBatchNumber = '';

                if (batchId && itemDoc.batches) {
                    const batch = itemDoc.batches.id(batchId);
                    if (batch) {
                        batch.quantity -= dispatchQty;
                        usedBatchNumber = batch.batchNumber;
                    }
                }

                itemDoc.quantity -= dispatchQty;
                await itemDoc.save();

                // Record transaction
                await Transaction.create({
                    item: dispatchItem.item,
                    type: 'outward',
                    quantity: dispatchQty,
                    reason: `Dispatch for Order ${order.orderNumber}`,
                    notes: `Vehicle: ${vehicleNumber}, Dispatch: ${dispatchNumber}`,
                    user: req.user._id,
                    previousQuantity,
                    newQuantity: itemDoc.quantity,
                    fromLocation: itemDoc.location,
                    batchId: batchId || null,
                    batchNumber: usedBatchNumber || null,
                    ...tenantQuery(req)
                });
            }
        }

        // Update Order status based on dispatch completion
        const isFullyDispatched = fullyDispatchedItemsCount === order.items.length;
        order.status = isFullyDispatched ? 'dispatched' : 'partially_dispatched'; 
        await order.save();

        sendResponse(res, 201, dispatch, 'Dispatch recorded successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Get all dispatches for the tenant
// @route   GET /api/dispatches
// @access  Private
export const getDispatches = async (req, res, next) => {
    try {
        const dispatches = await Dispatch.find({ ...tenantQuery(req) })
            .populate('order', 'orderNumber status')
            .populate('items.item', 'name brand size')
            .populate({ path: 'createdBy', model: User, select: 'name' })
            .sort({ createdAt: -1 });

        sendResponse(res, 200, dispatches);
    } catch (error) {
        next(error);
    }
};

// @desc    Get dispatches for a specific order
// @route   GET /api/dispatches/order/:orderId
// @access  Private
export const getOrderDispatches = async (req, res, next) => {
    try {
        const dispatches = await Dispatch.find({ 
            order: req.params.orderId, 
            ...tenantQuery(req) 
        })
        .populate('items.item', 'name brand size')
        .populate({ path: 'createdBy', model: User, select: 'name' })
        .sort({ createdAt: -1 });

        sendResponse(res, 200, dispatches);
    } catch (error) {
        next(error);
    }
};
