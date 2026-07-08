import SalesOrder from '../models/SalesOrder.js';
import Item from '../models/Item.js';

/**
 * Basic statistical forecasting simulating AI insights.
 * Analyzes past 30 days of sales to predict out-of-stock dates.
 */
export const generateDemandForecast = async (tenantId) => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Aggregate sales volume per item in the last 30 days
        const salesData = await SalesOrder.aggregate([
            { $match: { tenantId, createdAt: { $gte: thirtyDaysAgo }, isEstimation: false, status: { $ne: 'cancelled' } } },
            { $unwind: "$items" },
            { $group: {
                _id: "$items.item",
                totalQuantitySold: { $sum: "$items.quantity" },
                orderCount: { $sum: 1 }
            }}
        ]);

        const insights = [];
        const items = await Item.find({ tenantId, _id: { $in: salesData.map(d => d._id) } });

        for (const data of salesData) {
            const item = items.find(i => i._id.toString() === data._id.toString());
            if (!item) continue;

            const dailyRunRate = data.totalQuantitySold / 30; // Avg sold per day
            const currentStock = item.quantity;
            
            if (dailyRunRate > 0) {
                const daysUntilStockout = Math.floor(currentStock / dailyRunRate);
                
                if (daysUntilStockout <= 7) {
                    insights.push({
                        type: 'critical',
                        itemId: item._id,
                        itemName: item.name,
                        message: `Critical: ${item.name} will run out in ~${daysUntilStockout} days. Recent velocity: ${dailyRunRate.toFixed(1)} units/day.`,
                        suggestedAction: `Create PO for at least ${Math.ceil(dailyRunRate * 30)} units (30-day supply).`
                    });
                } else if (data.orderCount > 10 && dailyRunRate > (currentStock * 0.1)) {
                    insights.push({
                        type: 'trending',
                        itemId: item._id,
                        itemName: item.name,
                        message: `Trending: ${item.name} is moving fast (${data.totalQuantitySold} sold recently). Ensure supply chain is ready.`
                    });
                }
            }
        }
        
        // Find dead stock (items not sold in 30 days with high stock)
        const activeItemIds = salesData.map(d => d._id.toString());
        const deadStockItems = await Item.find({ 
            tenantId, 
            _id: { $nin: activeItemIds },
            quantity: { $gt: 10 }
        }).limit(5);

        for (const dead of deadStockItems) {
            insights.push({
                type: 'dead_stock',
                itemId: dead._id,
                itemName: dead.name,
                message: `Dead Stock: ${dead.name} has ${dead.quantity} units sitting idle. No sales in the last 30 days.`,
                suggestedAction: 'Consider applying a discount or bundle offer.'
            });
        }

        return insights;
    } catch (error) {
        console.error('AI Insights Error:', error);
        throw error;
    }
};
