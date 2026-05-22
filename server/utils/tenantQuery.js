/**
 * Builds a MongoDB $in filter for tenantId that matches BOTH:
 *   - New records: stored with tenant._id (ObjectId)
 *   - Legacy records: stored with tenantCode string (e.g. "T-1776227770474")
 *
 * Usage for READ queries:
 *   const query = { ...tenantQuery(req), isActive: true };
 *   Model.find(query)
 *
 * Usage for WRITE operations (create / update):
 *   Model.create({ ...req.body, tenantId: req.tenantId })
 *   — always use req.tenantId directly for writes (ObjectId for new records)
 */
import mongoose from 'mongoose';

export const tenantQuery = (req) => {
    const ids = [];
    
    if (req.tenantId) ids.push(req.tenantId);
    
    // Only add tenantCode if it's a valid ObjectId string or if we are certain the model handles strings
    // For safety with current strictly-typed ObjectId models, we prioritize the validated tenantId.
    if (req.tenantCode && String(req.tenantCode) !== String(req.tenantId)) {
        if (mongoose.Types.ObjectId.isValid(req.tenantCode)) {
            ids.push(req.tenantCode);
        }
    }

    if (ids.length === 0) return { tenantId: null };
    if (ids.length === 1) return { tenantId: ids[0] };
    
    return { tenantId: { $in: ids } };
};

/**
 * Returns a branch-scoping filter for transactions based on user's assigned branches.
 * Users with branchIds = [] (admins) see all branches.
 * Otherwise, scoped to their branches. `branchId` query param or X-Branch-Id header narrows further.
 */
export const branchFilter = (req) => {
    const branchIds = req.user?.branchIds || [];
    if (!branchIds.length) return {};
    const activeBranch = req.query.branchId || req.headers['x-branch-id'];
    if (activeBranch && branchIds.some(b => b.toString() === activeBranch)) {
        return { branchId: activeBranch };
    }
    return { branchId: { $in: branchIds } };
};
