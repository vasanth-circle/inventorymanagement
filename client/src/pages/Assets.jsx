import { useState, useEffect, useContext } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext';
import { InventoryContext } from '../context/InventoryContext';

const Assets = () => {
    const { user } = useContext(AuthContext);
    const { locations } = useContext(InventoryContext);
    
    const [assets, setAssets] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState(null);
    
    const [formData, setFormData] = useState({
        name: '',
        assetType: 'System',
        serialNumber: '',
        branch: '',
        assignee: '',
        status: 'Available',
        notes: '',
        insuranceData: {
            policyNumber: '',
            provider: '',
            expiryDate: ''
        }
    });

    useEffect(() => {
        fetchAssets();
        fetchUsers();
    }, []);

    const fetchAssets = async () => {
        try {
            const { data } = await api.get('/assets');
            setAssets(data.data);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error fetching assets');
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            let res;
            if (user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'tenant_owner' || user?.role === 'tenant_admin') {
                res = await api.get('/auth/users');
            } else {
                // simple fetch if not admin - server handles tenant scoped
                res = await api.get('/auth/users');
            }
            if(res.data?.success) {
               setUsers(res.data.data || res.data); // depending on backend structure
            }
        } catch (error) {
            console.error('Error fetching users for assignment', error);
        }
    };

    const handleOpenModal = (asset = null) => {
        if (asset) {
            setEditingAsset(asset);
            setFormData({
                name: asset.name,
                assetType: asset.assetType,
                serialNumber: asset.serialNumber || '',
                branch: asset.branch?._id || asset.branch || '',
                assignee: asset.assignee?._id || asset.assignee || '',
                status: asset.status || 'Available',
                notes: asset.notes || '',
                insuranceData: {
                    policyNumber: asset.insuranceData?.policyNumber || '',
                    provider: asset.insuranceData?.provider || '',
                    expiryDate: asset.insuranceData?.expiryDate ? new Date(asset.insuranceData.expiryDate).toISOString().split('T')[0] : ''
                }
            });
        } else {
            setEditingAsset(null);
            setFormData({
                name: '',
                assetType: 'System',
                serialNumber: '',
                branch: locations.length > 0 ? locations[0]._id : '',
                assignee: '',
                status: 'Available',
                notes: '',
                insuranceData: { policyNumber: '', provider: '', expiryDate: '' }
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingAsset(null);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name.includes('insuranceData.')) {
            const key = name.split('.')[1];
            setFormData(prev => ({
                ...prev,
                insuranceData: { ...prev.insuranceData, [key]: value }
            }));
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        try {
            const payload = {
                ...formData,
                assignee: formData.assignee || null
            };

            if (editingAsset) {
                await api.put(`/assets/${editingAsset._id}`, payload);
                toast.success('Asset updated successfully');
            } else {
                await api.post('/assets', payload);
                toast.success('Asset created successfully');
            }
            fetchAssets();
            handleCloseModal();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error saving asset');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this asset?')) {
            try {
                await api.delete(`/assets/${id}`);
                toast.success('Asset deleted successfully');
                fetchAssets();
            } catch (error) {
                toast.error(error.response?.data?.message || 'Error deleting asset');
            }
        }
    };

    const getStatusBadge = (status) => {
        const colors = {
            'Available': 'bg-green-100 text-green-800',
            'Assigned': 'bg-blue-100 text-blue-800',
            'In Service': 'bg-yellow-100 text-yellow-800',
            'Returned': 'bg-purple-100 text-purple-800',
            'Retired': 'bg-red-100 text-red-800'
        };
        return <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>{status}</span>;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Asset Management System</h1>
                <button
                    onClick={() => handleOpenModal()}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm font-semibold flex items-center"
                >
                    <span className="mr-2">➕</span> Add New Asset
                </button>
            </div>

            <div className="bg-white text-gray-900 overflow-hidden shadow-sm rounded-lg border border-gray-200">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Asset Info</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type / Details</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Location / Assignee</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                        <div className="flex flex-col items-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-2"></div>
                                            <span>Loading assets...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : assets.length > 0 ? (
                                assets.map((asset) => (
                                    <tr key={asset._id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-bold text-gray-900">{asset.name}</div>
                                            <div className="text-xs text-gray-500 truncate max-w-[200px]">{asset.notes}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{asset.assetType}</div>
                                            {asset.assetType === 'System' && asset.serialNumber && (
                                                <div className="text-xs text-slate-500 font-mono">SN: {asset.serialNumber}</div>
                                            )}
                                            {asset.assetType === 'Vehicle' && asset.insuranceData?.policyNumber && (
                                                <div className="text-xs text-slate-500">
                                                    Pol: {asset.insuranceData.policyNumber}<br/>
                                                    Exp: {asset.insuranceData.expiryDate ? new Date(asset.insuranceData.expiryDate).toLocaleDateString() : 'N/A'}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900 font-medium">📍 {asset.branch?.name || 'N/A'}</div>
                                            {asset.assignee ? (
                                                <div className="text-xs text-gray-600">👤 {asset.assignee.name}</div>
                                            ) : (
                                                <div className="text-xs text-yellow-600 italic">Unassigned</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getStatusBadge(asset.status)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                                            <button onClick={() => handleOpenModal(asset)} className="text-primary-600 hover:text-primary-900 font-semibold">✏️ Edit</button>
                                            <button onClick={() => handleDelete(asset._id)} className="text-red-600 hover:text-red-900 font-semibold">🗑️ Delete</button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center">
                                            <span className="text-4xl mb-2">🖥️</span>
                                            <p className="text-lg font-medium">No assets found</p>
                                            <p className="text-sm">Create your first asset to manage your systems and vehicles.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-800">
                                {editingAsset ? 'Edit Asset details' : 'Add New Asset'}
                            </h2>
                            <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                            <div className="p-6 overflow-y-auto space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Asset Name <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            name="name"
                                            required
                                            value={formData.name}
                                            onChange={handleChange}
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                            placeholder="e.g. MacBook Pro M2"
                                        />
                                    </div>
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Asset Type <span className="text-red-500">*</span></label>
                                        <select
                                            name="assetType"
                                            required
                                            value={formData.assetType}
                                            onChange={handleChange}
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        >
                                            <option value="System">System (Computer, Equipment)</option>
                                            <option value="Vehicle">Vehicle</option>
                                            <option value="Furniture">Furniture</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                </div>

                                {formData.assetType === 'System' && (
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Serial Number</label>
                                        <input
                                            type="text"
                                            name="serialNumber"
                                            value={formData.serialNumber}
                                            onChange={handleChange}
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                                            placeholder="S/NXXXXXXX"
                                        />
                                    </div>
                                )}

                                {formData.assetType === 'Vehicle' && (
                                    <div className="bg-blue-50 p-4 rounded-lg space-y-4 border border-blue-100">
                                        <h3 className="font-semibold text-blue-800 text-sm">Insurance Data</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-700 mb-1">Policy Provider</label>
                                                <input
                                                    type="text"
                                                    name="insuranceData.provider"
                                                    value={formData.insuranceData.provider}
                                                    onChange={handleChange}
                                                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-700 mb-1">Policy Number</label>
                                                <input
                                                    type="text"
                                                    name="insuranceData.policyNumber"
                                                    value={formData.insuranceData.policyNumber}
                                                    onChange={handleChange}
                                                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-xs font-semibold text-gray-700 mb-1">Expiry Date</label>
                                                <input
                                                    type="date"
                                                    name="insuranceData.expiryDate"
                                                    value={formData.insuranceData.expiryDate}
                                                    onChange={handleChange}
                                                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Branch / Location <span className="text-red-500">*</span></label>
                                        <select
                                            name="branch"
                                            required
                                            value={formData.branch}
                                            onChange={handleChange}
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        >
                                            <option value="" disabled>Select Branch</option>
                                            {locations.map(loc => (
                                                <option key={loc._id} value={loc._id}>{loc.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Assignee</label>
                                        <select
                                            name="assignee"
                                            value={formData.assignee}
                                            onChange={handleChange}
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        >
                                            <option value="">-- Unassigned --</option>
                                            {Array.isArray(users) && users.map(u => (
                                                <option key={u._id || u.id} value={u._id || u.id}>{u.name} ({u.email})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                                        <select
                                            name="status"
                                            required
                                            value={formData.status}
                                            onChange={handleChange}
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        >
                                            <option value="Available">Available</option>
                                            <option value="Assigned">Assigned</option>
                                            <option value="In Service">In Service / Maintenance</option>
                                            <option value="Returned">Returned</option>
                                            <option value="Retired">Retired</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Notes / Remarks</label>
                                    <textarea
                                        name="notes"
                                        rows="3"
                                        value={formData.notes}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        placeholder="Any additional information..."
                                    ></textarea>
                                </div>
                            </div>
                            
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex space-x-3 mt-auto">
                                <button type="submit" className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-bold shadow-md">
                                    {editingAsset ? 'Save Changes' : 'Create Asset'}
                                </button>
                                <button type="button" onClick={handleCloseModal} className="flex-1 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-bold shadow-sm">
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

export default Assets;
