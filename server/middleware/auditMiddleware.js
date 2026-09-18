import ActionLog from '../models/ActionLog.js';
import { getTenantId } from '../utils/tenantContext.js';

export const auditLogMiddleware = (req, res, next) => {
    // Only log modifying requests
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        // Intercept response finish event
        res.on('finish', () => {
            // Check if request was successful (2xx status codes)
            if (res.statusCode >= 200 && res.statusCode < 300) {
                try {
                    const tenantId = getTenantId() || req.tenantId;
                    
                    if (!tenantId || !req.user) return; // Can't log without context
                    
                    // Create an action string (e.g. POST /api/items -> Create Item)
                    const pathParts = req.baseUrl ? req.baseUrl.split('/') : req.path.split('/');
                    const entity = pathParts[pathParts.length - 1] || 'Unknown';
                    const methodToAction = {
                        'POST': 'Created',
                        'PUT': 'Updated',
                        'PATCH': 'Updated',
                        'DELETE': 'Deleted'
                    };
                    const action = methodToAction[req.method] || req.method;

                    ActionLog.create({
                        tenantId: tenantId,
                        user: req.user._id,
                        userName: req.user.name,
                        userRole: req.user.role,
                        action: action,
                        entityType: entity,
                        entityId: req.user._id, // Ideally, we'd capture the actual created entity ID from res.body, but res.on('finish') doesn't have it easily. Using user ID as fallback.
                        description: `${action} operation on ${entity} via ${req.originalUrl}`
                    }).catch(err => {
                        console.error('Audit Log Error:', err.message);
                    });
                } catch (error) {
                    console.error('Audit Log Sync Error:', error.message);
                }
            }
        });
    }
    next();
};
