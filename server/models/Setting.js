import mongoose from 'mongoose';
import { appConn } from '../config/db.js';

const settingSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        unique: true,
    },
    companyName: { type: String, default: 'Your Company Name', trim: true },
    address: { type: String, default: 'Your Company Address', trim: true },
    phone1: { type: String, default: '', trim: true },
    phone2: { type: String, default: '', trim: true },
    gstNumber: { type: String, default: '', trim: true },
    invoicePrefix: { type: String, default: 'INV' },
    estimatePrefix: { type: String, default: 'EST' },

    // ── Unit & Measurement Configuration ─────────────────────────────────
    unitConfig: {
        // Primary quantity basis (what the item is measured/sold in)
        quantityBasis: {
            type: String,
            enum: ['pieces', 'boxes', 'sqft', 'meters', 'kg', 'liters', 'units'],
            default: 'units',
        },
        // Optional secondary unit (e.g. show SqFt AND Boxes)
        secondaryUnit: {
            type: String,
            enum: ['none', 'pieces', 'boxes', 'sqft', 'meters'],
            default: 'none',
        },
        // What the price/rate is charged per
        rateBasis: {
            type: String,
            enum: ['per_piece', 'per_box', 'per_sqft', 'per_meter', 'per_kg', 'per_unit'],
            default: 'per_unit',
        },
        // Column label overrides shown on bills
        quantityLabel: { type: String, default: 'Qty' },
        secondaryLabel: { type: String, default: '' },
        rateLabel: { type: String, default: 'Rate' },
    },

    // ── Document & Workflow Configuration ────────────────────────────────
    documentConfig: {
        quotationPrefix: { type: String, default: 'QUO' },
        quotationCounter: { type: Number, default: 0 },
        quotationTitle: { type: String, default: 'Quotation' },
        invoiceTitle: { type: String, default: 'Tax Invoice' },
        quotationTemplate: { type: Number, default: 1 },
        invoiceTemplate: { type: Number, default: 1 },
        currency: { type: String, default: 'INR' },
        currencySymbol: { type: String, default: '₹' },
        taxLabel: { type: String, default: 'GST' },
        defaultTaxRate: { type: Number, default: 18 },
        showSecondaryQty: { type: Boolean, default: false },
    },

    // ── Pricing Configuration ────────────────────────────────────────────
    pricingConfig: {
        preventSellingBelowPurchase: { type: Boolean, default: false },
        validatePurchasePrice: { type: Boolean, default: false },
    },

    // ── Branding & Bank Details ──────────────────────────────────────────
    branding: {
        tagline: { type: String, default: '' },
        website: { type: String, default: '' },
        email: { type: String, default: '' },
        bankName: { type: String, default: '' },
        accountNumber: { type: String, default: '' },
        ifscCode: { type: String, default: '' },
        termsAndConditions: { type: String, default: '1. Goods once sold will not be taken back.\n2. No responsibility for breakages after leaving premises.\n3. E. & O.E.' },
    },
}, { timestamps: true });

const Setting = appConn.model('Setting', settingSchema);
export default Setting;
