import SalesOrder from '../models/SalesOrder.js';
import Dispatch from '../models/Dispatch.js';
import Item from '../models/Item.js';
import Setting from '../models/Setting.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import CustomerLedger from '../models/CustomerLedger.js';
import Customer from '../models/Customer.js';
import ActionLog from '../models/ActionLog.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';
import { getNextSequenceValue } from '../utils/sequence.js';
import { tenantQuery } from '../utils/tenantQuery.js';
import { allocateFIFO } from '../utils/stock.js';

// Helper for validating customer credit lock
export const validateCustomerCreditLock = async (req, res, customerId, newInvoiceAmount) => {
    const settings = await Setting.findOne({ tenantId: req.tenantId });
    if (!settings?.creditConfig?.enableAutoLock) return true; // Passed

    const customerDoc = await Customer.findOne({ _id: customerId, ...tenantQuery(req) });
    if (!customerDoc) return true; // Passed (or error handled elsewhere)

    let isManuallyUnlocked = false;
    if (customerDoc.unlockedUntil && new Date(customerDoc.unlockedUntil) > new Date()) {
        isManuallyUnlocked = true;
    }

    if (!isManuallyUnlocked) {
        const creditLimit = settings.creditConfig.customerCreditLimit || 0;
        const creditDays = settings.creditConfig.customerCreditDays || 0;
        const currentBalance = customerDoc.currentBalance || 0;

        // 1. Check Credit Limit
        if (creditLimit > 0 && (currentBalance + newInvoiceAmount) > creditLimit) {
            sendError(res, 400, `Cannot create bill: Customer Credit Limit (₹${creditLimit}) exceeded. Pending balance: ₹${currentBalance}. New Bill: ₹${newInvoiceAmount}. Contact Admin to unlock.`);
            return false;
        }

        // 2. Check Credit Days (FIFO calculation)
        if (creditDays > 0 && currentBalance > 0) {
            const allLedgerEntries = await CustomerLedger.find({ customer: customerId, tenantId: req.tenantId }).sort({ date: 1, createdAt: 1 });
            
            let totalPayments = 0;
            const bills = [];

            // Account for opening balance in FIFO calculation
            if (customerDoc.openingBalance > 0) {
                bills.push({ date: customerDoc.createdAt || new Date(0), amount: customerDoc.openingBalance });
            } else if (customerDoc.openingBalance < 0) {
                totalPayments += Math.abs(customerDoc.openingBalance);
            }

            allLedgerEntries.forEach(entry => {
                if (entry.debit > 0) bills.push({ date: entry.date, amount: entry.debit });
                if (entry.credit > 0) totalPayments += entry.credit;
            });

            let oldestUnpaidBillDate = null;
            for (const bill of bills) {
                if (totalPayments >= bill.amount) {
                    totalPayments -= bill.amount;
                } else {
                    oldestUnpaidBillDate = bill.date;
                    break;
                }
            }

            if (oldestUnpaidBillDate) {
                const diffTime = Math.abs(new Date() - new Date(oldestUnpaidBillDate));
                const daysPending = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (daysPending > creditDays) {
                    sendError(res, 400, `Cannot create bill: Customer has an unpaid balance pending for ${daysPending} days (Limit: ${creditDays} days). Contact Admin to unlock.`);
                    return false;
                }
            }
        }
    }
    return true; // Passed
};

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
            // The ledger debit = net bill value for THIS invoice only.
            // order.totalAmount has: itemsTotal + charges + taxes + oldBalance - discounts - advance + roundOff
            // We must EXCLUDE oldBalance (already in ledger from previous entries) and ADD BACK advance (it becomes a separate credit entry).
            const billDebitAmount = order.totalAmount + (order.advanceAmount || 0) - (order.oldBalance || 0);

            // ─── 1. Main Bill Entry (Debit) ───
            if (existingBillEntry) {
                oldCustomer = existingBillEntry.customer.toString();
                
                existingBillEntry.customer = order.customer;
                existingBillEntry.date = order.orderDate || new Date();
                existingBillEntry.refNumber = order.orderNumber;
                existingBillEntry.description = `Bill #${order.orderNumber}`;
                existingBillEntry.debit = billDebitAmount;
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
                    debit: billDebitAmount,
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

// Auto-dispatch (reduce stock) when an invoice is confirmed (for users bypassing dispatch module)
export const autoDispatchConfirmedOrder = async (orderId, tenantId, userId) => {
    try {
        const order = await SalesOrder.findOne({ _id: orderId, tenantId });
        if (!order || order.isEstimation || ['cancelled', 'void'].includes(order.status)) return;
        
        // Only auto-dispatch if it's confirmed
        if (order.status !== 'confirmed') return;

        // Check if auto-dispatch is enabled in settings
        const settings = await Setting.findOne({ tenantId });
        if (!settings?.workflowConfig?.enableAutoDispatch) return;


        let fullyDispatchedItemsCount = 0;
        const dispatchItems = [];

        for (const orderItem of order.items) {
            const itemDoc = await Item.findOne({ _id: orderItem.item, tenantId });
            if (itemDoc) {
                const dispatchQty = Number(orderItem.stockQty || orderItem.quantity);
                const previousQuantity = itemDoc.quantity;

                // FIFO Allocation
                const allocations = allocateFIFO(itemDoc, dispatchQty);
                if (!orderItem.batchAllocations) orderItem.batchAllocations = [];
                orderItem.batchAllocations.push(...allocations);

                itemDoc.quantity -= dispatchQty;
                await itemDoc.save();

                dispatchItems.push({
                    item: orderItem.item,
                    quantity: dispatchQty,
                    unit: orderItem.billingUnit || 'pieces',
                    batchAllocations: allocations
                });

                // Record transactions for each allocation
                for (const alloc of allocations) {
                    await Transaction.create({
                        item: orderItem.item,
                        type: 'outward',
                        quantity: alloc.quantity,
                        reason: `Auto-Dispatch for Order ${order.orderNumber}`,
                        notes: `System auto-dispatch upon invoice confirmation`,
                        user: userId,
                        previousQuantity,
                        newQuantity: itemDoc.quantity, // this is final qty, acceptable for logs
                        fromLocation: itemDoc.location,
                        batchId: alloc.batchId || null,
                        batchNumber: alloc.batchNumber || null,
                        tenantId
                    });
                }
                fullyDispatchedItemsCount++;
            }
        }

        // Generate a dispatch number and record to ensure stock reversals work if invoice is deleted
        if (dispatchItems.length > 0) {
            const date = new Date();
            const dateStr = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
            const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
            
            await Dispatch.create({
                order: orderId,
                dispatchNumber: `AD-${dateStr}-${randomStr}`,
                tenantId,
                items: dispatchItems,
                notes: 'Auto-dispatched upon invoice confirmation',
                status: 'dispatched',
                createdBy: userId,
            });
        }

        if (fullyDispatchedItemsCount === order.items.length && fullyDispatchedItemsCount > 0) {
            order.status = 'dispatched';
        }
        await order.save();
    } catch (err) {
        console.error(`autoDispatchConfirmedOrder error for order ${orderId}:`, err.message);
    }
};


// @desc    Get all sales orders
// @route   GET /api/sales-orders
// @access  Private
export const getSalesOrders = async (req, res, next) => {
    try {
        const { status = '', customer = '', type = '', search = '', page = 1, limit = 10, startDate, endDate } = req.query;
        const query = { ...tenantQuery(req) };

        if (status) {
            query.status = status;
        }

        if (customer) {
            query.customer = customer;
        }
        
        if (type === 'quote') {
            query.isEstimation = true;
        } else if (type === 'invoice') {
            query.isEstimation = false;
        }

        if (startDate || endDate) {
            query.orderDate = {};
            if (startDate) {
                query.orderDate.$gte = new Date(startDate);
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.orderDate.$lte = end;
            }
        }

        if (search) {
            const matchingCustomers = await Customer.find({ 
                name: { $regex: search, $options: 'i' },
                ...tenantQuery(req)
            }).select('_id');
            const customerIds = matchingCustomers.map(c => c._id);
            
            query.$or = [
                { orderNumber: { $regex: search, $options: 'i' } },
                { customer: { $in: customerIds } }
            ];
        }

        const orders = await SalesOrder.find(query)
            .populate('customer', 'name companyName phone gstin address')
            .populate({ path: 'user', model: User, select: 'name phone' })
            .populate('items.item', 'name brand size hsn sku barcode unitType sqFtPerPc pcsPerBox')
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
            .populate({ path: 'user', model: User, select: 'name phone' })
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
            loadingCharges, transportCharges, unloadingCharges, oldBalance, advanceAmount, taxAmount,
            siteName, siteAddress, discountAmount, roundOffAmount,
            customerType, referredBy
        } = req.body;

        // ── Items Validation ──
        if (!items || !Array.isArray(items) || items.length === 0) {
            return sendError(res, 400, 'Cannot create an empty bill. Please add at least one item.');
        }

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

        // ── Duplicate Submission Guard (same user + same customer + same items fingerprint within 15s) ──
        if (!isEstimation) {
            const fifteenSecondsAgo = new Date(Date.now() - 15000);
            const itemsFingerprint = (items || [])
                .map(i => `${i.item}:${i.quantity}:${i.price}`)
                .sort()
                .join('|');

            const recentOrders = await SalesOrder.find({
                tenantId: req.tenantId,
                customer,
                user: req.user._id,
                isEstimation: false,
                createdAt: { $gte: fifteenSecondsAgo }
            }).select('items createdAt');

            for (const recent of recentOrders) {
                const recentFingerprint = (recent.items || [])
                    .map(i => `${i.item}:${i.quantity}:${i.price}`)
                    .sort()
                    .join('|');
                if (recentFingerprint === itemsFingerprint) {
                    return sendError(res, 409, 'Duplicate submission detected. This invoice appears to have already been saved. Please refresh and check before trying again.');
                }
            }
        }

        if (!isEstimation) {
            let itemsTotal = 0;
            items.forEach(item => {
                let lineTotal = 0;
                switch ((item.billingUnit || 'pieces').toLowerCase()) {
                    case 'sqft': lineTotal = (item.totalSqFt || 0) * (item.price || 0); break;
                    case 'boxes': lineTotal = (item.boxCount || 0) * (item.price || 0); break;
                    default: lineTotal = (item.quantity || 0) * (item.price || 0);
                }
                itemsTotal += lineTotal;
            });
            const newInvoiceAmount = itemsTotal + (Number(loadingCharges) || 0) + (Number(unloadingCharges) || 0) + (Number(transportCharges) || 0) + (Number(taxAmount) || 0) + (Number(oldBalance) || 0) - (Number(discountAmount) || 0) - (Number(advanceAmount) || 0);
            
            const passed = await validateCustomerCreditLock(req, res, customer, newInvoiceAmount);
            if (!passed) return; // Error already sent inside helper
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
                    unloadingCharges: unloadingCharges || 0,
                    oldBalance: oldBalance || 0,
                    advanceAmount: advanceAmount || 0,
                    taxAmount: taxAmount || 0,
                    discountAmount: discountAmount || 0,
                    roundOffAmount: roundOffAmount || 0,
                    siteName: siteName || '',
                    siteAddress: siteAddress || '',
                    customerType: customerType || 'Regular Customer',
                    referredBy: referredBy || '',
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

        // ── Auto-create ledger debit entry and auto-dispatch stock ──
        if (order.customer) {
            await syncSalesOrderLedger(order._id, req.tenantId, req.user._id);
        }
        if (!order.isEstimation && order.status === 'confirmed') {
            await autoDispatchConfirmedOrder(order._id, req.tenantId, req.user._id);
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
            
            // ── Customer Credit & Lock Validation when converting to Invoice ──
            const passed = await validateCustomerCreditLock(req, res, order.customer, order.totalAmount);
            if (!passed) return; // Error already sent inside helper

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
            
            let retries = 0;
            let assigned = false;
            while (!assigned && retries < 10) {
                try {
                    const seq = await getNextSequenceValue('INV', req.tenantId);
                    order.orderNumber = `${seq}`;
                    order.status = status;
                    await order.save();
                    assigned = true;
                } catch (err) {
                    if (err.code === 11000) retries++;
                    else throw err;
                }
            }
            if (!assigned) return sendError(res, 500, 'Failed to generate a unique invoice number');
        } else {
            order.status = status;
            await order.save();
        }

        if (order.customer) {
            await syncSalesOrderLedger(order._id, req.tenantId, req.user._id);
        }
        if (order.status === 'confirmed' && !order.isEstimation) {
            await autoDispatchConfirmedOrder(order._id, req.tenantId, req.user._id);
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
            loadingCharges, transportCharges, unloadingCharges, oldBalance, advanceAmount, taxAmount,
            siteName, siteAddress, discountAmount, roundOffAmount,
            customerType, referredBy
        } = req.body;

        // ── Items Validation ──
        if (!items || !Array.isArray(items) || items.length === 0) {
            return sendError(res, 400, 'Cannot save an empty bill. Please add at least one item.');
        }

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

        let order = await SalesOrder.findOne({ _id: req.params.id, ...tenantQuery(req) });

        if (!order) {
            // Fallback for cross-tenant edge cases
            order = await SalesOrder.findById(req.params.id);
            if (!order) {
                return sendError(res, 404, 'Sales order not found');
            }
        }

        // Only allow editing if user is admin, manager, or sales person
        const isAdmin = ['super_admin', 'admin', 'tenant_owner', 'tenant_admin', 'manager', 'sales_person', 'sales person', 'sales user', 'sales_user'].includes(req.user.role);
        if (!isAdmin) {
            return sendError(res, 403, 'Permission denied: Only administrators and sales persons can edit bills');
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
        if (unloadingCharges !== undefined) order.unloadingCharges = unloadingCharges;
        if (transportCharges !== undefined) order.transportCharges = transportCharges;
        if (oldBalance !== undefined) order.oldBalance = oldBalance;
        if (advanceAmount !== undefined) order.advanceAmount = advanceAmount;
        if (taxAmount !== undefined) order.taxAmount = taxAmount;
        if (discountAmount !== undefined) order.discountAmount = discountAmount;
        if (roundOffAmount !== undefined) order.roundOffAmount = roundOffAmount;
        if (siteName !== undefined) order.siteName = siteName;
        if (siteAddress !== undefined) order.siteAddress = siteAddress;
        if (customerType !== undefined) order.customerType = customerType;
        if (referredBy !== undefined) order.referredBy = referredBy;

        // totalAmount calculation
        const itemsTotal = order.items.reduce((sum, item) => sum + (item.total || 0), 0);
        order.totalAmount = (
            itemsTotal + 
            Number(order.loadingCharges) + 
            Number(order.unloadingCharges || 0) +
            Number(order.transportCharges) + 
            Number(order.taxAmount) + 
            Number(order.oldBalance) -
            Number(order.discountAmount || 0) -
            Number(order.advanceAmount) +
            Number(order.roundOffAmount || 0)
        );

        await order.save();

        if (order.customer) {
            await syncSalesOrderLedger(order._id, req.tenantId, req.user._id);
        }

        // Log the edit action
        await ActionLog.create({
            tenantId: req.tenantId,
            user: req.user._id,
            userName: req.user.name || req.user.email || 'Unknown',
            userRole: req.user.role,
            action: 'EDIT_INVOICE',
            entityType: 'SalesOrder',
            entityId: order._id,
            entityNumber: order.orderNumber,
            description: `Edited invoice/estimation ${order.orderNumber}`
        });

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
                    
                    // Revert batch quantity using batchAllocations
                    let usedBatchNumber = null;
                    let batchId = null;
                    
                    if (dispatchItem.batchAllocations && dispatchItem.batchAllocations.length > 0) {
                        for (const alloc of dispatchItem.batchAllocations) {
                            if (alloc.batchId && itemDoc.batches) {
                                const batch = itemDoc.batches.id(alloc.batchId);
                                if (batch) {
                                    batch.quantity += alloc.quantity;
                                }
                            }
                        }
                        usedBatchNumber = 'MULTIPLE'; // simplified for logs
                    } else {
                        // Fallback to legacy logic
                        const orderItem = order.items.find(oi => oi.item.toString() === dispatchItem.item.toString());
                        batchId = orderItem?.batchId;
                        if (batchId && itemDoc.batches) {
                            const batch = itemDoc.batches.id(batchId);
                            if (batch) {
                                batch.quantity += revertQty;
                                usedBatchNumber = batch.batchNumber;
                            }
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
