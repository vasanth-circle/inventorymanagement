import { useState, useContext } from 'react';
import { InventoryContext } from '../context/InventoryContext';
import toast from 'react-hot-toast';

const Sizes = () => {
    const { sizes, addSize, editSize, removeSize, loading, confirmDelete } = useContext(InventoryContext);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSize, setEditingSize] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        width: '',
        height: '',
        unit: 'inches'
    });

    const handleEdit = (size) => {
        setEditingSize(size);
        setFormData({
            name: size.name,
            width: size.width,
            height: size.height,
            unit: size.unit || 'inches'
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        await confirmDelete('Are you sure you want to delete this size?', async () => {
            await removeSize(id);
            toast.success('Size deleted successfully');
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (editingSize) {
            const res = await editSize(editingSize._id, formData);
            if (res.success) {
                setIsModalOpen(false);
                toast.success('Size updated successfully');
            }
        } else {
            const res = await addSize(formData);
            if (res.success) {
                setIsModalOpen(false);
                toast.success('Size created successfully');
            }
        }
    };

    const openCreateModal = () => {
        setEditingSize(null);
        setFormData({ name: '', width: '', height: '', unit: 'inches' });
        setIsModalOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Manage Tile Sizes</h1>
                <button
                    onClick={openCreateModal}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-bold shadow-md"
                >
                    + Add New Size
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase">Size Name</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase">Dimensions</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {sizes.map((size) => (
                            <tr key={size._id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 font-medium text-gray-900">{size.name}</td>
                                <td className="px-6 py-4 text-gray-600">
                                    {size.width} x {size.height} {size.unit}
                                </td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button onClick={() => handleEdit(size)} className="text-amber-600 hover:text-amber-800 font-bold px-3 py-1 bg-amber-50 rounded-lg">Edit</button>
                                    <button onClick={() => handleDelete(size._id)} className="text-red-600 hover:text-red-800 font-bold px-3 py-1 bg-red-50 rounded-lg">Delete</button>
                                </td>
                            </tr>
                        ))}
                        {sizes.length === 0 && (
                            <tr>
                                <td colSpan="3" className="px-6 py-8 text-center text-gray-400">No sizes defined. Add one to get started.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h2 className="text-lg font-bold text-gray-800">{editingSize ? 'Edit Size' : 'Add New Size'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Size Name (Display)</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="e.g. 2x4, 600x600"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-500"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Width</label>
                                    <input
                                        required
                                        type="number"
                                        step="0.01"
                                        value={formData.width}
                                        onChange={e => setFormData({ ...formData, width: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-xl outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Length</label>
                                    <input
                                        required
                                        type="number"
                                        step="0.01"
                                        value={formData.height}
                                        onChange={e => setFormData({ ...formData, height: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-xl outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Unit</label>
                                <select
                                    value={formData.unit}
                                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl outline-none"
                                >
                                    <option value="inches">Inches</option>
                                    <option value="feet">Feet</option>
                                    <option value="cm">CM</option>
                                    <option value="mm">MM</option>
                                </select>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 text-gray-600 font-bold border border-gray-300 rounded-xl hover:bg-gray-50">Cancel</button>
                                <button type="submit" className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-bold shadow-lg">Save Size</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sizes;
