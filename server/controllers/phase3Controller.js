import BinLocation from '../models/BinLocation.js';
import BillOfMaterial from '../models/BillOfMaterial.js';
import ProductionOrder from '../models/ProductionOrder.js';
import Item from '../models/Item.js';
import Transaction from '../models/Transaction.js';
import SalesOrder from '../models/SalesOrder.js';
import { generateDemandForecast } from '../services/aiInsightsService.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';
import { tenantQuery } from '../utils/tenantQuery.js';
import { getNextSequenceValue } from '../utils/sequence.js';

// ==========================================
// 1. Bin Management
// ==========================================
export const createBinLocation = async (req, res) => {
    try {
        const bin = await BinLocation.create({ ...req.body, tenantId: req.tenantId });
        sendResponse(res, 201, bin, 'Bin created');
    } catch (e) {
        sendError(res, 400, e.message);
    }
};

export const getBinLocations = async (req, res) => {
    try {
        const bins = await BinLocation.find(tenantQuery(req)).populate('location', 'name type');
        sendResponse(res, 200, bins);
    } catch (e) {
        sendError(res, 400, e.message);
    }
};

// ==========================================
// 2. Manufacturing (BOM & Production)
// ==========================================
export const createBOM = async (req, res) => {
    try {
        const bom = await BillOfMaterial.create({ ...req.body, tenantId: req.tenantId });
        sendResponse(res, 201, bom, 'BOM created');
    } catch (e) {
        sendError(res, 400, e.message);
    }
};

export const getBOMs = async (req, res) => {
    try {
        const boms = await BillOfMaterial.find(tenantQuery(req))
            .populate('finishedGood', 'name sku price')
            .populate('rawMaterials.item', 'name sku price');
        sendResponse(res, 200, boms);
    } catch (e) {
        sendError(res, 400, e.message);
    }
};

export const createProductionOrder = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const seq = await getNextSequenceValue('PROD', tenantId);
        
        const order = await ProductionOrder.create({ 
            ...req.body, 
            orderNumber: `PROD-${seq}`,
            tenantId,
            createdBy: req.user._id,
            startDate: new Date()
        });
        sendResponse(res, 201, order, 'Production Order created');
    } catch (e) {
        sendError(res, 400, e.message);
    }
};

export const getProductionOrders = async (req, res) => {
    try {
        const orders = await ProductionOrder.find(tenantQuery(req))
            .populate({
                path: 'bom',
                populate: { path: 'finishedGood', select: 'name sku' }
            });
        sendResponse(res, 200, orders);
    } catch (e) {
        sendError(res, 400, e.message);
    }
};

export const completeProductionOrder = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const order = await ProductionOrder.findOne({ _id: req.params.id, tenantId }).populate('bom');
        
        if (!order) return sendError(res, 404, 'Order not found');
        if (order.status === 'completed') return sendError(res, 400, 'Order already completed');

        const bom = order.bom;
        const qty = order.quantityToProduce;

        // 1. Check raw material stock
        for (const rm of bom.rawMaterials) {
            const required = (rm.quantity * qty) * (1 + rm.scrapPercentage / 100);
            const item = await Item.findById(rm.item);
            if (!item || item.quantity < required) {
                return sendError(res, 400, `Insufficient raw material: ${item?.name || 'Unknown'}. Required: ${required}`);
            }
        }

        // 2. Deduct raw materials
        for (const rm of bom.rawMaterials) {
            const required = (rm.quantity * qty) * (1 + rm.scrapPercentage / 100);
            const item = await Item.findById(rm.item);
            item.quantity -= required;
            await item.save();

            await Transaction.create({
                item: rm.item, type: 'outward', quantity: required,
                reason: 'Manufacturing Consumption', notes: `Production Order ${order.orderNumber}`,
                user: req.user._id, tenantId
            });
        }

        // 3. Add finished good
        const fg = await Item.findById(bom.finishedGood);
        fg.quantity += qty;
        await fg.save();

        await Transaction.create({
            item: bom.finishedGood, type: 'inward', quantity: qty,
            reason: 'Manufacturing Output', notes: `Production Order ${order.orderNumber}`,
            user: req.user._id, tenantId
        });

        order.status = 'completed';
        order.quantityProduced = qty;
        order.endDate = new Date();
        await order.save();

        sendResponse(res, 200, order, 'Production completed successfully');
    } catch (e) {
        sendError(res, 400, e.message);
    }
};

// ==========================================
// 3. AI Insights
// ==========================================
export const getAiInsights = async (req, res) => {
    try {
        const insights = await generateDemandForecast(req.tenantId);
        sendResponse(res, 200, insights);
    } catch (e) {
        sendError(res, 500, e.message);
    }
};

// ==========================================
// 4. BI Dashboard Data
// ==========================================
export const getBiDashboardData = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        
        // Basic metrics for BI
        const salesTrend = await SalesOrder.aggregate([
            { $match: { tenantId, isEstimation: false, status: { $ne: 'cancelled' } } },
            { $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                revenue: { $sum: "$totalAmount" }
            }},
            { $sort: { _id: 1 } },
            { $limit: 30 }
        ]);

        const revenueByCategory = await SalesOrder.aggregate([
            { $match: { tenantId, isEstimation: false, status: { $ne: 'cancelled' } } },
            { $unwind: "$items" },
            { $lookup: { from: 'items', localField: 'items.item', foreignField: '_id', as: 'itemDetails' } },
            { $unwind: "$itemDetails" },
            { $lookup: { from: 'categories', localField: 'itemDetails.category', foreignField: '_id', as: 'categoryDetails' } },
            { $unwind: { path: "$categoryDetails", preserveNullAndEmptyArrays: true } },
            { $group: {
                _id: { $ifNull: ["$categoryDetails.name", "Uncategorized"] },
                value: { $sum: { $multiply: ["$items.quantity", "$items.price"] } }
            }}
        ]);

        sendResponse(res, 200, {
            salesTrend,
            revenueByCategory
        });
    } catch (e) {
        sendError(res, 500, e.message);
    }
};
