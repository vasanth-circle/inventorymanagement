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
    hsn: {
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
    damagedQuantity: {
        type: Number,
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
    brand: {
        type: String,
        trim: true,
    },
    size: {
        type: String, // e.g., '4x4', '18x12'
        trim: true,
    },
    pcsPerBox: {
        type: Number,
        default: 1,
        min: 1,
    },
    sqFtPerPc: {
        type: Number,
        default: 0,
        min: 0,
    },
    customFields: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {},
    },
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant ID is required'],
        index: true,
    },
    batches: [{
        batchNumber: { type: String, trim: true },
        quantity: { type: Number, default: 0 },
        price: { type: Number, required: true }, // Selling price for this specific batch
        purchasePrice: { type: Number, default: 0 },
        receivedDate: { type: Date, default: Date.now },
    }],
}, {
    timestamps: true,
});

// Indexes for search optimization
itemSchema.index({ name: 'text', barcode: 'text', description: 'text', tenantId: 1 });
itemSchema.index({ tenantId: 1, category: 1 });
itemSchema.index({ tenantId: 1, quantity: 1 });

// Unique per tenant, but only if SKU/Barcode is provided (Partial Index)
itemSchema.index({ sku: 1, tenantId: 1 }, { 
    unique: true, 
    partialFilterExpression: { sku: { $type: "string", $gt: "" } } 
});

itemSchema.index({ barcode: 1, tenantId: 1 }, { 
    unique: true, 
    partialFilterExpression: { barcode: { $type: "string", $gt: "" } } 
});

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
