import Joi from 'joi';

export const validateRequest = (schema) => {
    return (req, res, next) => {
        if (req.body.role) {
            console.log(`Validating role: "${req.body.role}"`);
        }
        const { error } = schema.validate(req.body, { abortEarly: false });

        if (error) {
            console.log('Validation Error details:', error.details.map(d => d.message));
            const errors = error.details.map(detail => detail.message);
            return res.status(400).json({ message: 'Validation Error', errors });
        }

        next();
    };
};

// Validation schemas
const ALLOWED_ROLES = [
    'admin', 'manager', 'sales_person', 'sales person', 'sales user', 
    'accounts', 'godown_staff', 'godown staff', 'staff', 
    'tenant_owner', 'tenant_admin', 'super_admin', 'tenant user', 'tenant_user'
];

export const schemas = {
    register: Joi.object({
        name: Joi.string().required().trim(),
        email: Joi.string().email().required().trim().lowercase(),
        password: Joi.string().min(6).required(),
        companyName: Joi.string().required().trim(),
        phone: Joi.string().required().trim(),
        termsAccepted: Joi.boolean().optional(),
        role: Joi.string().optional().allow('').default('staff'),
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
        role: Joi.string().optional().allow(''),
        inventoryRole: Joi.string().optional().allow('', null),
        menuAccess: Joi.string().valid('all', 'specific', null).optional(),
        allowedMenus: Joi.array().items(Joi.string().allow('')).optional(),
        isActive: Joi.boolean().optional(),
        branchIds: Joi.array().items(Joi.string().allow('')).optional().default([]),
    }),

    addUser: Joi.object({
        name: Joi.string().required().trim(),
        email: Joi.string().email().required().trim().lowercase(),
        password: Joi.string().min(6).required(),
        role: Joi.string().optional().allow('').default('staff'),
        inventoryRole: Joi.string().optional().allow('', null),
        isActive: Joi.boolean().optional().default(true),
        menuAccess: Joi.string().valid('all', 'specific', null).optional().default('all'),
        allowedMenus: Joi.array().items(Joi.string().allow('')).optional().default([]),
        branchIds: Joi.array().items(Joi.string().allow('')).optional().default([]),
    }),

    createItem: Joi.object({
        name: Joi.string().required().trim(),
        barcode: Joi.string().optional().allow('').trim(),
        partNumber: Joi.string().optional().allow('').trim(),
        hsn: Joi.string().optional().allow('').trim(),
        sku: Joi.string().optional().trim(),
        category: Joi.string().required(),
        quantity: Joi.number().min(0).default(0),
        minStockThreshold: Joi.number().min(0).default(10),
        price: Joi.number().min(0).optional().allow('', null),
        purchasePrice: Joi.number().min(0).optional().allow('', null),
        location: Joi.string().optional().trim(),
        description: Joi.string().optional().allow('').trim(),
        size: Joi.string().optional().allow('').trim(),
        brand: Joi.string().optional().allow('').trim(),
        pcsPerBox: Joi.number().min(1).default(1),
        sqFtPerPc: Joi.number().min(0).optional().allow('', null),
        customFields: Joi.any().optional(),
    }).unknown(true),

    updateItem: Joi.object({
        name: Joi.string().optional().trim(),
        barcode: Joi.string().optional().allow('').trim(),
        partNumber: Joi.string().optional().allow('').trim(),
        hsn: Joi.string().optional().allow('').trim(),
        category: Joi.string().optional(),
        quantity: Joi.number().min(0).optional(),
        minStockThreshold: Joi.number().min(0).optional(),
        price: Joi.number().min(0).optional().allow('', null),
        purchasePrice: Joi.number().min(0).optional().allow('', null),
        location: Joi.string().optional().trim(),
        description: Joi.string().optional().allow('').trim(),
        size: Joi.string().optional().allow('').trim(),
        brand: Joi.string().optional().allow('').trim(),
        pcsPerBox: Joi.number().min(1).optional(),
        sqFtPerPc: Joi.number().min(0).optional().allow('', null),
        customFields: Joi.any().optional(),
    }).unknown(true),

    createTransaction: Joi.object({
        item: Joi.string().required(),
        type: Joi.string().valid('inward', 'outward', 'transfer', 'adjustment', 'return').optional(),
        returnType: Joi.string().valid('customer', 'vendor').optional(),
        adjustmentType: Joi.string().valid('add', 'subtract').optional(),
        quantity: Joi.number().min(1).required(),
        damagedQuantity: Joi.number().min(0).optional(),
        reason: Joi.string().optional().trim().allow(''),
        fromLocation: Joi.string().optional().trim(),
        toLocation: Joi.string().optional().trim(),
        notes: Joi.string().optional().trim().allow(''),
        price: Joi.number().min(0).optional(),
        batchNumber: Joi.string().optional().allow(''),
    }),

    createCategory: Joi.object({
        name: Joi.string().required().trim(),
        description: Joi.string().optional().allow('').trim(),
    }),
    createLocation: Joi.object({
        name: Joi.string().required().trim(),
        description: Joi.string().optional().allow('').trim(),
        type: Joi.string().valid('inventory', 'asset').optional(),
    }),
    updateLocation: Joi.object({
        name: Joi.string().optional().trim(),
        description: Joi.string().optional().allow('').trim(),
        isActive: Joi.boolean().optional(),
        type: Joi.string().valid('inventory', 'asset').optional(),
    }),
};
