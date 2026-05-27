import SalesOrder from '../models/SalesOrder.js';
import Dispatch from '../models/Dispatch.js';
import Item from '../models/Item.js';
import Setting from '../models/Setting.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import CustomerLedger from '../models/CustomerLedger.js';
import Customer from '../models/Customer.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';
import { getNextSequenceValue } from '../utils/sequence.js';
import { tenantQuery } from '../utils/tenantQuery.js';

// Recalculate customer running ledger balance chronologically
export const recalculateCustomerBalance = async (customerId, tenantId) => {
    try {
        const customer = await Customer.findById(customerId);
        if (!customer) return;

        // Fetch all ledger entries sorted chronologically
        const entries = await CustomerLedger.find({ customer: customerId, tenantId })
            .sort({ date: 1, createdAt: 1 });

        let runningBalance = customer.openingBalance || 0;
        for (const entry of entries) {
            runningBalance = runningBalance + (entry.debit || 0) - (entry.credit || 0);
            entry.balance = runningBalance;
            await entry.save();
        }

        await Customer.findByIdAndUpdate(customerId, { currentBalance: runningBalance });
    } catch (err) {
        console.error(`recalculateCustomerBalance error for customer ${customerId}:`, err.message);
    }
};

// Synchronize ledger entry for a Sales Order
export const syncSalesOrderLedger = async (orderId, tenantId, userId) => {
    try {
        const order = await SalesOrder.findById(orderId);
        if (!order) return;

        // An order requires a ledger entry if it's NOT an estimation and is NOT cancelled or void
        const isRealBill = !order.isEstimation && !['cancelled', 'void'].includes(order.status);
        const existingBillEntry = await CustomerLedger.findOne({ refId: orderId, refType: 'SalesOrder', type: 'bill' });
        const existingPaymentEntry = await CustomerLedger.findOne({ refId: orderId, refType: 'SalesOrder', type: 'payment' });

        if (isRealBill) {
            let oldCustomer = null;
            const newCustomer = order.customer.toString();
            const fullAmount = order.totalAmount + (order.advanceAmount || 0);

            // ─── 1. Main Bill Entry (Debit) ───
            if (existingBillEntry) {
                oldCustomer = existingBillEntry.customer.toString();
                
                existingBillEntry.customer = order.customer;
                existingBillEntry.date = order.orderDate || new Date();
                existingBillEntry.refNumber = order.orderNumber;
                existingBillEntry.description = `Bill #${order.orderNumber}`;
                existingBillEntry.debit = fullAmount;
                existingBillEntry.credit = 0;
                await existingBillEntry.save();
            } else {
                await CustomerLedger.create({
                    tenantId,
                    customer: order.customer,
                    date: order.orderDate || new Date(),
                    type: 'bill',
                    refType: 'SalesOrder',
                    refId: order._id,
                    refNumber: order.orderNumber,
                    description: `Bill #${order.orderNumber}`,
                    debit: fullAmount,
                    credit: 0,
                    balance: 0,
                    createdBy: userId,
                });
            }

            // ─── 2. Advance Payment Entry (Credit) ───
            if (order.advanceAmount > 0) {
                if (existingPaymentEntry) {
                    if (existingPaymentEntry.customer.toString() !== newCustomer) {
                        oldCustomer = existingPaymentEntry.customer.toString();
                    }
                    
                    existingPaymentEntry.customer = order.customer;
                    existingPaymentEntry.date = order.orderDate || new Date();
                    existingPaymentEntry.refNumber = order.orderNumber;
                    existingPaymentEntry.description = `Advance Payment for Bill #${order.orderNumber}`;
                    existingPaymentEntry.debit = 0;
                    existingPaymentEntry.credit = order.advanceAmount;
                    await existingPaymentEntry.save();
                } else {
                    await CustomerLedger.create({
                        tenantId,
                        customer: order.customer,
                        date: order.orderDate || new Date(),
                        type: 'payment',
                        refType: 'SalesOrder',
                        refId: order._id,
                        refNumber: order.orderNumber,
                        description: `Advance Payment for Bill #${order.orderNumber}`,
                        debit: 0,
                        credit: order.advanceAmount,
                        balance: 0,
                        createdBy: userId,
                    });
                }
            } else {
                // If advanceAmount is 0 but we have an existing payment entry, delete it!
                if (existingPaymentEntry) {
                    if (existingPaymentEntry.customer.toString() !== newCustomer) {
                        oldCustomer = existingPaymentEntry.customer.toString();
                    }
                    await CustomerLedger.deleteOne({ _id: existingPaymentEntry._id });
                }
            }

            // ─── 3. Recalculate Balances ───
            await recalculateCustomerBalance(newCustomer, tenantId);
            if (oldCustomer && oldCustomer !== newCustomer) {
                await recalculateCustomerBalance(oldCustomer, tenantId);
            }
        } else {
            // If it shouldn't have ledger entries (e.g. toggled back to estimation or cancelled)
            const affectedCustomers = new Set();
            if (existingBillEntry) {
                affectedCustomers.add(existingBillEntry.customer.toString());
                await CustomerLedger.deleteOne({ _id: existingBillEntry._id });
            }
            if (existingPaymentEntry) {
                affectedCustomers.add(existingPaymentEntry.customer.toString());
                await CustomerLedger.deleteOne({ _id: existingPaymentEntry._id });
            }

            for (const custId of affectedCustomers) {
                await recalculateCustomerBalance(custId, tenantId);
            }
        }
    } catch (err) {
        console.error(`syncSalesOrderLedger error for order ${orderId}:`, err.message);
    }
};

// Backward-compatible ledger helper (calls syncSalesOrderLedger under the hood)
export const createBillLedgerEntry = async ({ orderId, tenantId, userId }) => {
    await syncSalesOrderLedger(orderId, tenantId, userId);
};


// @desc    Get all sales orders
// @route   GET /api/sales-orders
// @access  Private
export const getSalesOrders = async (req, res, next) => {
    try {
        const { status = '', customer = '', page = 1, limit = 10 } = req.query;
        const query = { ...tenantQuery(req) };

        if (status) {
            query.status = status;
        }

        if (customer) {
            query.customer = customer;
        }

        const orders = await SalesOrder.find(query)
            .populate('customer', 'name companyName')
            .populate({ path: 'user', model: User, select: 'name' })
            .populate('items.item', 'name brand size hsn sku barcode')
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
        const order = await SalesOrder.findOne({ _id: req.params.id, ...tenantQuery(req) })
            .populate('customer')
            .populate({ path: 'user', model: User, select: 'name' })
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
            loadingCharges, transportCharges, oldBalance, advanceAmount, taxAmount,
            siteName, siteAddress
        } = req.body;

        // ── Pricing & Stock Validation ──
        const settings = await Setting.findOne({ tenantId: req.tenantId });
        const preventBelowPurchase = settings?.pricingConfig?.preventSellingBelowPurchase;

        for (const lineItem of items) {
            const itemDoc = await Item.findOne({ _id: lineItem.item, ...tenantQuery(req) });
            if (!itemDoc) {
                return sendError(res, 400, `Item not found`);
            }

            // Check if selling price is below purchase price
            if (preventBelowPurchase && !isEstimation) {
                const effectivePurchasePrice = itemDoc.purchasePrice || 0;
                if (lineItem.price < effectivePurchasePrice) {
                    return sendError(res, 400, `Price for ${itemDoc.name} cannot be lower than purchase price (₹${effectivePurchasePrice})`);
                }
            }

            // Stock Validation
            if (!isEstimation && settings?.workflowConfig?.allowNegativeStock === false) {
                const stockQtyRequired = lineItem.stockQty || lineItem.quantity;
                if (itemDoc.quantity < stockQtyRequired) {
                    return sendError(res, 400, `Insufficient stock for ${itemDoc.name}. Available: ${itemDoc.quantity}, Required: ${stockQtyRequired}`);
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
                    status: status || (isEstimation ? 'quotation' : 'confirmed'),
                    loadingCharges: loadingCharges || 0,
                    transportCharges: transportCharges || 0,
                    oldBalance: oldBalance || 0,
                    advanceAmount: advanceAmount || 0,
                    taxAmount: taxAmount || 0,
                    siteName: siteName || '',
                    siteAddress: siteAddress || '',
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

        // ── Auto-create ledger debit entry ──
        if (order.customer) {
            await syncSalesOrderLedger(order._id, req.tenantId, req.user._id);
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
        const order = await SalesOrder.findOne({ _id: req.params.id, ...tenantQuery(req) });

        if (!order) {
            return sendError(res, 404, 'Sales order not found');
        }

        const wasEstimation = order.isEstimation;
        if (order.isEstimation && ['confirmed', 'dispatched', 'partially_dispatched'].includes(status)) {
            const settings = await Setting.findOne({ tenantId: req.tenantId });
            if (settings?.workflowConfig?.allowNegativeStock === false) {
                for (const lineItem of order.items) {
                    const itemDoc = await Item.findById(lineItem.item);
                    if (itemDoc) {
                        const stockQtyRequired = lineItem.stockQty || lineItem.quantity;
                        if (itemDoc.quantity < stockQtyRequired) {
                            return sendError(res, 400, `Insufficient stock for ${itemDoc.name} to confirm invoice. Available: ${itemDoc.quantity}`);
                        }
                    }
                }
            }
            order.isEstimation = false;
        }

        order.status = status;
        await order.save();

        if (order.customer) {
            await syncSalesOrderLedger(order._id, req.tenantId, req.user._id);
        }

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
            loadingCharges, transportCharges, oldBalance, advanceAmount, taxAmount,
            siteName, siteAddress
        } = req.body;

        const settings = await Setting.findOne({ tenantId: req.tenantId });
        const preventBelowPurchase = settings?.pricingConfig?.preventSellingBelowPurchase;

        if (items) {
            for (const lineItem of items) {
                const itemDoc = await Item.findOne({ _id: lineItem.item, ...tenantQuery(req) });
                if (itemDoc && preventBelowPurchase && !isEstimation && lineItem.price < (itemDoc.purchasePrice || 0)) {
                    return sendError(res, 400, `Price for ${itemDoc.name} cannot be lower than purchase price (₹${itemDoc.purchasePrice || 0})`);
                }
            }
        }

        const order = await SalesOrder.findOne({ _id: req.params.id, ...tenantQuery(req) });

        if (!order) {
            return sendError(res, 404, 'Sales order not found');
        }

        // Only allow editing if user is admin or higher
        const isAdmin = ['super_admin', 'admin', 'tenant_owner', 'tenant_admin', 'manager'].includes(req.user.role);
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
        if (siteName !== undefined) order.siteName = siteName;
        if (siteAddress !== undefined) order.siteAddress = siteAddress;

        // totalAmount calculation
        const itemsTotal = order.items.reduce((sum, item) => sum + (item.total || 0), 0);
        order.totalAmount = (
            itemsTotal + 
            Number(order.loadingCharges) + 
            Number(order.transportCharges) + 
            Number(order.taxAmount) + 
            Number(order.oldBalance) - 
            Number(order.advanceAmount)
        );

        await order.save();

        if (order.customer) {
            await syncSalesOrderLedger(order._id, req.tenantId, req.user._id);
        }

        sendResponse(res, 200, order, 'Sales order updated successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Delete sales order
// @route   DELETE /api/sales-orders/:id
// @access  Private (Admin only)
export const deleteSalesOrder = async (req, res, next) => {
    try {
        const orderId = req.params.id;
        const tenantId = req.tenantId;

        const order = await SalesOrder.findOne({ _id: orderId, tenantId });
        if (!order) {
            return sendError(res, 404, 'Sales order not found');
        }

        // 1. Handle Dispatches & Revert Stock
        const dispatches = await Dispatch.find({ order: orderId, tenantId });
        for (const dispatch of dispatches) {
            for (const dispatchItem of dispatch.items) {
                const itemDoc = await Item.findOne({ _id: dispatchItem.item, tenantId });
                if (itemDoc) {
                    const revertQty = Number(dispatchItem.quantity);
                    const previousQuantity = itemDoc.quantity;
                    
                    // Revert batch quantity if applicable
                    let usedBatchNumber = null;
                    const orderItem = order.items.find(oi => oi.item.toString() === dispatchItem.item.toString());
                    const batchId = orderItem?.batchId;
                    
                    if (batchId && itemDoc.batches) {
                        const batch = itemDoc.batches.id(batchId);
                        if (batch) {
                            batch.quantity += revertQty;
                            usedBatchNumber = batch.batchNumber;
                        }
                    }

                    // Revert main physical stock
                    itemDoc.quantity += revertQty;
                    await itemDoc.save();

                    // Create reversing transaction
                    await Transaction.create({
                        item: dispatchItem.item,
                        type: 'adjustment', // reverting outward
                        quantity: revertQty,
                        reason: `Reversed Dispatch for Deleted Order ${order.orderNumber}`,
                        notes: `Stock reverted from deleted Sales Order (Dispatch: ${dispatch.dispatchNumber})`,
                        user: req.user._id,
                        previousQuantity,
                        newQuantity: itemDoc.quantity,
                        fromLocation: itemDoc.location,
                        batchId: batchId || null,
                        batchNumber: usedBatchNumber,
                        tenantId
                    });
                }
            }
            // Delete the dispatch record
            await Dispatch.deleteOne({ _id: dispatch._id });
        }

        // 2. Remove Customer Ledger Entries
        if (order.customer) {
            await CustomerLedger.deleteMany({ refId: order._id, tenantId });
            await recalculateCustomerBalance(order.customer, tenantId);
        }

        // 3. Delete the Sales Order
        await SalesOrder.deleteOne({ _id: order._id });

        sendResponse(res, 200, null, 'Sales order deleted and stock reverted successfully');
    } catch (error) {
        next(error);
    }
};
