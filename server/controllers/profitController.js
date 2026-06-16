import SalesOrder from '../models/SalesOrder.js';
import Item from '../models/Item.js';
import User from '../models/User.js';
import { tenantQuery } from '../utils/tenantQuery.js';

export const getProfitReport = async (req, res, next) => {
    try {
        const { from, to } = req.query;

        // Fetch all items to map their current purchase price
        const items = await Item.find({ ...tenantQuery(req) }).select('_id name purchasePrice category');
        const itemMap = {};
        items.forEach(item => {
            itemMap[item._id.toString()] = {
                name: item.name,
                purchasePrice: item.purchasePrice || 0,
                categoryId: item.category
            };
        });

        // Build query for SalesOrders
        const query = {
            ...tenantQuery(req),
            status: { $nin: ['cancelled', 'void', 'draft', 'quotation'] }
        };

        if (from || to) {
            query.orderDate = {};
            if (from) {
                const fromDate = new Date(from);
                fromDate.setHours(0, 0, 0, 0);
                query.orderDate.$gte = fromDate;
            }
            if (to) {
                const toDate = new Date(to);
                toDate.setHours(23, 59, 59, 999);
                query.orderDate.$lte = toDate;
            }
        }

        const orders = await SalesOrder.find(query)
            .populate('customer', 'name companyName')
            .populate({ path: 'user', model: User, select: 'name' })
            .sort({ orderDate: 1 });

        const billWise = [];
        const itemWiseMap = {};
        const dayWiseMap = {};

        let totalRevenue = 0;
        let totalCogs = 0;

        orders.forEach(order => {
            let orderRevenue = 0;
            let orderCogs = 0;
            const dateStr = new Date(order.orderDate).toLocaleDateString('en-GB');

            order.items.forEach(orderItem => {
                const itemIdStr = orderItem.item.toString();
                const itemData = itemMap[itemIdStr] || { name: orderItem.name || 'Unknown', purchasePrice: 0 };
                
                // Usually quantity is stored in `quantity`, `boxCount`, `totalSqFt` depending on billingUnit
                let quantityToUse = orderItem.quantity || 0;
                
                // In tiles industry, if price is per box, and purchase is per box, they match.
                // We'll use orderItem.total for revenue to account for any line-level differences
                const itemRevenue = orderItem.total || (quantityToUse * orderItem.price);
                const itemCogs = quantityToUse * itemData.purchasePrice;
                const itemProfit = itemRevenue - itemCogs;

                orderRevenue += itemRevenue;
                orderCogs += itemCogs;

                // Item-wise Aggregation
                if (!itemWiseMap[itemIdStr]) {
                    itemWiseMap[itemIdStr] = {
                        name: itemData.name,
                        qtySold: 0,
                        revenue: 0,
                        cogs: 0,
                        profit: 0
                    };
                }
                itemWiseMap[itemIdStr].qtySold += quantityToUse;
                itemWiseMap[itemIdStr].revenue += itemRevenue;
                itemWiseMap[itemIdStr].cogs += itemCogs;
                itemWiseMap[itemIdStr].profit += itemProfit;
            });

            const orderProfit = orderRevenue - orderCogs;
            
            // Bill-wise aggregation
            billWise.push({
                orderNumber: order.orderNumber,
                date: order.orderDate,
                customer: order.customer?.companyName || order.customer?.name || 'Walk-in',
                user: order.user?.name || 'System',
                revenue: orderRevenue,
                cogs: orderCogs,
                profit: orderProfit,
                margin: orderRevenue > 0 ? ((orderProfit / orderRevenue) * 100).toFixed(2) : 0
            });

            // Day-wise aggregation
            if (!dayWiseMap[dateStr]) {
                dayWiseMap[dateStr] = {
                    date: dateStr,
                    rawDate: new Date(order.orderDate).setHours(0,0,0,0),
                    revenue: 0,
                    cogs: 0,
                    profit: 0
                };
            }
            dayWiseMap[dateStr].revenue += orderRevenue;
            dayWiseMap[dateStr].cogs += orderCogs;
            dayWiseMap[dateStr].profit += orderProfit;

            totalRevenue += orderRevenue;
            totalCogs += orderCogs;
        });

        // Convert Maps to Arrays and sort
        const itemWise = Object.values(itemWiseMap).sort((a, b) => b.profit - a.profit);
        const dayWise = Object.values(dayWiseMap).sort((a, b) => a.rawDate - b.rawDate);

        res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalRevenue,
                    totalCogs,
                    totalProfit: totalRevenue - totalCogs,
                    marginPercent: totalRevenue > 0 ? (((totalRevenue - totalCogs) / totalRevenue) * 100).toFixed(2) : 0
                },
                billWise,
                dayWise,
                itemWise
            }
        });

    } catch (error) {
        next(error);
    }
};
