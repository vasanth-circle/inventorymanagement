import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const itemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Item name is required'],
        trim: true,
    },
    barcode: {
        type: String,
        trim: true,
    },
    sku: {
        type: String,
        trim: true,
        uppercase: true,
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: [true, 'Category is required'],
    },
    quantity: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    minStockThreshold: {
        type: Number,
        default: 10,
        min: 0,
    },
    price: {
        type: Number,
        required: [true, 'Price is required'],
        min: 0,
    },
    location: {
        type: String,
        trim: true,
    },
    image: {
        type: String,
        default: '',
    },
    description: {
        type: String,
        trim: true,
    },
    customFields: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {},
    },
    tenantId: {
        type: String,
        required: [true, 'Tenant ID is required'],
        index: true,
    },
}, {
    timestamps: true,
});

// Indexes for search optimization
itemSchema.index({ name: 'text', barcode: 'text', description: 'text', tenantId: 1 });
itemSchema.index({ tenantId: 1, category: 1 });
itemSchema.index({ tenantId: 1, quantity: 1 });
itemSchema.index({ tenantId: 1, sku: 1 }, { unique: true });

// Virtual field for stock status
itemSchema.virtual('stockStatus').get(function () {
    if (this.quantity === 0) return 'out-of-stock';
    if (this.quantity <= this.minStockThreshold) return 'low-stock';
    return 'in-stock';
});

// Ensure virtuals are included in JSON
itemSchema.set('toJSON', { virtuals: true });
itemSchema.set('toObject', { virtuals: true });

const Item = appConn.model('Item', itemSchema);

export default Item;
