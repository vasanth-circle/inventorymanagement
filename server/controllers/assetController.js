import Asset from '../models/Asset.js';
import Location from '../models/Location.js';
import { AppUser } from '../models/User.js';

// Helper: generate next asset tag for a tenant
const generateAssetTag = async (tenantId) => {
    const count = await Asset.countDocuments({ tenantId });
    const padded = String(count + 1).padStart(4, '0');
    return `AST-${padded}`;
};

// @desc    Get all assets
// @route   GET /api/assets
// @access  Private
export const getAssets = async (req, res) => {
    try {
        const { status, assetType, category, branch, search } = req.query;
        const filter = { tenantId: req.user.tenantId };

        if (status) filter.status = status;
        if (assetType) filter.assetType = assetType;
        if (category) filter.category = category;
        if (branch) filter.branch = branch;
        if (search) filter.name = { $regex: search, $options: 'i' };

        const assets = await Asset.find(filter)
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
        const retiredAssets = assets.filter(a => a.status === 'Retired').length;

        // Financial totals
        const totalPurchaseValue = assets.reduce((sum, a) => sum + (a.purchaseCost || 0), 0);
        const totalCurrentValue = assets.reduce((sum, a) => sum + (a.currentValue || a.purchaseCost || 0), 0);

        // Warranty alerts (expiring within 30 days)
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        const warrantyExpiringSoon = assets.filter(a =>
            a.warrantyExpiry && new Date(a.warrantyExpiry) <= thirtyDaysFromNow && new Date(a.warrantyExpiry) >= new Date()
        ).length;

        // Insurance expiring (vehicles)
        const insuranceExpiringSoon = assets.filter(a =>
            a.insuranceData?.expiryDate &&
            new Date(a.insuranceData.expiryDate) <= thirtyDaysFromNow &&
            new Date(a.insuranceData.expiryDate) >= new Date()
        ).length;

        // Status breakdown (for chart)
        const statusBreakdown = {
            Available: assets.filter(a => a.status === 'Available').length,
            Assigned: assets.filter(a => a.status === 'Assigned').length,
            'In Service': assets.filter(a => a.status === 'In Service').length,
            Returned: assets.filter(a => a.status === 'Returned').length,
            Retired: retiredAssets,
        };

        // Category breakdown
        const categoryBreakdown = {};
        assets.forEach(a => {
            const cat = a.category || 'Other';
            categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
        });

        // Type breakdown
        const typeBreakdown = {};
        assets.forEach(a => {
            typeBreakdown[a.assetType] = (typeBreakdown[a.assetType] || 0) + 1;
        });

        // Total maintenance cost
        const totalMaintenanceCost = assets.reduce((sum, a) => {
            return sum + (a.maintenanceLogs || []).reduce((s, log) => s + (log.cost || 0), 0);
        }, 0);

        // Get recent assets (populated)
        const recentAssets = await Asset.find({ tenantId: req.user.tenantId })
            .populate({ path: 'branch', model: Location, select: 'name' })
            .populate({ path: 'assignee', model: AppUser, select: 'name' })
            .sort({ createdAt: -1 })
            .limit(8);

        // Assets with warranty expiring soon (details for alerts)
        const warrantyAlerts = await Asset.find({
            tenantId: req.user.tenantId,
            warrantyExpiry: { $gte: new Date(), $lte: thirtyDaysFromNow }
        }).select('name assetTag warrantyExpiry category');

        const insuranceAlerts = await Asset.find({
            tenantId: req.user.tenantId,
            'insuranceData.expiryDate': { $gte: new Date(), $lte: thirtyDaysFromNow }
        }).select('name assetTag insuranceData.expiryDate');

        res.json({
            success: true,
            data: {
                totalAssets,
                totalSystems,
                totalVehicles,
                activeAssets,
                inServiceAssets,
                retiredAssets,
                warrantyExpiringSoon,
                insuranceExpiringSoon,
                totalPurchaseValue,
                totalCurrentValue,
                totalMaintenanceCost,
                statusBreakdown,
                categoryBreakdown,
                typeBreakdown,
                recentAssets,
                warrantyAlerts,
                insuranceAlerts,
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
        const {
            name, assetType, category, make, model, condition,
            serialNumber, insuranceData,
            purchaseDate, purchaseCost, currentValue, depreciationRate, vendor, warrantyExpiry,
            branch, assignee, status, notes
        } = req.body;

        const assetTag = await generateAssetTag(req.user.tenantId);

        const asset = new Asset({
            tenantId: req.user.tenantId,
            assetTag,
            name,
            assetType,
            category: category || 'Other',
            make,
            model,
            condition: condition || 'Good',
            serialNumber: (assetType === 'System' || assetType === 'Networking') ? serialNumber : undefined,
            insuranceData: assetType === 'Vehicle' ? insuranceData : undefined,
            purchaseDate: purchaseDate || undefined,
            purchaseCost: purchaseCost || 0,
            currentValue: currentValue || purchaseCost || 0,
            depreciationRate: depreciationRate || 0,
            vendor,
            warrantyExpiry: warrantyExpiry || undefined,
            branch,
            assignee: assignee || null,
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
        const {
            name, assetType, category, make, model, condition,
            serialNumber, insuranceData,
            purchaseDate, purchaseCost, currentValue, depreciationRate, vendor, warrantyExpiry,
            branch, assignee, status, notes
        } = req.body;

        let asset = await Asset.findOne({
            _id: req.params.id,
            tenantId: req.user.tenantId
        });

        if (!asset) {
            return res.status(404).json({ success: false, message: 'Asset not found' });
        }

        asset.name = name || asset.name;
        asset.assetType = assetType || asset.assetType;
        asset.category = category || asset.category;
        asset.make = make !== undefined ? make : asset.make;
        asset.model = model !== undefined ? model : asset.model;
        asset.condition = condition || asset.condition;

        if (asset.assetType === 'System' || asset.assetType === 'Networking') {
            asset.serialNumber = serialNumber;
            asset.insuranceData = undefined;
        } else if (asset.assetType === 'Vehicle') {
            asset.insuranceData = insuranceData;
            asset.serialNumber = undefined;
        } else {
            asset.serialNumber = undefined;
            asset.insuranceData = undefined;
        }

        if (purchaseDate !== undefined) asset.purchaseDate = purchaseDate || undefined;
        if (purchaseCost !== undefined) asset.purchaseCost = purchaseCost;
        if (currentValue !== undefined) asset.currentValue = currentValue;
        if (depreciationRate !== undefined) asset.depreciationRate = depreciationRate;
        if (vendor !== undefined) asset.vendor = vendor;
        if (warrantyExpiry !== undefined) asset.warrantyExpiry = warrantyExpiry || undefined;
        if (branch) asset.branch = branch;
        if (assignee !== undefined) asset.assignee = assignee || null;
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

// @desc    Add maintenance log to asset
// @route   POST /api/assets/:id/maintenance
// @access  Private
export const addMaintenanceLog = async (req, res) => {
    try {
        const { date, description, cost, performedBy, type } = req.body;

        if (!description) {
            return res.status(400).json({ success: false, message: 'Description is required' });
        }

        const asset = await Asset.findOne({
            _id: req.params.id,
            tenantId: req.user.tenantId
        });

        if (!asset) {
            return res.status(404).json({ success: false, message: 'Asset not found' });
        }

        asset.maintenanceLogs.unshift({
            date: date || new Date(),
            description,
            cost: cost || 0,
            performedBy,
            type: type || 'Other'
        });

        await asset.save();

        res.status(201).json({
            success: true,
            data: asset.maintenanceLogs[0],
            message: 'Maintenance log added'
        });
    } catch (error) {
        console.error('Error in addMaintenanceLog:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Get all maintenance logs across all assets (for timeline view)
// @route   GET /api/assets/maintenance/all
// @access  Private
export const getAllMaintenanceLogs = async (req, res) => {
    try {
        const assets = await Asset.find({ tenantId: req.user.tenantId })
            .select('name assetTag category maintenanceLogs')
            .populate({ path: 'assignee', model: AppUser, select: 'name' });

        const logs = [];
        assets.forEach(asset => {
            (asset.maintenanceLogs || []).forEach(log => {
                logs.push({
                    ...log.toObject(),
                    assetId: asset._id,
                    assetName: asset.name,
                    assetTag: asset.assetTag,
                    assetCategory: asset.category,
                });
            });
        });

        // Sort by date desc
        logs.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json({ success: true, count: logs.length, data: logs });
    } catch (error) {
        console.error('Error in getAllMaintenanceLogs:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};
