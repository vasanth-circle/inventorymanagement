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
        companyName: Joi.string().required().trim(),
        phone: Joi.string().required().trim(),
        termsAccepted: Joi.boolean().optional(),
        role: Joi.string().valid('admin', 'manager', 'staff', 'tenant_owner', 'tenant_admin').default('staff'),
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
        role: Joi.string().valid('admin', 'manager', 'staff', 'tenant_owner', 'tenant_admin').optional(),
        inventoryRole: Joi.string().optional().allow('', null),
        menuAccess: Joi.string().valid('all', 'specific', null).optional(),
        allowedMenus: Joi.array().items(Joi.string().allow('')).optional(),
        isActive: Joi.boolean().optional(),
    }),

    addUser: Joi.object({
        name: Joi.string().required().trim(),
        email: Joi.string().email().required().trim().lowercase(),
        password: Joi.string().min(6).required(),
        role: Joi.string().valid('admin', 'manager', 'staff', 'tenant_owner', 'tenant_admin').optional().default('staff'),
        inventoryRole: Joi.string().optional().allow('', null),
        isActive: Joi.boolean().optional().default(true),
        menuAccess: Joi.string().valid('all', 'specific', null).optional().default('all'),
        allowedMenus: Joi.array().items(Joi.string().allow('')).optional().default([]),
    }),

    createItem: Joi.object({
        name: Joi.string().required().trim(),
        barcode: Joi.string().optional().trim(),
        hsn: Joi.string().optional().allow('').trim(),
        sku: Joi.string().optional().trim(),
        category: Joi.string().required(),
        quantity: Joi.number().min(0).default(0),
        minStockThreshold: Joi.number().min(0).default(10),
        price: Joi.number().min(0).required(),
        purchasePrice: Joi.number().min(0).optional(),
        location: Joi.string().optional().trim(),
        description: Joi.string().optional().allow('').trim(),
        size: Joi.string().optional().allow('').trim(),
        brand: Joi.string().optional().allow('').trim(),
        pcsPerBox: Joi.number().min(1).default(1),
        sqFtPerPc: Joi.number().min(0).optional(),
        customFields: Joi.any().optional(),
    }),

    updateItem: Joi.object({
        name: Joi.string().optional().trim(),
        barcode: Joi.string().optional().trim(),
        hsn: Joi.string().optional().allow('').trim(),
        category: Joi.string().optional(),
        quantity: Joi.number().min(0).optional(),
        minStockThreshold: Joi.number().min(0).optional(),
        price: Joi.number().min(0).optional(),
        purchasePrice: Joi.number().min(0).optional(),
        location: Joi.string().optional().trim(),
        description: Joi.string().optional().allow('').trim(),
        size: Joi.string().optional().allow('').trim(),
        brand: Joi.string().optional().allow('').trim(),
        pcsPerBox: Joi.number().min(1).optional(),
        sqFtPerPc: Joi.number().min(0).optional(),
        customFields: Joi.any().optional(),
    }),

    createTransaction: Joi.object({
        item: Joi.string().required(),
        type: Joi.string().valid('inward', 'outward', 'transfer', 'adjustment', 'return').required(),
        returnType: Joi.string().valid('customer', 'vendor').optional(),
        adjustmentType: Joi.string().valid('add', 'subtract').optional(),
        quantity: Joi.number().min(1).required(),
        damagedQuantity: Joi.number().min(0).optional(),
        reason: Joi.string().optional().trim().allow(''),
        fromLocation: Joi.string().optional().trim(),
        toLocation: Joi.string().optional().trim(),
        notes: Joi.string().optional().trim().allow(''),
    }),

    createCategory: Joi.object({
        name: Joi.string().required().trim(),
        description: Joi.string().optional().allow('').trim(),
    }),
    createLocation: Joi.object({
        name: Joi.string().required().trim(),
        description: Joi.string().optional().allow('').trim(),
    }),
    updateLocation: Joi.object({
        name: Joi.string().optional().trim(),
        description: Joi.string().optional().allow('').trim(),
        isActive: Joi.boolean().optional(),
    }),
};
