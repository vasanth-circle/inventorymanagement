import Asset from '../models/Asset.js';
import Location from '../models/Location.js';
import { AppUser } from '../models/User.js';

// @desc    Get all assets
// @route   GET /api/assets
// @access  Private
export const getAssets = async (req, res) => {
    try {
        const assets = await Asset.find({ tenantId: req.user.tenantId })
            .populate({ path: 'branch', model: Location, select: 'name mapLink' })
            .populate({ path: 'assignee', model: AppUser, select: 'name email role' })
            .populate({ path: 'createdBy', model: AppUser, select: 'name' })
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: assets.length,
            data: assets
        });
    } catch (error) {
        console.error('Error in getAssets:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Get asset statistics for dashboard
// @route   GET /api/assets/dashboard
// @access  Private
export const getAssetStats = async (req, res) => {
    try {
        const assets = await Asset.find({ tenantId: req.user.tenantId });

        const totalAssets = assets.length;
        const totalSystems = assets.filter(a => a.assetType === 'System').length;
        const totalVehicles = assets.filter(a => a.assetType === 'Vehicle').length;
        const activeAssets = assets.filter(a => a.status === 'Available' || a.status === 'Assigned').length;
        const inServiceAssets = assets.filter(a => a.status === 'In Service').length;

        // Get recent assets
        const recentAssets = await Asset.find({ tenantId: req.user.tenantId })
            .populate({ path: 'branch', model: Location, select: 'name' })
            .populate({ path: 'assignee', model: AppUser, select: 'name' })
            .sort({ createdAt: -1 })
            .limit(5);

        res.json({
            success: true,
            data: {
                totalAssets,
                totalSystems,
                totalVehicles,
                activeAssets,
                inServiceAssets,
                recentAssets
            }
        });
    } catch (error) {
        console.error('Error in getAssetStats:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Get single asset
// @route   GET /api/assets/:id
// @access  Private
export const getAssetById = async (req, res) => {
    try {
        const asset = await Asset.findOne({ 
            _id: req.params.id, 
            tenantId: req.user.tenantId 
        })
        .populate({ path: 'branch', model: Location, select: 'name mapLink' })
        .populate({ path: 'assignee', model: AppUser, select: 'name email role' })
        .populate({ path: 'createdBy', model: AppUser, select: 'name' });

        if (!asset) {
            return res.status(404).json({ success: false, message: 'Asset not found' });
        }

        res.json({ success: true, data: asset });
    } catch (error) {
        console.error('Error in getAssetById:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Create new asset
// @route   POST /api/assets
// @access  Private
export const createAsset = async (req, res) => {
    try {
        const { name, assetType, serialNumber, insuranceData, branch, assignee, status, notes } = req.body;

        const asset = new Asset({
            tenantId: req.user.tenantId,
            name,
            assetType,
            serialNumber: assetType === 'System' ? serialNumber : undefined,
            insuranceData: assetType === 'Vehicle' ? insuranceData : undefined,
            branch,
            assignee: assignee || null, // Allow unassigned
            status: status || 'Available',
            notes,
            createdBy: req.user._id
        });

        const savedAsset = await asset.save();
        
        const populatedAsset = await Asset.findById(savedAsset._id)
            .populate({ path: 'branch', model: Location, select: 'name mapLink' })
            .populate({ path: 'assignee', model: AppUser, select: 'name email role' })
            .populate({ path: 'createdBy', model: AppUser, select: 'name' });

        res.status(201).json({
            success: true,
            data: populatedAsset,
            message: 'Asset created successfully'
        });
    } catch (error) {
        console.error('Error in createAsset:', error);
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ success: false, message: messages.join(', ') });
        }
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Update asset
// @route   PUT /api/assets/:id
// @access  Private
export const updateAsset = async (req, res) => {
    try {
        const { name, assetType, serialNumber, insuranceData, branch, assignee, status, notes } = req.body;

        let asset = await Asset.findOne({ 
            _id: req.params.id, 
            tenantId: req.user.tenantId 
        });

        if (!asset) {
            return res.status(404).json({ success: false, message: 'Asset not found' });
        }

        asset.name = name || asset.name;
        asset.assetType = assetType || asset.assetType;
        
        if (asset.assetType === 'System') {
            asset.serialNumber = serialNumber;
            asset.insuranceData = undefined; // Clear vehicle data if changed type
        } else if (asset.assetType === 'Vehicle') {
            asset.insuranceData = insuranceData;
            asset.serialNumber = undefined; // Clear system data
        } else {
            asset.serialNumber = undefined;
            asset.insuranceData = undefined;
        }

        if (branch) asset.branch = branch;
        if (assignee !== undefined) asset.assignee = assignee || null; // allow unassigning
        if (status) asset.status = status;
        if (notes !== undefined) asset.notes = notes;

        await asset.save();

        const updatedAsset = await Asset.findById(asset._id)
            .populate({ path: 'branch', model: Location, select: 'name mapLink' })
            .populate({ path: 'assignee', model: AppUser, select: 'name email role' })
            .populate({ path: 'createdBy', model: AppUser, select: 'name' });

        res.json({
            success: true,
            data: updatedAsset,
            message: 'Asset updated successfully'
        });
    } catch (error) {
        console.error('Error in updateAsset:', error);
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ success: false, message: messages.join(', ') });
        }
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Delete asset
// @route   DELETE /api/assets/:id
// @access  Private
export const deleteAsset = async (req, res) => {
    try {
        const asset = await Asset.findOne({ 
            _id: req.params.id, 
            tenantId: req.user.tenantId 
        });

        if (!asset) {
            return res.status(404).json({ success: false, message: 'Asset not found' });
        }

        await asset.deleteOne();

        res.json({
            success: true,
            message: 'Asset deleted successfully'
        });
    } catch (error) {
        console.error('Error in deleteAsset:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};
