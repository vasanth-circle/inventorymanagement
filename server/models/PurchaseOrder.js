import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const purchaseOrderSchema = new mongoose.Schema({
    orderNumber: {
        type: String,
        required: true,
    },
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant ID is required'],
        index: true,
    },
    vendor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
        required: [true, 'Vendor is required'],
    },
    items: [{
        item: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Item',
            required: true,
        },
        name: String,
        quantity: { // This will represent Total SqFt for tiles
            type: Number,
            required: true,
            min: 0,
        },
        boxCount: {
            type: Number,
            default: 0,
        },
        pcsPerBox: {
            type: Number,
            default: 1,
        },
        sqFtPerPc: {
            type: Number,
            default: 0,
        },
        totalSqFt: {
            type: Number,
            default: 0,
        },
        damagedQuantity: {
            type: Number,
            default: 0,
        },
        price: { // Rate per SqFt
            type: Number,
            required: true,
        },
        total: Number,
        taxRate: {
            type: Number,
            default: 0,
        },
        taxAmount: {
            type: Number,
            default: 0,
        },
        hsnCode: {
            type: String,
            trim: true,
        },
    }],
    itemsTotal: {
        type: Number,
        default: 0,
    },
    taxRate: {
        type: Number,
        default: 0,
    },
    taxAmount: {
        type: Number,
        default: 0,
    },
    totalAmount: {
        type: Number,
        required: true,
    },
    roundOffAmount: {
        type: Number,
        default: 0,
    },
    status: {
        type: String,
        enum: ['draft', 'issued', 'received', 'billed', 'void'],
        default: 'draft',
    },
    vendorBillNumber: {
        type: String,
        trim: true,
    },
    billDate: {
        type: Date,
    },
    orderDate: {
        type: Date,
        default: Date.now,
    },
    expectedDeliveryDate: Date,
    notes: String,
    // ─── Landed Costs ─────────────────────────────────────────────────────
    landedCosts: [{
        type: { type: String, enum: ['freight', 'customs', 'insurance', 'handling', 'other'], default: 'other' },
        description: { type: String, trim: true },
        amount: { type: Number, default: 0, min: 0 },
        allocationMethod: { type: String, enum: ['proportional', 'quantity', 'manual'], default: 'proportional' },
    }],
    // ─── GRN Linkage ───────────────────────────────────────────────────
    grnIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'GoodsReceiptNote' }],
    receivedStatus: {
        type: String,
        enum: ['not_received', 'partially_received', 'fully_received'],
        default: 'not_received',
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    }
}, {
    timestamps: true,
});

purchaseOrderSchema.pre('validate', function (next) {
    this.items.forEach(item => {
        // If totalSqFt is provided (tiles), use it for the final amount
        if (item.totalSqFt > 0) {
            item.quantity = item.totalSqFt;
            item.total = item.totalSqFt * item.price;
        } else {
            item.total = item.quantity * item.price;
        }
        // Per-item tax calculation
        const itemTaxRate = parseFloat(item.taxRate) || 0;
        item.taxAmount = item.total * itemTaxRate / 100;
    });
    this.itemsTotal = this.items.reduce((sum, item) => sum + item.total, 0);
    // Total tax = sum of all per-item taxes
    this.taxAmount = this.items.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
    this.totalAmount = this.itemsTotal + this.taxAmount + (Number(this.roundOffAmount) || 0);
    next();
});

purchaseOrderSchema.index({ orderNumber: 1, tenantId: 1 }, { unique: true });
purchaseOrderSchema.index({ vendor: 1, tenantId: 1 });

const PurchaseOrder = appConn.model('PurchaseOrder', purchaseOrderSchema);

export default PurchaseOrder;
