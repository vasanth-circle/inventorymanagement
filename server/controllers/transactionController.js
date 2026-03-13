import Item from '../models/Item.js';
import Transaction from '../models/Transaction.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';

// @desc    Create stock inward transaction
// @route   POST /api/transactions/inward
// @access  Private
export const stockInward = async (req, res, next) => {
    try {
        const { item, quantity, reason, notes } = req.body;

        const itemDoc = await Item.findOne({ _id: item, tenantId: req.tenantId });
        if (!itemDoc) {
            return sendError(res, 404, 'Item not found');
        }

        const previousQuantity = itemDoc.quantity;
        const newQuantity = previousQuantity + parseInt(quantity);

        // Update item quantity
        itemDoc.quantity = newQuantity;
        await itemDoc.save();

        // Create transaction record
        const transaction = await Transaction.create({
            item,
            type: 'inward',
            quantity,
            reason,
            notes,
            user: req.user._id,
            previousQuantity,
            newQuantity,
            toLocation: itemDoc.location,
            tenantId: req.tenantId
        });

        const populatedTransaction = await Transaction.findOne({ _id: transaction._id, tenantId: req.tenantId })
            .populate('item', 'name barcode')
            .populate('user', 'name email');

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
            .populate('user', 'name email');

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
        const { item, quantity, reason, notes } = req.body;

        const itemDoc = await Item.findOne({ _id: item, tenantId: req.tenantId });
        if (!itemDoc) {
            return sendError(res, 404, 'Item not found');
        }

        const previousQuantity = itemDoc.quantity;
        const newQuantity = previousQuantity + parseInt(quantity);

        // Update item quantity
        itemDoc.quantity = newQuantity;
        await itemDoc.save();

        // Create transaction record
        const transaction = await Transaction.create({
            item,
            type: 'return',
            quantity,
            reason,
            notes,
            user: req.user._id,
            previousQuantity,
            newQuantity,
            toLocation: itemDoc.location,
            tenantId: req.tenantId
        });

        const populatedTransaction = await Transaction.findOne({ _id: transaction._id, tenantId: req.tenantId })
            .populate('item', 'name barcode')
            .populate('user', 'name email');

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
            .populate('user', 'name email');

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
            .populate('user', 'name email')
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

// @desc    Get transaction history for an item
// @route   GET /api/transactions/item/:itemId
// @access  Private
export const getItemHistory = async (req, res, next) => {
    try {
        const transactions = await Transaction.find({ item: req.params.itemId, tenantId: req.tenantId })
            .populate('user', 'name email')
            .sort({ createdAt: -1 });

        res.json(transactions);
    } catch (error) {
        next(error);
    }
};
