import { useState, useContext, useMemo } from 'react';
import { InventoryContext } from '../context/InventoryContext';
import toast from 'react-hot-toast';

const Brands = () => {
    const { brands, categories, addBrand, editBrand, removeBrand, loading, confirmDelete } = useContext(InventoryContext);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBrand, setEditingBrand] = useState(null);
    const [search, setSearch] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [formData, setFormData] = useState({ name: '', description: '', categoryId: '' });

    const filtered = useMemo(() =>
        brands.filter(b => {
            const matchesSearch =
                b.name?.toLowerCase().includes(search.toLowerCase()) ||
                (b.description || '').toLowerCase().includes(search.toLowerCase());
            const matchesCat = filterCategory ? (b.categoryId?._id || b.categoryId) === filterCategory : true;
            return matchesSearch && matchesCat;
        }), [brands, search, filterCategory]);

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
        if (!formData.categoryId) { toast.error('Please select a category'); return; }
        if (editingBrand) {
            const result = await editBrand(editingBrand._id, formData);
            if (result.success) { handleCloseModal(); toast.success('Brand updated successfully'); }
        } else {
            const result = await addBrand(formData);
            if (result.success) { handleCloseModal(); toast.success('Brand created successfully'); }
        }
    };

    const handleDelete = async (id) => {
        await confirmDelete('Are you sure you want to delete this brand?', async () => {
            await removeBrand(id);
            toast.success('Brand deleted successfully');
        });
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap gap-3 items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">Brand Management</h1>
                <button
                    onClick={() => handleOpenModal()}
                    className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors font-medium flex items-center gap-1.5 shadow-sm"
                >
                    ➕ Add Brand
                </button>
            </div>

            {/* Search & Filter Row */}
            <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                    <input
                        type="text"
                        placeholder="Search brands..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">✕</button>
                    )}
                </div>
                <select
                    value={filterCategory}
                    onChange={e => setFilterCategory(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white min-w-[160px]"
                >
                    <option value="">All Categories</option>
                    {categories.map(cat => (
                        <option key={cat._id} value={cat._id}>{cat.name}</option>
                    ))}
                </select>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Brand Name</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                            <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-50">
                        {loading ? (
                            <tr><td colSpan="5" className="px-4 py-6 text-center text-sm text-gray-400">Loading...</td></tr>
                        ) : filtered.length > 0 ? (
                            filtered.map((brand, idx) => (
                                <tr key={brand._id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-2 text-xs text-gray-400 w-8">{idx + 1}</td>
                                    <td className="px-4 py-2 text-sm font-semibold text-gray-800">{brand.name}</td>
                                    <td className="px-4 py-2">
                                        <span className="inline-block text-xs bg-purple-50 text-purple-700 font-semibold px-2 py-0.5 rounded-full">
                                            {brand.categoryId?.name || '—'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 text-xs text-gray-500 max-w-xs truncate">
                                        {brand.description || <span className="italic text-gray-300">—</span>}
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                        <button onClick={() => handleOpenModal(brand)} className="text-xs text-primary-600 hover:text-primary-800 font-semibold mr-3">Edit</button>
                                        <button onClick={() => handleDelete(brand._id)} className="text-xs text-red-500 hover:text-red-700 font-semibold">Delete</button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="5" className="px-4 py-6 text-center text-sm text-gray-400">
                                    {search || filterCategory ? 'No brands match your search.' : 'No brands found. Add one to get started.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
                {filtered.length > 0 && (
                    <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
                        Showing {filtered.length} of {brands.length} brands
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-gray-800">{editingBrand ? 'Edit Brand' : 'Add Brand'}</h2>
                            <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Category <span className="text-red-500">*</span></label>
                                <select
                                    required
                                    value={formData.categoryId}
                                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-gray-50 focus:bg-white"
                                >
                                    <option value="">Select a category</option>
                                    {categories.map((cat) => (
                                        <option key={cat._id} value={cat._id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Brand Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-gray-50 focus:bg-white"
                                    placeholder="e.g. Kajaria, Asian Granito"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-gray-50 focus:bg-white"
                                    rows="2"
                                    placeholder="Optional description"
                                />
                            </div>
                            <div className="flex gap-3 pt-2 border-t border-gray-100">
                                <button type="submit" className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-bold shadow">
                                    {editingBrand ? 'Update' : 'Create'}
                                </button>
                                <button type="button" onClick={handleCloseModal} className="flex-1 px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-bold">
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
