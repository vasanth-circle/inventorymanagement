import { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { printAccountStatement } from '../utils/printTemplates';
import { AuthContext } from '../context/AuthContext';
import FullScreenModal from '../components/FullScreenModal';
const api = (path, opts = {}) =>
    axios({ url: `/api${path}`, ...opts, headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, ...opts.headers } });

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PAYMENT_MODES = [
    { value: 'cash', label: '💵 Cash' },
    { value: 'cheque', label: '🏦 Cheque' },
    { value: 'upi', label: '📱 UPI' },
    { value: 'bank_transfer', label: '🏛️ Bank Transfer' },
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

    const effectiveRole = user?.appRoles?.inventory || user?.role;
    const canRecordPayment = ['admin', 'manager', 'tenant_owner', 'tenant_admin', 'accounts'].includes(effectiveRole) || ['admin', 'manager', 'tenant_owner', 'tenant_admin', 'super_admin'].includes(user?.role);

    // Payment modal state
    const [payModal, setPayModal] = useState(false);
    const [paying, setPaying] = useState(false);
    const [payForm, setPayForm] = useState({ amount: '', paymentMode: 'cash', date: new Date().toISOString().split('T')[0], notes: '', refNumber: '' });

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
        // Fetch customers list for dropdown (fetch all for local search)
        api('/customers?limit=1000').then(res => {
            setCustomers(res.data.data.customers);
        }).catch(() => {});
        fetchLedger(); 
    }, [fetchLedger]);

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
        api('/settings').then(r => setSettings(r.data.data)).catch(() => {});
    }, []);

    const handlePrint = async () => {
        try {
            const params = {};
            if (from) params.from = from;
            if (to) params.to = to;
            const res = await api(`/customers/${selectedCustomerId}/statement`, { params });
            const { customer, entries, summary, period } = res.data.data;
            printAccountStatement(customer, entries, summary, period, settings);
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

    const customer = data?.customer;
    const entries = data?.entries || [];
    const balance = data?.currentBalance ?? 0;

    const typeStyle = (type) => {
        if (type === 'bill') return { bg: 'bg-orange-50', badge: 'bg-orange-100 text-orange-700', label: '🧾 Bill' };
        if (type === 'payment') return { bg: 'bg-green-50', badge: 'bg-green-100 text-green-700', label: '✅ Payment' };
        if (type === 'opening') return { bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-700', label: '📂 Opening' };
        return { bg: '', badge: 'bg-gray-100 text-gray-600', label: '⚙️ Adj' };
    };

    return (
        <div className="space-y-6 pb-24 lg:pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-end pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3 w-full sm:w-auto flex-1 max-w-md">
                    <button onClick={() => navigate('/customers')} className="text-gray-500 hover:text-gray-800 text-xl font-bold">←</button>
                    <SearchableDropdown 
                        value={selectedCustomerId}
                        onChange={handleCustomerChange}
                        placeholder="-- Select Customer Account --"
                        options={customers.map(c => ({ value: c._id, label: c.companyName || c.name }))}
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
                    <button
                        onClick={handlePrint}
                        disabled={!selectedCustomerId || !data}
                        className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold text-xs shadow disabled:opacity-50"
                    >
                        🖨️ Statement
                    </button>
                </div>
            </div>

            {/* Balance Cards */}
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

            {/* Date Filter */}
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

            {/* Ledger Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="font-bold text-gray-800">Ledger Entries</h2>
                    <span className="text-sm text-gray-500">{entries.length} entries</span>
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
                ) : entries.length === 0 ? (
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
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {entries.map((entry, i) => {
                                    const ts = typeStyle(entry.type);
                                    return (
                                        <tr key={entry._id} className={`${ts.bg} hover:brightness-95 transition-all`}>
                                            <td className="px-4 py-3 text-gray-400 text-sm" data-label="#">{i + 1}</td>
                                            <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap" data-label="Date">
                                                {new Date(entry.date).toLocaleDateString('en-IN')}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-mono font-semibold text-gray-800" data-label="Ref No.">
                                                {entry.refNumber || '-'}
                                            </td>
                                            <td className="px-4 py-3" data-label="Particulars">
                                                <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-1 ${ts.badge}`}>
                                                    {ts.label}
                                                </span>
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
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>

            {/* Payment Modal */}
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
                            {/* Current balance chip */}
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
        </div>
    );
};

export default CustomerLedger;
