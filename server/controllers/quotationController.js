import Quotation from '../models/Quotation.js';
import SalesOrder from '../models/SalesOrder.js';
import Item from '../models/Item.js';
import User from '../models/User.js';
import CustomerLedger from '../models/CustomerLedger.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';
import { tenantQuery } from '../utils/tenantQuery.js';
import { getNextSequenceValue } from '../utils/sequence.js';
import Setting from '../models/Setting.js';

// @desc    Get all quotations for the tenant
// @route   GET /api/quotations
// @access  Private
export const getQuotations = async (req, res, next) => {
    try {
        const quotations = await Quotation.find({ ...tenantQuery(req) })
            .populate('customer', 'name companyName phone')
            .populate('items.item', 'name brand size')
            .populate('user', 'name')
            .sort({ createdAt: -1 });

        sendResponse(res, 200, { quotations });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single quotation
// @route   GET /api/quotations/:id
// @access  Private
export const getQuotation = async (req, res, next) => {
    try {
        const quotation = await Quotation.findOne({ _id: req.params.id, ...tenantQuery(req) })
            .populate('customer', 'name companyName phone address')
            .populate('items.item');

        if (!quotation) return sendError(res, 404, 'Quotation not found');
        sendResponse(res, 200, { quotation });
    } catch (error) {
        next(error);
    }
};

// @desc    Create quotation
// @route   POST /api/quotations
// @access  Private
export const createQuotation = async (req, res, next) => {
    try {
        let { quotationNumber } = req.body;
        
        // Auto-generate quotation number if not provided
        if (!quotationNumber) {
            const settings = await Setting.findOne({ tenantId: req.tenantId });
            const prefix = settings?.documentConfig?.quotationPrefix || 'QUO';
            const maxSeq = settings?.documentConfig?.quotationMaxNumber || 500;
            const startSeq = settings?.documentConfig?.quotationStartNumber || 1;
            const padding = settings?.documentConfig?.quotationPadding || 3;
            const sequence = await getNextSequenceValue('quotation', req.tenantId, maxSeq, startSeq);
            quotationNumber = `${prefix}-${sequence.toString().padStart(padding, '0')}`;
        }
        
        // Ensure uniqueness for tenant
        const existing = await Quotation.findOne({ quotationNumber, ...tenantQuery(req) });
        if (existing) {
            // If it's a conflict and was auto-generated, try one more time with a random suffix as fallback
            // but ideally sequence should handle it.
            if (!req.body.quotationNumber) {
                 const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
                 quotationNumber = `${quotationNumber}-${randomStr}`;
            } else {
                return sendError(res, 400, 'Quotation number already exists');
            }
        }

        const quotation = await Quotation.create({
            ...req.body,
            quotationNumber,
            tenantId: req.tenantId,
            user: req.user._id,
        });

        sendResponse(res, 201, { quotation }, 'Quotation created successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Update quotation
// @route   PUT /api/quotations/:id
// @access  Private
export const updateQuotation = async (req, res, next) => {
    try {
        const quotation = await Quotation.findOneAndUpdate(
            { _id: req.params.id, ...tenantQuery(req) },
            req.body,
            { new: true, runValidators: true }
        );

        if (!quotation) return sendError(res, 404, 'Quotation not found');
        sendResponse(res, 200, { quotation }, 'Quotation updated successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Delete/Reject quotation
// @route   DELETE /api/quotations/:id
// @access  Private
export const deleteQuotation = async (req, res, next) => {
    try {
        const quotation = await Quotation.findOne({ _id: req.params.id, ...tenantQuery(req) });
        if (!quotation) return sendError(res, 404, 'Quotation not found');

        quotation.status = 'rejected';
        await quotation.save();

        sendResponse(res, 200, null, 'Quotation marked as rejected');
    } catch (error) {
        next(error);
    }
};

// @desc    Convert Quotation to Invoice (Sales Order)
// @route   POST /api/quotations/:id/convert
// @access  Private
export const convertToInvoice = async (req, res, next) => {
    try {
        const quotation = await Quotation.findOne({ _id: req.params.id, ...tenantQuery(req) })
            .populate('items.item');
            
        if (!quotation) return sendError(res, 404, 'Quotation not found');
        if (quotation.status === 'converted') return sendError(res, 400, 'Already converted to invoice');

        // STRICT STOCK VALIDATION BEFORE CONVERSION
        for (const qItem of quotation.items) {
            const itemDoc = await Item.findOne({ _id: qItem.item._id, ...tenantQuery(req) });
            if (!itemDoc) return sendError(res, 404, `Item ${qItem.name} not found`);

            const requiredQty = qItem.stockQty || qItem.quantity;
            if (itemDoc.quantity < requiredQty) {
                return sendError(res, 400, `Insufficient stock for ${itemDoc.name}. Available: ${itemDoc.quantity}, Required: ${requiredQty}. Please update stock first.`);
            }

            if (qItem.batchId && itemDoc.batches) {
                const batch = itemDoc.batches.id(qItem.batchId);
                if (batch && batch.quantity < requiredQty) {
                    return sendError(res, 400, `Insufficient stock in batch ${batch.batchNumber} for ${itemDoc.name}.`);
                }
            }
        }

        // Generate Invoice Number
        const date = new Date();
        const dateStr = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
        const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
        const invoiceNumber = `INV-${dateStr}-${randomStr}`;

        // Create Sales Order
        const salesOrder = await SalesOrder.create({
            orderNumber: invoiceNumber,
            tenantId: req.tenantId,
            customer: quotation.customer,
            quotationRef: quotation._id,
            quotationNumber: quotation.quotationNumber,
            orderDate: new Date(),
            status: 'confirmed',
            isEstimation: false,
            items: quotation.items.map(qi => ({
                item: qi.item._id,
                name: qi.name,
                brand: qi.brand,
                size: qi.size,
                hsn: qi.hsn,
                batchId: qi.batchId,
                billingUnit: qi.billingUnit,
                stockQty: qi.stockQty,
                stockUnit: qi.stockUnit,
                // Map generic qty fields to salesOrder fields
                quantity: qi.quantity,
                primaryQty: qi.primaryQty,
                secondaryQty: qi.secondaryQty,
                unitLabel: qi.unitLabel,
                price: qi.price,
                total: qi.total,
                boxCount: qi.boxCount,
                totalSqFt: qi.totalSqFt,
            })),
            itemsTotal: quotation.itemsTotal,
            taxAmount: quotation.taxAmount,
            taxRate: quotation.taxRate,
            loadingCharges: quotation.loadingCharges,
            unloadingCharges: quotation.unloadingCharges || 0,
            transportCharges: quotation.transportCharges,
            oldBalance: quotation.oldBalance || 0,
            advanceAmount: Number(req.body.advanceAmount) || 0,
            notes: quotation.notes,
            terms: quotation.terms,
            user: req.user._id,
        });

        // Link Quotation to Invoice
        quotation.status = 'converted';
        quotation.convertedToInvoice = salesOrder._id;
        quotation.convertedAt = new Date();
        await quotation.save();

        // ── Customer Ledger Entries ─────────────────────────────────────────────
        // 1) Bill entry: debit the full invoice amount (before advance)
        const grossInvoiceAmount = salesOrder.totalAmount + (Number(req.body.advanceAmount) || 0);
        const lastEntry = await CustomerLedger.findOne(
            { customer: quotation.customer, tenantId: req.tenantId }
        ).sort({ date: -1, createdAt: -1 });
        const runningBalance = lastEntry ? lastEntry.balance : 0;
        const balanceAfterBill = runningBalance + grossInvoiceAmount;

        await CustomerLedger.create({
            tenantId: req.tenantId,
            customer: quotation.customer,
            date: new Date(),
            type: 'bill',
            refType: 'SalesOrder',
            refId: salesOrder._id,
            refNumber: salesOrder.orderNumber,
            description: `Invoice ${salesOrder.orderNumber} (from ${quotation.quotationNumber})`,
            debit: grossInvoiceAmount,
            credit: 0,
            balance: balanceAfterBill,
            createdBy: req.user._id,
            notes: `Converted from quotation ${quotation.quotationNumber}`,
        });

        // 2) If advance was collected, add a payment credit entry
        const advAmt = Number(req.body.advanceAmount) || 0;
        if (advAmt > 0) {
            const balanceAfterAdvance = balanceAfterBill - advAmt;
            await CustomerLedger.create({
                tenantId: req.tenantId,
                customer: quotation.customer,
                date: new Date(),
                type: 'payment',
                refType: 'SalesOrder',
                refId: salesOrder._id,
                refNumber: salesOrder.orderNumber,
                description: `Advance payment against ${salesOrder.orderNumber}`,
                debit: 0,
                credit: advAmt,
                balance: balanceAfterAdvance,
                paymentMode: 'cash',
                createdBy: req.user._id,
                notes: `Advance collected at time of invoice conversion`,
            });
        }
        // ───────────────────────────────────────────────────────────────────────

        sendResponse(res, 201, { salesOrder }, 'Quotation converted to Invoice successfully');
    } catch (error) {
        next(error);
    }
};
