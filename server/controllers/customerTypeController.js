import CustomerType from '../models/CustomerType.js';

export const getCustomerTypes = async (req, res) => {
    try {
        const customerTypes = await CustomerType.find({ tenantId: req.tenantId }).sort({ name: 1 });
        res.status(200).json(customerTypes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const createCustomerType = async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name || name.trim() === '') {
            return res.status(400).json({ message: 'Customer Type name is required' });
        }

        const existingType = await CustomerType.findOne({ name: name.trim(), tenantId: req.tenantId });
        if (existingType) {
            return res.status(400).json({ message: 'Customer Type already exists' });
        }

        const customerType = await CustomerType.create({
            name: name.trim(),
            description: description || '',
            tenantId: req.tenantId,
        });

        res.status(201).json(customerType);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const updateCustomerType = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        if (!name || name.trim() === '') {
            return res.status(400).json({ message: 'Customer Type name is required' });
        }

        const existingType = await CustomerType.findOne({ name: name.trim(), tenantId: req.tenantId, _id: { $ne: id } });
        if (existingType) {
            return res.status(400).json({ message: 'Another Customer Type with this name already exists' });
        }

        const customerType = await CustomerType.findOneAndUpdate(
            { _id: id, tenantId: req.tenantId },
            { name: name.trim(), description: description || '' },
            { new: true, runValidators: true }
        );

        if (!customerType) {
            return res.status(404).json({ message: 'Customer Type not found' });
        }

        res.status(200).json(customerType);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const deleteCustomerType = async (req, res) => {
    try {
        const { id } = req.params;
        
        const customerType = await CustomerType.findOneAndDelete({ _id: id, tenantId: req.tenantId });

        if (!customerType) {
            return res.status(404).json({ message: 'Customer Type not found' });
        }

        res.status(200).json({ message: 'Customer Type deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
