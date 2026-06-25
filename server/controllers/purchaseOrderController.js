import PurchaseOrder from '../models/PurchaseOrder.js';
import Item from '../models/Item.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';
import { getNextSequenceValue } from '../utils/sequence.js';
import { tenantQuery } from '../utils/tenantQuery.js';
import VendorLedger from '../models/VendorLedger.js';
import Vendor from '../models/Vendor.js';

// ─── Ledger helper (called after PO receipt/bill, does not change existing flow) ─
export const createPurchaseLedgerEntry = async ({ orderId, orderNumber, vendorId, amount, tenantId, userId, orderDate }) => {
    try {
        const vendor = await Vendor.findById(vendorId);
        if (!vendor) return;

        const lastEntry = await VendorLedger.findOne({ vendor: vendorId, tenantId }).sort({ date: -1, createdAt: -1 });
        const previousBalance = lastEntry ? lastEntry.balance : (vendor.openingBalance || 0);
        
        // Credit increases our liability (balance)
        const newBalance = previousBalance + amount;

        await VendorLedger.create({
            tenantId,
            vendor: vendorId,
            date: orderDate || new Date(),
            type: 'bill',
            refType: 'PurchaseOrder',
            refId: orderId,
            refNumber: orderNumber,
            description: `Bill from PO #${orderNumber}`,
            debit: 0,
            credit: amount,
            balance: newBalance,
            createdBy: userId,
        });

        await Vendor.findByIdAndUpdate(vendorId, { currentBalance: newBalance });
    } catch (err) {
        console.error('createPurchaseLedgerEntry error:', err.message);
    }
};

// @desc    Get all purchase orders
// @route   GET /api/purchase-orders
// @access  Private
export const getPurchaseOrders = async (req, res, next) => {
    try {
        const { status = '', page = 1, limit = 10, from, to } = req.query;
        const query = { ...tenantQuery(req) };

        if (status) {
            query.status = status;
        }

        if (from || to) {
            query.orderDate = {};
            if (from) query.orderDate.$gte = new Date(from);
            if (to) {
                const toDate = new Date(to);
                toDate.setHours(23, 59, 59, 999);
                query.orderDate.$lte = toDate;
            }
        }

        const orders = await PurchaseOrder.find(query)
            .populate('vendor', 'name companyName gstin address phone email')
            .populate('items.item', 'name sku barcode size brand unitType')
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
// @desc    Get single purchase order
// @route   GET /api/purchase-orders/:id
// @access  Private
export const getPurchaseOrder = async (req, res, next) => {
    try {
        const order = await PurchaseOrder.findOne({ _id: req.params.id, ...tenantQuery(req) })
            .populate('vendor')
            .populate('items.item', 'name sku barcode size brand unitType')
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
        const { vendor, items, orderDate, expectedDeliveryDate, notes, vendorBillNumber, billDate, taxRate, totalAmount, roundOffAmount } = req.body;

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
                    vendorBillNumber,
                    billDate,
                    items,
                    taxRate,
                    totalAmount: totalAmount || 0,
                    roundOffAmount: roundOffAmount || 0,
                    orderDate,
                    expectedDeliveryDate,
                    notes,
                    user: req.user._id,
                    ...tenantQuery(req),
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

// @desc    Update purchase order
// @route   PUT /api/purchase-orders/:id
// @access  Private
export const updatePurchaseOrder = async (req, res, next) => {
    try {
        const order = await PurchaseOrder.findOne({ _id: req.params.id, ...tenantQuery(req) });
        if (!order) {
            return sendError(res, 404, 'Purchase order not found');
        }

        if (order.status !== 'draft' && order.status !== 'issued') {
            return sendError(res, 400, 'Cannot edit an order that has been received or billed');
        }

        const { vendor, items, notes, vendorBillNumber, billDate, taxRate, taxType, taxAmount, totalAmount, roundOffAmount } = req.body;

        order.vendor = vendor;
        order.items = items;
        order.notes = notes;
        order.vendorBillNumber = vendorBillNumber;
        order.billDate = billDate;
        order.taxRate = taxRate;
        order.taxType = taxType;
        order.taxAmount = taxAmount;
        order.totalAmount = totalAmount;
        if (roundOffAmount !== undefined) order.roundOffAmount = roundOffAmount;

        await order.save();

        sendResponse(res, 200, order, 'Purchase order updated successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Delete purchase order
// @route   DELETE /api/purchase-orders/:id
// @access  Private
export const deletePurchaseOrder = async (req, res, next) => {
    try {
        const order = await PurchaseOrder.findOne({ _id: req.params.id, ...tenantQuery(req) });
        if (!order) {
            return sendError(res, 404, 'Purchase order not found');
        }

        if (order.status === 'received' || order.status === 'billed') {
            return sendError(res, 400, 'Cannot delete an order that has been received or billed.');
        }

        await order.deleteOne();

        sendResponse(res, 200, {}, 'Purchase order deleted successfully');
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
        const order = await PurchaseOrder.findOne({ _id: req.params.id, ...tenantQuery(req) });

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

        // If marked as billed, ensure ledger entry exists (if not already received)
        if (status === 'billed') {
            const alreadyInLedger = await VendorLedger.findOne({ refId: order._id, refType: 'PurchaseOrder' });
            if (!alreadyInLedger) {
                createPurchaseLedgerEntry({
                    orderId: order._id,
                    orderNumber: order.orderNumber,
                    vendorId: order.vendor,
                    amount: order.totalAmount,
                    tenantId: req.tenantId,
                    userId: req.user._id,
                    orderDate: order.orderDate,
                });
            }
        }

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
        const { receivedItems, vendorBillNumber } = req.body; 
        const order = await PurchaseOrder.findOne({ _id: req.params.id, ...tenantQuery(req) });

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
            const itemDoc = await Item.findOne({ _id: rItem.item, ...tenantQuery(req) });
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

                    itemDoc.purchasePrice = rate;
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
                        ...tenantQuery(req),
                    });
                }
            }
        }

        if (vendorBillNumber) {
            order.vendorBillNumber = vendorBillNumber;
        }

        order.status = 'received';
        await order.save();

        // ── Auto-create vendor ledger credit entry ──
        createPurchaseLedgerEntry({
            orderId: order._id,
            orderNumber: order.orderNumber,
            vendorId: order.vendor,
            amount: order.totalAmount,
            tenantId: req.tenantId,
            userId: req.user._id,
            orderDate: order.orderDate,
        });

        sendResponse(res, 200, order, 'Purchase order received successfully');
    } catch (error) {
        next(error);
    }
};
