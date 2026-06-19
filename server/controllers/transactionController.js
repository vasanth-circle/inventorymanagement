import Item from '../models/Item.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import VendorLedger from '../models/VendorLedger.js';
import CustomerLedger from '../models/CustomerLedger.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { sendResponse, sendError } from '../utils/standardResponse.js';
import { tenantQuery } from '../utils/tenantQuery.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for invoice image upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads/invoices');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'invoice-' + uniqueSuffix + path.extname(file.originalname));
    }
});

export const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype || extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image or PDF files are allowed for invoices'));
        }
    }
});

// @desc    Create stock inward transaction
// @route   POST /api/transactions/inward
// @access  Private
export const stockInward = async (req, res, next) => {
    try {
        const { item: itemId, quantity, damagedQuantity, reason, notes, batchNumber, price, expiryDate, vendor, billNumber } = req.body;

        let invoiceImage = '';
        if (req.file) {
            invoiceImage = `/uploads/invoices/${req.file.filename}`;
        }

        const itemDoc = await Item.findOne({ _id: itemId, ...tenantQuery(req) });
        if (!itemDoc) {
            return sendError(res, 404, 'Item not found');
        }

        const qty = parseInt(quantity);
        const previousQuantity = itemDoc.quantity;
        const newQuantity = previousQuantity + qty;
        const dmgQty = parseInt(damagedQuantity) || 0;
        const rate = parseFloat(price) || itemDoc.price;

        // Update item quantity
        itemDoc.quantity = newQuantity;
        if (dmgQty > 0) {
            itemDoc.damagedQuantity = (itemDoc.damagedQuantity || 0) + dmgQty;
        }

        // Handle Batches
        if (!itemDoc.batches) itemDoc.batches = [];
        
        let batch = itemDoc.batches.find(b => b.price === rate && (batchNumber ? b.batchNumber === batchNumber : true));
        
        if (batch) {
            batch.quantity += qty;
            if (expiryDate) batch.expiryDate = expiryDate;
        } else {
            itemDoc.batches.push({
                batchNumber: batchNumber || `B-${Date.now()}`,
                quantity: qty,
                price: rate,
                expiryDate: expiryDate,
                receivedDate: Date.now()
            });
            batch = itemDoc.batches[itemDoc.batches.length - 1];
        }

        itemDoc.purchasePrice = rate;
        await itemDoc.save();

        // Create transaction record
        const transaction = await Transaction.create({
            item: itemId,
            type: 'inward',
            quantity,
            damagedQuantity: dmgQty,
            reason,
            notes,
            user: req.user._id,
            previousQuantity,
            newQuantity,
            toLocation: itemDoc.location,
            invoiceImage,
            batchId: batch._id,
            batchNumber: batch.batchNumber,
            tenantId: req.tenantId
        });

        // Create Vendor Ledger Entry if vendor is provided
        if (vendor) {
            const totalAmount = qty * rate;
            const lastEntry = await VendorLedger.findOne({ vendor, tenantId: req.tenantId }).sort({ date: -1, createdAt: -1 });
            const currentBalance = lastEntry ? lastEntry.balance : 0;
            const newBalance = currentBalance + totalAmount;

            await VendorLedger.create({
                tenantId: req.tenantId,
                vendor,
                date: Date.now(),
                type: 'bill',
                refType: 'Manual',
                refNumber: billNumber || `INW-${Date.now()}`,
                description: `Stock Inward: ${itemDoc.name} (${qty} qty)`,
                credit: totalAmount,
                balance: newBalance,
                createdBy: req.user._id,
                notes: notes || 'Automated entry from stock inward'
            });
        }

        const populatedTransaction = await Transaction.findOne({ _id: transaction._id, ...tenantQuery(req) })
            .populate('item', 'name barcode')
            .populate({ path: 'user', model: User, select: 'name email' });

        sendResponse(res, 201, populatedTransaction, 'Stock inward recorded successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Create stock outward transaction
// @route   POST /api/transactions/outward
// @access  Private
export const stockOutward = async (req, res, next) => {
    try {
        const { item, quantity, reason, notes, batchId } = req.body;

        const itemDoc = await Item.findOne({ _id: item, ...tenantQuery(req) });
        if (!itemDoc) {
            return sendError(res, 404, 'Item not found');
        }

        const qtyToSubtract = parseInt(quantity);
        if (itemDoc.quantity < qtyToSubtract) {
            return sendError(res, 400, 'Insufficient total stock available');
        }

        const previousQuantity = itemDoc.quantity;
        const newQuantity = previousQuantity - qtyToSubtract;

        let selectedBatchNumber = '';
        let selectedBatchId = '';

        // Handle Batch deduction
        if (batchId) {
            const batch = itemDoc.batches.id(batchId);
            if (!batch || batch.quantity < qtyToSubtract) {
                return sendError(res, 400, 'Insufficient stock in selected batch');
            }
            batch.quantity -= qtyToSubtract;
            selectedBatchNumber = batch.batchNumber;
            selectedBatchId = batch._id;
        } else {
            // FIFO deduction if no batch specificly requested
            let remaining = qtyToSubtract;
            // Sort batches by date to ensure FIFO
            const sortedBatches = itemDoc.batches.sort((a, b) => new Date(a.receivedDate) - new Date(b.receivedDate));
            
            for (const batch of sortedBatches) {
                if (remaining <= 0) break;
                const deduct = Math.min(batch.quantity, remaining);
                batch.quantity -= deduct;
                remaining -= deduct;
                if (remaining <= 0) {
                    selectedBatchNumber = batch.batchNumber;
                    selectedBatchId = batch._id;
                }
            }
        }

        // Update item total quantity
        itemDoc.quantity = newQuantity;
        await itemDoc.save();

        // Create transaction record
        const transaction = await Transaction.create({
            item,
            type: 'outward',
            quantity,
            reason,
            notes,
            user: req.user._id,
            previousQuantity,
            newQuantity,
            fromLocation: itemDoc.location,
            batchId: selectedBatchId,
            batchNumber: selectedBatchNumber,
            tenantId: req.tenantId
        });

        const populatedTransaction = await Transaction.findOne({ _id: transaction._id, ...tenantQuery(req) })
            .populate('item', 'name barcode')
            .populate({ path: 'user', model: User, select: 'name email' });

        res.status(201).json(populatedTransaction);
    } catch (error) {
        next(error);
    }
};


// @desc    Create stock transfer transaction
// @route   POST /api/transactions/transfer
// @access  Private
export const stockTransfer = async (req, res, next) => {
    try {
        const { item, quantity, fromLocation, toLocation, notes } = req.body;

        const itemDoc = await Item.findOne({ _id: item, ...tenantQuery(req) });
        if (!itemDoc) {
            return sendError(res, 404, 'Item not found');
        }

        const previousQuantity = itemDoc.quantity;

        // Update item location
        itemDoc.location = toLocation;
        await itemDoc.save();

        // Create transaction record
        const transaction = await Transaction.create({
            item,
            type: 'transfer',
            quantity,
            fromLocation,
            toLocation,
            notes,
            user: req.user._id,
            previousQuantity,
            newQuantity: previousQuantity, // Quantity doesn't change in transfer
            tenantId: req.tenantId
        });

        const populatedTransaction = await Transaction.findOne({ _id: transaction._id, ...tenantQuery(req) })
            .populate('item', 'name barcode')
            .populate({ path: 'user', model: User, select: 'name email' });

        res.status(201).json(populatedTransaction);
    } catch (error) {
        next(error);
    }
};

// @desc    Get all transactions with filtering
// @route   GET /api/transactions
// @access  Private
export const getTransactions = async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 10,
            type = '',
            item = '',
            startDate = '',
            endDate = '',
        } = req.query;

        const query = { ...tenantQuery(req) };

        if (req.query._id) {
            query._id = req.query._id;
        }

        if (type) {
            query.type = type;
        }

        if (item) {
            query.item = item;
        }

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) {
                query.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.createdAt.$lte = end;
            }
        }

        const transactions = await Transaction.find(query)
            .populate('item', 'name barcode category')
            .populate({ path: 'user', model: User, select: 'name email' })
            .populate('customer', 'name companyName phone')
            .populate('vendor', 'name companyName phone')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const count = await Transaction.countDocuments(query);

        res.json({
            transactions,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            totalTransactions: count,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create stock adjustment transaction
// @route   POST /api/transactions/adjustment
// @access  Private
export const stockAdjustment = async (req, res, next) => {
    try {
        const { item, quantity, adjustmentType, reason, notes } = req.body;

        const itemDoc = await Item.findOne({ _id: item, ...tenantQuery(req) });
        if (!itemDoc) {
            return sendError(res, 404, 'Item not found');
        }

        const previousQuantity = itemDoc.quantity;
        let newQuantity = previousQuantity;

        if (adjustmentType === 'add') {
            newQuantity += parseInt(quantity);
        } else if (adjustmentType === 'subtract') {
            newQuantity -= parseInt(quantity);
            if (newQuantity < 0) {
                return sendError(res, 400, 'Adjustment would result in negative stock');
            }
        } else {
            return sendError(res, 400, 'Adjustment type must be "add" or "subtract"');
        }

        // Update item quantity
        itemDoc.quantity = newQuantity;
        await itemDoc.save();

        // Create transaction record
        const transaction = await Transaction.create({
            item,
            type: 'adjustment',
            quantity,
            reason: reason || `Manual Adjustment (${adjustmentType})`,
            notes,
            user: req.user._id,
            previousQuantity,
            newQuantity,
            tenantId: req.tenantId
        });

        res.status(201).json({
            success: true,
            data: transaction
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get transaction history for an item
// @route   GET /api/transactions/item/:itemId
// @access  Private
export const getItemHistory = async (req, res, next) => {
    try {
        const transactions = await Transaction.find({ item: req.params.itemId, ...tenantQuery(req) })
            .populate({ path: 'user', model: User, select: 'name email' })
            .sort({ createdAt: -1 });

        res.json(transactions);
    } catch (error) {
        next(error);
    }
};
// @desc    Create stock return transaction
// @route   POST /api/transactions/return
// @access  Private
export const stockReturn = async (req, res, next) => {
    try {
        const { item: itemId, quantity, returnType, referenceOrder, reason, notes, customer, vendor, rate } = req.body;

        const itemDoc = await Item.findOne({ _id: itemId, ...tenantQuery(req) });
        if (!itemDoc) {
            return sendError(res, 404, 'Item not found');
        }

        const qty = parseInt(quantity) || 0;
        const previousQuantity = itemDoc.quantity;
        let newQuantity = previousQuantity;

        // returnType 'customer' adds to stock, 'vendor' removes from stock
        if (returnType === 'customer') {
            newQuantity += qty;
        } else if (returnType === 'vendor') {
            if (previousQuantity < qty) {
                return sendError(res, 400, 'Insufficient stock for return to vendor');
            }
            newQuantity -= qty;
        }

        // Update item quantity
        itemDoc.quantity = newQuantity;
        await itemDoc.save();

        // Create transaction record
        const transaction = await Transaction.create({
            item: itemId,
            type: 'return',
            returnType,
            quantity: qty,
            rate: parseFloat(rate) || 0,
            referenceOrder,
            reason,
            notes,
            customer: customer || null,
            vendor: vendor || null,
            user: req.user._id,
            previousQuantity,
            newQuantity,
            tenantId: req.tenantId,
            settlementType: req.body.settlementType || 'ledger'
        });

        const totalAmount = qty * (parseFloat(rate) || 0);

        if (returnType === 'vendor' && vendor && totalAmount > 0) {
            const lastEntry = await VendorLedger.findOne({ vendor, tenantId: req.tenantId }).sort({ date: -1, createdAt: -1 });
            const currentBalance = lastEntry ? lastEntry.balance : 0;
            const newBalance = currentBalance - totalAmount; // Debit reduces liability

            await VendorLedger.create({
                tenantId: req.tenantId,
                vendor,
                date: Date.now(),
                type: 'adjustment',
                refType: 'Manual',
                refNumber: referenceOrder || `RET-${Date.now()}`,
                description: `Stock Return to Vendor: ${itemDoc.name} (${qty} qty)`,
                debit: totalAmount,
                balance: newBalance,
                createdBy: req.user._id,
                notes: notes || 'Automated entry from stock return'
            });

            if (req.body.settlementType === 'cash') {
                const finalBalance = newBalance + totalAmount; // Credit increases liability back
                await VendorLedger.create({
                    tenantId: req.tenantId,
                    vendor,
                    date: Date.now(),
                    type: 'payment',
                    refType: 'Cash',
                    refNumber: referenceOrder || `CASH-${Date.now()}`,
                    description: `Cash Received for Return: ${itemDoc.name}`,
                    credit: totalAmount,
                    balance: finalBalance,
                    createdBy: req.user._id,
                    notes: 'Immediate cash received for return'
                });
            }
        } else if (returnType === 'customer' && customer && totalAmount > 0) {
            const lastEntry = await CustomerLedger.findOne({ customer, tenantId: req.tenantId }).sort({ date: -1, createdAt: -1 });
            const currentBalance = lastEntry ? lastEntry.balance : 0;
            const newBalance = currentBalance - totalAmount; // Credit reduces customer liability (they owe less)

            await CustomerLedger.create({
                tenantId: req.tenantId,
                customer,
                date: Date.now(),
                type: 'payment',
                refType: 'Manual',
                refNumber: referenceOrder || `RET-${Date.now()}`,
                description: `Refunded Amt: ${itemDoc.name} (${qty} qty returned)`,
                credit: totalAmount,
                balance: newBalance,
                createdBy: req.user._id,
                notes: notes || 'Automated refund entry from stock return'
            });

            if (req.body.settlementType === 'cash') {
                const finalBalance = newBalance + totalAmount; // Debit increases liability back
                await CustomerLedger.create({
                    tenantId: req.tenantId,
                    customer,
                    date: Date.now(),
                    type: 'payment',
                    refType: 'Cash',
                    refNumber: referenceOrder || `CASH-${Date.now()}`,
                    description: `Cash Paid for Return: ${itemDoc.name}`,
                    debit: totalAmount,
                    balance: finalBalance,
                    createdBy: req.user._id,
                    notes: 'Immediate cash paid for return'
                });
            }
        }

        const populatedTransaction = await Transaction.findOne({ _id: transaction._id, ...tenantQuery(req) })
            .populate('item', 'name barcode')
            .populate({ path: 'user', model: User, select: 'name email' });

        sendResponse(res, 201, populatedTransaction, `Stock return from ${returnType} recorded successfully`);
    } catch (error) {
        next(error);
    }
};
