import Brand from '../models/Brand.js';
import { tenantQuery } from '../utils/tenantQuery.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';

// @desc    Get all brands (optionally filter by categoryId)
// @route   GET /api/brands
// @access  Private
export const getBrands = async (req, res, next) => {
    try {
        const filter = { ...tenantQuery(req) };
        if (req.query.categoryId) {
            filter.categoryId = req.query.categoryId;
        }
        const brands = await Brand.find(filter)
            .populate('categoryId', 'name')
            .sort({ name: 1 });
        sendResponse(res, 200, brands);
    } catch (error) {
        next(error);
    }
};

// @desc    Create a new brand under a category
// @route   POST /api/brands
// @access  Private
export const createBrand = async (req, res, next) => {
    try {
        const { name, description, categoryId } = req.body;

        const exists = await Brand.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') }, categoryId, ...tenantQuery(req) });
        if (exists) {
            return sendError(res, 400, 'Brand with this name already exists in the selected category');
        }

        const brand = await Brand.create({
            name,
            description,
            categoryId,
            tenantId: req.tenantId,
        });

        const populated = await Brand.findById(brand._id).populate('categoryId', 'name');
        sendResponse(res, 201, populated, 'Brand created successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Update a brand
// @route   PUT /api/brands/:id
// @access  Private
export const updateBrand = async (req, res, next) => {
    try {
        const { name, description, categoryId } = req.body;
        const brand = await Brand.findOneAndUpdate(
            { _id: req.params.id, ...tenantQuery(req) },
            { name, description, categoryId },
            { new: true, runValidators: true }
        ).populate('categoryId', 'name');

        if (!brand) {
            return sendError(res, 404, 'Brand not found');
        }

        sendResponse(res, 200, brand, 'Brand updated successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a brand
// @route   DELETE /api/brands/:id
// @access  Private
export const deleteBrand = async (req, res, next) => {
    try {
        const brand = await Brand.findOneAndDelete({ _id: req.params.id, ...tenantQuery(req) });
        if (!brand) {
            return sendError(res, 404, 'Brand not found');
        }
        sendResponse(res, 200, null, 'Brand deleted successfully');
    } catch (error) {
        next(error);
    }
};
