import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { toast } from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext';
import { KeyIcon, BookOpenIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

const Customers = () => {
    const navigate = useNavigate();
    const [customers, setCustomers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCustomers, setTotalCustomers] = useState(0);
    const [balances, setBalances] = useState({}); // { customerId: balance }
    const [lockedStatuses, setLockedStatuses] = useState({}); // { customerId: boolean }
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const { user } = useContext(AuthContext);

    // Unlock Feature State
    const [unlockModalOpen, setUnlockModalOpen] = useState(false);
    const [unlockCustomerData, setUnlockCustomerData] = useState(null);
    const [unlockComment, setUnlockComment] = useState('');
    const [unlockDays, setUnlockDays] = useState(1);

    const [activeTab, setActiveTab] = useState('all');
    const [lockedCustomers, setLockedCustomers] = useState([]);
    const [loadingLocked, setLoadingLocked] = useState(false);

    // New-site inline form state
    const [newSiteName, setNewSiteName] = useState('');
    const [newSiteAddress, setNewSiteAddress] = useState('');
    const [showAddSite, setShowAddSite] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        phone2: '',
        companyName: '',
        gstin: '',
        openingBalance: '',
        billingAddress: { street: '', city: '', state: '', zipCode: '', country: '' },
        sites: [],
    });

    const API_URL = '/customers';

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchCustomers(currentPage, searchQuery, itemsPerPage);
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery, currentPage, itemsPerPage]);

    const fetchCustomers = async (page = 1, search = '', limit = 10) => {
        try {
            setLoading(true);
            const res = await api.get(API_URL, { params: { page, limit, search } });
            const list = res.data.data.customers;
            setCustomers(list);
            setTotalPages(res.data.data.totalPages || 1);
            setTotalCustomers(res.data.data.totalCustomers || 0);
            
            // Fetch balances in parallel (non-blocking, silent on individual failures)
            const balanceMap = {};
            const lockStatusMap = {};
            await Promise.allSettled(
                list.map(async (c) => {
                    try {
                        const r = await api.get(`${API_URL}/${c._id}/balance`);
                        balanceMap[c._id] = r.data.data.balance;
                        lockStatusMap[c._id] = r.data.data.isLocked || false;
                    } catch { 
                        balanceMap[c._id] = c.currentBalance || 0; 
                        lockStatusMap[c._id] = false;
                    }
                })
            );
            setBalances(balanceMap);
            setLockedStatuses(lockStatusMap);
        } catch (error) {
            toast.error('Failed to fetch customers');
        } finally {
            setLoading(false);
        }
    };

    const fetchLockedCustomers = async () => {
        try {
            setLoadingLocked(true);
            const res = await api.get('/customers/reports/locked');
            setLockedCustomers(res.data.data);
        } catch (error) {
            toast.error('Failed to fetch locked customers');
        } finally {
            setLoadingLocked(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'locked') {
            fetchLockedCustomers();
        }
    }, [activeTab]);


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
                phone2: customer.phone2 || '',
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
                phone2: '',
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
        // 10-digit validation for phone
        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(formData.phone)) {
            return toast.error('Primary phone must be a 10-digit number');
        }
        if (formData.phone2 && !phoneRegex.test(formData.phone2)) {
            return toast.error('Secondary phone must be a 10-digit number');
        }
        try {
            const data = {
                ...formData,
                address: { billing: formData.billingAddress }
            };

            if (editingCustomer) {
                await api.put(`${API_URL}/${editingCustomer._id}`, data);
                toast.success('Customer updated successfully');
            } else {
                await api.post(API_URL, data);
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
            await api.post(`${API_URL}/${unlockCustomerData._id}/unlock`, { unlockComment, days: unlockDays });
            toast.success(`${unlockCustomerData.companyName || unlockCustomerData.name} has been unlocked for ${unlockDays} days.`);
            setUnlockModalOpen(false);
            setUnlockComment('');
            setUnlockDays(1);
            if (activeTab === 'locked') {
                fetchLockedCustomers();
            }
            fetchCustomers(currentPage, searchQuery, itemsPerPage);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to unlock customer');
        }
    };

    const handleDelete = async (id, balance) => {
        if (balance !== 0) {
            return toast.error('Cannot delete customer with an outstanding balance');
        }
        if (window.confirm('Are you sure you want to delete this customer? This action cannot be undone.')) {
            try {
                await api.delete(`${API_URL}/${id}`);
                toast.success('Customer deleted successfully');
                fetchCustomers(currentPage, searchQuery, itemsPerPage);
            } catch (error) {
                toast.error(error.response?.data?.message || 'Failed to delete customer');
            }
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-2">
                <h1 className="text-2xl font-bold text-gray-800">Customers</h1>
                <div className="flex gap-3">
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="Search customers..." 
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
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

            <div className="flex border-b border-gray-200">
                <button 
                    className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors ${activeTab === 'all' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                    onClick={() => setActiveTab('all')}
                >
                    All Customers
                </button>
                <button 
                    className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'locked' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                    onClick={() => setActiveTab('locked')}
                >
                    {lockedCustomers.length > 0 && <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-[10px] font-bold">{lockedCustomers.length}</span>}
                    Locked Customers
                </button>
            </div>

            {activeTab === 'all' && (
                <>
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
                            {customers.map((customer) => {
                                const bal = balances[customer._id] ?? customer.currentBalance ?? 0;
                                const activeSites = (customer.sites || []).filter(s => s.isActive !== false);
                                return (
                                <tr 
                                    key={customer._id} 
                                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                                    onClick={() => navigate(`/customer-ledger/${customer._id}`)}
                                >
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900 flex items-center gap-2">
                                            {customer.companyName || customer.name}
                                            {customer.unlockedUntil && new Date(customer.unlockedUntil) > new Date() ? (
                                                <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-full" title={`Unlocked until ${new Date(customer.unlockedUntil).toLocaleString()}`}>
                                                    🔓 Unlocked
                                                </span>
                                            ) : lockedStatuses[customer._id] ? (
                                                <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full" title="Locked due to pending balance over limit">
                                                    🔒 Locked
                                                </span>
                                            ) : null}
                                        </div>
                                        {customer.companyName && <div className="text-xs text-gray-500">{customer.name}</div>}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">{customer.email}</td>
                                    <td className="px-6 py-4 text-gray-600">
                                        <div>{customer.phone}</div>
                                        {customer.phone2 && <div className="text-xs text-gray-400">{customer.phone2}</div>}
                                    </td>
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
                                    <td className="px-6 py-4 text-right space-x-3" onClick={(e) => e.stopPropagation()}>
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
                                        <button
                                            onClick={() => handleDelete(customer._id, bal)}
                                            className={`${bal !== 0 ? 'text-gray-300 cursor-not-allowed' : 'text-red-400 hover:text-red-600 hover:bg-red-50'} p-1.5 rounded-lg transition-colors inline-flex items-center justify-center`}
                                            title={bal !== 0 ? "Cannot delete customer with outstanding balance" : "Delete Customer"}
                                            disabled={bal !== 0}
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                                );
                            })}
                            
                            {customers.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center">
                                            <span className="text-4xl mb-3">🔍</span>
                                            <p className="text-lg font-medium">No customers found</p>
                                            <p className="text-sm">Try adjusting your search or add a new customer.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {/* Pagination */}
                    {totalCustomers > 0 && (
                    <div className="flex items-center justify-between px-6 py-3 bg-white border-t border-gray-200">
                        <div className="flex flex-1 justify-between sm:hidden">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="relative ml-3 inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                            <div className="flex items-center gap-4">
                                <p className="text-sm text-gray-700">
                                    Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, totalCustomers)}</span> of <span className="font-medium">{totalCustomers}</span> results
                                </p>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-700">Rows per page:</span>
                                    <select
                                        value={itemsPerPage}
                                        onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                        className="text-sm border border-gray-300 rounded-md py-1 px-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                                    >
                                        <option value="10">10</option>
                                        <option value="20">20</option>
                                        <option value="50">50</option>
                                        <option value="100">100</option>
                                        <option value="500">500</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        <span className="sr-only">Previous</span>
                                        &larr;
                                    </button>
                                    <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                                        Page {currentPage} of {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        <span className="sr-only">Next</span>
                                        &rarr;
                                    </button>
                                </nav>
                            </div>
                        </div>
                    </div>
                    )}
                </div>
            )}
            </>
            )}

            {activeTab === 'locked' && (
                <div className="space-y-4">
                    {loadingLocked ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
                        </div>
                    ) : lockedCustomers.length === 0 ? (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center flex flex-col items-center">
                            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center text-green-500 mb-4">
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">No Locked Customers</h3>
                            <p className="text-gray-500 text-sm mt-1 max-w-sm">All customers are within their credit limits and payment terms.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {lockedCustomers.map(customer => (
                                <div key={customer._id} className="bg-white rounded-2xl shadow-sm border border-red-200 overflow-hidden flex flex-col p-6 hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest bg-red-50 px-2 py-0.5 rounded-full inline-flex items-center gap-1 mb-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                                Billing Locked
                                            </span>
                                            <h3 className="text-base font-black text-gray-900">{customer.name}</h3>
                                            <p className="text-xs text-gray-500 mt-1">{customer.phone} • {customer.email}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-gray-50 rounded-xl p-4 mb-4 grid grid-cols-2 gap-4">
                                        <div>
                                            <span className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Current Balance</span>
                                            <span className="font-bold text-red-600 text-sm">₹{customer.currentBalance?.toLocaleString('en-IN') || 0} Dr</span>
                                            {customer.creditLimit > 0 && <span className="block text-[10px] text-gray-400 mt-0.5">Limit: ₹{customer.creditLimit.toLocaleString('en-IN')}</span>}
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Oldest Pending</span>
                                            <span className="font-bold text-gray-900 text-sm">{customer.oldestPendingDays} Days</span>
                                            {customer.creditDays > 0 && <span className="block text-[10px] text-gray-400 mt-0.5">Limit: {customer.creditDays} Days</span>}
                                        </div>
                                    </div>
                                    
                                    <div className="mt-auto pt-4 border-t border-gray-100 flex gap-3">
                                        <button
                                            onClick={() => navigate(`/customer-ledger/${customer._id}`)}
                                            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-200 transition-colors"
                                        >
                                            View Ledger
                                        </button>
                                        <button
                                            onClick={() => { setUnlockCustomerData(customer); setUnlockModalOpen(true); }}
                                            className="flex-1 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2"
                                        >
                                            🔓 Unlock
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
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
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone * <span className="text-gray-400 text-xs">(10 digits)</span></label>
                                    <input
                                        required
                                        type="tel"
                                        maxLength={10}
                                        pattern="[0-9]{10}"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                        placeholder="e.g. 9876543210"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone 2 <span className="text-gray-400 text-xs">(optional, 10 digits)</span></label>
                                    <input
                                        type="tel"
                                        maxLength={10}
                                        pattern="[0-9]{10}"
                                        value={formData.phone2}
                                        onChange={(e) => setFormData({ ...formData, phone2: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                        placeholder="Optional alternate number"
                                    />
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

                            {editingCustomer && lockedStatuses[editingCustomer._id] && (
                                <div className="flex justify-between items-center bg-yellow-50 p-4 rounded-xl border border-yellow-200 mt-6 mb-2">
                                    <div>
                                        <div className="font-bold text-sm text-yellow-800">Credit Lock Bypass</div>
                                        <div className="text-xs text-yellow-700 mt-1">Temporarily allow billing if this customer is locked due to pending balances.</div>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => { setUnlockCustomerData(editingCustomer); setUnlockModalOpen(true); setIsModalOpen(false); }}
                                        className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-bold text-sm rounded-lg whitespace-nowrap ml-4 transition-colors"
                                    >
                                        Unlock Temporarily
                                    </button>
                                </div>
                            )}

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
                            You are temporarily unlocking <strong>{unlockCustomerData.companyName || unlockCustomerData.name}</strong> for billing.
                        </p>
                        
                        <form onSubmit={handleUnlockSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Days to Unlock *</label>
                                <input 
                                    type="number"
                                    min="1"
                                    max="365"
                                    required
                                    value={unlockDays}
                                    onChange={(e) => setUnlockDays(Number(e.target.value))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                                />
                            </div>
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
