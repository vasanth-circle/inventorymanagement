import Item from '../models/Item.js';
import Transaction from '../models/Transaction.js';
import Category from '../models/Category.js';
import SalesOrder from '../models/SalesOrder.js';
import PurchaseOrder from '../models/PurchaseOrder.js';

// @desc    Get dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private
export const getDashboardStats = async (req, res, next) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Total items count
        const totalItems = await Item.countDocuments();

        // Low stock items count
        const lowStockItems = await Item.countDocuments({
            $expr: { $lte: ['$quantity', '$minStockThreshold'] }
        });

        // Out of stock items count
        const outOfStockItems = await Item.countDocuments({ quantity: 0 });

        // Today's inward transactions
        const todayInward = await Transaction.aggregate([
            {
                $match: {
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
            {
                $group: {
                    _id: null,
                    totalValue: { $sum: { $multiply: ['$quantity', '$price'] } }
                }
            }
        ]);

        // Sales Activity Counts
        const salesActivity = await SalesOrder.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Purchase Activity Counts
        const purchaseActivity = await PurchaseOrder.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Total Sales and Purchase Amount
        const salesStats = await SalesOrder.aggregate([
            { $match: { status: { $ne: 'void' } } },
            { $group: { _id: null, totalSales: { $sum: '$totalAmount' } } }
        ]);

        const purchaseStats = await PurchaseOrder.aggregate([
            { $match: { status: { $ne: 'void' } } },
            { $group: { _id: null, totalPurchase: { $sum: '$totalAmount' } } }
        ]);


        // Category-wise distribution
        const categoryDistribution = await Item.aggregate([
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

        // Inventory Summary Stats
        const totalItemsCount = await Item.aggregate([
            { $group: { _id: null, total: { $sum: '$quantity' } } }
        ]);

        const pendingOrders = await PurchaseOrder.find({ status: 'issued' });
        const pendingReceipts = pendingOrders.reduce((acc, order) => {
            return acc + order.items.reduce((sum, item) => sum + item.quantity, 0);
        }, 0);

        res.json({
            userName: req.user.name,
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
            totalItemsCount: totalItemsCount[0]?.total || 0,
            pendingReceipts,
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
