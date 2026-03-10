import Joi from 'joi';

export const validateRequest = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body, { abortEarly: false });

        if (error) {
            const errors = error.details.map(detail => detail.message);
            return res.status(400).json({ message: 'Validation Error', errors });
        }

        next();
    };
};

// Validation schemas
export const schemas = {
    register: Joi.object({
        name: Joi.string().required().trim(),
        email: Joi.string().email().required().trim().lowercase(),
        password: Joi.string().min(6).required(),
        role: Joi.string().valid('admin', 'manager', 'staff', 'tenant_owner').default('staff'),
        menuAccess: Joi.string().valid('all', 'specific', null).optional(),
        allowedMenus: Joi.array().items(Joi.string().allow('')).optional(),
        tenantId: Joi.string().optional(),
    }),

    login: Joi.object({
        email: Joi.string().email().required().trim().lowercase(),
        password: Joi.string().required(),
    }),

    updateUser: Joi.object({
        name: Joi.string().optional().trim(),
        email: Joi.string().email().optional().trim().lowercase(),
        role: Joi.string().valid('admin', 'manager', 'staff', 'tenant_owner').optional(),
        menuAccess: Joi.string().valid('all', 'specific', null).optional(),
        allowedMenus: Joi.array().items(Joi.string().allow('')).optional(),
        isActive: Joi.boolean().optional(),
    }),

    createItem: Joi.object({
        name: Joi.string().required().trim(),
        barcode: Joi.string().optional().trim(),
        sku: Joi.string().optional().trim(),
        category: Joi.string().required(),
        quantity: Joi.number().min(0).default(0),
        minStockThreshold: Joi.number().min(0).default(10),
        price: Joi.number().min(0).required(),
        location: Joi.string().optional().trim(),
        description: Joi.string().optional().allow('').trim(),
        customFields: Joi.any().optional(),
    }),

    updateItem: Joi.object({
        name: Joi.string().optional().trim(),
        barcode: Joi.string().optional().trim(),
        category: Joi.string().optional(),
        quantity: Joi.number().min(0).optional(),
        minStockThreshold: Joi.number().min(0).optional(),
        price: Joi.number().min(0).optional(),
        location: Joi.string().optional().trim(),
        description: Joi.string().optional().allow('').trim(),
        customFields: Joi.any().optional(),
    }),

    createTransaction: Joi.object({
        item: Joi.string().required(),
        type: Joi.string().valid('inward', 'outward', 'transfer', 'adjustment', 'return').required(),
        quantity: Joi.number().min(1).required(),
        reason: Joi.string().optional().trim(),
        fromLocation: Joi.string().optional().trim(),
        toLocation: Joi.string().optional().trim(),
        notes: Joi.string().optional().trim(),
    }),

    createCategory: Joi.object({
        name: Joi.string().required().trim(),
        description: Joi.string().optional().trim(),
    }),
};
