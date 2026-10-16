import express from 'express';
import mongoose from 'mongoose';
import SalesOrder from '../models/SalesOrder.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Item from '../models/Item.js';
import Party from '../models/Party.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import Customer from '../models/Customer.js';
import Vendor from '../models/Vendor.js';

const router = express.Router();

// Helper: format currency
const fmt = (n) => {
    n = Number(n) || 0;
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
    return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// GET /api/ai-chat/query
// Handles all live data questions
router.get('/query', async (req, res) => {
    try {
        const { intent } = req.query;
        const tenantId = req.tenantId;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - 6);

        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

        const tq = tenantId ? { tenantId } : {};

        // ── today_sales ───────────────────────────────────────────────────────
        if (intent === 'today_sales') {
            const trueSalesExpr = { $subtract: [{ $add: ['$totalAmount', { $ifNull: ['$advanceAmount', 0] }] }, { $ifNull: ['$oldBalance', 0] }] };

            const [ordersAgg, topItem, topCustomer, countAgg] = await Promise.all([
                SalesOrder.aggregate([
                    { $match: { ...tq, status: { $ne: 'void' }, isEstimation: { $ne: true }, $or: [{ orderDate: { $gte: today, $lte: todayEnd } }, { createdAt: { $gte: today, $lte: todayEnd } }] } },
                    { $group: { _id: null, totalValue: { $sum: trueSalesExpr }, totalBoxes: { $sum: { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', '$$this.quantity'] } } } } } }
                ]),
                SalesOrder.aggregate([
                    { $match: { ...tq, status: { $ne: 'void' }, isEstimation: { $ne: true }, $or: [{ orderDate: { $gte: today } }, { createdAt: { $gte: today } }] } },
                    { $unwind: '$items' },
                    { $group: { _id: '$items.item', name: { $first: '$items.name' }, qty: { $sum: '$items.quantity' } } },
                    { $sort: { qty: -1 } }, { $limit: 1 }
                ]),
                SalesOrder.aggregate([
                    { $match: { ...tq, status: { $ne: 'void' }, isEstimation: { $ne: true }, $or: [{ orderDate: { $gte: today } }, { createdAt: { $gte: today } }] } },
                    { $group: { _id: '$party', totalValue: { $sum: trueSalesExpr } } },
                    { $sort: { totalValue: -1 } }, { $limit: 1 },
                    { $lookup: { from: 'parties', localField: '_id', foreignField: '_id', as: 'partyInfo' } },
                    { $unwind: { path: '$partyInfo', preserveNullAndEmptyArrays: true } },
                    { $project: { name: { $ifNull: ['$partyInfo.name', 'Unknown'] }, totalValue: 1 } }
                ]),
                SalesOrder.countDocuments({ ...tq, status: { $ne: 'void' }, isEstimation: { $ne: true }, $or: [{ orderDate: { $gte: today } }, { createdAt: { $gte: today } }] })
            ]);

            const totalValue = ordersAgg[0]?.totalValue || 0;
            const totalBoxes = ordersAgg[0]?.totalBoxes || 0;

            return res.json({
                intent,
                totalValue,
                totalBoxes,
                orderCount: countAgg,
                topItem: topItem[0] || null,
                topCustomer: topCustomer[0] || null,
                formatted: {
                    totalValue: fmt(totalValue),
                    totalBoxes: totalBoxes.toFixed(2),
                }
            });
        }

        // ── today_purchase ────────────────────────────────────────────────────
        if (intent === 'today_purchase') {
            const [purchAgg, topVendor, countAgg] = await Promise.all([
                PurchaseOrder.aggregate([
                    { $match: { ...tq, status: { $ne: 'void' }, $or: [{ orderDate: { $gte: today } }, { createdAt: { $gte: today } }] } },
                    { $group: { _id: null, totalValue: { $sum: '$totalAmount' }, totalBoxes: { $sum: { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', '$$this.quantity'] } } } } } }
                ]),
                PurchaseOrder.aggregate([
                    { $match: { ...tq, status: { $ne: 'void' }, $or: [{ orderDate: { $gte: today } }, { createdAt: { $gte: today } }] } },
                    { $group: { _id: '$party', totalValue: { $sum: '$totalAmount' } } },
                    { $sort: { totalValue: -1 } }, { $limit: 1 },
                    { $lookup: { from: 'parties', localField: '_id', foreignField: '_id', as: 'partyInfo' } },
                    { $unwind: { path: '$partyInfo', preserveNullAndEmptyArrays: true } },
                    { $project: { name: { $ifNull: ['$partyInfo.name', 'Unknown'] }, totalValue: 1 } }
                ]),
                PurchaseOrder.countDocuments({ ...tq, status: { $ne: 'void' }, $or: [{ orderDate: { $gte: today } }, { createdAt: { $gte: today } }] })
            ]);

            const totalValue = purchAgg[0]?.totalValue || 0;
            const totalBoxes = purchAgg[0]?.totalBoxes || 0;

            return res.json({
                intent,
                totalValue,
                totalBoxes,
                orderCount: countAgg,
                topVendor: topVendor[0] || null,
                formatted: {
                    totalValue: fmt(totalValue),
                    totalBoxes: totalBoxes.toFixed(2),
                }
            });
        }

        // ── today_customers ───────────────────────────────────────────────────
        if (intent === 'today_customers') {
            const [newCustomers, todaySalesCustomers] = await Promise.all([
                Party.countDocuments({ ...tq, type: { $in: ['customer', 'both'] }, createdAt: { $gte: today } }),
                SalesOrder.distinct('party', { ...tq, status: { $ne: 'void' }, isEstimation: { $ne: true }, $or: [{ orderDate: { $gte: today } }, { createdAt: { $gte: today } }] })
            ]);

            return res.json({
                intent,
                newCustomers,
                activeCustomers: todaySalesCustomers.length,
            });
        }

        // ── top_selling_item ──────────────────────────────────────────────────
        if (intent === 'top_selling_item') {
            const { period = 'today' } = req.query;
            let dateFilter = {};
            if (period === 'today') dateFilter = { $gte: today };
            else if (period === 'week') dateFilter = { $gte: weekStart };
            else if (period === 'month') dateFilter = { $gte: monthStart };

            const matchStage = { ...tq, status: { $ne: 'void' }, isEstimation: { $ne: true } };
            if (dateFilter.$gte) matchStage.$or = [{ orderDate: dateFilter }, { createdAt: dateFilter }];

            const topItems = await SalesOrder.aggregate([
                { $match: matchStage },
                { $unwind: '$items' },
                { $group: { _id: '$items.item', name: { $first: '$items.name' }, qty: { $sum: '$items.quantity' }, revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } } } },
                { $sort: { qty: -1 } }, { $limit: 5 }
            ]);

            return res.json({ intent, period, topItems });
        }

        // ── top_customer ──────────────────────────────────────────────────────
        if (intent === 'top_customer') {
            const { period = 'today' } = req.query;
            const trueSalesExpr = { $subtract: [{ $add: ['$totalAmount', { $ifNull: ['$advanceAmount', 0] }] }, { $ifNull: ['$oldBalance', 0] }] };

            let dateFilter = {};
            if (period === 'today') dateFilter = { $gte: today };
            else if (period === 'week') dateFilter = { $gte: weekStart };
            else if (period === 'month') dateFilter = { $gte: monthStart };

            const matchStage = { ...tq, status: { $ne: 'void' }, isEstimation: { $ne: true } };
            if (dateFilter.$gte) matchStage.$or = [{ orderDate: dateFilter }, { createdAt: dateFilter }];

            const topCustomers = await SalesOrder.aggregate([
                { $match: matchStage },
                { $group: { _id: '$party', totalValue: { $sum: trueSalesExpr }, orderCount: { $sum: 1 } } },
                { $sort: { totalValue: -1 } }, { $limit: 5 },
                { $lookup: { from: 'parties', localField: '_id', foreignField: '_id', as: 'partyInfo' } },
                { $unwind: { path: '$partyInfo', preserveNullAndEmptyArrays: true } },
                { $project: { name: { $ifNull: ['$partyInfo.name', 'Unknown'] }, totalValue: 1, orderCount: 1 } }
            ]);

            return res.json({ intent, period, topCustomers });
        }

        // ── stock_summary ─────────────────────────────────────────────────────
        if (intent === 'stock_summary') {
            const [totalItems, lowStock, outOfStock, stockValueAgg] = await Promise.all([
                Item.countDocuments(tq),
                Item.countDocuments({ ...tq, $expr: { $and: [{ $gt: ['$quantity', 0] }, { $lte: ['$quantity', '$minStockThreshold'] }] } }),
                Item.countDocuments({ ...tq, quantity: 0 }),
                Item.aggregate([{ $match: tq }, { $group: { _id: null, value: { $sum: { $multiply: ['$quantity', '$price'] } }, qty: { $sum: '$quantity' } } }])
            ]);

            return res.json({
                intent,
                totalItems,
                lowStock,
                outOfStock,
                stockValue: stockValueAgg[0]?.value || 0,
                totalQty: stockValueAgg[0]?.qty || 0,
                formatted: { stockValue: fmt(stockValueAgg[0]?.value || 0) }
            });
        }

        // ── week_sales ────────────────────────────────────────────────────────
        if (intent === 'week_sales') {
            const trueSalesExpr = { $subtract: [{ $add: ['$totalAmount', { $ifNull: ['$advanceAmount', 0] }] }, { $ifNull: ['$oldBalance', 0] }] };
            const [agg, countAgg] = await Promise.all([
                SalesOrder.aggregate([
                    { $match: { ...tq, status: { $ne: 'void' }, isEstimation: { $ne: true }, $or: [{ orderDate: { $gte: weekStart } }, { createdAt: { $gte: weekStart } }] } },
                    { $group: { _id: null, totalValue: { $sum: trueSalesExpr }, totalBoxes: { $sum: { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', '$$this.quantity'] } } } } } }
                ]),
                SalesOrder.countDocuments({ ...tq, status: { $ne: 'void' }, isEstimation: { $ne: true }, $or: [{ orderDate: { $gte: weekStart } }, { createdAt: { $gte: weekStart } }] })
            ]);

            return res.json({
                intent,
                totalValue: agg[0]?.totalValue || 0,
                totalBoxes: agg[0]?.totalBoxes || 0,
                orderCount: countAgg,
                formatted: { totalValue: fmt(agg[0]?.totalValue || 0) }
            });
        }

        // ── month_sales ───────────────────────────────────────────────────────
        if (intent === 'month_sales') {
            const trueSalesExpr = { $subtract: [{ $add: ['$totalAmount', { $ifNull: ['$advanceAmount', 0] }] }, { $ifNull: ['$oldBalance', 0] }] };
            const [agg, countAgg] = await Promise.all([
                SalesOrder.aggregate([
                    { $match: { ...tq, status: { $ne: 'void' }, isEstimation: { $ne: true }, $or: [{ orderDate: { $gte: monthStart } }, { createdAt: { $gte: monthStart } }] } },
                    { $group: { _id: null, totalValue: { $sum: trueSalesExpr }, totalBoxes: { $sum: { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', '$$this.quantity'] } } } } } }
                ]),
                SalesOrder.countDocuments({ ...tq, status: { $ne: 'void' }, isEstimation: { $ne: true }, $or: [{ orderDate: { $gte: monthStart } }, { createdAt: { $gte: monthStart } }] })
            ]);

            return res.json({
                intent,
                totalValue: agg[0]?.totalValue || 0,
                totalBoxes: agg[0]?.totalBoxes || 0,
                orderCount: countAgg,
                formatted: { totalValue: fmt(agg[0]?.totalValue || 0) }
            });
        }

        // ── low_stock ─────────────────────────────────────────────────────────
        if (intent === 'low_stock') {
            const items = await Item.find({ ...tq, $expr: { $lte: ['$quantity', '$minStockThreshold'] } })
                .select('name quantity minStockThreshold').sort({ quantity: 1 }).limit(10);
            return res.json({ intent, items, count: items.length });
        }

        // ── today_inward ──────────────────────────────────────────────────────
        if (intent === 'today_inward') {
            const [agg] = await Promise.all([
                Transaction.aggregate([
                    { $match: { ...tq, type: 'inward', createdAt: { $gte: today } } },
                    { $group: { _id: null, totalQty: { $sum: '$quantity' }, count: { $sum: 1 } } }
                ])
            ]);
            return res.json({ intent, totalQty: agg[0]?.totalQty || 0, count: agg[0]?.count || 0 });
        }

        // ── top_stocked_item (highest stock in inventory) ─────────────────────
        if (intent === 'top_stocked_item') {
            const items = await Item.find(tq)
                .select('name quantity price unit brand category minStockThreshold')
                .sort({ quantity: -1 })
                .limit(5);

            const topItem = items[0] || null;
            return res.json({
                intent,
                topItem,
                items,
                formatted: {
                    topItemValue: topItem ? fmt((topItem.quantity || 0) * (topItem.price || 0)) : '₹0',
                }
            });
        }

        // ── sales_persons ─────────────────────────────────────────────────────
        if (intent === 'sales_persons') {
            const users = await User.find(tq).select('name email role phone isActive');
            const salesUsers = users.filter(u => /sales/i.test(u.role || ''));
            return res.json({
                intent,
                totalUsers: users.length,
                activeUsers: users.filter(u => u.isActive !== false).length,
                salesCount: salesUsers.length,
                salesUsers: salesUsers.map(u => ({ name: u.name, email: u.email, role: u.role, phone: u.phone })),
                allUsers: users.map(u => ({ name: u.name, email: u.email, role: u.role })),
            });
        }

        // ── total_orders (total sales and purchase orders) ────────────────────
        if (intent === 'total_orders') {
            const trueSalesExpr = { $subtract: [{ $add: ['$totalAmount', { $ifNull: ['$advanceAmount', 0] }] }, { $ifNull: ['$oldBalance', 0] }] };

            const [soAgg, poAgg] = await Promise.all([
                SalesOrder.aggregate([
                    { $match: { ...tq, status: { $ne: 'void' }, isEstimation: { $ne: true } } },
                    { $group: { _id: null, count: { $sum: 1 }, totalValue: { $sum: trueSalesExpr }, totalBoxes: { $sum: { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', '$$this.quantity'] } } } } } }
                ]),
                PurchaseOrder.aggregate([
                    { $match: { ...tq, status: { $ne: 'void' } } },
                    { $group: { _id: null, count: { $sum: 1 }, totalValue: { $sum: '$totalAmount' }, totalBoxes: { $sum: { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', '$$this.quantity'] } } } } } }
                ])
            ]);

            const salesCount = soAgg[0]?.count || 0;
            const salesValue = soAgg[0]?.totalValue || 0;
            const salesBoxes = soAgg[0]?.totalBoxes || 0;

            const purchaseCount = poAgg[0]?.count || 0;
            const purchaseValue = poAgg[0]?.totalValue || 0;
            const purchaseBoxes = poAgg[0]?.totalBoxes || 0;

            return res.json({
                intent,
                sales: {
                    count: salesCount,
                    totalValue: salesValue,
                    totalBoxes: salesBoxes,
                    formattedValue: fmt(salesValue),
                    formattedBoxes: salesBoxes.toFixed(2),
                },
                purchase: {
                    count: purchaseCount,
                    totalValue: purchaseValue,
                    totalBoxes: purchaseBoxes,
                    formattedValue: fmt(purchaseValue),
                    formattedBoxes: purchaseBoxes.toFixed(2),
                },
                totalOrders: salesCount + purchaseCount,
            });
        }

        // ── parties_summary (customers & vendors) ─────────────────────────────
        if (intent === 'parties_summary') {
            const [customersCount, vendorsCount, partiesCount] = await Promise.all([
                Customer.countDocuments(tq),
                Vendor.countDocuments(tq),
                Party.countDocuments(tq),
            ]);

            return res.json({
                intent,
                customersCount,
                vendorsCount,
                partiesCount,
            });
        }

        return res.json({ intent: 'unknown', message: 'Intent not recognized' });
    } catch (err) {
        console.error('AI Chat Error:', err);
        res.status(500).json({ message: err.message });
    }
});

export default router;
