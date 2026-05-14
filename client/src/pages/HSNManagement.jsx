import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { InventoryContext } from '../context/InventoryContext';
import { useContext } from 'react';

const HSNManagement = () => {
    const { fetchHsnCodes } = useContext(InventoryContext);
    const [hsnCodes, setHsnCodes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingHsn, setEditingHsn] = useState(null);
    const [formData, setFormData] = useState({
        code: '',
        description: '',
        gstRate: 0
    });

    useEffect(() => {
        fetchHSNCodes();
    }, []);

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

    const handleOpenModal = (hsn = null) => {
        if (hsn) {
            setEditingHsn(hsn);
            setFormData({
                code: hsn.code,
                description: hsn.description,
                gstRate: hsn.gstRate
            });
        } else {
            setEditingHsn(null);
            setFormData({ code: '', description: '', gstRate: 0 });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingHsn(null);
    };

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
            fetchHsnCodes(); // Update global context
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
            fetchHsnCodes(); // Update global context
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error deleting HSN code');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">HSN Codes Management</h1>
                <button
                    onClick={() => handleOpenModal()}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium flex items-center shadow-sm"
                >
                    <span className="mr-2">➕</span> Add HSN Code
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">HSN Code</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">GST Rate (%)</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan="4" className="px-6 py-8 text-center">Loading...</td></tr>
                        ) : hsnCodes.length > 0 ? (
                            hsnCodes.map((hsn) => (
                                <tr key={hsn._id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{hsn.code}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{hsn.description}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{hsn.gstRate}%</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium space-x-3">
                                        <button onClick={() => handleOpenModal(hsn)} className="text-primary-600 hover:text-primary-900 font-semibold">Edit</button>
                                        <button onClick={() => handleDelete(hsn._id)} className="text-red-600 hover:text-red-900 font-semibold">Delete</button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-500">No HSN codes found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-800">{editingHsn ? 'Edit HSN Code' : 'Add HSN Code'}</h2>
                            <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">HSN Code</label>
                                <input
                                    type="text"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                                    required
                                    placeholder="e.g. 6907"
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
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">GST Rate (%)</label>
                                <input
                                    type="number"
                                    value={formData.gstRate}
                                    onChange={(e) => setFormData({ ...formData, gstRate: parseFloat(e.target.value) })}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                                    required
                                    min="0"
                                    step="0.01"
                                />
                            </div>
                            <div className="flex space-x-3 pt-4 border-t border-gray-100">
                                <button type="submit" className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-bold shadow-md">
                                    {editingHsn ? 'Update' : 'Create'}
                                </button>
                                <button type="button" onClick={handleCloseModal} className="flex-1 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-bold">
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
