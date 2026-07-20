import Item from '../models/Item.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import SalesOrder from '../models/SalesOrder.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { tenantQuery } from '../utils/tenantQuery.js';

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
            location = '',
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const query = { ...tenantQuery(req) };
        const andConditions = [];

        // Search by name or barcode
        if (search) {
            andConditions.push({
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { barcode: { $regex: search, $options: 'i' } }
                ]
            });
        }

        // Filter by category
        if (category) {
            query.category = category;
        }

        // Filter by location
        if (location) {
            if (location === 'empty_location') {
                andConditions.push({
                    $or: [{ location: null }, { location: '' }, { location: { $exists: false } }]
                });
            } else {
                // Case-insensitive match so 'Goodown' matches 'GOODOWN' stored in DB
                andConditions.push({ location: { $regex: new RegExp(`^${location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
            }
        }


        if (andConditions.length > 0) {
            query.$and = andConditions;
        }

        // Filter by stock status
        if (status === 'low-stock') {
            query.$expr = { $lte: ['$quantity', '$minStockThreshold'] };
        } else if (status === 'out-of-stock') {
            query.quantity = 0;
        } else if (status === 'in-stock') {
            query.$expr = { $gt: ['$quantity', '$minStockThreshold'] };
        } else if (status === 'damaged') {
            query.damagedQuantity = { $gt: 0 };
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
        const item = await Item.findOne({ _id: req.params.id, ...tenantQuery(req) }).populate('category', 'name');

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

        // Parse customFields if sent as a string (from FormData)
        if (typeof itemData.customFields === 'string') {
            try {
                itemData.customFields = JSON.parse(itemData.customFields);
            } catch (e) {
                return sendError(res, 400, 'Invalid custom fields format');
            }
        }

        if (req.file) {
            itemData.image = `/uploads/${req.file.filename}`;
        }

        // Sanitize for partial indexing: empty strings should be undefined
        if (itemData.sku === '') delete itemData.sku;
        if (itemData.barcode === '') delete itemData.barcode;
        if (itemData.minStockThreshold === '') itemData.minStockThreshold = 0;
        if (itemData.price === '') itemData.price = 0;
        if (itemData.purchasePrice === '') itemData.purchasePrice = 0;

        itemData.tenantId = req.tenantId;

        const exists = await Item.findOne({ name: { $regex: new RegExp(`^${itemData.name}$`, 'i') }, ...tenantQuery(req) });
        if (exists) {
            return sendError(res, 400, 'Item with this name already exists');
        }

        const item = await Item.create(itemData);
        const populatedItem = await Item.findOne({ _id: item._id, ...tenantQuery(req) }).populate('category', 'name');

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
        const item = await Item.findOne({ _id: req.params.id, ...tenantQuery(req) });

        if (!item) {
            return sendError(res, 404, 'Item not found');
        }

        const updateData = { ...req.body };

        // Parse customFields if sent as a string (from FormData)
        if (typeof updateData.customFields === 'string') {
            try {
                updateData.customFields = JSON.parse(updateData.customFields);
            } catch (e) {
                return sendError(res, 400, 'Invalid custom fields format');
            }
        }

        // Prevent direct quantity updates
        if (updateData.quantity !== undefined) {
            delete updateData.quantity;
            // Or throw an error:
            // return sendError(res, 400, 'Quantity cannot be updated directly. Please use the Transactions menu.');
        }

        if (req.file) {
            updateData.image = `/uploads/${req.file.filename}`;
        }

        // Sanitize for partial indexing
        if (updateData.sku === '') updateData.sku = undefined;
        if (updateData.barcode === '') updateData.barcode = undefined;
        if (updateData.minStockThreshold === '') updateData.minStockThreshold = 0;
        if (updateData.price === '') updateData.price = 0;
        if (updateData.purchasePrice === '') updateData.purchasePrice = 0;

        const updatedItem = await Item.findOneAndUpdate(
            { _id: req.params.id, ...tenantQuery(req) },
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
        const item = await Item.findOne({ _id: req.params.id, ...tenantQuery(req) });

        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }

        await Item.findOneAndDelete({ _id: req.params.id, ...tenantQuery(req) });

        res.json({ message: 'Item deleted successfully' });
    } catch (error) {
        next(error);
    }
};

// @desc    Get item history (Purchases and Sales)
// @route   GET /api/items/:id/history
// @access  Private
export const getItemHistory = async (req, res, next) => {
    try {
        const itemId = req.params.id;
        
        // Fetch purchases containing this item
        const purchases = await PurchaseOrder.find({ 
            'items.item': itemId,
            ...tenantQuery(req) 
        }).populate('vendor', 'name companyName').sort({ orderDate: -1 });

        // Fetch sales containing this item
        const sales = await SalesOrder.find({ 
            'items.item': itemId,
            ...tenantQuery(req) 
        }).populate('customer', 'name companyName').sort({ orderDate: -1 });

        const history = {
            purchases: purchases.map(po => {
                const itemData = po.items.find(i => i.item.toString() === itemId);
                return {
                    id: po._id,
                    date: po.orderDate,
                    billNumber: po.vendorBillNumber || po.orderNumber,
                    partyName: po.vendor?.companyName || po.vendor?.name || 'Unknown',
                    quantity: itemData ? itemData.quantity : 0,
                    rate: itemData ? itemData.price : 0,
                };
            }),
            sales: sales.map(so => {
                const itemData = so.items.find(i => i.item.toString() === itemId);
                return {
                    id: so._id,
                    date: so.orderDate,
                    billNumber: so.orderNumber,
                    partyName: so.customer?.companyName || so.customer?.name || 'Unknown',
                    quantity: itemData ? itemData.quantity : 0,
                    rate: itemData ? itemData.price : 0,
                };
            })
        };

        sendResponse(res, 200, history, 'Item history fetched successfully');
    } catch (error) {
        next(error);
    }
};
