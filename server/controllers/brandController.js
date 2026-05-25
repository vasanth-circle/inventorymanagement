import Brand from '../models/Brand.js';
import { tenantQuery } from '../utils/tenantQuery.js';

// @desc    Get all brands
// @route   GET /api/brands
// @access  Private
export const getBrands = async (req, res, next) => {
    try {
        const brands = await Brand.find({ ...tenantQuery(req) }).sort({ name: 1 });
        res.json(brands);
    } catch (error) {
        next(error);
    }
};

// @desc    Create new brand
// @route   POST /api/brands
// @access  Private
export const createBrand = async (req, res, next) => {
    try {
        const { name, description } = req.body;

        const brand = await Brand.create({ 
            name, 
            description,
            tenantId: req.tenantId
        });
        res.status(201).json(brand);
    } catch (error) {
        next(error);
    }
};

// @desc    Update brand
// @route   PUT /api/brands/:id
// @access  Private
export const updateBrand = async (req, res, next) => {
    try {
        const brand = await Brand.findOneAndUpdate(
            { _id: req.params.id, ...tenantQuery(req) },
            req.body,
            { new: true, runValidators: true }
        );

        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        res.json(brand);
    } catch (error) {
        next(error);
    }
};

// @desc    Delete brand
// @route   DELETE /api/brands/:id
// @access  Private/Admin
export const deleteBrand = async (req, res, next) => {
    try {
        const brand = await Brand.findOne({ _id: req.params.id, ...tenantQuery(req) });

        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        await Brand.findOneAndDelete({ _id: req.params.id, ...tenantQuery(req) });
        res.json({ message: 'Brand deleted successfully' });
    } catch (error) {
        next(error);
    }
};
