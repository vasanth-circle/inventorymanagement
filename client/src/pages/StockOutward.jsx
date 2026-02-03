import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { InventoryContext } from '../context/InventoryContext';
import toast from 'react-hot-toast';

const StockOutward = () => {
    const { items, fetchItems, createTransaction } = useContext(InventoryContext);
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [formData, setFormData] = useState({
        item: '',
        quantity: '',
        reason: '',
        notes: '',
    });

    useEffect(() => {
        fetchItems({ limit: 1000 }); // Fetch all items for selection
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });

        if (name === 'item') {
            const item = items.find(i => i._id === value);
            setSelectedItem(item);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!selectedItem) {
            toast.error('Please select an item');
            return;
        }

        if (parseInt(formData.quantity) > selectedItem.quantity) {
            toast.error(`Insufficient stock. Available: ${selectedItem.quantity}`);
            return;
        }

        setLoading(true);

        const result = await createTransaction({
            item: formData.item,
            type: 'outward',
            quantity: parseInt(formData.quantity),
            reason: formData.reason,
            notes: formData.notes,
        });

        if (result.success) {
            toast.success('Stock outward recorded successfully!');
            navigate('/inventory');
        }

        setLoading(false);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Stock Outward</h1>
                <p className="text-gray-600 mt-2">Record stock removal or sales</p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select Item <span className="text-red-500">*</span>
                        </label>
                        <select
                            name="item"
                            required
                            value={formData.item}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="">Choose an item</option>
                            {items.map(item => (
                                <option key={item._id} value={item._id}>
                                    {item.name} - Available: {item.quantity}
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedItem && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h3 className="font-semibold text-blue-900 mb-2">Item Details</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-gray-600">Category:</p>
                                    <p className="font-medium">{selectedItem.category?.name}</p>
                                </div>
                                <div>
                                    <p className="text-gray-600">Available Quantity:</p>
                                    <p className="font-medium text-lg">{selectedItem.quantity}</p>
                                </div>
                                <div>
                                    <p className="text-gray-600">Location:</p>
                                    <p className="font-medium">{selectedItem.location}</p>
                                </div>
                                <div>
                                    <p className="text-gray-600">Status:</p>
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${selectedItem.stockStatus === 'in-stock' ? 'bg-green-100 text-green-800' :
                                            selectedItem.stockStatus === 'low-stock' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-red-100 text-red-800'
                                        }`}>
                                        {selectedItem.stockStatus}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Quantity <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                name="quantity"
                                required
                                min="1"
                                max={selectedItem?.quantity || 0}
                                value={formData.quantity}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                placeholder="Enter quantity to remove"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Reason <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="reason"
                                required
                                value={formData.reason}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                                <option value="">Select reason</option>
                                <option value="Sale">Sale</option>
                                <option value="Damage">Damage</option>
                                <option value="Expired">Expired</option>
                                <option value="Return">Return</option>
                                <option value="Transfer">Transfer</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Notes
                        </label>
                        <textarea
                            name="notes"
                            value={formData.notes}
                            onChange={handleChange}
                            rows="3"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                            placeholder="Additional notes (optional)"
                        />
                    </div>

                    <div className="flex space-x-4">
                        <button
                            type="submit"
                            disabled={loading || !selectedItem}
                            className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                        >
                            {loading ? 'Processing...' : '📤 Remove Stock'}
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/inventory')}
                            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default StockOutward;
