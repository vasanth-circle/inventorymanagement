import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const imageSchema = new mongoose.Schema({
    url: {
        type: String,
        required: [true, 'Image URL is required'],
        trim: true,
    },
    title: {
        type: String,
        trim: true,
        default: '',
    },
    description: {
        type: String,
        trim: true,
        default: '',
    },
    order: {
        type: Number,
        default: 0,
    },
}, { _id: true });

const productShowcaseSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Item',
        default: null,
    },
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant ID is required'],
        index: true,
    },
    name: {
        type: String,
        required: [true, 'Showcase name is required'],
        trim: true,
    },
    slug: {
        type: String,
        required: [true, 'Slug is required'],
        trim: true,
        lowercase: true,
    },
    description: {
        type: String,
        trim: true,
        default: '',
    },
    images: {
        type: [imageSchema],
        default: [],
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    qrCodeUrl: {
        type: String,
        trim: true,
        default: '',
    },
    scanCount: {
        type: Number,
        default: 0,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
}, {
    timestamps: true,
});

// Slug must be unique per tenant
productShowcaseSchema.index({ slug: 1, tenantId: 1 }, { unique: true });
productShowcaseSchema.index({ tenantId: 1, isActive: 1 });

// Check if model already registered on this connection (avoids re-compile on hot-reload)
const ProductShowcase = appConn.models.ProductShowcase
    || appConn.model('ProductShowcase', productShowcaseSchema);

export default ProductShowcase;
