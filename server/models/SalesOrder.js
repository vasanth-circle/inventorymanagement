import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const salesOrderSchema = new mongoose.Schema({
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
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: [true, 'Customer is required'],
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
        batchId: String,
        batchNumber: String,
        boxCount: {
            type: Number,
            default: 0,
        },
        totalPcs: {
            type: Number,
            default: 0,
        },
        totalSqFt: {
            type: Number,
            default: 0,
        },
        billingUnit: { type: String, default: 'pieces' }, // pieces, boxes, sqft
        stockQty: { type: Number, default: 0 },         // Physical qty to deduct (usually boxes or pcs)
        stockUnit: { type: String, default: 'pieces' }, // boxes, pieces
        quantity: { // For tiles, this might be total SqFt or total Pcs depending on pricing.
            type: Number,
            required: true,
            min: 0,
        },
        price: {
            type: Number,
            required: true,
        },
        total: Number,
    }],
    totalAmount: { // Final net amount
        type: Number,
        required: true,
    },
    itemsTotal: { // Sum of individual items
        type: Number,
        default: 0,
    },
    taxAmount: {
        type: Number,
        default: 0,
    },
    loadingCharges: {
        type: Number,
        default: 0,
    },
    unloadingCharges: {
        type: Number,
        default: 0,
    },
    transportCharges: {
        type: Number,
        default: 0,
    },
    oldBalance: {
        type: Number,
        default: 0,
    },
    advanceAmount: {
        type: Number,
        default: 0,
    },
    isEstimation: {
        type: Boolean,
        default: false,
    },
    status: {
        type: String,
        enum: ['quotation', 'confirmed', 'dispatched', 'partially_dispatched', 'completed', 'cancelled', 'draft', 'packed', 'shipped', 'delivered', 'invoiced', 'void'],
        default: 'quotation',
    },
    orderDate: {
        type: Date,
        default: Date.now,
    },
    expectedShipmentDate: Date,
    notes: String,
    terms: String,
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    // Quotation conversion tracking
    quotationRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Quotation',
        default: null,
    },
    quotationNumber: { type: String, default: null },
}, {
    timestamps: true,
});

// Calculate line item totals before saving
  salesOrderSchema.pre('validate', function (next) {
    // Compute line item total based on billing unit
    this.items.forEach(item => {
      let lineTotal = 0;
      // Determine which quantity field to use
      switch ((item.billingUnit || 'pieces').toLowerCase()) {
        case 'sqft':
          lineTotal = (item.totalSqFt || 0) * (item.price || 0);
          break;
        case 'boxes':
          lineTotal = (item.boxCount || 0) * (item.price || 0);
          break;
        default: // pieces or any other unit
          lineTotal = (item.quantity || 0) * (item.price || 0);
      }
      item.total = lineTotal;
    });

    // Sum up all line totals
    this.itemsTotal = this.items.reduce((sum, item) => sum + (item.total || 0), 0);
    
    // Final Amount = Items + Loading + Transport + Tax + OldBalance - Advance
    this.totalAmount = (
        this.itemsTotal + 
        (Number(this.loadingCharges) || 0) + 
        (Number(this.unloadingCharges) || 0) + 
        (Number(this.transportCharges) || 0) + 
        (Number(this.taxAmount) || 0) + 
        (Number(this.oldBalance) || 0) - 
        (Number(this.advanceAmount) || 0)
    );
    
    next();
});

salesOrderSchema.index({ orderNumber: 1, tenantId: 1 }, { unique: true });
salesOrderSchema.index({ customer: 1, tenantId: 1 });
salesOrderSchema.index({ status: 1, tenantId: 1 });

const SalesOrder = appConn.model('SalesOrder', salesOrderSchema);

export default SalesOrder;
