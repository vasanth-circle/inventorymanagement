import { useState, useContext, useMemo } from 'react';
import { InventoryContext } from '../context/InventoryContext';
import toast from 'react-hot-toast';

// Convert width x height in given unit -> sqft per piece
const calcSqFt = (width, height, unit) => {
    const w = Number(width);
    const h = Number(height);
    if (!w || !h) return null;
    const u = (unit || 'inches').toLowerCase();
    if (u === 'feet')   return w * h;
    if (u === 'inches') return (w * h) / 144;
    if (u === 'cm')     return (w * h) / 929.03;
    if (u === 'mm')     return (w * h) / 92903;
    return w * h;
};

const Sizes = () => {
    const { sizes, addSize, editSize, removeSize, loading, confirmDelete, billingSettings } = useContext(InventoryContext);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSize, setEditingSize] = useState(null);
    const [search, setSearch] = useState('');
    const [formData, setFormData] = useState({ name: '', width: '', height: '', unit: 'mm' });

    const filtered = useMemo(() =>
        sizes.filter(s =>
            s.name?.toLowerCase().includes(search.toLowerCase()) ||
            String(s.width).includes(search) ||
            String(s.height).includes(search) ||
            (s.unit || '').toLowerCase().includes(search.toLowerCase())
        ), [sizes, search]);

    const handleEdit = (size) => {
        setEditingSize(size);
        setFormData({ name: size.name, width: size.width, height: size.height, unit: size.unit || 'mm' });
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
            if (res.success) { setIsModalOpen(false); toast.success('Size updated successfully'); }
        } else {
            const res = await addSize(formData);
            if (res.success) { setIsModalOpen(false); toast.success('Size created successfully'); }
        }
    };

    const openCreateModal = () => {
        setEditingSize(null);
        setFormData({ name: '', width: '', height: '', unit: 'mm' });
        setIsModalOpen(true);
    };

    // Live sqft preview shown in the modal as user types
    const previewSqFt = calcSqFt(formData.width, formData.height, formData.unit);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap gap-3 items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-800">
                    {billingSettings?.industry === 'machinery' ? 'Manage Part Sizes' : 'Manage Tile Sizes'}
                </h1>
                <button
                    onClick={openCreateModal}
                    className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors font-medium flex items-center gap-1.5 shadow-sm"
                >
                    ➕ Add New Size
                </button>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                <input
                    type="text"
                    placeholder="Search size name or dimensions..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
                />
                {search && (
                    <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">✕</button>
                )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Size Name</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Dimensions</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Unit</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">SqFt / Piece</th>
                            <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-50">
                        {loading ? (
                            <tr><td colSpan="6" className="px-4 py-6 text-center text-sm text-gray-400">Loading...</td></tr>
                        ) : filtered.length > 0 ? (
                            filtered.map((size, idx) => {
                                const sqft = calcSqFt(size.width, size.height, size.unit);
                                const hasZeroDims = !size.width || !size.height;
                                return (
                                    <tr key={size._id} className={`hover:bg-gray-50 transition-colors ${hasZeroDims ? 'bg-red-50' : ''}`}>
                                        <td className="px-4 py-2 text-xs text-gray-400 w-8">{idx + 1}</td>
                                        <td className="px-4 py-2 text-sm font-semibold text-gray-800">
                                            {size.name}
                                            {hasZeroDims && <span className="ml-2 text-[9px] text-red-500 font-bold uppercase">⚠ fix dims</span>}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-gray-600">{size.width} × {size.height}</td>
                                        <td className="px-4 py-2">
                                            <span className="inline-block text-xs bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full">{size.unit}</span>
                                        </td>
                                        <td className="px-4 py-2">
                                            {sqft !== null ? (
                                                <span className="inline-flex items-center gap-1 text-sm font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                                                    {sqft.toFixed(3)}
                                                    <span className="text-[9px] font-semibold text-emerald-400 uppercase">sqft</span>
                                                </span>
                                            ) : (
                                                <span className="text-xs text-red-400 font-semibold">— set dims</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            <button onClick={() => handleEdit(size)} className="text-xs text-amber-600 hover:text-amber-800 font-semibold mr-3">Edit</button>
                                            <button onClick={() => handleDelete(size._id)} className="text-xs text-red-500 hover:text-red-700 font-semibold">Delete</button>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan="6" className="px-4 py-6 text-center text-sm text-gray-400">
                                    {search ? `No sizes matching "${search}"` : 'No sizes defined. Add one to get started.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
                {filtered.length > 0 && (
                    <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
                        Showing {filtered.length} of {sizes.length} sizes
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h2 className="text-lg font-bold text-gray-800">{editingSize ? 'Edit Size' : 'Add New Size'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Size Name (Display) <span className="text-red-500">*</span></label>
                                <input
                                    required
                                    type="text"
                                    placeholder="e.g. 2x4, 600x600"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 bg-gray-50 focus:bg-white"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Width <span className="text-red-500">*</span></label>
                                    <input
                                        required type="number" step="0.01"
                                        value={formData.width}
                                        onChange={e => setFormData({ ...formData, width: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Length <span className="text-red-500">*</span></label>
                                    <input
                                        required type="number" step="0.01"
                                        value={formData.height}
                                        onChange={e => setFormData({ ...formData, height: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Unit</label>
                                <select
                                    value={formData.unit}
                                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400"
                                >
                                    <option value="mm">MM (millimeters)</option>
                                    <option value="cm">CM (centimeters)</option>
                                    <option value="inches">Inches</option>
                                    <option value="feet">Feet</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Width ({formData.unit}) <span className="text-red-500">*</span></label>
                                    <input required type="number" step="0.01" value={formData.width} onChange={e => setFormData({ ...formData, width: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Length ({formData.unit}) <span className="text-red-500">*</span></label>
                                    <input required type="number" step="0.01" value={formData.height} onChange={e => setFormData({ ...formData, height: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" />
                                </div>
                            </div>
                            {/* Live SqFt Preview */}
                            <div className={`rounded-xl px-4 py-3 flex items-center justify-between transition-all ${previewSqFt !== null ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-gray-100'}`}>
                                <div>
                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Auto-calculated</div>
                                    <div className="text-xs font-semibold text-gray-500">SqFt per Piece</div>
                                </div>
                                {previewSqFt !== null ? (
                                    <span className="text-2xl font-black text-emerald-600">{previewSqFt.toFixed(3)} <span className="text-sm font-semibold text-emerald-400">sqft</span></span>
                                ) : (
                                    <span className="text-sm text-gray-400 italic">Enter dimensions above</span>
                                )}
                            </div>
                            <div className="pt-2 flex gap-3 border-t border-gray-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 text-sm text-gray-600 font-bold border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
                                <button type="submit" className="flex-1 px-4 py-2 text-sm bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-bold shadow">Save Size</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sizes;
