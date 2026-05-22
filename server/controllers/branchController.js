import mongoose from 'mongoose';
import Branch from '../models/Branch.js';
import Item from '../models/Item.js';
import Transaction from '../models/Transaction.js';

// @desc    Get all branches for tenant
// @route   GET /api/branches
// @access  Private
export const getBranches = async (req, res, next) => {
    try {
        const tenantId = req.tenantId;
        const branches = await Branch.find({ tenantId, isActive: true }).sort({ isHeadOffice: -1, name: 1 });
        res.json({ success: true, data: branches });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single branch
// @route   GET /api/branches/:id
// @access  Private
export const getBranch = async (req, res, next) => {
    try {
        const branch = await Branch.findOne({ _id: req.params.id, tenantId: req.tenantId });
        if (!branch) return res.status(404).json({ message: 'Branch not found' });
        res.json({ success: true, data: branch });
    } catch (error) {
        next(error);
    }
};

// @desc    Create a new branch
// @route   POST /api/branches
// @access  Private/Admin
export const createBranch = async (req, res, next) => {
    try {
        const { name, code, address, phone, isHeadOffice } = req.body;
        const tenantId = req.tenantId;

        // If this is head office, unset previous head office
        if (isHeadOffice) {
            await Branch.updateMany({ tenantId }, { isHeadOffice: false });
        }

        const branch = await Branch.create({
            name,
            code: code?.toUpperCase(),
            address,
            phone,
            isHeadOffice: isHeadOffice || false,
            tenantId,
        });

        res.status(201).json({ success: true, data: branch });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Branch code already exists for this tenant' });
        }
        next(error);
    }
};

// @desc    Update a branch
// @route   PUT /api/branches/:id
// @access  Private/Admin
export const updateBranch = async (req, res, next) => {
    try {
        const { name, code, address, phone, isHeadOffice, isActive } = req.body;
        const tenantId = req.tenantId;

        const branch = await Branch.findOne({ _id: req.params.id, tenantId });
        if (!branch) return res.status(404).json({ message: 'Branch not found' });

        // If setting as head office, unset previous
        if (isHeadOffice && !branch.isHeadOffice) {
            await Branch.updateMany({ tenantId }, { isHeadOffice: false });
        }

        if (name !== undefined) branch.name = name;
        if (code !== undefined) branch.code = code.toUpperCase();
        if (address !== undefined) branch.address = address;
        if (phone !== undefined) branch.phone = phone;
        if (isHeadOffice !== undefined) branch.isHeadOffice = isHeadOffice;
        if (isActive !== undefined) branch.isActive = isActive;

        await branch.save();
        res.json({ success: true, data: branch });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Branch code already exists for this tenant' });
        }
        next(error);
    }
};

// @desc    Delete (deactivate) a branch
// @route   DELETE /api/branches/:id
// @access  Private/Admin
export const deleteBranch = async (req, res, next) => {
    try {
        const branch = await Branch.findOne({ _id: req.params.id, tenantId: req.tenantId });
        if (!branch) return res.status(404).json({ message: 'Branch not found' });
        if (branch.isHeadOffice) return res.status(400).json({ message: 'Cannot delete the head office branch' });

        branch.isActive = false;
        await branch.save();
        res.json({ success: true, message: 'Branch deactivated successfully' });
    } catch (error) {
        next(error);
    }
};

// @desc    Transfer stock between branches
// @route   POST /api/branches/transfer
// @access  Private
export const branchStockTransfer = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { fromBranchId, toBranchId, itemId, quantity, notes } = req.body;
        const tenantId = req.tenantId;

        if (!fromBranchId || !toBranchId || !itemId || !quantity || quantity <= 0) {
            return res.status(400).json({ message: 'fromBranchId, toBranchId, itemId and quantity are required' });
        }
        if (fromBranchId === toBranchId) {
            return res.status(400).json({ message: 'From and To branch must be different' });
        }

        // Find item
        const item = await Item.findOne({ _id: itemId, tenantId }).session(session);
        if (!item) return res.status(404).json({ message: 'Item not found' });

        // Get current from-branch stock
        const fromStockEntry = item.branchStock.find(bs => bs.branchId?.toString() === fromBranchId);
        // If no branch-specific entry exists, fall back to the global quantity (for legacy items)
        const fromQty = fromStockEntry ? fromStockEntry.quantity : item.quantity;

        if (fromQty < quantity) {
            await session.abortTransaction();
            return res.status(400).json({ message: `Insufficient stock at source branch (available: ${fromQty})` });
        }

        // Deduct from source branch
        if (fromStockEntry) {
            fromStockEntry.quantity -= quantity;
        } else {
            // First time branch tracking — initialize all stock at the source branch first
            item.branchStock.push({ branchId: fromBranchId, quantity: fromQty - quantity });
        }

        // Add to destination branch
        const toStockEntry = item.branchStock.find(bs => bs.branchId?.toString() === toBranchId);
        if (toStockEntry) {
            toStockEntry.quantity += quantity;
        } else {
            item.branchStock.push({ branchId: toBranchId, quantity });
        }

        // Global quantity stays same (just moved between branches)
        item.markModified('branchStock');
        await item.save({ session });

        // Record transaction
        const txn = await Transaction.create([{
            item: itemId,
            type: 'branch_transfer',
            quantity,
            fromLocation: fromBranchId,
            toLocation: toBranchId,
            branchId: fromBranchId,
            toBranchId: toBranchId,
            user: req.user._id,
            tenantId,
            previousQuantity: fromQty,
            newQuantity: fromQty - quantity,
            notes: notes || 'Branch stock transfer',
        }], { session });

        await session.commitTransaction();
        res.status(201).json({
            success: true,
            message: 'Stock transferred successfully',
            data: {
                transaction: txn[0],
                item: { _id: item._id, name: item.name, branchStock: item.branchStock },
            }
        });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

// @desc    Get branch transfer history
// @route   GET /api/branches/transfer-history
// @access  Private
export const getBranchTransferHistory = async (req, res, next) => {
    try {
        const { branchId, page = 1, limit = 30 } = req.query;
        const tenantId = req.tenantId;
        const query = { tenantId, type: 'branch_transfer' };
        if (branchId) {
            query.$or = [{ branchId }, { toBranchId: branchId }];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [transfers, total] = await Promise.all([
            Transaction.find(query)
                .populate('item', 'name sku')
                .populate('user', 'name')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            Transaction.countDocuments(query)
        ]);

        res.json({ success: true, data: transfers, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
    } catch (error) {
        next(error);
    }
};
