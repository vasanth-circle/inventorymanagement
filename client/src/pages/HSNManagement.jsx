import { useState, useEffect, useContext, useMemo } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { InventoryContext } from '../context/InventoryContext';

const HSNManagement = () => {
    const { fetchHsnCodes } = useContext(InventoryContext);
    const [hsnCodes, setHsnCodes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingHsn, setEditingHsn] = useState(null);
    const [search, setSearch] = useState('');
    const [formData, setFormData] = useState({ code: '', description: '', gstRate: 0 });

    useEffect(() => { fetchHSNCodes(); }, []);

    const fetchHSNCodes = async () => {
        try {
            const { data } = await api.get('/hsn');
            setHsnCodes(data.data);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error fetching HSN codes');
        } finally {
            setLoading(false);
        }
    };

    const filtered = useMemo(() =>
        (hsnCodes || []).filter(h =>
            h.code?.toLowerCase().includes(search.toLowerCase()) ||
            (h.description || '').toLowerCase().includes(search.toLowerCase()) ||
            String(h.gstRate).includes(search)
        ), [hsnCodes, search]);

    const handleOpenModal = (hsn = null) => {
        if (hsn) {
            setEditingHsn(hsn);
            setFormData({ code: hsn.code, description: hsn.description, gstRate: hsn.gstRate });
        } else {
            setEditingHsn(null);
            setFormData({ code: '', description: '', gstRate: 0 });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => { setIsModalOpen(false); setEditingHsn(null); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingHsn) {
                await api.put(`/hsn/${editingHsn._id}`, formData);
                toast.success('HSN code updated successfully');
            } else {
                await api.post('/hsn', formData);
                toast.success('HSN code created successfully');
            }
            fetchHSNCodes();
            fetchHsnCodes();
            handleCloseModal();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error saving HSN code');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this HSN code?')) return;
        try {
            await api.delete(`/hsn/${id}`);
            toast.success('HSN code deleted successfully');
            fetchHSNCodes();
            fetchHsnCodes();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error deleting HSN code');
        }
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap gap-3 items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">HSN Codes</h1>
                <button
                    onClick={() => handleOpenModal()}
                    className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors font-medium flex items-center gap-1.5 shadow-sm"
                >
                    ➕ Add HSN Code
                </button>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                <input
                    type="text"
                    placeholder="Search code, description, GST rate..."
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
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">HSN Code</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">GST %</th>
                            <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-50">
                        {loading ? (
                            <tr><td colSpan="5" className="px-4 py-6 text-center text-sm text-gray-400">Loading...</td></tr>
                        ) : filtered.length > 0 ? (
                            filtered.map((hsn, idx) => (
                                <tr key={hsn._id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-2 text-xs text-gray-400 w-8">{idx + 1}</td>
                                    <td className="px-4 py-2 text-sm font-bold text-gray-800">{hsn.code}</td>
                                    <td className="px-4 py-2 text-xs text-gray-500 max-w-xs truncate">{hsn.description || <span className="italic text-gray-300">—</span>}</td>
                                    <td className="px-4 py-2">
                                        <span className="inline-block text-xs bg-green-50 text-green-700 font-semibold px-2 py-0.5 rounded-full">{hsn.gstRate}%</span>
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                        <button onClick={() => handleOpenModal(hsn)} className="text-xs text-primary-600 hover:text-primary-800 font-semibold mr-3">Edit</button>
                                        <button onClick={() => handleDelete(hsn._id)} className="text-xs text-red-500 hover:text-red-700 font-semibold">Delete</button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="5" className="px-4 py-6 text-center text-sm text-gray-400">
                                    {search ? `No HSN codes matching "${search}"` : 'No HSN codes found.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
                {filtered.length > 0 && (
                    <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
                        Showing {filtered.length} of {hsnCodes.length} HSN codes
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-gray-800">{editingHsn ? 'Edit HSN Code' : 'Add HSN Code'}</h2>
                            <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">HSN Code <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-gray-50 focus:bg-white"
                                    required
                                    placeholder="e.g. 6907"
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
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">GST Rate (%)</label>
                                <input
                                    type="number"
                                    value={formData.gstRate}
                                    onChange={(e) => setFormData({ ...formData, gstRate: parseFloat(e.target.value) })}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-gray-50 focus:bg-white"
                                    required
                                    min="0"
                                    step="0.01"
                                />
                            </div>
                            <div className="flex gap-3 pt-2 border-t border-gray-100">
                                <button type="submit" className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-bold shadow">
                                    {editingHsn ? 'Update' : 'Create'}
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

export default HSNManagement;
