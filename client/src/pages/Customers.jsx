import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext';
import { LockOpenIcon, BookOpenIcon, PencilSquareIcon } from '@heroicons/react/24/outline';

const Customers = () => {
    const navigate = useNavigate();
    const [customers, setCustomers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [balances, setBalances] = useState({}); // { customerId: balance }
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const { user } = useContext(AuthContext);

    // Unlock Feature State
    const [unlockModalOpen, setUnlockModalOpen] = useState(false);
    const [unlockCustomerData, setUnlockCustomerData] = useState(null);
    const [unlockComment, setUnlockComment] = useState('');

    // New-site inline form state
    const [newSiteName, setNewSiteName] = useState('');
    const [newSiteAddress, setNewSiteAddress] = useState('');
    const [showAddSite, setShowAddSite] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        companyName: '',
        gstin: '',
        openingBalance: '',
        billingAddress: { street: '', city: '', state: '', zipCode: '', country: '' },
        sites: [],
    });

    const API_URL = '/api/customers';

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        try {
            setLoading(true);
            const res = await axios.get(API_URL, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            const list = res.data.data.customers;
            setCustomers(list);
            // Fetch balances in parallel (non-blocking, silent on individual failures)
            const token = localStorage.getItem('token');
            const balanceMap = {};
            await Promise.allSettled(
                list.map(async (c) => {
                    try {
                        const r = await axios.get(`${API_URL}/${c._id}/balance`, { headers: { Authorization: `Bearer ${token}` } });
                        balanceMap[c._id] = r.data.data.balance;
                    } catch { balanceMap[c._id] = c.currentBalance || 0; }
                })
            );
            setBalances(balanceMap);
        } catch (error) {
            toast.error('Failed to fetch customers');
        } finally {
            setLoading(false);
        }
    };


    const handleOpenModal = (customer = null) => {
        setNewSiteName('');
        setNewSiteAddress('');
        setShowAddSite(false);
        if (customer) {
            setEditingCustomer(customer);
            setFormData({
                name: customer.name,
                email: customer.email || '',
                phone: customer.phone || '',
                companyName: customer.companyName || '',
                gstin: customer.gstin || '',
                openingBalance: customer.openingBalance || 0,
                billingAddress: customer.address?.billing || { street: '', city: '', state: '', zipCode: '', country: '' },
                sites: (customer.sites || []).filter(s => s.isActive !== false),
            });
        } else {
            setEditingCustomer(null);
            setFormData({
                name: '',
                email: '',
                phone: '',
                companyName: '',
                gstin: '',
                openingBalance: '',
                billingAddress: { street: '', city: '', state: '', zipCode: '', country: '' },
                sites: [],
            });
        }
        setIsModalOpen(true);
    };

    // Add a site to the local list (not yet saved to DB)
    const handleAddSite = () => {
        if (!newSiteName.trim()) return toast.error('Site name is required');
        setFormData(prev => ({
            ...prev,
            sites: [...prev.sites, { name: newSiteName.trim(), address: newSiteAddress.trim(), isActive: true }]
        }));
        setNewSiteName('');
        setNewSiteAddress('');
        setShowAddSite(false);
    };

    // Remove a site from the local list
    const handleRemoveSite = (idx) => {
        setFormData(prev => ({
            ...prev,
            sites: prev.sites.filter((_, i) => i !== idx)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const data = {
                ...formData,
                address: { billing: formData.billingAddress }
            };

            if (editingCustomer) {
                await axios.put(`${API_URL}/${editingCustomer._id}`, data, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
                toast.success('Customer updated successfully');
            } else {
                await axios.post(API_URL, data, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
                toast.success('Customer added successfully');
            }
            setIsModalOpen(false);
            fetchCustomers();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error saving customer');
        }
    };

    const handleUnlockSubmit = async (e) => {
        e.preventDefault();
        if (!unlockComment.trim()) return toast.error('Unlock comment is required');
        
        try {
            await axios.post(`${API_URL}/${unlockCustomerData._id}/unlock`, { unlockComment }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            toast.success(`${unlockCustomerData.companyName || unlockCustomerData.name} has been unlocked for 24 hours.`);
            setUnlockModalOpen(false);
            setUnlockComment('');
            fetchCustomers();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to unlock customer');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Customers</h1>
                <div className="flex gap-3">
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="Search customers..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none w-64"
                        />
                        <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
                    </div>
                    <button
                        onClick={() => handleOpenModal()}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shrink-0"
                    >
                        Add Customer
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-md overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-bottom border-gray-100">
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Company / Name</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Email</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Phone</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">GSTIN</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Sites</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600 text-right">Balance</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {customers.filter(c => 
                                c.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                c.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                c.phone?.includes(searchQuery)
                            ).map((customer) => {
                                const bal = balances[customer._id] ?? customer.currentBalance ?? 0;
                                const activeSites = (customer.sites || []).filter(s => s.isActive !== false);
                                return (
                                <tr key={customer._id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900 flex items-center gap-2">
                                            {customer.companyName || customer.name}
                                            {customer.unlockedUntil && new Date(customer.unlockedUntil) > new Date() && (
                                                <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-full" title={`Unlocked until ${new Date(customer.unlockedUntil).toLocaleString()}`}>
                                                    🔓 Unlocked
                                                </span>
                                            )}
                                        </div>
                                        {customer.companyName && <div className="text-xs text-gray-500">{customer.name}</div>}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">{customer.email}</td>
                                    <td className="px-6 py-4 text-gray-600">{customer.phone}</td>
                                    <td className="px-6 py-4 text-gray-600">{customer.gstin || '-'}</td>
                                    <td className="px-6 py-4">
                                        {activeSites.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                                {activeSites.slice(0, 2).map((s, i) => (
                                                    <span key={i} className="inline-block bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-100">
                                                        🏗️ {s.name}
                                                    </span>
                                                ))}
                                                {activeSites.length > 2 && (
                                                    <span className="inline-block bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                        +{activeSites.length - 2}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-gray-300 text-xs">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`inline-block px-2.5 py-1 rounded-lg text-sm font-bold ${bal > 0 ? 'bg-orange-100 text-orange-700' : bal < 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {bal !== 0 ? `₹${Math.abs(bal).toLocaleString('en-IN')} ${bal > 0 ? 'Dr' : 'Cr'}` : '—'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-3">
                                        <button
                                            onClick={() => navigate(`/customer-ledger/${customer._id}`)}
                                            className="text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 p-1.5 rounded-lg transition-colors inline-flex items-center justify-center"
                                            title="View Customer Ledger"
                                        >
                                            <BookOpenIcon className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleOpenModal(customer)}
                                            className="text-primary-500 hover:text-primary-700 hover:bg-primary-50 p-1.5 rounded-lg transition-colors inline-flex items-center justify-center"
                                            title="Edit Customer"
                                        >
                                            <PencilSquareIcon className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}


            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60] overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-800">{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                            {/* ── Basic Info ── */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Display Name *</label>
                                    <input required type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                                    <input type="text" value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                                    <input required type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN</label>
                                    <input type="text" value={formData.gstin} onChange={(e) => setFormData({ ...formData, gstin: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Opening Balance (₹)</label>
                                    <input type="number" step="0.01" value={formData.openingBalance} onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value === '' ? '' : parseFloat(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder="e.g. 5000 (Owed by customer) or -100 (Advance paid)" />
                                    <p className="text-[10px] text-gray-500 mt-1">Positive = Owed to you. Negative = Advance paid.</p>
                                </div>
                            </div>

                            {/* ── Billing Address ── */}
                            <h3 className="font-semibold text-gray-700 border-b pb-1">Billing Address</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Street</label>
                                    <input type="text" value={formData.billingAddress.street} onChange={(e) => setFormData({ ...formData, billingAddress: { ...formData.billingAddress, street: e.target.value } })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                                    <input type="text" value={formData.billingAddress.city} onChange={(e) => setFormData({ ...formData, billingAddress: { ...formData.billingAddress, city: e.target.value } })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                                    <input type="text" value={formData.billingAddress.state} onChange={(e) => setFormData({ ...formData, billingAddress: { ...formData.billingAddress, state: e.target.value } })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                                </div>
                            </div>

                            {/* ── Sites / Projects ── */}
                            <div className="border-t pt-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                                            🏗️ Project Sites
                                            <span className="text-[10px] font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                                                Optional — for builders with multiple sites
                                            </span>
                                        </h3>
                                    </div>
                                    {!showAddSite && (
                                        <button
                                            type="button"
                                            onClick={() => setShowAddSite(true)}
                                            className="text-sm font-bold text-primary-600 hover:text-primary-700 bg-primary-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                                        >
                                            + Add Site
                                        </button>
                                    )}
                                </div>

                                {/* Existing sites list */}
                                {formData.sites.length > 0 && (
                                    <div className="space-y-2 mb-3">
                                        {formData.sites.map((site, idx) => (
                                            <div key={idx} className="flex items-start justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 group">
                                                <div>
                                                    <div className="font-bold text-blue-800 text-sm">🏗️ {site.name}</div>
                                                    {site.address && <div className="text-xs text-blue-600 mt-0.5">{site.address}</div>}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveSite(idx)}
                                                    className="text-red-400 hover:text-red-600 text-lg font-bold ml-3 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Remove site"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {formData.sites.length === 0 && !showAddSite && (
                                    <p className="text-xs text-gray-400 italic mb-2">No sites added yet. Click "Add Site" to add construction sites for this customer.</p>
                                )}

                                {/* Inline add-site form */}
                                {showAddSite && (
                                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">Site Name *</label>
                                            <input
                                                type="text"
                                                value={newSiteName}
                                                onChange={e => setNewSiteName(e.target.value)}
                                                placeholder="e.g. Raja Street Site, Phase 2 Building"
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                                                autoFocus
                                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSite(); } }}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">Site Address (Optional)</label>
                                            <input
                                                type="text"
                                                value={newSiteAddress}
                                                onChange={e => setNewSiteAddress(e.target.value)}
                                                placeholder="e.g. 12 Raja St, Chennai"
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSite(); } }}
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={handleAddSite}
                                                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-bold"
                                            >
                                                ✓ Save Site
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { setShowAddSite(false); setNewSiteName(''); setNewSiteAddress(''); }}
                                                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">
                                    {editingCustomer ? 'Update Customer' : 'Add Customer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Unlock Customer Modal */}
            {unlockModalOpen && unlockCustomerData && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[70]">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                🔓 Unlock Customer
                            </h2>
                            <button onClick={() => setUnlockModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-4">
                            You are temporarily unlocking <strong>{unlockCustomerData.companyName || unlockCustomerData.name}</strong> for billing for the next 24 hours.
                        </p>
                        
                        <form onSubmit={handleUnlockSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Unlock (Required) *</label>
                                <textarea 
                                    required
                                    rows="3"
                                    value={unlockComment}
                                    onChange={(e) => setUnlockComment(e.target.value)}
                                    placeholder="e.g., Payment expected tomorrow, Manager approved."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                                ></textarea>
                            </div>
                            
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setUnlockModalOpen(false)} className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium text-sm">
                                    Unlock Account
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Customers;
