import Location from '../models/Location.js';

// @desc    Get all locations
// @route   GET /api/locations
// @access  Private
export const getLocations = async (req, res, next) => {
    try {
        const locations = await Location.find({ isActive: true }).sort({ name: 1 });
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
        const { name, description } = req.body;

        const locationExists = await Location.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });

        if (locationExists) {
            return res.status(400).json({ message: 'Location already exists' });
        }

        const location = await Location.create({
            name,
            description,
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
        const { name, description, isActive } = req.body;

        let location = await Location.findById(req.params.id);

        if (!location) {
            return res.status(404).json({ message: 'Location not found' });
        }

        location.name = name || location.name;
        location.description = description !== undefined ? description : location.description;
        location.isActive = isActive !== undefined ? isActive : location.isActive;

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
        const location = await Location.findById(req.params.id);

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
