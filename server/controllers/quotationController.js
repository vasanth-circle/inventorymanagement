import Quotation from '../models/Quotation.js';
import SalesOrder from '../models/SalesOrder.js';
import Setting from '../models/Setting.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';

// ── Helper: generate next quotation number ─────────────────────────────────
const generateQuotationNumber = async (tenantId) => {
    const settings = await Setting.findOneAndUpdate(
        { tenantId },
        { $inc: { 'documentConfig.quotationCounter': 1 } },
        { new: true, upsert: true }
    );
    const prefix = settings?.documentConfig?.quotationPrefix || 'QUO';
    const counter = settings?.documentConfig?.quotationCounter || 1;
    return `${prefix}-${String(counter).padStart(4, '0')}`;
};

// @desc    Get all quotations
// @route   GET /api/quotations
// @access  Private
export const getQuotations = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, status, search } = req.query;
        const query = { tenantId: req.tenantId };

        if (status) query.status = status;
        if (search) {
            query.$or = [
                { quotationNumber: { $regex: search, $options: 'i' } },
            ];
        }

        const quotations = await Quotation.find(query)
            .populate('customer', 'name companyName phone address')
            .populate('user', 'name')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Quotation.countDocuments(query);

        sendResponse(res, 200, {
            quotations,
            totalPages: Math.ceil(total / limit),
            currentPage: Number(page),
            total,
        }, 'Quotations fetched successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Get single quotation
// @route   GET /api/quotations/:id
// @access  Private
export const getQuotation = async (req, res, next) => {
    try {
        const quotation = await Quotation.findOne({ _id: req.params.id, tenantId: req.tenantId })
            .populate('customer', 'name companyName phone address')
            .populate('user', 'name')
            .populate('items.item', 'name brand size hsn');

        if (!quotation) return sendError(res, 404, 'Quotation not found');
        sendResponse(res, 200, quotation, 'Quotation fetched successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Create new quotation
// @route   POST /api/quotations
// @access  Private
export const createQuotation = async (req, res, next) => {
    try {
        const quotationNumber = await generateQuotationNumber(req.tenantId);

        const quotation = await Quotation.create({
            ...req.body,
            quotationNumber,
            tenantId: req.tenantId,
            user: req.user._id,
        });

        const populated = await Quotation.findById(quotation._id)
            .populate('customer', 'name companyName phone address')
            .populate('user', 'name');

        sendResponse(res, 201, populated, 'Quotation created successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Update quotation
// @route   PUT /api/quotations/:id
// @access  Private
export const updateQuotation = async (req, res, next) => {
    try {
        const quotation = await Quotation.findOne({ _id: req.params.id, tenantId: req.tenantId });
        if (!quotation) return sendError(res, 404, 'Quotation not found');
        if (quotation.status === 'converted') return sendError(res, 400, 'Cannot edit a converted quotation');

        const updated = await Quotation.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        ).populate('customer', 'name companyName phone address').populate('user', 'name');

        sendResponse(res, 200, updated, 'Quotation updated successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Convert quotation to invoice (Sales Order)
// @route   POST /api/quotations/:id/convert
// @access  Private
export const convertToInvoice = async (req, res, next) => {
    try {
        const quotation = await Quotation.findOne({ _id: req.params.id, tenantId: req.tenantId })
            .populate('customer')
            .populate('items.item');

        if (!quotation) return sendError(res, 404, 'Quotation not found');
        if (quotation.status === 'converted') return sendError(res, 400, 'Quotation has already been converted to an invoice');

        // Get next invoice number from settings
        const settings = await Setting.findOneAndUpdate(
            { tenantId: req.tenantId },
            { $inc: {} }, // no increment here — handled by salesOrderController auto-count
            { new: true, upsert: true }
        );
        const invoicePrefix = settings?.invoicePrefix || 'INV';

        // Count existing sales orders to get next number
        const count = await SalesOrder.countDocuments({ tenantId: req.tenantId });
        const orderNumber = `${invoicePrefix}-${String(count + 1).padStart(4, '0')}`;

        // Build the sales order from quotation data
        const salesOrderData = {
            orderNumber,
            tenantId: req.tenantId,
            customer: quotation.customer._id,
            items: quotation.items.map(qi => ({
                item: qi.item._id || qi.item,
                name: qi.name,
                brand: qi.brand,
                size: qi.size,
                hsn: qi.hsn,
                // Map generic qty fields to salesOrder fields
                quantity: qi.quantity,
                primaryQty: qi.primaryQty,
                secondaryQty: qi.secondaryQty,
                unitLabel: qi.unitLabel,
                price: qi.price,
                total: qi.total,
            })),
            itemsTotal: quotation.itemsTotal,
            taxAmount: quotation.taxAmount,
            loadingCharges: quotation.loadingCharges,
            transportCharges: quotation.transportCharges,
            totalAmount: quotation.totalAmount,
            notes: quotation.notes,
            terms: quotation.terms,
            status: 'confirmed',
            orderDate: new Date(),
            user: req.user._id,
            quotationRef: quotation._id,
            quotationNumber: quotation.quotationNumber,
        };

        const salesOrder = await SalesOrder.create(salesOrderData);

        // Mark quotation as converted
        quotation.status = 'converted';
        quotation.convertedToInvoice = salesOrder._id;
        quotation.convertedAt = new Date();
        await quotation.save();

        sendResponse(res, 201, { salesOrder, quotation }, 'Quotation converted to invoice successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Delete / reject quotation
// @route   DELETE /api/quotations/:id
// @access  Private
export const deleteQuotation = async (req, res, next) => {
    try {
        const quotation = await Quotation.findOne({ _id: req.params.id, tenantId: req.tenantId });
        if (!quotation) return sendError(res, 404, 'Quotation not found');
        if (quotation.status === 'converted') return sendError(res, 400, 'Cannot delete a converted quotation');

        quotation.status = 'rejected';
        await quotation.save();

        sendResponse(res, 200, null, 'Quotation rejected successfully');
    } catch (error) {
        next(error);
    }
};
