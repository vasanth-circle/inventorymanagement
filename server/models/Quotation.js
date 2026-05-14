import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const quotationSchema = new mongoose.Schema({
    quotationNumber: {
        type: String,
        required: true,
    },
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant ID is required'],
        index: true,
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: [true, 'Customer is required'],
    },
    status: {
        type: String,
        enum: ['draft', 'sent', 'accepted', 'rejected', 'converted'],
        default: 'draft',
    },
    validUntil: {
        type: Date,
        default: () => {
            const d = new Date();
            d.setDate(d.getDate() + 30);
            return d;
        },
    },
    items: [{
        item: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Item',
            required: true,
        },
        name: String,
        brand: String,
        size: String,
        hsn: String,
        // Generic qty fields — used based on tenant unitConfig
        primaryQty: { type: Number, default: 0 },     // e.g. SqFt / Pieces / Boxes
        secondaryQty: { type: Number, default: 0 },   // e.g. Boxes when primary is SqFt
        unitLabel: { type: String, default: 'units' },
        rateLabel: { type: String, default: 'per unit' },
        quantity: { type: Number, required: true, min: 0 }, // used for total calc
        price: { type: Number, required: true },
        total: { type: Number, default: 0 },
        boxCount: { type: Number, default: 0 },
        totalSqFt: { type: Number, default: 0 },
        billingUnit: { type: String, default: 'pieces' }, // pieces, boxes, sqft
        stockQty: { type: Number, default: 0 },         // Physical qty to deduct (usually boxes or pcs)
        stockUnit: { type: String, default: 'pieces' }, // boxes, pieces
    }],

    // Totals
    itemsTotal: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    loadingCharges: { type: Number, default: 0 },
    unloadingCharges: { type: Number, default: 0 },
    transportCharges: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    oldBalance: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },

    // Conversion tracking
    convertedToInvoice: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SalesOrder',
        default: null,
    },
    convertedAt: { type: Date, default: null },

    // Meta
    notes: String,
    terms: String,
    quotationDate: { type: Date, default: Date.now },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
}, { timestamps: true });

// Auto-calculate totals before save
quotationSchema.pre('validate', function (next) {
    this.items.forEach(item => {
        item.total = item.quantity * item.price;
    });
    this.itemsTotal = this.items.reduce((sum, item) => sum + item.total, 0);
    this.totalAmount = (
        this.itemsTotal +
        (Number(this.loadingCharges) || 0) +
        (Number(this.unloadingCharges) || 0) +
        (Number(this.transportCharges) || 0) +
        (Number(this.taxAmount) || 0) +
        (Number(this.oldBalance) || 0) -
        (Number(this.discountAmount) || 0)
    );
    next();
});

quotationSchema.index({ quotationNumber: 1, tenantId: 1 }, { unique: true });
quotationSchema.index({ customer: 1, tenantId: 1 });
quotationSchema.index({ status: 1, tenantId: 1 });

const Quotation = appConn.model('Quotation', quotationSchema);
export default Quotation;
