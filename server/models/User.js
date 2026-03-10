import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { authConn } from '../config/db.js';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: 6,
        select: false,
    },
    role: {
        type: String,
        enum: ['admin', 'manager', 'staff'],
        default: 'staff',
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    menuAccess: {
        type: String,
        enum: ['all', 'specific'],
        default: 'all',
    },
    allowedMenus: {
        type: [String],
        default: [],
        validate: {
            validator: function (menus) {
                const validMenus = ['dashboard', 'inventory', 'stock-inward', 'stock-outward', 'stock-return', 'scan-bill', 'returns', 'reports', 'users'];
                return menus.every(menu => validMenus.includes(menu));
            },
            message: 'Invalid menu identifier'
        }
    },
}, {
    timestamps: true,
});

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

const User = authConn.model('User', userSchema);

export default User;
