import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Category name is required'],
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    tenantId: {
        type: String,
        required: [true, 'Tenant ID is required'],
        index: true,
    },
}, {
    timestamps: true,
});

// Category name must be unique within a tenant
categorySchema.index({ name: 1, tenantId: 1 }, { unique: true });

const Category = appConn.model('Category', categorySchema);

export default Category;
