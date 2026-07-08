import cron from 'node-cron';
import ReportSchedule from '../models/ReportSchedule.js';
import Item from '../models/Item.js';
import Customer from '../models/Customer.js';
// Import mailer etc

export const initScheduledJobs = () => {
    // Run every hour to check for matching schedules
    cron.schedule('0 * * * *', async () => {
        try {
            console.log('[Scheduled Jobs] Running schedule check...');
            const now = new Date();
            const currentHour = now.getHours().toString().padStart(2, '0') + ':00';
            const currentDay = now.getDay();
            
            // Find active schedules that should run now
            const schedules = await ReportSchedule.find({ 
                isActive: true,
                time: currentHour,
                $or: [
                    { frequency: 'daily' },
                    { frequency: 'weekly', dayOfWeek: currentDay }
                ]
            });

            for (const schedule of schedules) {
                console.log(`[Scheduled Jobs] Running report: ${schedule.name} for tenant ${schedule.tenantId}`);
                let reportData = '';
                
                if (schedule.reportType === 'daily_stock') {
                    const items = await Item.find({ tenantId: schedule.tenantId }).limit(10);
                    reportData = `Found ${items.length} items. Total value ...`;
                } else if (schedule.reportType === 'overdue_payments') {
                    const customers = await Customer.find({ tenantId: schedule.tenantId, currentBalance: { $gt: 0 } }).limit(10);
                    reportData = `Found ${customers.length} customers with overdue payments.`;
                }
                
                // Simulate sending email
                console.log(`[Scheduled Jobs] Sending ${schedule.reportType} to ${schedule.recipients.join(',')}: ${reportData}`);
                
                schedule.lastRunAt = new Date();
                await schedule.save();
            }
        } catch (error) {
            console.error('[Scheduled Jobs] Error running jobs:', error);
        }
    });
};
