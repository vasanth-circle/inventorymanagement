import Location from '../models/Location.js';
import { tenantQuery } from '../utils/tenantQuery.js';

// @desc    Get all locations
// @route   GET /api/locations
// @access  Private
export const getLocations = async (req, res, next) => {
    try {
        const query = { ...tenantQuery(req), isActive: true };
        if (req.query.type) {
            if (req.query.type === 'inventory') {
                // Support legacy records where type field might be missing
                query.$or = [
                    { type: 'inventory' },
                    { type: { $exists: false } },
                    { type: null }
                ];
            } else {
                query.type = req.query.type;
            }
        }
        const locations = await Location.find(query).sort({ name: 1 });
        res.json(locations);
    } catch (error) {
        next(error);
    }
};

// @desc    Create a new location
// @route   POST /api/locations
// @access  Private/Admin
export const createLocation = async (req, res, next) => {
    try {
        const { name, description, type } = req.body;

        const locationExists = await Location.findOne({ 
            name: { $regex: new RegExp(`^${name}$`, 'i') },
            type: type || 'inventory',
            ...tenantQuery(req) 
        });

        if (locationExists) {
            return res.status(400).json({ message: 'Location already exists' });
        }

        const location = await Location.create({
            name,
            description,
            type: type || 'inventory',
            tenantId: req.tenantId
        });

        res.status(201).json(location);
    } catch (error) {
        next(error);
    }
};

// @desc    Update a location
// @route   PUT /api/locations/:id
// @access  Private/Admin
export const updateLocation = async (req, res, next) => {
    try {
        const { name, description, isActive, type } = req.body;

        let location = await Location.findOne({ _id: req.params.id, ...tenantQuery(req) });

        if (!location) {
            return res.status(404).json({ message: 'Location not found' });
        }

        location.name = name || location.name;
        location.description = description !== undefined ? description : location.description;
        location.isActive = isActive !== undefined ? isActive : location.isActive;
        location.type = type || location.type;

        await location.save();

        res.json(location);
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a location
// @route   DELETE /api/locations/:id
// @access  Private/Admin
export const deleteLocation = async (req, res, next) => {
    try {
        const location = await Location.findOne({ _id: req.params.id, ...tenantQuery(req) });

        if (!location) {
            return res.status(404).json({ message: 'Location not found' });
        }

        // Soft delete
        location.isActive = false;
        await location.save();

        res.json({ message: 'Location removed' });
    } catch (error) {
        next(error);
    }
};
