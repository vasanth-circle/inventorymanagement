import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { BookOpenIcon, PencilSquareIcon, TrashIcon, LinkIcon, XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

// Custom searchable dropdown for customer linking — avoids native <select> UI
const CustomerSearchDropdown = ({ customers, value, onChange }) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef(null);

    const selected = customers.find(c => c._id === value);
    const filtered = customers.filter(c =>
        `${c.name} ${c.companyName || ''}`.toLowerCase().includes(search.toLowerCase())
    );

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleSelect = (id) => { onChange(id); setSearch(''); setOpen(false); };
    const handleClear = (e) => { e.stopPropagation(); onChange(''); setSearch(''); };

    return (
        <div ref={ref} className="relative">
            {/* Trigger button */}
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-all ${
                    open ? 'border-purple-400 ring-2 ring-purple-200 bg-white' : 'border-purple-300 bg-white hover:border-purple-400'
                }`}
            >
                <span className={selected ? 'text-gray-800 font-semibold' : 'text-gray-400'}>
                    {selected
                        ? <span className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-black flex items-center justify-center">
                                {(selected.name || '?')[0].toUpperCase()}
                            </span>
                            {selected.name}{selected.companyName ? <span className="text-gray-400 font-normal"> ({selected.companyName})</span> : ''}
                          </span>
                        : '— Not linked (Vendor only) —'
                    }
                </span>
                <span className="flex items-center gap-1 shrink-0">
                    {value && (
                        <span
                            role="button"
                            onClick={handleClear}
                            className="text-gray-400 hover:text-red-500 transition-colors p-0.5 rounded"
                            title="Remove link"
                        >
                            <XMarkIcon className="w-3.5 h-3.5" />
                        </span>
                    )}
                    <span className="text-gray-400 text-xs ml-1">{open ? '▲' : '▼'}</span>
                </span>
            </button>

            {/* Dropdown panel */}
            {open && (
                <div className="absolute z-[200] top-full left-0 right-0 mt-1 bg-white border border-purple-200 rounded-xl shadow-2xl overflow-hidden">
                    {/* Search bar */}
                    <div className="p-2 border-b border-gray-100 flex items-center gap-2 bg-purple-50">
                        <MagnifyingGlassIcon className="w-4 h-4 text-purple-400 shrink-0" />
                        <input
                            autoFocus
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search customer name..."
                            className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder-gray-400"
                        />
                        {search && (
                            <button type="button" onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
                                <XMarkIcon className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Not linked option */}
                    <button
                        type="button"
                        onClick={() => handleSelect('')}
                        className={`w-full text-left px-4 py-2.5 text-sm border-b border-gray-50 transition-colors ${
                            !value ? 'bg-purple-50 text-purple-700 font-bold' : 'text-gray-500 hover:bg-gray-50'
                        }`}
                    >
                        — Not linked (Vendor only) —
                    </button>

                    {/* Customer list */}
                    <div className="max-h-48 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <div className="px-4 py-4 text-sm text-gray-400 text-center">No customers found</div>
                        ) : (
                            filtered.map(c => (
                                <button
                                    key={c._id}
                                    type="button"
                                    onClick={() => handleSelect(c._id)}
                                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2.5 transition-colors ${
                                        c._id === value
                                            ? 'bg-purple-50 text-purple-800 font-bold'
                                            : 'text-gray-700 hover:bg-purple-50 hover:text-purple-700'
                                    }`}
                                >
                                    <span className="w-7 h-7 rounded-full bg-purple-100 text-purple-600 text-xs font-black flex items-center justify-center shrink-0">
                                        {(c.name || '?')[0].toUpperCase()}
                                    </span>
                                    <span>
                                        <span className="font-semibold">{c.name}</span>
                                        {c.companyName && <span className="text-gray-400 font-normal ml-1">({c.companyName})</span>}
                                        {c.phone && <span className="block text-[10px] text-gray-400">{c.phone}</span>}
                                    </span>
                                    {c._id === value && (
                                        <span className="ml-auto text-purple-500 text-xs font-bold">✓ Selected</span>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};


const Vendors = () => {
    const navigate = useNavigate();
    const [vendors, setVendors] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingVendor, setEditingVendor] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        companyName: '',
        email: '',
        phone: '',
        gstin: '',
        openingBalance: 0,
        linkedCustomerId: '',
        address: { street: '', city: '', state: '', zipCode: '', country: '' },
    });

    const API_URL = '/api/vendors';


    useEffect(() => {
        fetchVendors();
        // Fetch customers list for linking dropdown
        axios.get('/api/customers?limit=1000', {
            headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
        }).then(res => setCustomers(res.data?.data?.customers || [])).catch(() => {});
    }, [page, search]);


    const fetchVendors = async () => {
        try {
            setLoading(true);
            const res = await axios.get(API_URL, {
                params: { page, limit: 10, search },
                headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
            });
            setVendors(res.data.data.vendors);
            setTotalPages(res.data.data.totalPages || 1);
        } catch (error) {
            toast.error('Failed to fetch vendors');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (vendor = null) => {
        if (vendor) {
            setEditingVendor(vendor);
            setFormData({
                name: vendor.name,
                companyName: vendor.companyName || '',
                email: vendor.email || '',
                phone: vendor.phone || '',
                gstin: vendor.gstin || '',
                openingBalance: vendor.openingBalance || 0,
                linkedCustomerId: vendor.linkedCustomerId || '',
                address: vendor.address || { street: '', city: '', state: '', zipCode: '', country: '' },
            });
        } else {
            setEditingVendor(null);
            setFormData({
                name: '',
                companyName: '',
                email: '',
                phone: '',
                gstin: '',
                openingBalance: 0,
                linkedCustomerId: '',
                address: { street: '', city: '', state: '', zipCode: '', country: '' },
            });
        }
        setIsModalOpen(true);
    };


    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingVendor) {
                await axios.put(`${API_URL}/${editingVendor._id}`, formData, {
                    headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
                });
                toast.success('Vendor updated successfully');
            } else {
                await axios.post(API_URL, formData, {
                    headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
                });
                toast.success('Vendor added successfully');
            }
            setIsModalOpen(false);
            fetchVendors();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error saving vendor');
        }
    };

    const handleDelete = async (id, balance) => {
        if (balance !== 0) {
            return toast.error('Cannot delete vendor with an outstanding balance');
        }
        if (window.confirm('Are you sure you want to delete this vendor? This action cannot be undone.')) {
            try {
                await axios.delete(`${API_URL}/${id}`, {
                    headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
                });
                toast.success('Vendor deleted successfully');
                fetchVendors();
            } catch (error) {
                toast.error(error.response?.data?.message || 'Failed to delete vendor');
            }
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-800">Vendors</h1>
                <div className="flex w-full sm:w-auto items-center gap-3">
                    <input 
                        type="text" 
                        placeholder="Search vendors..." 
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        className="w-full sm:w-64 px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                        onClick={() => handleOpenModal()}
                        className="shrink-0 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                        Add Vendor
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
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Vendor / Company</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Contact</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">GSTIN</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600 text-right">Balance</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {vendors.map((vendor) => {
                                const bal = vendor.currentBalance || 0;
                                return (
                                <tr 
                                    key={vendor._id} 
                                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                                    onClick={() => navigate(`/vendor-ledger/${vendor._id}`)}
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="font-medium text-gray-900">{vendor.name}</div>
                                            {vendor.linkedCustomerId && (
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-bold uppercase tracking-wide">
                                                    <LinkIcon className="w-3 h-3" /> Linked
                                                </span>
                                            )}
                                        </div>
                                        {vendor.companyName && <div className="text-xs text-gray-500">{vendor.companyName}</div>}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">
                                        <div>{vendor.email}</div>
                                        <div className="text-xs">{vendor.phone}</div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">{vendor.gstin || '-'}</td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`inline-block px-2.5 py-1 rounded-lg text-sm font-bold ${bal > 0 ? 'bg-orange-100 text-orange-700' : bal < 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {bal !== 0 ? `₹${Math.abs(bal).toLocaleString('en-IN')} ${bal > 0 ? 'Cr' : 'Dr'}` : '—'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-3" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            onClick={() => navigate(`/vendor-ledger/${vendor._id}`)}
                                            className="text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 p-1.5 rounded-lg transition-colors inline-flex items-center justify-center"
                                            title="View Vendor Ledger"
                                        >
                                            <BookOpenIcon className="w-5 h-5" />
                                        </button>
                                        {vendor.linkedCustomerId && (
                                                <button
                                                    onClick={() => navigate(`/combined-ledger/${vendor._id}`)}
                                                    className="text-purple-500 hover:text-purple-700 hover:bg-purple-50 p-1.5 rounded-lg transition-colors inline-flex items-center justify-center"
                                                    title="View Combined Ledger (Sales + Purchase)"
                                                >
                                                    <LinkIcon className="w-5 h-5" />
                                                </button>
                                            )}
                                        <button
                                            onClick={() => handleOpenModal(vendor)}
                                            className="text-primary-500 hover:text-primary-700 hover:bg-primary-50 p-1.5 rounded-lg transition-colors inline-flex items-center justify-center"
                                            title="Edit Vendor"
                                        >
                                            <PencilSquareIcon className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(vendor._id, bal)}
                                            className={`${bal !== 0 ? 'text-gray-300 cursor-not-allowed' : 'text-red-400 hover:text-red-600 hover:bg-red-50'} p-1.5 rounded-lg transition-colors inline-flex items-center justify-center`}
                                            title={bal !== 0 ? "Cannot delete vendor with outstanding balance" : "Delete Vendor"}
                                            disabled={bal !== 0}
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                    
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 bg-gray-50">
                            <span className="text-sm text-gray-600">
                                Page <span className="font-bold text-gray-900">{page}</span> of <span className="font-bold text-gray-900">{totalPages}</span>
                            </span>
                            <div className="flex gap-2">
                                <button
                                    disabled={page === 1}
                                    onClick={() => setPage(p => p - 1)}
                                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                <button
                                    disabled={page === totalPages}
                                    onClick={() => setPage(p => p + 1)}
                                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0">
                            <h2 className="text-xl font-bold text-gray-800">{editingVendor ? 'Edit Vendor' : 'Add New Vendor'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                                    <input required type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                                    <input type="text" value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                                    <input required type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN</label>
                                    <input type="text" value={formData.gstin} onChange={(e) => setFormData({ ...formData, gstin: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Opening Balance (₹)</label>
                                    <input type="number" step="0.01" value={formData.openingBalance} onChange={(e) => setFormData({ ...formData, openingBalance: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500" placeholder="e.g. 5000 (You owe them) or -100 (Advance paid)" />
                                    <p className="text-[10px] text-gray-500 mt-1">Positive = You owe vendor. Negative = Advance paid.</p>
                                </div>
                            </div>

                            {/* Combined Ledger Linking */}
                            <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <LinkIcon className="w-4 h-4 text-purple-600" />
                                    <h3 className="font-semibold text-purple-800 text-sm">Link to Customer Account (Combined Ledger)</h3>
                                </div>
                                <p className="text-xs text-purple-600 mb-3">
                                    If this vendor also buys from you (is also a customer), link their customer account here.
                                    This enables a <strong>Combined Ledger</strong> that shows both Sales and Purchase transactions together with a single net balance.
                                </p>
                                <CustomerSearchDropdown
                                    customers={customers}
                                    value={formData.linkedCustomerId}
                                    onChange={(id) => setFormData({ ...formData, linkedCustomerId: id })}
                                />
                                {formData.linkedCustomerId && (
                                    <p className="text-xs text-purple-700 mt-2 font-medium">
                                        ✅ Linked — Combined Ledger will be available for this vendor.
                                    </p>
                                )}
                            </div>

                            <h3 className="font-semibold text-gray-700 border-b pb-1">Address Details</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Street</label>
                                    <input type="text" value={formData.address.street} onChange={(e) => setFormData({ ...formData, address: { ...formData.address, street: e.target.value } })} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                                    <input type="text" value={formData.address.city} onChange={(e) => setFormData({ ...formData, address: { ...formData.address, city: e.target.value } })} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                                    <input type="text" value={formData.address.state} onChange={(e) => setFormData({ ...formData, address: { ...formData.address, state: e.target.value } })} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none" />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-white">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors">
                                    {editingVendor ? 'Update Vendor' : 'Add Vendor'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Vendors;
