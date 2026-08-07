import DraftPO from '../models/DraftPO.js';

// @desc    Create a new Draft PO
// @route   POST /api/draft-pos
// @access  Private
export const createDraftPO = async (req, res, next) => {
    try {
        const { vendorName, items, notes } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ message: 'At least one item is required' });
        }

        // Generate PO Number
        const count = await DraftPO.countDocuments({ tenantId: req.tenantId });
        const poNumber = `DPO-${(count + 1).toString().padStart(4, '0')}`;

        // Calculate total amount
        let totalAmount = 0;
        const processedItems = items.map(item => {
            const lineTotal = (item.quantity || 0) * (item.price || 0);
            totalAmount += lineTotal;
            return {
                item: item.item,
                name: item.name,
                quantity: item.quantity,
                price: item.price || 0,
                unitType: item.unitType
            };
        });

        const draftPO = new DraftPO({
            tenantId: req.tenantId,
            poNumber,
            vendorName,
            items: processedItems,
            totalAmount,
            notes,
            createdBy: req.user._id
        });

        const savedDraftPO = await draftPO.save();
        res.status(201).json(savedDraftPO);
    } catch (error) {
        next(error);
    }
};

// @desc    Get all Draft POs
// @route   GET /api/draft-pos
// @access  Private
export const getDraftPOs = async (req, res, next) => {
    try {
        const draftPOs = await DraftPO.find({ tenantId: req.tenantId })
            .populate('createdBy', 'name')
            .sort({ createdAt: -1 });
        res.json(draftPOs);
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a Draft PO
// @route   DELETE /api/draft-pos/:id
// @access  Private
export const deleteDraftPO = async (req, res, next) => {
    try {
        const draftPO = await DraftPO.findOne({ _id: req.params.id, tenantId: req.tenantId });
        if (!draftPO) {
            return res.status(404).json({ message: 'Draft PO not found' });
        }
        await draftPO.deleteOne();
        res.json({ message: 'Draft PO deleted' });
    } catch (error) {
        next(error);
    }
};
