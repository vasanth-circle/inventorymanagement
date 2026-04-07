import Dispatch from '../models/Dispatch.js';
import SalesOrder from '../models/SalesOrder.js';
import Item from '../models/Item.js';
import Transaction from '../models/Transaction.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';

// @desc    Create a new dispatch record
// @route   POST /api/dispatches
// @access  Private
export const createDispatch = async (req, res, next) => {
    try {
        const { order: orderId, vehicleNumber, driverPhone, items, notes } = req.body;

        const order = await SalesOrder.findOne({ _id: orderId, tenantId: req.tenantId });
        if (!order) {
            return sendError(res, 404, 'Sales order not found');
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
            const itemDoc = await Item.findOne({ _id: dispatchItem.item, tenantId: req.tenantId });
            if (itemDoc) {
                const previousQuantity = itemDoc.quantity;
                const dispatchQty = Number(dispatchItem.quantity);
                
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
                    tenantId: req.tenantId
                });
            }
        }

        // Update Order status based on dispatch
        // For simplicity, we'll mark it as 'partially_dispatched' or 'dispatched'
        // In a more robust system, we would compare sum of all dispatches against order quantities.
        order.status = 'partially_dispatched'; 
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
        const dispatches = await Dispatch.find({ tenantId: req.tenantId })
            .populate('order', 'orderNumber status')
            .populate('items.item', 'name brand size')
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
            tenantId: req.tenantId 
        })
        .populate('items.item', 'name brand size')
        .sort({ createdAt: -1 });

        sendResponse(res, 200, dispatches);
    } catch (error) {
        next(error);
    }
};
