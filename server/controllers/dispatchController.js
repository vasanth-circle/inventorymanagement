import Dispatch from '../models/Dispatch.js';
import SalesOrder from '../models/SalesOrder.js';
import Item from '../models/Item.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Setting from '../models/Setting.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';
import { tenantQuery } from '../utils/tenantQuery.js';
import { allocateFIFO } from '../utils/stock.js';

// @desc    Create a new dispatch record
// @route   POST /api/dispatches
// @access  Private
export const createDispatch = async (req, res, next) => {
    try {
        const { order: orderId, items, notes } = req.body;

        const order = await SalesOrder.findOne({ _id: orderId, ...tenantQuery(req) });
        if (!order) {
            return sendError(res, 404, 'Sales order not found');
        }

        if (order.isEstimation) {
            return sendError(res, 400, 'Estimations/Quotations cannot be dispatched. Please convert it to a real invoice first.');
        }

        // Validate over-dispatch (including pending requests)
        const pastDispatches = await Dispatch.find({ order: orderId, status: { $ne: 'cancelled' }, ...tenantQuery(req) });

        for (const dispatchItem of items) {
            const orderItem = order.items.find(oi => oi.item.toString() === dispatchItem.item.toString());
            if (!orderItem) return sendError(res, 400, `Item ${dispatchItem.item} not found in order`);

            const pastDispatchedQty = pastDispatches.reduce((sum, d) => {
                const match = d.items.find(di => di.item.toString() === dispatchItem.item.toString());
                return sum + (match ? match.quantity : 0);
            }, 0);

            const targetedStockLimit = Number((orderItem.stockQty || orderItem.quantity).toFixed(2));
            const pendingQty = Number((targetedStockLimit - pastDispatchedQty).toFixed(2));
            const reqQty = Number(Number(dispatchItem.quantity).toFixed(2));
            
            if (reqQty > pendingQty) {
                return sendError(res, 400, `Cannot request dispatch of ${reqQty} units. Only ${pendingQty} pending for this item.`);
            }
        }

        // Generate a dispatch number
        const date = new Date();
        const dateStr = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
        const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
        const dispatchNumber = `REQ-${dateStr}-${randomStr}`;

        // Create the pending dispatch request
        const dispatch = await Dispatch.create({
            order: orderId,
            dispatchNumber,
            tenantId: req.tenantId,
            items,
            notes,
            status: 'pending_loading', // 2-step process: wait for godown
            createdBy: req.user._id,
        });

        sendResponse(res, 201, dispatch, 'Dispatch request submitted to Godown');
    } catch (error) {
        next(error);
    }
};

// @desc    Fulfill a pending dispatch request
// @route   PUT /api/dispatches/:id/fulfill
// @access  Private
export const fulfillDispatch = async (req, res, next) => {
    try {
        const { vehicleNumber, driverPhone, notes } = req.body;
        const dispatch = await Dispatch.findOne({ _id: req.params.id, status: 'pending_loading', ...tenantQuery(req) });
        
        if (!dispatch) return sendError(res, 404, 'Pending dispatch request not found');

        const order = await SalesOrder.findOne({ _id: dispatch.order, ...tenantQuery(req) });
        if (!order) return sendError(res, 404, 'Sales order not found');

        const settings = await Setting.findOne({ tenantId: req.tenantId });
        const allowNegativeStock = settings?.workflowConfig?.allowNegativeStock !== false;

        // Update inventory and create transactions
        for (const dispatchItem of dispatch.items) {
            const itemDoc = await Item.findOne({ _id: dispatchItem.item, ...tenantQuery(req) });
            if (itemDoc) {
                const previousQuantity = itemDoc.quantity;
                const dispatchQty = Number(dispatchItem.quantity);

                // PHYSICAL STOCK CHECK
                if (!allowNegativeStock && previousQuantity < dispatchQty) {
                    return sendError(res, 400, `Insufficient physical stock for ${itemDoc.name}. Available: ${previousQuantity}, Trying to load: ${dispatchQty}`);
                }
                
                const orderItem = order.items.find(oi => oi.item.toString() === dispatchItem.item.toString());
                
                // FIFO Allocation
                const allocations = allocateFIFO(itemDoc, dispatchQty);
                dispatchItem.batchAllocations = allocations; // Save to dispatch record

                // Accumulate to sales order item
                if (orderItem) {
                    if (!orderItem.batchAllocations) orderItem.batchAllocations = [];
                    orderItem.batchAllocations.push(...allocations);
                }

                itemDoc.quantity -= dispatchQty;
                await itemDoc.save();

                // Record transactions for each allocation
                for (const alloc of allocations) {
                    await Transaction.create({
                        item: dispatchItem.item,
                        type: 'outward',
                        quantity: alloc.quantity,
                        reason: `Dispatch for Order ${order.orderNumber}`,
                        notes: `Vehicle: ${vehicleNumber}, Dispatch: ${dispatch.dispatchNumber}`,
                        user: req.user._id,
                        previousQuantity,
                        newQuantity: itemDoc.quantity,
                        fromLocation: itemDoc.location,
                        batchId: alloc.batchId || null,
                        batchNumber: alloc.batchNumber || null,
                        ...tenantQuery(req)
                    });
                }
            }
        }

        dispatch.vehicleNumber = vehicleNumber;
        dispatch.driverPhone = driverPhone;
        if (notes) dispatch.notes = (dispatch.notes ? dispatch.notes + ' | ' : '') + notes;
        dispatch.status = 'dispatched';
        dispatch.dispatchDate = new Date();
        await dispatch.save();

        // Check if order is fully dispatched based on ALL dispatched logs
        const pastDispatches = await Dispatch.find({ order: order._id, status: 'dispatched', ...tenantQuery(req) });
        let fullyDispatchedItemsCount = 0;
        
        for (const orderItem of order.items) {
            const targetedStockLimit = orderItem.stockQty || orderItem.quantity;
            const pastDispatchedQty = pastDispatches.reduce((sum, d) => {
                const match = d.items.find(di => di.item.toString() === orderItem.item.toString());
                return sum + (match ? match.quantity : 0);
            }, 0);
            if (pastDispatchedQty >= targetedStockLimit) {
                fullyDispatchedItemsCount++;
            }
        }

        const isFullyDispatched = fullyDispatchedItemsCount === order.items.length;
        if (order.isEstimation) order.isEstimation = false;
        order.status = isFullyDispatched ? 'dispatched' : 'partially_dispatched'; 
        await order.save();

        if (order.customer) {
            const { syncSalesOrderLedger } = await import('./salesOrderController.js');
            await syncSalesOrderLedger(order._id, req.tenantId, req.user._id);
        }

        sendResponse(res, 200, dispatch, 'Dispatch fulfilled successfully');
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
            .populate({
                path: 'order',
                select: 'orderNumber status customer totalAmount isEstimation',
                populate: { path: 'customer', select: 'name companyName' }
            })
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

// @desc    Update a pending dispatch request
// @route   PUT /api/dispatches/:id
// @access  Private
export const updateDispatch = async (req, res, next) => {
    try {
        const { items, notes } = req.body;
        
        const dispatch = await Dispatch.findOne({ _id: req.params.id, ...tenantQuery(req) });
        if (!dispatch) {
            return sendError(res, 404, 'Dispatch request not found');
        }

        if (dispatch.status !== 'pending_loading') {
            return sendError(res, 400, 'Only pending dispatch requests can be edited');
        }

        const order = await SalesOrder.findOne({ _id: dispatch.order, ...tenantQuery(req) });
        if (!order) {
            return sendError(res, 404, 'Sales order not found');
        }

        // Validate over-dispatch
        const pastDispatches = await Dispatch.find({ 
            order: order._id, 
            status: { $ne: 'cancelled' },
            _id: { $ne: dispatch._id }, // Exclude current dispatch from past calculations
            ...tenantQuery(req) 
        });

        for (const dispatchItem of items) {
            const orderItem = order.items.find(oi => oi.item.toString() === dispatchItem.item.toString());
            if (!orderItem) return sendError(res, 400, `Item ${dispatchItem.item} not found in order`);

            const pastDispatchedQty = pastDispatches.reduce((sum, d) => {
                const match = d.items.find(di => di.item.toString() === dispatchItem.item.toString());
                return sum + (match ? match.quantity : 0);
            }, 0);

            const targetedStockLimit = Number((orderItem.stockQty || orderItem.quantity).toFixed(2));
            const pendingQty = Number((targetedStockLimit - pastDispatchedQty).toFixed(2));
            const reqQty = Number(Number(dispatchItem.quantity).toFixed(2));
            
            if (reqQty > pendingQty) {
                return sendError(res, 400, `Cannot request dispatch of ${reqQty} units. Only ${pendingQty} pending for this item.`);
            }
        }

        dispatch.items = items;
        if (notes !== undefined) dispatch.notes = notes;
        
        await dispatch.save();

        sendResponse(res, 200, dispatch, 'Dispatch request updated successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Cancel a pending dispatch request
// @route   DELETE /api/dispatches/:id
// @access  Private
export const deleteDispatch = async (req, res, next) => {
    try {
        const dispatch = await Dispatch.findOne({ _id: req.params.id, ...tenantQuery(req) });
        
        if (!dispatch) {
            return sendError(res, 404, 'Dispatch request not found');
        }

        if (dispatch.status !== 'pending_loading') {
            return sendError(res, 400, 'Only pending dispatch requests can be cancelled');
        }

        dispatch.status = 'cancelled';
        await dispatch.save();

        sendResponse(res, 200, null, 'Dispatch request cancelled successfully');
    } catch (error) {
        next(error);
    }
};
