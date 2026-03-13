import Category from '../models/Category.js';

// @desc    Get all categories
// @route   GET /api/categories
// @access  Private
export const getCategories = async (req, res, next) => {
    try {
        const categories = await Category.find({ tenantId: req.tenantId }).sort({ name: 1 });
        res.json(categories);
    } catch (error) {
        next(error);
    }
};

// @desc    Create new category
// @route   POST /api/categories
// @access  Private
export const createCategory = async (req, res, next) => {
    try {
        const { name, description } = req.body;

        const category = await Category.create({ 
            name, 
            description,
            tenantId: req.tenantId
        });
        res.status(201).json(category);
    } catch (error) {
        next(error);
    }
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private
export const updateCategory = async (req, res, next) => {
    try {
        const category = await Category.findOneAndUpdate(
            { _id: req.params.id, tenantId: req.tenantId },
            req.body,
            { new: true, runValidators: true }
        );

        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }

        res.json(category);
    } catch (error) {
        next(error);
    }
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private/Admin
export const deleteCategory = async (req, res, next) => {
    try {
        const category = await Category.findOne({ _id: req.params.id, tenantId: req.tenantId });

        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }

        await Category.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        next(error);
    }
};
