import Item from '../models/Item.js';
import Transaction from '../models/Transaction.js';
import Category from '../models/Category.js';
import SalesOrder from '../models/SalesOrder.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Tenant from '../models/Tenant.js';

// @desc    Get dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private
export const getDashboardStats = async (req, res, next) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tenantQuery = { tenantId: req.tenantId };
        
        // Fetch Tenant Info
        const tenant = await Tenant.findOne({ tenantId: req.tenantId });
        const companyName = tenant ? tenant.businessName : 'Inventory Management';

        // Total items count
        const totalItems = await Item.countDocuments(tenantQuery);

        // Low stock items count
        const lowStockItems = await Item.countDocuments({
            ...tenantQuery,
            $expr: { $lte: ['$quantity', '$minStockThreshold'] }
        });

        // Out of stock items count
        const outOfStockItems = await Item.countDocuments({ ...tenantQuery, quantity: 0 });

        // Today's inward transactions
        const todayInward = await Transaction.aggregate([
            {
                $match: {
                    ...tenantQuery,
                    type: 'inward',
                    createdAt: { $gte: today }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$quantity' },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Today's outward transactions
        const todayOutward = await Transaction.aggregate([
            {
                $match: {
                    ...tenantQuery,
                    type: 'outward',
                    createdAt: { $gte: today }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$quantity' },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Total stock value
        const stockValue = await Item.aggregate([
            { $match: tenantQuery },
            {
                $group: {
                    _id: null,
                    totalValue: { $sum: { $multiply: ['$quantity', '$price'] } }
                }
            }
        ]);

        // Sales Activity Counts
        const salesActivity = await SalesOrder.aggregate([
            { $match: tenantQuery },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Purchase Activity Counts
        const purchaseActivity = await PurchaseOrder.aggregate([
            { $match: tenantQuery },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Total Sales and Purchase Amount
        const salesStats = await SalesOrder.aggregate([
            { $match: { ...tenantQuery, status: { $ne: 'void' } } },
            { $group: { _id: null, totalSales: { $sum: '$totalAmount' } } }
        ]);

        const purchaseStats = await PurchaseOrder.aggregate([
            { $match: { ...tenantQuery, status: { $ne: 'void' } } },
            { $group: { _id: null, totalPurchase: { $sum: '$totalAmount' } } }
        ]);


        // Category-wise distribution
        const categoryDistribution = await Item.aggregate([
            { $match: tenantQuery },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 },
                    totalQuantity: { $sum: '$quantity' }
                }
            },
            {
                $lookup: {
                    from: 'categories',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'categoryInfo'
                }
            },
            {
                $unwind: '$categoryInfo'
            },
            {
                $project: {
                    name: '$categoryInfo.name',
                    count: 1,
                    totalQuantity: 1
                }
            }
        ]);

        // Total categories count
        const totalCategories = await Category.countDocuments(tenantQuery);

        // Pending Purchase Orders (issued status)
        const pendingOrders = await PurchaseOrder.find({ ...tenantQuery, status: 'issued' });
        const pendingReceipts = pendingOrders.reduce((acc, order) => {
            return acc + order.items.reduce((sum, item) => sum + item.quantity, 0);
        }, 0);

        // Top Selling Items (top 5 from Sales Orders)
        const topSellingItems = await SalesOrder.aggregate([
            { $match: tenantQuery },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.item',
                    name: { $first: '$items.name' },
                    totalSold: { $sum: '$items.quantity' }
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: 5 }
        ]);

        res.json({
            userName: req.user.name,
            companyName,
            totalItems,
            lowStockItems,
            outOfStockItems,
            todayInward: todayInward[0] || { total: 0, count: 0 },
            todayOutward: todayOutward[0] || { total: 0, count: 0 },
            stockValue: stockValue[0]?.totalValue || 0,
            categoryDistribution,
            salesActivity: salesActivity.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {}),
            purchaseActivity: purchaseActivity.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {}),
            totalSales: salesStats[0]?.totalSales || 0,
            totalPurchase: purchaseStats[0]?.totalPurchase || 0,
            totalItemsCount: totalItems, // Fixed bug: was totalItemsCount
            pendingReceipts,
            totalCategories,
            topSellingItems
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get low stock items
// @route   GET /api/dashboard/low-stock
// @access  Private
export const getLowStockItems = async (req, res, next) => {
    try {
        const lowStockItems = await Item.find({
            $expr: { $lte: ['$quantity', '$minStockThreshold'] }
        })
            .populate('category', 'name')
            .sort({ quantity: 1 })
            .limit(20);

        res.json(lowStockItems);
    } catch (error) {
        next(error);
    }
};

// @desc    Get recent transactions
// @route   GET /api/dashboard/recent-transactions
// @access  Private
export const getRecentTransactions = async (req, res, next) => {
    try {
        const transactions = await Transaction.find()
            .populate('item', 'name barcode')
            .populate('user', 'name')
            .sort({ createdAt: -1 })
            .limit(10);

        res.json(transactions);
    } catch (error) {
        next(error);
    }
};

// @desc    Get stock movement trend (last 7 days)
// @route   GET /api/dashboard/stock-trend
// @access  Private
export const getStockTrend = async (req, res, next) => {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const trend = await Transaction.aggregate([
            {
                $match: {
                    createdAt: { $gte: sevenDaysAgo }
                }
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        type: '$type'
                    },
                    total: { $sum: '$quantity' }
                }
            },
            {
                $sort: { '_id.date': 1 }
            }
        ]);

        res.json(trend);
    } catch (error) {
        next(error);
    }
};
