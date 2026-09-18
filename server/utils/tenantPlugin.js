import { getTenantId } from './tenantContext.js';

export default function tenantPlugin(schema) {
    // Only apply if the schema actually has a tenantId field
    if (!schema.path('tenantId')) return;

    // Apply to all find operations
    const operations = ['find', 'findOne', 'countDocuments', 'count', 'findOneAndUpdate', 'updateOne', 'updateMany', 'deleteMany', 'deleteOne'];
    
    operations.forEach(op => {
        schema.pre(op, function (next) {
            const tenantId = getTenantId();
            if (tenantId) {
                this.where({ tenantId });
            }
            next();
        });
    });

    // Apply to save operations (insert/update)
    schema.pre('save', function (next) {
        const tenantId = getTenantId();
        if (tenantId && !this.tenantId) {
            this.tenantId = tenantId;
        }
        next();
    });
}
