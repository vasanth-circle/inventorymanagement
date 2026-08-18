import React, { useState, useEffect, useCallback, useContext, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { printTallyLedger, printPaymentReceipt } from '../utils/printTemplates';
import { AuthContext } from '../context/AuthContext';
import FullScreenModal from '../components/FullScreenModal';
const api = (path, opts = {}) =>
    axios({ url: `/api${path}`, ...opts, headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}`, ...opts.headers } });

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PAYMENT_MODES = [
    { value: 'cash', label: '💵 Cash' },
    { value: 'cheque', label: '🏦 Cheque' },
    { value: 'upi', label: '📱 UPI' },
    { value: 'bank_transfer', label: '🏛️ Bank Transfer' },
    { value: 'discount', label: '🏷️ Discount / Write-off' },
    { value: 'other', label: '⚙️ Other' },
];

const SearchableDropdown = ({ options = [], value, onChange, placeholder = 'Search...', disabled = false }) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef(null);

    const selected = options.find(o => o.value === value);

    const filtered = options.filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase())
    );

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleSelect = (val) => {
        onChange({ target: { value: val } });
        setSearch('');
        setOpen(false);
    };

    return (
        <div ref={ref} className="relative w-full">
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen(o => !o)}
                className={`w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-800 focus:ring-2 focus:ring-primary-500 transition-all flex items-center justify-between shadow-sm ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
                <span className={selected ? 'text-gray-800' : 'text-gray-400'}>
                    {selected ? selected.label : placeholder}
                </span>
                <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
            </button>
            {open && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                    <div className="p-2 border-b border-gray-100">
                        <input
                            autoFocus
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Type to search..."
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
                        />
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <div className="px-4 py-3 text-xs text-gray-400 text-center">No results found</div>
                        ) : (
                            filtered.map(o => (
                                <button
                                    key={o.value}
                                    type="button"
                                    onClick={() => handleSelect(o.value)}
                                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-primary-50 hover:text-primary-700 transition-colors ${o.value === value ? 'bg-primary-50 text-primary-700 font-bold' : 'text-gray-700'}`}
                                >
                                    {o.label}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const CustomerLedger = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);

    const [selectedCustomerId, setSelectedCustomerId] = useState(id || '');
    const [customers, setCustomers] = useState([]);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [settings, setSettings] = useState(null);
    const [linkedVendor, setLinkedVendor] = useState(null);

    const effectiveRole = user?.appRoles?.inventory || user?.role;
    const canRecordPayment = ['admin', 'manager', 'tenant_owner', 'tenant_admin', 'accounts', 'sales_person', 'sales person', 'sales_user', 'sales user'].includes(effectiveRole) || ['admin', 'manager', 'tenant_owner', 'tenant_admin', 'super_admin', 'sales_person'].includes(user?.role);
    const canEditPayment = ['admin', 'manager', 'tenant_owner', 'tenant_admin'].includes(effectiveRole) || ['admin', 'manager', 'tenant_owner', 'tenant_admin', 'super_admin'].includes(user?.role);

    const [payModal, setPayModal] = useState(false);
    const [paying, setPaying] = useState(false);
    const [payForm, setPayForm] = useState({ amount: '', paymentMode: 'cash', date: new Date().toISOString().split('T')[0], notes: '', refNumber: '' });

    const [editModal, setEditModal] = useState(false);
    const [editingEntry, setEditingEntry] = useState(null);
    const [editForm, setEditForm] = useState({ amount: '', paymentMode: 'cash', date: '', notes: '', refNumber: '' });
    const [editSaving, setEditSaving] = useState(false);

    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const [refundModal, setRefundModal] = useState(false);
    const [refunding, setRefunding] = useState(false);
    const [refundForm, setRefundForm] = useState({ amount: '', paymentMode: 'cash', date: new Date().toISOString().split('T')[0], notes: '', refNumber: '', returnRef: '' });

    const fetchLedger = useCallback(async () => {
        if (!selectedCustomerId) {
            setData(null);
            return;
        }
        try {
            setLoading(true);
            const params = {};
            if (from) params.from = from;
            if (to) params.to = to;
            const res = await api(`/customers/${selectedCustomerId}/ledger`, { params });
            setData(res.data.data);
        } catch {
            toast.error('Failed to fetch ledger');
        } finally {
            setLoading(false);
        }
    }, [selectedCustomerId, from, to]);

    useEffect(() => {
        api('/customers?limit=1000').then(res => {
            setCustomers(res.data.data.customers);
        }).catch(() => {});
        fetchLedger(); 
    }, [fetchLedger]);

    useEffect(() => {
        if (!selectedCustomerId) { setLinkedVendor(null); return; }
        api('/vendors?limit=1000').then(res => {
            const allVendors = res.data?.data?.vendors || [];
            const linked = allVendors.find(v => v.linkedCustomerId === selectedCustomerId || String(v.linkedCustomerId) === String(selectedCustomerId));
            setLinkedVendor(linked || null);
        }).catch(() => setLinkedVendor(null));
    }, [selectedCustomerId]);

    useEffect(() => {
        if (id && id !== selectedCustomerId) {
             setSelectedCustomerId(id);
        }
    }, [id]);

    const handleCustomerChange = (e) => {
        const newId = e.target.value;
        setSelectedCustomerId(newId);
        if (newId) {
            navigate(`/customer-ledger/${newId}`);
        } else {
            navigate(`/customer-ledger`);
        }
    };

    useEffect(() => {
        api('/settings/billing').then(r => setSettings(r.data.data)).catch(() => {});
    }, []);

    const handlePrint = async () => {
        try {
            const params = {};
            if (from) params.from = from;
            if (to) params.to = to;
            const res = await api(`/customers/${selectedCustomerId}/statement`, { params });
            const { customer, entries, summary } = res.data.data;
            printTallyLedger(customer, entries, summary);
        } catch {
            toast.error('Failed to generate statement');
        }
    };

    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        if (!payForm.amount || Number(payForm.amount) <= 0) return toast.error('Enter a valid amount');
        setPaying(true);
        try {
            await api(`/customers/${selectedCustomerId}/payment`, {
                method: 'POST',
                data: { ...payForm, amount: Number(payForm.amount) }
            });
            toast.success('Payment recorded successfully');
            setPayModal(false);
            setPayForm({ amount: '', paymentMode: 'cash', date: new Date().toISOString().split('T')[0], notes: '', refNumber: '' });
            fetchLedger();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to record payment');
        } finally {
            setPaying(false);
        }
    };

    const handleEditOpen = (entry) => {
        setEditingEntry(entry);
        setEditForm({
            // For refunds (adjustment) amount is stored in debit; for payments it's in credit
            amount: entry.type === 'adjustment' ? entry.debit : entry.credit,
            paymentMode: entry.paymentMode || 'cash',
            date: new Date(entry.date).toISOString().split('T')[0],
            notes: entry.notes || '',
            refNumber: entry.refNumber || '',
        });
        setEditModal(true);
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        if (!editForm.amount || Number(editForm.amount) <= 0) return toast.error('Enter a valid amount');
        setEditSaving(true);
        try {
            await api(`/customers/${selectedCustomerId}/payment/${editingEntry._id}`, {
                method: 'PUT',
                data: { ...editForm, amount: Number(editForm.amount) },
            });
            toast.success('Payment updated successfully');
            setEditModal(false);
            setEditingEntry(null);
            fetchLedger();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update payment');
        } finally {
            setEditSaving(false);
        }
    };

    const handleDeletePayment = async () => {
        if (!deleteConfirm) return;
        setDeleting(true);
        try {
            await api(`/customers/${selectedCustomerId}/payment/${deleteConfirm._id}`, {
                method: 'DELETE',
            });
            toast.success('Payment deleted successfully');
            setDeleteConfirm(null);
            fetchLedger();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete payment');
        } finally {
            setDeleting(false);
        }
    };

    const handleRefundSubmit = async (e) => {
        e.preventDefault();
        if (!refundForm.amount || Number(refundForm.amount) <= 0) return toast.error('Enter a valid refund amount');
        setRefunding(true);
        try {
            await api(`/customers/${selectedCustomerId}/refund`, {
                method: 'POST',
                data: { ...refundForm, amount: Number(refundForm.amount) },
            });
            toast.success('Refund recorded successfully');
            setRefundModal(false);
            setRefundForm({ amount: '', paymentMode: 'cash', date: new Date().toISOString().split('T')[0], notes: '', refNumber: '', returnRef: '' });
            fetchLedger();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to record refund');
        } finally {
            setRefunding(false);
        }
    };

    const customer = data?.customer;
    const backendEntries = data?.entries || [];
    const balance = data?.currentBalance ?? 0;
    const bbf = data?.bbf ?? 0;

    const entries = [...backendEntries];
    const displayBbf = from ? bbf : (customer?.openingBalance || 0);
    if (displayBbf !== 0) {
        entries.unshift({
            _id: 'bbf-entry',
            date: from ? new Date(from).toISOString() : (customer?.createdAt || new Date().toISOString()),
            type: 'opening',
            refNumber: from ? 'B/F' : 'OPENING',
            description: from ? 'Balance Brought Forward' : 'Opening Balance',
            debit: displayBbf > 0 ? displayBbf : 0,
            credit: displayBbf < 0 ? Math.abs(displayBbf) : 0,
            balance: displayBbf
        });
    }

    const groupedEntries = useMemo(() => {
        const groups = [];
        let currentGroup = null;

        entries.forEach((entry) => {
            const dateStr = new Date(entry.date).toDateString();
            const isRefund = entry.description && entry.description.includes('Refund');
            
            if (isRefund && entry.refNumber) {
                if (currentGroup && currentGroup.refNumber === entry.refNumber && currentGroup.dateStr === dateStr) {
                    currentGroup.items.push(entry);
                    currentGroup.credit += entry.credit || 0;
                    currentGroup.debit += entry.debit || 0;
                    currentGroup.balance = entry.balance;
                } else {
                    if (currentGroup) groups.push(currentGroup);
                    currentGroup = { ...entry, isGroup: true, items: [entry], dateStr, description: `Grouped Refund (Ref: ${entry.refNumber})` };
                }
            } else {
                if (currentGroup) {
                    groups.push(currentGroup);
                    currentGroup = null;
                }
                groups.push(entry);
            }
        });
        if (currentGroup) groups.push(currentGroup);
        
        return groups.map(g => {
            if (g.isGroup && g.items.length === 1) {
                return g.items[0]; // flatten single-item groups back to original entry
            }
            return g;
        });
    }, [entries]);

    const typeStyle = (type) => {
        if (type === 'bill') return { bg: 'bg-orange-50', badge: 'bg-orange-100 text-orange-700', label: '🧾 Bill' };
        if (type === 'payment') return { bg: 'bg-green-50', badge: 'bg-green-100 text-green-700', label: '✅ Payment' };
        if (type === 'opening') return { bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-700', label: '📂 Opening' };
        return { bg: '', badge: 'bg-gray-100 text-gray-600', label: '⚙️ Adj' };
    };

    return (
        <div className="space-y-6 pb-24 lg:pb-8">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-end pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3 w-full sm:w-auto flex-1 max-w-md">
                    <button onClick={() => navigate('/customers')} className="text-gray-500 hover:text-gray-800 text-xl font-bold">←</button>
                    <SearchableDropdown 
                        value={selectedCustomerId}
                        onChange={handleCustomerChange}
                        placeholder="-- Select Customer Account --"
                        options={customers.map(c => ({ value: c._id, label: `${c.companyName || c.name}${c.phone ? ` - ${c.phone}` : ''}` }))}
                    />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    {canRecordPayment && (
                        <button
                            onClick={() => setPayModal(true)}
                            className="flex-1 sm:flex-none px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-xs shadow"
                        >
                            + Receive Payment
                        </button>
                    )}
                    {canRecordPayment && (
                        <button
                            onClick={() => setRefundModal(true)}
                            className="flex-1 sm:flex-none px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold text-xs shadow"
                        >
                            ↩ Issue Refund
                        </button>
                    )}
                    <button
                        onClick={handlePrint}
                        disabled={!selectedCustomerId || !data}
                        className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold text-xs shadow disabled:opacity-50"
                    >
                        🖨️ Statement
                    </button>
                </div>
            </div>

            {linkedVendor && (
                <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-xl px-5 py-3 gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-purple-600 text-lg">🔗</span>
                        <div>
                            <p className="text-sm font-bold text-purple-800">This customer is also a Vendor</p>
                            <p className="text-xs text-purple-600">View both Sales and Purchase transactions together with a single net balance.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate(`/combined-ledger/${linkedVendor._id}`)}
                        className="shrink-0 px-4 py-2 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 transition-colors shadow"
                    >
                        View Combined Ledger →
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className={`rounded-xl p-5 shadow-sm border ${balance > 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Outstanding Balance</p>
                    <p className={`text-3xl font-black mt-1 ${balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                        ₹{fmt(Math.abs(balance))}
                    </p>
                    <p className="text-xs mt-1 font-medium text-gray-500">{balance > 0 ? 'Amount Pending (Dr)' : balance < 0 ? 'Advance / Surplus (Cr)' : 'Settled'}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Billed</p>
                    <p className="text-3xl font-black mt-1 text-red-600">₹{fmt(entries.reduce((s, e) => s + e.debit, 0))}</p>
                    <p className="text-xs mt-1 text-gray-500">{entries.filter(e => e.type === 'bill').length} bills</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-5 shadow-sm">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Received</p>
                    <p className="text-3xl font-black mt-1 text-green-600">₹{fmt(entries.reduce((s, e) => s + e.credit, 0))}</p>
                    <p className="text-xs mt-1 text-gray-500">{entries.filter(e => e.type === 'payment').length} payments</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-3 items-end">
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">From Date</label>
                    <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">To Date</label>
                    <input type="date" value={to} onChange={e => setTo(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
                <button onClick={fetchLedger} disabled={!selectedCustomerId} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50">Apply</button>
                {(from || to) && (
                    <button onClick={() => { setFrom(''); setTo(''); }} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Clear</button>
                )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="font-bold text-gray-800">Ledger Entries</h2>
                    <span className="text-sm text-gray-500">{groupedEntries.length} entries</span>
                </div>
                {loading ? (
                    <div className="flex justify-center items-center h-48">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
                    </div>
                ) : !selectedCustomerId ? (
                    <div className="text-center py-16 text-gray-400 border-t border-gray-100">
                        <p className="text-4xl mb-3 mt-4">🔍</p>
                        <p className="text-lg font-medium">Select an account</p>
                        <p className="text-sm">Choose a customer document from the dropdown above to view their Tally ledger statement.</p>
                    </div>
                ) : groupedEntries.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                        <p className="text-4xl mb-3">📒</p>
                        <p className="text-lg font-medium">No ledger entries found</p>
                        <p className="text-sm">Bills and payments will appear here once recorded.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left mobile-card-table">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">#</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ref No.</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Particulars</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Debit (Dr)</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Credit (Cr)</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Balance</th>
                                    {canEditPayment && <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-center">Actions</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {groupedEntries.map((entry, i) => {
                                    const ts = typeStyle(entry.type);
                                    const isManualPayment = entry.type === 'payment' && entry.refType === 'Manual' && !entry.isGroup;
                                    const isManualRefund  = entry.type === 'adjustment' && entry.refType === 'Manual' && !entry.isGroup;
                                    return (
                                        <tr key={entry._id || i} className={`${ts.bg} hover:brightness-95 transition-all`}>
                                            <td className="px-4 py-3 text-gray-400 text-sm" data-label="#">{i + 1}</td>
                                            <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap" data-label="Date">
                                                {new Date(entry.date).toLocaleDateString('en-IN')}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-mono font-semibold text-gray-800" data-label="Ref No.">
                                                {entry.refNumber || '-'}
                                            </td>
                                            <td className="px-4 py-3" data-label="Particulars">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${ts.badge}`}>
                                                        {ts.label}
                                                    </span>
                                                    {entry.paymentMode && (
                                                        <span className="inline-block text-[10px] font-bold text-gray-500 uppercase tracking-wider bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                                                            {entry.paymentMode}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-700">{entry.description}</p>
                                                {entry.notes && <p className="text-xs text-gray-400 mt-0.5">{entry.notes}</p>}
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-red-600 whitespace-nowrap" data-label="Debit (Dr)">
                                                {entry.debit > 0 ? `₹${fmt(entry.debit)}` : <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-green-600 whitespace-nowrap" data-label="Credit (Cr)">
                                                {entry.credit > 0 ? `₹${fmt(entry.credit)}` : <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className={`px-4 py-3 text-right font-bold whitespace-nowrap ${entry.balance >= 0 ? 'text-orange-600' : 'text-green-600'}`} data-label="Balance">
                                                ₹{fmt(Math.abs(entry.balance))}
                                                <span className="text-xs font-normal ml-1">{entry.balance >= 0 ? 'Dr' : 'Cr'}</span>
                                            </td>
                                            {canEditPayment && (
                                                <td className="px-4 py-3 text-center whitespace-nowrap" data-label="Actions">
                                                    {(isManualPayment || isManualRefund) ? (
                                                        <div className="flex gap-1 justify-center">
                                                            <button
                                                                onClick={() => handleEditOpen(entry)}
                                                                title={isManualRefund ? 'Edit refund' : 'Edit payment'}
                                                                className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                                                                ✏️
                                                            </button>
                                                            {isManualPayment && (
                                                                <button
                                                                    onClick={() => printPaymentReceipt(entry, data.customer, settings, 'customer')}
                                                                    title="Print Receipt"
                                                                    className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors">
                                                                    🖨️
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => setDeleteConfirm(entry)}
                                                                title={isManualRefund ? 'Delete refund' : 'Delete payment'}
                                                                className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                                                                🗑️
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-300 text-xs">—</span>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="bg-gray-800 text-white">
                                    <td colSpan={4} className="px-4 py-3 font-bold text-sm">TOTAL</td>
                                    <td className="px-4 py-3 text-right font-bold text-red-300">
                                        ₹{fmt(entries.reduce((s, e) => s + e.debit, 0))}
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-green-300">
                                        ₹{fmt(entries.reduce((s, e) => s + e.credit, 0))}
                                    </td>
                                    <td className={`px-4 py-3 text-right font-bold text-lg ${balance >= 0 ? 'text-orange-300' : 'text-green-300'}`}>
                                        ₹{fmt(Math.abs(balance))} {balance >= 0 ? 'Dr' : 'Cr'}
                                    </td>
                                    {canEditPayment && <td className="px-4 py-3"></td>}
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>

            {/* Receive Payment Modal */}
            {payModal && (
                <FullScreenModal isOpen={payModal} onClose={() => setPayModal(false)}>
                    <div className="modal-content">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-green-50">
                            <div className="flex flex-col">
                                <h2 className="text-xl font-bold text-green-800">💵 Receive Payment</h2>
                                <p className="text-xs font-bold text-green-600 uppercase tracking-tight mt-0.5">CUSTOMER: {customer?.companyName || customer?.name}</p>
                            </div>
                            <button onClick={() => setPayModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
                        </div>
                        <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4">
                            <div className={`p-3 rounded-lg text-center font-semibold text-sm ${balance > 0 ? 'bg-orange-50 text-orange-700 border border-orange-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
                                Current Balance: ₹{fmt(Math.abs(balance))} {balance >= 0 ? 'Dr (Pending)' : 'Cr (Advance)'}
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Amount Received *</label>
                                <input type="number" step="0.01" min="0.01" required
                                    value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                                    placeholder="Enter amount"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-lg font-bold" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Payment Mode</label>
                                    <select value={payForm.paymentMode} onChange={e => setPayForm({ ...payForm, paymentMode: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none">
                                        {PAYMENT_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Date</label>
                                    <input type="date" value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Ref / Cheque No. (optional)</label>
                                <input type="text" value={payForm.refNumber} onChange={e => setPayForm({ ...payForm, refNumber: e.target.value })}
                                    placeholder="e.g. CHQ-123456, UPI Ref"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Notes (optional)</label>
                                <textarea rows={2} value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })}
                                    placeholder="Any remarks..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none resize-none" />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="submit" disabled={paying}
                                    className="flex-1 py-2.5 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50">
                                    {paying ? 'Recording...' : '✅ Record Payment'}
                                </button>
                                <button type="button" onClick={() => setPayModal(false)}
                                    className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </FullScreenModal>
            )}

            {/* Edit Payment Modal */}
            {editModal && (
                <FullScreenModal isOpen={editModal} onClose={() => { setEditModal(false); setEditingEntry(null); }}>
                    <div className="modal-content">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-blue-50">
                            <div className="flex flex-col">
                                <h2 className="text-xl font-bold text-blue-800">
                                    {editingEntry?.type === 'adjustment' ? '✏️ Edit Refund' : '✏️ Edit Payment'}
                                </h2>
                                <p className="text-xs font-bold text-blue-600 uppercase tracking-tight mt-0.5">CUSTOMER: {customer?.companyName || customer?.name}</p>
                            </div>
                            <button onClick={() => { setEditModal(false); setEditingEntry(null); }} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
                        </div>
                        <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Amount Received *</label>
                                <input type="number" step="0.01" min="0.01" required
                                    value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })}
                                    placeholder="Enter amount"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-lg font-bold" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Payment Mode</label>
                                    <select value={editForm.paymentMode} onChange={e => setEditForm({ ...editForm, paymentMode: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                                        {PAYMENT_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Date</label>
                                    <input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Ref / Cheque No. (optional)</label>
                                <input type="text" value={editForm.refNumber} onChange={e => setEditForm({ ...editForm, refNumber: e.target.value })}
                                    placeholder="e.g. CHQ-123456, UPI Ref"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Notes (optional)</label>
                                <textarea rows={2} value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                                    placeholder="Any remarks..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="submit" disabled={editSaving}
                                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50">
                                    {editSaving ? 'Saving...' : '✅ Save Changes'}
                                </button>
                                <button type="button" onClick={() => { setEditModal(false); setEditingEntry(null); }}
                                    className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </FullScreenModal>
            )}

            {/* Delete Confirm Modal */}
            {deleteConfirm && (
                <FullScreenModal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
                    <div className="modal-content">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-red-50">
                            <h2 className="text-xl font-bold text-red-800">🗑️ Delete Payment</h2>
                            <button onClick={() => setDeleteConfirm(null)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                                <p className="text-red-700 font-semibold">Are you sure you want to delete this payment entry?</p>
                                <p className="text-2xl font-black text-red-600 mt-2">₹{fmt(deleteConfirm.credit)}</p>
                                <p className="text-sm text-gray-500 mt-1">{deleteConfirm.description} · {new Date(deleteConfirm.date).toLocaleDateString('en-IN')}</p>
                                <p className="text-xs text-red-500 mt-2 font-medium">This action cannot be undone. The customer balance will be recalculated automatically.</p>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={handleDeletePayment} disabled={deleting}
                                    className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 disabled:opacity-50">
                                    {deleting ? 'Deleting...' : '🗑️ Yes, Delete'}
                                </button>
                                <button onClick={() => setDeleteConfirm(null)}
                                    className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </FullScreenModal>
            )}

            {/* Issue Refund Modal */}
            {refundModal && (
                <FullScreenModal isOpen={refundModal} onClose={() => setRefundModal(false)}>
                    <div className="modal-content">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-purple-50">
                            <div className="flex flex-col">
                                <h2 className="text-xl font-bold text-purple-800">&#x21A9; Issue Refund</h2>
                                <p className="text-xs font-bold text-purple-600 uppercase tracking-tight mt-0.5">CUSTOMER: {customer?.companyName || customer?.name}</p>
                            </div>
                            <button onClick={() => setRefundModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
                        </div>
                        <form onSubmit={handleRefundSubmit} className="p-6 space-y-4">
                            <div className={`p-3 rounded-lg text-center font-semibold text-sm ${balance > 0 ? 'bg-orange-50 text-orange-700 border border-orange-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
                                Current Balance: &#x20B9;{fmt(Math.abs(balance))} {balance >= 0 ? 'Dr (Pending)' : 'Cr (Advance)'}
                            </div>
                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs text-purple-700">
                                <strong>&#8505;&#65039; What this does:</strong> Records money paid back to the customer for a return. Reduces their outstanding balance (or creates an advance credit for future bills).
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Refund Amount *</label>
                                <input type="number" step="0.01" min="0.01" required
                                    value={refundForm.amount} onChange={e => setRefundForm({ ...refundForm, amount: e.target.value })}
                                    placeholder="Enter refund amount"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-lg font-bold" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Payment Mode</label>
                                    <select value={refundForm.paymentMode} onChange={e => setRefundForm({ ...refundForm, paymentMode: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none">
                                        {PAYMENT_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Date</label>
                                    <input type="date" value={refundForm.date} onChange={e => setRefundForm({ ...refundForm, date: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Return Reference No. (optional)</label>
                                <input type="text" value={refundForm.returnRef} onChange={e => setRefundForm({ ...refundForm, returnRef: e.target.value })}
                                    placeholder="e.g. RET-001, SO-123"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Ref / Voucher No. (optional)</label>
                                <input type="text" value={refundForm.refNumber} onChange={e => setRefundForm({ ...refundForm, refNumber: e.target.value })}
                                    placeholder="e.g. CHQ-123, UPI Ref"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Notes (optional)</label>
                                <textarea rows={2} value={refundForm.notes} onChange={e => setRefundForm({ ...refundForm, notes: e.target.value })}
                                    placeholder="Reason for refund, items returned, etc."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-none" />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="submit" disabled={refunding}
                                    className="flex-1 py-2.5 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50">
                                    {refunding ? 'Recording...' : '&#x21A9; Record Refund'}
                                </button>
                                <button type="button" onClick={() => setRefundModal(false)}
                                    className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </FullScreenModal>
            )}
        </div>
    );
};

export default CustomerLedger;
