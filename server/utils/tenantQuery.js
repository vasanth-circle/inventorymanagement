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
export const tenantQuery = (req) => {
    const ids = [req.tenantId];
    if (req.tenantCode && String(req.tenantCode) !== String(req.tenantId)) {
        ids.push(req.tenantCode);
    }
    if (ids.length === 1) {
        // Only one value — simpler equality query, avoids $in overhead
        return { tenantId: ids[0] };
    }
    return { tenantId: { $in: ids } };
};
