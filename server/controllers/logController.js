import ActionLog from '../models/ActionLog.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';
import { tenantQuery } from '../utils/tenantQuery.js';
import { AppUser } from '../models/User.js'; // Needed to resolve the ref in populate

// @desc    Get action logs
// @route   GET /api/logs
// @access  Private (Admin only)
export const getLogs = async (req, res, next) => {
    try {
        const { page = 1, limit = 50, entityNumber = '', user = '' } = req.query;
        
        const query = { ...tenantQuery(req) };
        
        if (entityNumber) {
            query.entityNumber = { $regex: entityNumber, $options: 'i' };
        }
        
        if (user) {
            query.user = user;
        }

        const logs = await ActionLog.find(query)
            .populate({ path: 'user', model: AppUser, select: 'name email role' })
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        // Normalise: if populate didn't resolve (cross-db), fall back to stored fields
        const normalisedLogs = logs.map(log => {
            const obj = log.toObject();
            if (!obj.user || typeof obj.user === 'string' || (typeof obj.user === 'object' && !obj.user.name)) {
                obj.user = {
                    _id: obj.user,
                    name: obj.userName || 'Unknown',
                    role: obj.userRole || ''
                };
            }
            return obj;
        });

        const total = await ActionLog.countDocuments(query);

        sendResponse(res, 200, {
            logs: normalisedLogs,
            totalPages: Math.ceil(total / limit),
            currentPage: Number(page),
            totalLogs: total
        }, 'Logs fetched successfully');
    } catch (error) {
        next(error);
    }
};
