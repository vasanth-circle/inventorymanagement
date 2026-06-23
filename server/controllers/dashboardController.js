import mongoose from 'mongoose';
import Item from '../models/Item.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import Category from '../models/Category.js';
import SalesOrder from '../models/SalesOrder.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Tenant from '../models/Tenant.js';
import Vendor from '../models/Vendor.js';

// @desc    Get dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private
export const getDashboardStats = async (req, res, next) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tenantQuery = { tenantId: req.tenantId };
        
        const query = { $or: [{ tenantId: req.tenantId }] };
        if (mongoose.Types.ObjectId.isValid(req.tenantId)) query.$or.push({ _id: req.tenantId });
        
        const tenant = await Tenant.findOne(query);
        const companyName = tenant ? tenant.businessName : 'Inventory Management';

        const totalItemsCount = await Item.countDocuments(tenantQuery);
        const inventorySummary = await Item.aggregate([{ $match: tenantQuery }, { $group: { _id: null, totalQty: { $sum: '$quantity' } } }]);
        const totalQuantity = inventorySummary[0]?.totalQty || 0;
        const lowStockItems = await Item.countDocuments({ ...tenantQuery, $expr: { $lte: ['$quantity', '$minStockThreshold'] } });
        const outOfStockItems = await Item.countDocuments({ ...tenantQuery, quantity: 0 });
        const totalDamagedItems = await Item.aggregate([{ $match: tenantQuery }, { $group: { _id: null, totalDamaged: { $sum: '$damagedQuantity' } } }]);
        const todayInward = await Transaction.aggregate([{ $match: { ...tenantQuery, type: 'inward', createdAt: { $gte: today } } }, { $group: { _id: null, total: { $sum: '$quantity' }, count: { $sum: 1 } } }]);
        const todayOutward = await Transaction.aggregate([{ $match: { ...tenantQuery, type: 'outward', createdAt: { $gte: today } } }, { $group: { _id: null, total: { $sum: '$quantity' }, count: { $sum: 1 } } }]);
        const stockValue = await Item.aggregate([{ $match: tenantQuery }, { $group: { _id: null, totalValue: { $sum: { $multiply: ['$quantity', '$price'] } } } }]);
        const salesActivity = await SalesOrder.aggregate([{ $match: tenantQuery }, { $group: { _id: '$status', count: { $sum: 1 } } }]);
        const purchaseActivity = await PurchaseOrder.aggregate([{ $match: tenantQuery }, { $group: { _id: '$status', count: { $sum: 1 } } }]);

        const startOfWeek = new Date(today); startOfWeek.setDate(today.getDate() - today.getDay());
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        const trueSalesExpr = { $subtract: [{ $add: ['$totalAmount', { $ifNull: ['$advanceAmount', 0] }] }, { $ifNull: ['$oldBalance', 0] }] };
        const salesStats = await SalesOrder.aggregate([
            { $match: { ...tenantQuery, status: { $ne: 'void' }, isEstimation: { $ne: true } } },
            { $group: { 
                _id: null, 
                totalSales: { $sum: trueSalesExpr }, 
                todaySales: { $sum: { $cond: [{ $gte: [{ $ifNull: ['$orderDate', '$createdAt'] }, today] }, trueSalesExpr, 0] } }, 
                weekSales: { $sum: { $cond: [{ $gte: [{ $ifNull: ['$orderDate', '$createdAt'] }, startOfWeek] }, trueSalesExpr, 0] } }, 
                monthSales: { $sum: { $cond: [{ $gte: [{ $ifNull: ['$orderDate', '$createdAt'] }, startOfMonth] }, trueSalesExpr, 0] } } 
            } }
        ]);
        const purchaseStats = await PurchaseOrder.aggregate([{ $match: { ...tenantQuery, status: { $ne: 'void' } } }, { $group: { _id: null, totalPurchase: { $sum: '$totalAmount' } } }]);
        const categoryDistribution = await Item.aggregate([
            { $match: tenantQuery }, { $group: { _id: '$category', count: { $sum: 1 }, totalQuantity: { $sum: '$quantity' } } },
            { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'categoryInfo' } }, { $unwind: '$categoryInfo' },
            { $project: { name: '$categoryInfo.name', count: 1, totalQuantity: 1 } }
        ]);
        const totalCategories = await Category.countDocuments(tenantQuery);
        const pendingOrders = await PurchaseOrder.find({ ...tenantQuery, status: 'issued' });
        const pendingOrdersCount = pendingOrders.length;
        const pendingReceipts = pendingOrders.reduce((acc, order) => acc + order.items.reduce((sum, item) => sum + item.quantity, 0), 0);
        const topSellingItems = await SalesOrder.aggregate([
            { $match: tenantQuery }, { $unwind: '$items' },
            { $group: { _id: '$items.item', name: { $first: '$items.name' }, totalSold: { $sum: '$items.quantity' } } },
            { $sort: { totalSold: -1 } }, { $limit: 5 }
        ]);
        const damagedItemsList = await Item.find({ ...tenantQuery, damagedQuantity: { $gt: 0 } }).select('name sku damagedQuantity price').sort({ damagedQuantity: -1 }).limit(5);

        res.json({
            userName: req.user.name, companyName, totalItems: totalItemsCount, totalQuantity, quantityInHand: totalQuantity,
            lowStockItems, outOfStockItems, todayInward: todayInward[0] || { total: 0, count: 0 }, todayOutward: todayOutward[0] || { total: 0, count: 0 },
            stockValue: stockValue[0]?.totalValue || 0, categoryDistribution,
            salesActivity: salesActivity.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {}),
            purchaseActivity: purchaseActivity.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {}),
            totalSales: salesStats[0]?.totalSales || 0, todaySales: salesStats[0]?.todaySales || 0,
            weekSales: salesStats[0]?.weekSales || 0, monthSales: salesStats[0]?.monthSales || 0,
            totalPurchase: purchaseStats[0]?.totalPurchase || 0, totalItemsCount,
            pendingReceipts, pendingOrdersCount, totalCategories, topSellingItems,
            totalDamagedItems: totalDamagedItems[0]?.totalDamaged || 0, damagedItemsList
        });
    } catch (error) { next(error); }
};

// @desc    Get low stock items
// @route   GET /api/dashboard/low-stock
// @access  Private
export const getLowStockItems = async (req, res, next) => {
    try {
        const lowStockItems = await Item.find({ tenantId: req.tenantId, $expr: { $lte: ['$quantity', '$minStockThreshold'] } })
            .populate('category', 'name').sort({ quantity: 1 }).limit(20);
        res.json(lowStockItems);
    } catch (error) { next(error); }
};

// @desc    Get recent transactions
// @route   GET /api/dashboard/recent-transactions
// @access  Private
export const getRecentTransactions = async (req, res, next) => {
    try {
        const transactions = await Transaction.find({ tenantId: req.tenantId })
            .populate('item', 'name barcode').populate({ path: 'user', model: User, select: 'name' })
            .sort({ createdAt: -1 }).limit(10);
        res.json(transactions);
    } catch (error) { next(error); }
};

// @desc    Get stock movement trend (last 7 days)
// @route   GET /api/dashboard/stock-trend
// @access  Private
export const getStockTrend = async (req, res, next) => {
    try {
        const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const trend = await Transaction.aggregate([
            { $match: { tenantId: req.tenantId, createdAt: { $gte: sevenDaysAgo } } },
            { $group: { _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, type: '$type' }, total: { $sum: '$quantity' } } },
            { $sort: { '_id.date': 1 } }
        ]);
        res.json(trend);
    } catch (error) { next(error); }
};

// @desc    Get comprehensive inventory dashboard data
// @route   GET /api/dashboard/inventory
// @access  Private
export const getInventoryDashboard = async (req, res, next) => {
    try {
        const tenantQuery = { tenantId: req.tenantId };
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 30);
        const sixMonthsAgo = new Date(now); sixMonthsAgo.setMonth(now.getMonth() - 5); sixMonthsAgo.setDate(1); sixMonthsAgo.setHours(0, 0, 0, 0);

        // --- KPI ---
        const [totalProducts, outOfStockCount, lowStockDocs, damagedSummary, inventoryValueAgg, stockQtyAgg, skuCount, overStockedCount] = await Promise.all([
            Item.countDocuments(tenantQuery),
            Item.countDocuments({ ...tenantQuery, quantity: 0 }),
            Item.find({ ...tenantQuery, $expr: { $and: [{ $gt: ['$quantity', 0] }, { $lte: ['$quantity', '$minStockThreshold'] }] } })
                .select('name sku quantity minStockThreshold category price purchasePrice').populate('category', 'name').sort({ quantity: 1 }).limit(50),
            Item.aggregate([{ $match: { ...tenantQuery, damagedQuantity: { $gt: 0 } } }, { $group: { _id: null, total: { $sum: '$damagedQuantity' }, count: { $sum: 1 }, value: { $sum: { $multiply: ['$damagedQuantity', { $ifNull: ['$purchasePrice', '$price'] }] } } } }]),
            Item.aggregate([{ $match: tenantQuery }, { $group: { _id: null, value: { $sum: { $multiply: ['$quantity', '$purchasePrice'] } } } }]),
            Item.aggregate([{ $match: tenantQuery }, { $group: { _id: null, qty: { $sum: '$quantity' } } }]),
            Item.countDocuments({ ...tenantQuery, sku: { $exists: true, $ne: '' } }),
            Item.countDocuments({ ...tenantQuery, $expr: { $and: [{ $gt: ['$minStockThreshold', 0] }, { $gt: ['$quantity', { $multiply: ['$minStockThreshold', 3] }] }] } })
        ]);

        // Out of stock list
        const outOfStockItems = await Item.find({ ...tenantQuery, quantity: 0 })
            .select('name sku quantity minStockThreshold category price').populate('category', 'name').sort({ updatedAt: -1 }).limit(50);

        // Damaged items list
        const damagedItems = await Item.find({ ...tenantQuery, damagedQuantity: { $gt: 0 } })
            .select('name sku damagedQuantity quantity price purchasePrice').sort({ damagedQuantity: -1 }).limit(20);

        // --- PURCHASE ORDER STATS ---
        const [poStats, monthPOStats] = await Promise.all([
            PurchaseOrder.aggregate([{ $match: tenantQuery }, { $group: { _id: '$status', count: { $sum: 1 }, totalValue: { $sum: '$totalAmount' } } }]),
            PurchaseOrder.aggregate([{ $match: { ...tenantQuery, orderDate: { $gte: startOfMonth }, status: { $ne: 'void' } } }, { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }]),
        ]);
        const poByStatus = poStats.reduce((acc, cur) => { acc[cur._id] = { count: cur.count, value: cur.totalValue }; return acc; }, {});

        // Supplier analytics
        const supplierAnalytics = await PurchaseOrder.aggregate([
            { $match: { ...tenantQuery, status: { $ne: 'void' } } },
            { $group: { _id: '$vendor', totalValue: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
            { $sort: { totalValue: -1 } }, { $limit: 5 },
            { $lookup: { from: 'vendors', localField: '_id', foreignField: '_id', as: 'vendorInfo' } },
            { $unwind: { path: '$vendorInfo', preserveNullAndEmptyArrays: true } },
            { $project: { name: { $ifNull: ['$vendorInfo.name', 'Unknown'] }, totalValue: 1, count: 1 } }
        ]);

        // --- CATEGORY DISTRIBUTION ---
        const categoryDistribution = await Item.aggregate([
            { $match: tenantQuery },
            { $group: { _id: '$category', count: { $sum: 1 }, totalQty: { $sum: '$quantity' }, totalValue: { $sum: { $multiply: ['$quantity', '$purchasePrice'] } } } },
            { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'cat' } },
            { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } },
            { $project: { name: { $ifNull: ['$cat.name', 'Uncategorized'] }, count: 1, totalQty: 1, totalValue: 1 } },
            { $sort: { totalValue: -1 } }
        ]);

        // --- MONTHLY TREND (last 6 months) ---
        const [monthlyPOTrend, monthlySalesTrend] = await Promise.all([
            PurchaseOrder.aggregate([
                { $match: { ...tenantQuery, orderDate: { $gte: sixMonthsAgo }, status: { $ne: 'void' } } },
                { $group: { _id: { year: { $year: '$orderDate' }, month: { $month: '$orderDate' } }, value: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ]),
            SalesOrder.aggregate([
                { $match: { ...tenantQuery, orderDate: { $gte: sixMonthsAgo }, status: { $ne: 'void' }, isEstimation: { $ne: true } } },
                { $group: { _id: { year: { $year: '$orderDate' }, month: { $month: '$orderDate' } }, value: { $sum: { $subtract: [{ $add: ['$totalAmount', { $ifNull: ['$advanceAmount', 0] }] }, { $ifNull: ['$oldBalance', 0] }] } }, count: { $sum: 1 } } },
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ])
        ]);

        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const trendMap = {};
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now); d.setMonth(now.getMonth() - i);
            const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
            trendMap[key] = { month: monthNames[d.getMonth()], purchase: 0, sales: 0 };
        }
        monthlyPOTrend.forEach(r => { const k = `${r._id.year}-${r._id.month}`; if (trendMap[k]) trendMap[k].purchase = r.value; });
        monthlySalesTrend.forEach(r => { const k = `${r._id.year}-${r._id.month}`; if (trendMap[k]) trendMap[k].sales = r.value; });
        const monthlyTrend = Object.values(trendMap);

        // --- WEEKLY STOCK MOVEMENT (last 4 weeks) ---
        const weeklyMovement = await Transaction.aggregate([
            { $match: { ...tenantQuery, type: { $in: ['inward', 'outward'] }, createdAt: { $gte: thirtyDaysAgo } } },
            { $group: { _id: { week: { $isoWeek: '$createdAt' }, type: '$type' }, total: { $sum: '$quantity' } } },
            { $sort: { '_id.week': 1 } }
        ]);

        // Map to last 4 ISO weeks
        const isoWeek = (d) => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7)); const y = t.getUTCFullYear(); const w1 = new Date(Date.UTC(y, 0, 4)); return 1 + Math.round(((t - w1) / 86400000 - 3 + (w1.getUTCDay() || 7)) / 7); };
        const weekMap = {};
        for (let i = 3; i >= 0; i--) {
            const d = new Date(now); d.setDate(now.getDate() - i * 7);
            const wn = isoWeek(d);
            weekMap[wn] = { week: `W${4 - i}`, inward: 0, outward: 0, weekNum: wn };
        }
        weeklyMovement.forEach(r => { if (weekMap[r._id.week]) weekMap[r._id.week][r._id.type] = r.total; });
        const stockMovement = Object.values(weekMap).sort((a, b) => a.weekNum - b.weekNum);

        // --- TOP SELLING & SLOW MOVING ---
        const [topSelling, recentlySoldItemIds] = await Promise.all([
            SalesOrder.aggregate([
                { $match: { ...tenantQuery, status: { $ne: 'void' }, isEstimation: { $ne: true } } }, { $unwind: '$items' },
                { $group: { _id: '$items.item', name: { $first: '$items.name' }, totalSold: { $sum: '$items.quantity' }, revenue: { $sum: { $multiply: ['$items.quantity', { $ifNull: ['$items.price', 0] }] } } } },
                { $sort: { totalSold: -1 } }, { $limit: 10 }
            ]),
            Transaction.distinct('item', { ...tenantQuery, type: 'outward', createdAt: { $gte: thirtyDaysAgo } })
        ]);

        const slowMoving = await Item.find({ ...tenantQuery, quantity: { $gt: 0 }, _id: { $nin: recentlySoldItemIds } })
            .select('name sku quantity price purchasePrice category').populate('category', 'name').sort({ quantity: -1 }).limit(10);

        // --- RECENT ACTIVITY ---
        const [recentTransactions, recentSales, recentPOs] = await Promise.all([
            Transaction.find(tenantQuery).populate('item', 'name sku').populate('user', 'name').sort({ createdAt: -1 }).limit(8).lean(),
            SalesOrder.find({ ...tenantQuery, isEstimation: { $ne: true } }).select('orderNumber totalAmount status orderDate customer').populate('customer', 'name companyName').sort({ createdAt: -1 }).limit(5).lean(),
            PurchaseOrder.find(tenantQuery).select('orderNumber totalAmount status orderDate vendor').populate('vendor', 'name').sort({ createdAt: -1 }).limit(5).lean(),
        ]);

        const activityFeed = [
            ...recentTransactions.map(t => ({ type: t.type === 'inward' ? 'stock_in' : t.type === 'outward' ? 'stock_out' : t.type, label: t.item?.name || 'Item', sub: t.reason || '', qty: t.quantity, user: t.user?.name, date: t.createdAt })),
            ...recentSales.map(s => ({ type: 'sale', label: s.orderNumber, sub: s.customer?.companyName || s.customer?.name || '', amount: s.totalAmount, status: s.status, date: s.orderDate || s.createdAt })),
            ...recentPOs.map(p => ({ type: 'purchase', label: p.orderNumber, sub: p.vendor?.name || '', amount: p.totalAmount, status: p.status, date: p.orderDate || p.createdAt })),
        ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 15);

        // --- ALERTS ---
        const alerts = [];
        if (lowStockDocs.length > 0) alerts.push({ type: 'low_stock', count: lowStockDocs.length, message: `${lowStockDocs.length} items are running low on stock` });
        if (outOfStockCount > 0) alerts.push({ type: 'out_of_stock', count: outOfStockCount, message: `${outOfStockCount} items are out of stock` });
        if (poByStatus.issued?.count > 0) alerts.push({ type: 'pending_po', count: poByStatus.issued.count, message: `${poByStatus.issued.count} purchase orders are pending` });
        if (damagedSummary[0]?.count > 0) alerts.push({ type: 'damaged', count: damagedSummary[0].count, message: `${damagedSummary[0].count} items have damaged stock` });

        res.json({
            kpi: {
                totalProducts, totalSKUs: skuCount, inventoryValue: inventoryValueAgg[0]?.value || 0,
                availableStock: stockQtyAgg[0]?.qty || 0, lowStockCount: lowStockDocs.length,
                outOfStockCount, overStockedCount,
                damagedTotal: damagedSummary[0]?.total || 0,
                damagedCount: damagedSummary[0]?.count || 0,
                damagedValue: damagedSummary[0]?.value || 0,
                purchaseThisMonth: monthPOStats[0]?.total || 0, pendingPOs: poByStatus.issued?.count || 0,
            },
            monthlyTrend, stockMovement, categoryDistribution, supplierAnalytics,
            purchaseStats: {
                total: Object.values(poByStatus).reduce((s, v) => s + v.count, 0),
                pending: poByStatus.issued?.count || 0,
                received: (poByStatus.received?.count || 0) + (poByStatus.billed?.count || 0),
                draft: poByStatus.draft?.count || 0,
                monthValue: monthPOStats[0]?.total || 0,
                monthCount: monthPOStats[0]?.count || 0,
            },
            stockMonitoring: { lowStock: lowStockDocs, outOfStock: outOfStockItems, damaged: damagedItems },
            productPerformance: { topSelling, slowMoving },
            activityFeed, alerts,
        });
    } catch (error) { next(error); }
};
