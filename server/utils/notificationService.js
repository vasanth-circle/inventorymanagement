import Notification from '../models/Notification.js';

/**
 * Sends an in-app notification by saving it to the database.
 * 
 * @param {Object} options - Notification options
 * @param {string} options.tenantId - The tenant ID
 * @param {string} [options.userId] - Specific user ID to notify
 * @param {string} [options.role] - Broadcast to a specific role instead of a user
 * @param {string} options.title - Notification title
 * @param {string} options.message - Notification body
 * @param {string} [options.type='info'] - 'info', 'success', 'warning', 'error'
 * @param {string} [options.link] - URL to redirect the user to
 */
export const sendNotification = async (options) => {
    try {
        const { tenantId, userId, role, title, message, type = 'info', link } = options;

        if (!tenantId) {
            console.warn('sendNotification: missing tenantId');
            return null;
        }

        const notification = await Notification.create({
            tenantId,
            userId,
            role,
            title,
            message,
            type,
            link
        });

        // In the future: Add WebSockets (Socket.io) here to push the notification instantly to the client
        // In the future: Add Email integration (e.g., SendGrid) here if type === 'warning' or user preferences allow
        
        return notification;
    } catch (error) {
        console.error('Error sending notification:', error);
        return null;
    }
};
