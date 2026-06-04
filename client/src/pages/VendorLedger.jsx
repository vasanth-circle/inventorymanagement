import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { toast } from 'react-hot-toast';

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

const VendorLedger = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [selectedVendorId, setSelectedVendorId] = useState(id || '');
    const [vendors, setVendors] = useState([]);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    
    // Payment modal state
    const [payModal, setPayModal] = useState(false);
    const [paying, setPaying] = useState(false);
    const [payForm, setPayForm] = useState({ amount: '', paymentMode: 'cash', date: new Date().toISOString().split('T')[0], notes: '', description: '' });

    const fetchLedger = useCallback(async () => {
        if (!selectedVendorId) {
            setData(null);
            return;
        }
        try {
            setLoading(true);
            const res = await api.get(`/vendor-ledger/${selectedVendorId}`);
            setData(res.data?.data || null);
        } catch (err) {
            console.error('Ledger fetch error:', err);
            toast.error('Failed to fetch ledger');
        } finally {
            setLoading(false);
        }
    }, [selectedVendorId]);

    useEffect(() => {
        // Fetch vendors list for dropdown
        api.get('/vendors?limit=1000').then(res => {
            const list = res.data?.data?.vendors || [];
            setVendors(list);
        }).catch(err => {
            console.error('Vendors fetch error:', err);
        });
    }, []);

    useEffect(() => {
        fetchLedger(); 
    }, [fetchLedger]);

    useEffect(() => {
        if (id && id !== selectedVendorId) {
             setSelectedVendorId(id);
        }
    }, [id]);

    const handleVendorChange = (e) => {
        const newId = e.target.value;
        setSelectedVendorId(newId);
        if (newId) {
            navigate(`/vendor-ledger/${newId}`);
        } else {
            navigate(`/vendor-ledger`);
        }
    };

    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        if (!payForm.amount || Number(payForm.amount) <= 0) return toast.error('Enter a valid amount');
        setPaying(true);
        try {
            await api.post(`/vendor-ledger/payment`, { ...payForm, vendorId: selectedVendorId, amount: Number(payForm.amount) });
            toast.success('Payment recorded successfully');
            setPayModal(false);
            setPayForm({ amount: '', paymentMode: 'cash', date: new Date().toISOString().split('T')[0], notes: '', description: '' });
            fetchLedger();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to record payment');
        } finally {
            setPaying(false);
        }
    };

    const vendor = data?.vendor;
    const backendEntries = Array.isArray(data?.ledger) ? data.ledger : [];
    const balance = vendor?.currentBalance ?? 0;

    const entries = [...backendEntries];
    if (backendEntries.length === 0 && vendor?.openingBalance) {
        entries.unshift({
            _id: 'bbf-entry',
            date: vendor?.createdAt || new Date().toISOString(),
            type: 'opening',
            refNumber: 'OPENING',
            description: 'Opening Balance',
            debit: vendor.openingBalance < 0 ? Math.abs(vendor.openingBalance) : 0, // vendor owes us -> debit
            credit: vendor.openingBalance > 0 ? vendor.openingBalance : 0, // we owe vendor -> credit
            balance: vendor.openingBalance
        });
    }

    const typeStyle = (type) => {
        if (type === 'bill') return { bg: 'bg-red-50', badge: 'bg-red-100 text-red-700', label: '📦 Purchase' };
        if (type === 'payment') return { bg: 'bg-green-50', badge: 'bg-green-100 text-green-700', label: '💸 Paid' };
        if (type === 'opening') return { bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-700', label: '📂 Opening' };
        return { bg: '', badge: 'bg-gray-100 text-gray-600', label: '⚙️ Adj' };
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap gap-3 items-start justify-between">
                <div className="flex items-center gap-3 w-full md:w-auto flex-1 max-w-md">
                    <button onClick={() => navigate('/vendors')} className="text-gray-500 hover:text-gray-800 text-xl font-bold">←</button>
                    <SearchableDropdown 
                        value={selectedVendorId}
                        onChange={handleVendorChange}
                        placeholder="-- Select Vendor Account --"
                        options={vendors.map(v => ({ value: v._id, label: v.companyName || v.name }))}
                    />
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setPayModal(true)}
                        disabled={!selectedVendorId}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold text-sm shadow disabled:opacity-50"
                    >
                        + Record Payment
                    </button>
                </div>
            </div>

            {/* Balance Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className={`rounded-xl p-5 shadow-sm border ${balance > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Outstanding Dues</p>
                    <p className={`text-3xl font-black mt-1 ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        ₹{fmt(Math.abs(balance))}
                    </p>
                    <p className="text-xs mt-1 font-medium text-gray-500">{balance > 0 ? 'Amount to be Paid (Cr)' : balance < 0 ? 'Advance Paid (Dr)' : 'Settled'}</p>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 shadow-sm">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Purchases</p>
                    <p className="text-3xl font-black mt-1 text-orange-600">₹{fmt(entries.reduce((s, e) => s + (e.credit || 0), 0))}</p>
                    <p className="text-xs mt-1 text-gray-500">{entries.filter(e => e.type === 'bill').length} bills</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-5 shadow-sm">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Paid</p>
                    <p className="text-3xl font-black mt-1 text-green-600">₹{fmt(entries.reduce((s, e) => s + (e.debit || 0), 0))}</p>
                    <p className="text-xs mt-1 text-gray-500">{entries.filter(e => e.type === 'payment').length} payments</p>
                </div>
            </div>

            {/* Ledger Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="font-bold text-gray-800">Vendor Ledger Entries</h2>
                    <span className="text-sm text-gray-500">{entries.length} entries</span>
                </div>
                {loading ? (
                    <div className="flex justify-center items-center h-48">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
                    </div>
                ) : !selectedVendorId ? (
                    <div className="text-center py-16 text-gray-400 border-t border-gray-100">
                        <p className="text-4xl mb-3 mt-4">🔍</p>
                        <p className="text-lg font-medium">Select a Vendor</p>
                        <p className="text-sm">Choose a vendor from the dropdown to view your payment history and dues.</p>
                    </div>
                ) : entries.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                        <p className="text-4xl mb-3">📒</p>
                        <p className="text-lg font-medium">No ledger entries found</p>
                        <p className="text-sm">Bills and payments will appear here once recorded.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
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
                                            <td className="px-4 py-3 text-gray-400 text-sm">{i + 1}</td>
                                            <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                                                {new Date(entry.date).toLocaleDateString('en-IN')}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-mono font-semibold text-gray-800">
                                                {entry.refNumber || '-'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-1 ${ts.badge}`}>
                                                    {ts.label}
                                                </span>
                                                <p className="text-sm text-gray-700">{entry.description}</p>
                                                {entry.notes && <p className="text-xs text-gray-400 mt-0.5">{entry.notes}</p>}
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-green-600 whitespace-nowrap">
                                                {entry.debit > 0 ? `₹${fmt(entry.debit)}` : <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-red-600 whitespace-nowrap">
                                                {entry.credit > 0 ? `₹${fmt(entry.credit)}` : <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className={`px-4 py-3 text-right font-bold whitespace-nowrap ${entry.balance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                ₹{fmt(Math.abs(entry.balance))}
                                                <span className="text-xs font-normal ml-1">{entry.balance >= 0 ? 'Cr' : 'Dr'}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Payment Modal */}
            {payModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-red-50">
                            <h2 className="text-xl font-bold text-red-800">💸 Record Payment</h2>
                            <button onClick={() => setPayModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
                        </div>
                        <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4">
                            <div className={`p-3 rounded-lg text-center font-semibold text-sm ${balance > 0 ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
                                Current Dues: ₹{fmt(Math.abs(balance))} {balance >= 0 ? 'Cr (Owed)' : 'Dr (Advance)'}
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Amount Paid *</label>
                                <input type="number" step="0.01" min="0.01" required
                                    value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                                    placeholder="Enter amount"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-lg font-bold" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Payment Mode</label>
                                    <select value={payForm.paymentMode} onChange={e => setPayForm({ ...payForm, paymentMode: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none">
                                        {PAYMENT_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Date</label>
                                    <input type="date" value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Description (optional)</label>
                                <input type="text" value={payForm.description} onChange={e => setPayForm({ ...payForm, description: e.target.value })}
                                    placeholder="e.g. Paid for INV-123"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Notes (optional)</label>
                                <textarea rows={2} value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })}
                                    placeholder="Any remarks..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none resize-none" />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="submit" disabled={paying}
                                    className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 disabled:opacity-50">
                                    {paying ? 'Recording...' : '✅ Record Payment'}
                                </button>
                                <button type="button" onClick={() => setPayModal(false)}
                                    className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50">
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

export default VendorLedger;
