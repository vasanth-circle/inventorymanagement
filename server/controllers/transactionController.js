import Item from '../models/Item.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { sendResponse, sendError } from '../utils/standardResponse.js';

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
        const { item: itemId, quantity, damagedQuantity, reason, notes } = req.body;

        let invoiceImage = '';
        if (req.file) {
            invoiceImage = `/uploads/invoices/${req.file.filename}`;
        }

        const itemDoc = await Item.findOne({ _id: itemId, tenantId: req.tenantId });
        if (!itemDoc) {
            return sendError(res, 404, 'Item not found');
        }

        const previousQuantity = itemDoc.quantity;
        const newQuantity = previousQuantity + parseInt(quantity);
        const dmgQty = parseInt(damagedQuantity) || 0;

        // Update item quantity
        itemDoc.quantity = newQuantity;
        if (dmgQty > 0) {
            itemDoc.damagedQuantity = (itemDoc.damagedQuantity || 0) + dmgQty;
        }
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
            tenantId: req.tenantId
        });

        const populatedTransaction = await Transaction.findOne({ _id: transaction._id, tenantId: req.tenantId })
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
        const { item, quantity, reason, notes } = req.body;

        const itemDoc = await Item.findOne({ _id: item, tenantId: req.tenantId });
        if (!itemDoc) {
            return sendError(res, 404, 'Item not found');
        }

        if (itemDoc.quantity < quantity) {
            return sendError(res, 400, 'Insufficient stock available');
        }

        const previousQuantity = itemDoc.quantity;
        const newQuantity = previousQuantity - parseInt(quantity);

        // Update item quantity
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
            tenantId: req.tenantId
        });

        const populatedTransaction = await Transaction.findOne({ _id: transaction._id, tenantId: req.tenantId })
            .populate('item', 'name barcode')
            .populate({ path: 'user', model: User, select: 'name email' });

        res.status(201).json(populatedTransaction);
    } catch (error) {
        next(error);
    }
};

// @desc    Create stock return transaction
// @route   POST /api/transactions/return
// @access  Private
export const stockReturn = async (req, res, next) => {
    try {
        const { item, quantity, returnType, reason, notes } = req.body;

        const itemDoc = await Item.findOne({ _id: item, tenantId: req.tenantId });
        if (!itemDoc) {
            return sendError(res, 404, 'Item not found');
        }

        const previousQuantity = itemDoc.quantity;
        let newQuantity = previousQuantity;
        let finalReason = reason;
        
        if (returnType === 'vendor') {
            if (previousQuantity < quantity) {
                return sendError(res, 400, 'Insufficient stock to return to vendor');
            }
            newQuantity -= parseInt(quantity);
            if (!finalReason) finalReason = 'Return to Vendor';
        } else {
            // Default is customer return (inward to stock)
            newQuantity += parseInt(quantity);
            if (!finalReason) finalReason = 'Customer Return';
        }

        // Update item quantity
        itemDoc.quantity = newQuantity;
        await itemDoc.save();

        // Create transaction record
        const transaction = await Transaction.create({
            item,
            type: 'return', // Could be 'return_outward' or 'outward', but keeping 'return' for logs.
            quantity,
            reason: finalReason,
            notes,
            user: req.user._id,
            previousQuantity,
            newQuantity,
            toLocation: itemDoc.location,
            tenantId: req.tenantId
        });

        const populatedTransaction = await Transaction.findOne({ _id: transaction._id, tenantId: req.tenantId })
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

        const itemDoc = await Item.findOne({ _id: item, tenantId: req.tenantId });
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

        const populatedTransaction = await Transaction.findOne({ _id: transaction._id, tenantId: req.tenantId })
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

        const query = { tenantId: req.tenantId };

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

        const itemDoc = await Item.findOne({ _id: item, tenantId: req.tenantId });
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
        const transactions = await Transaction.find({ item: req.params.itemId, tenantId: req.tenantId })
            .populate({ path: 'user', model: User, select: 'name email' })
            .sort({ createdAt: -1 });

        res.json(transactions);
    } catch (error) {
        next(error);
    }
};
