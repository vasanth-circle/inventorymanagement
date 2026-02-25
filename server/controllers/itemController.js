import Item from '../models/Item.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for image upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'item-' + uniqueSuffix + path.extname(file.originalname));
    }
});

export const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// @desc    Get all items with pagination and filtering
// @route   GET /api/items
// @access  Private
export const getItems = async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = '',
            category = '',
            status = '',
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const query = {};

        // Search by name or barcode
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { barcode: { $regex: search, $options: 'i' } }
            ];
        }

        // Filter by category
        if (category) {
            query.category = category;
        }

        // Filter by stock status
        if (status === 'low-stock') {
            query.$expr = { $lte: ['$quantity', '$minStockThreshold'] };
        } else if (status === 'out-of-stock') {
            query.quantity = 0;
        } else if (status === 'in-stock') {
            query.$expr = { $gt: ['$quantity', '$minStockThreshold'] };
        }

        const sort = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        const items = await Item.find(query)
            .populate('category', 'name')
            .sort(sort)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const count = await Item.countDocuments(query);

        res.json({
            items,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            totalItems: count,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single item
// @route   GET /api/items/:id
// @access  Private
export const getItem = async (req, res, next) => {
    try {
        const item = await Item.findById(req.params.id).populate('category', 'name');

        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }

        res.json(item);
    } catch (error) {
        next(error);
    }
};

// @desc    Create new item
// @route   POST /api/items
// @access  Private
export const createItem = async (req, res, next) => {
    try {
        const itemData = { ...req.body };

        if (req.file) {
            itemData.image = `/uploads/${req.file.filename}`;
        }

        const item = await Item.create(itemData);
        const populatedItem = await Item.findById(item._id).populate('category', 'name');

        res.status(201).json(populatedItem);
    } catch (error) {
        next(error);
    }
};

// @desc    Update item
// @route   PUT /api/items/:id
// @access  Private
export const updateItem = async (req, res, next) => {
    try {
        const item = await Item.findById(req.params.id);

        if (!item) {
            return sendError(res, 404, 'Item not found');
        }

        const updateData = { ...req.body };

        // Prevent direct quantity updates
        if (updateData.quantity !== undefined) {
            delete updateData.quantity;
            // Or throw an error:
            // return sendError(res, 400, 'Quantity cannot be updated directly. Please use the Transactions menu.');
        }

        if (req.file) {
            updateData.image = `/uploads/${req.file.filename}`;
        }

        const updatedItem = await Item.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).populate('category', 'name');

        sendResponse(res, 200, updatedItem, 'Item updated successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Delete item
// @route   DELETE /api/items/:id
// @access  Private/Admin
export const deleteItem = async (req, res, next) => {
    try {
        const item = await Item.findById(req.params.id);

        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }

        await Item.findByIdAndDelete(req.params.id);

        res.json({ message: 'Item deleted successfully' });
    } catch (error) {
        next(error);
    }
};
