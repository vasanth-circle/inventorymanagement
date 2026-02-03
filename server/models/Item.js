import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Item name is required'],
        trim: true,
    },
    barcode: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
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
        default: 'Main Warehouse',
    },
    image: {
        type: String,
        default: '',
    },
    customFields: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {},
    },
}, {
    timestamps: true,
});

// Indexes for search optimization
itemSchema.index({ name: 'text', barcode: 'text' });
itemSchema.index({ category: 1 });
itemSchema.index({ quantity: 1 });

// Virtual field for stock status
itemSchema.virtual('stockStatus').get(function () {
    if (this.quantity === 0) return 'out-of-stock';
    if (this.quantity <= this.minStockThreshold) return 'low-stock';
    return 'in-stock';
});

// Ensure virtuals are included in JSON
itemSchema.set('toJSON', { virtuals: true });
itemSchema.set('toObject', { virtuals: true });

const Item = mongoose.model('Item', itemSchema);

export default Item;
