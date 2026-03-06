import mongoose from 'mongoose';

const salesOrderSchema = new mongoose.Schema({
    orderNumber: {
        type: String,
        required: true,
        unique: true,
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
        enum: ['draft', 'confirmed', 'packed', 'shipped', 'delivered', 'invoiced', 'void'],
        default: 'draft',
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
    }
}, {
    timestamps: true,
});

// Calculate line item totals before saving
salesOrderSchema.pre('validate', function (next) {
    this.items.forEach(item => {
        item.total = item.quantity * item.price;
    });
    this.totalAmount = this.items.reduce((sum, item) => sum + item.total, 0);
    next();
});

salesOrderSchema.index({ customer: 1 });
salesOrderSchema.index({ status: 1 });

const SalesOrder = mongoose.model('SalesOrder', salesOrderSchema);

export default SalesOrder;
