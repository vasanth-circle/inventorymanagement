import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Category name is required'],
        unique: true,
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
}, {
    timestamps: true,
});

const Category = appConn.model('Category', categorySchema);

export default Category;
