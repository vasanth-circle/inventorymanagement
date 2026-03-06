import mongoose from 'mongoose';

const purchaseOrderSchema = new mongoose.Schema({
    orderNumber: {
        type: String,
        required: true,
        unique: true,
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
        quantity: {
            type: Number,
            required: true,
            min: 1,
        },
        price: {
            type: Number,
            required: true,
        },
        total: Number,
    }],
    totalAmount: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        enum: ['draft', 'issued', 'received', 'billed', 'void'],
        default: 'draft',
    },
    orderDate: {
        type: Date,
        default: Date.now,
    },
    expectedDeliveryDate: Date,
    notes: String,
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
        item.total = item.quantity * item.price;
    });
    this.totalAmount = this.items.reduce((sum, item) => sum + item.total, 0);
    next();
});

purchaseOrderSchema.index({ vendor: 1 });

const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);

export default PurchaseOrder;
