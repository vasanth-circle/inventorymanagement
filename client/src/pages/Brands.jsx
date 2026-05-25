import { useState, useContext } from 'react';
import { InventoryContext } from '../context/InventoryContext';
import toast from 'react-hot-toast';

const Brands = () => {
    const { brands, categories, addBrand, editBrand, removeBrand, loading, confirmDelete } = useContext(InventoryContext);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBrand, setEditingBrand] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        categoryId: '',
    });

    const handleOpenModal = (brand = null) => {
        if (brand) {
            setEditingBrand(brand);
            setFormData({
                name: brand.name,
                description: brand.description || '',
                categoryId: brand.categoryId?._id || brand.categoryId || '',
            });
        } else {
            setEditingBrand(null);
            setFormData({ name: '', description: '', categoryId: '' });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingBrand(null);
        setFormData({ name: '', description: '', categoryId: '' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.categoryId) {
            toast.error('Please select a category');
            return;
        }
        if (editingBrand) {
            const result = await editBrand(editingBrand._id, formData);
            if (result.success) {
                handleCloseModal();
                toast.success('Brand updated successfully');
            }
        } else {
            const result = await addBrand(formData);
            if (result.success) {
                handleCloseModal();
                toast.success('Brand created successfully');
            }
        }
    };

    const handleDelete = async (id) => {
        await confirmDelete('Are you sure you want to delete this brand? Items using this brand name will remain unchanged.', async () => {
            await removeBrand(id);
            toast.success('Brand deleted successfully');
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Brand Management</h1>
                <button
                    onClick={() => handleOpenModal()}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium flex items-center shadow-sm"
                >
                    <span className="mr-2">➕</span> Add Brand
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Brand Name</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>
                        ) : brands.length > 0 ? (
                            brands.map((brand) => (
                                <tr key={brand._id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{brand.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {brand.categoryId?.name || '—'}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                                        {brand.description || <span className="text-gray-400">No description</span>}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium space-x-3">
                                        <button
                                            onClick={() => handleOpenModal(brand)}
                                            className="text-primary-600 hover:text-primary-900 font-semibold"
                                        >
                                            ✏️ Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(brand._id)}
                                            className="text-red-600 hover:text-red-900 font-semibold"
                                        >
                                            🗑️ Delete
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                                    No brands found. Add one to get started.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-800">
                                {editingBrand ? 'Edit Brand' : 'Add Brand'}
                            </h2>
                            <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">
                                    Category <span className="text-red-500">*</span>
                                </label>
                                <select
                                    required
                                    value={formData.categoryId}
                                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                                >
                                    <option value="">Select a category</option>
                                    {categories.map((cat) => (
                                        <option key={cat._id} value={cat._id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">
                                    Brand Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                                    placeholder="e.g. Kajaria, Asian Granito"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                                    rows="3"
                                    placeholder="Optional description"
                                />
                            </div>
                            <div className="flex space-x-3 pt-4 border-t border-gray-100">
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-bold shadow-md"
                                >
                                    {editingBrand ? 'Update' : 'Create'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="flex-1 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-bold"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Brands;
