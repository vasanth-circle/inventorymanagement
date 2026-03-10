import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { coreConn } from '../config/db.js';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
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
        enum: ['admin', 'manager', 'staff', 'tenant_owner'],
        default: 'staff',
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    menuAccess: {
        type: String,
        enum: ['all', 'specific', null],
        default: 'all',
    },
    allowedMenus: {
        type: [String],
        default: [],
    },
    tenantId: {
        type: String,
        trim: true,
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
    // If the hash in the DB is not a bcrypt hash, this will return false
    // Most modern core DBs use bcrypt.
    return await bcrypt.compare(candidatePassword, this.password);
};

// Check if model already exists on this connection
const User = coreConn.models.User || coreConn.model('User', userSchema);

export default User;
