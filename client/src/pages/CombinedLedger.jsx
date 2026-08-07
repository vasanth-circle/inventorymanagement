import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { toast } from 'react-hot-toast';

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SearchableDropdown = ({ options = [], value, onChange, placeholder = 'Search...', disabled = false }) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef(null);
    const selected = options.find(o => o.value === value);
    const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));
    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);
    const handleSelect = (val) => { onChange({ target: { value: val } }); setSearch(''); setOpen(false); };
    return (
        <div ref={ref} className="relative w-full">
            <button
                type="button" disabled={disabled}
                onClick={() => setOpen(o => !o)}
                className={`w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-800 focus:ring-2 focus:ring-purple-500 transition-all flex items-center justify-between shadow-sm ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
                <span className={selected ? 'text-gray-800' : 'text-gray-400'}>{selected ? selected.label : placeholder}</span>
                <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
            </button>
            {open && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                    <div className="p-2 border-b border-gray-100">
                        <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Type to search..." className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500" />
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                        {filtered.length === 0
                            ? <div className="px-4 py-3 text-xs text-gray-400 text-center">No results found</div>
                            : filtered.map(o => (
                                <button key={o.value} type="button" onClick={() => handleSelect(o.value)}
                                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-purple-50 hover:text-purple-700 transition-colors ${o.value === value ? 'bg-purple-50 text-purple-700 font-bold' : 'text-gray-700'}`}>
                                    {o.label}
                                </button>
                            ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const CombinedLedger = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [selectedVendorId, setSelectedVendorId] = useState(id || '');
    const [linkedVendors, setLinkedVendors] = useState([]);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');

    useEffect(() => {
        api.get('/vendors?limit=1000').then(res => {
            const all = res.data?.data?.vendors || [];
            setLinkedVendors(all.filter(v => v.linkedCustomerId));
        }).catch(() => {});
    }, []);

    const fetchCombined = useCallback(async () => {
        if (!selectedVendorId) { setData(null); return; }
        try {
            setLoading(true);
            const params = {};
            if (from) params.from = from;
            if (to) params.to = to;
            const res = await api.get(`/vendor-ledger/${selectedVendorId}/combined`, { params });
            setData(res.data?.data || null);
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to fetch combined ledger';
            toast.error(msg);
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [selectedVendorId, from, to]);

    useEffect(() => { fetchCombined(); }, [fetchCombined]);

    useEffect(() => {
        if (id && id !== selectedVendorId) setSelectedVendorId(id);
    }, [id]);

    const handleVendorChange = (e) => {
        const newId = e.target.value;
        setSelectedVendorId(newId);
        if (newId) navigate(`/combined-ledger/${newId}`);
        else navigate('/combined-ledger');
    };

    const handlePrint = () => {
        if (!data) return;
        const { vendor, customer, combinedLedger, netBalance, bbf } = data;
        const partyName = vendor.companyName || vendor.name;
        const printContent = `<!DOCTYPE html>
<html>
<head>
  <title>Combined Ledger - ${partyName}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:0;padding:20px}
    h1{font-size:18px;margin:0 0 4px}
    .sub{color:#555;font-size:11px;margin-bottom:16px}
    table{width:100%;border-collapse:collapse;margin-top:8px}
    th{background:#f0f0f0;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;border:1px solid #ddd}
    td{padding:5px 8px;border:1px solid #eee;font-size:11px}
    .purchase{background:#fff8f0}.sales{background:#f0fff8}
    .badge{display:inline-block;padding:1px 6px;border-radius:9px;font-size:9px;font-weight:bold}
    .badge-p{background:#fed7aa;color:#92400e}.badge-s{background:#bbf7d0;color:#065f46}
    .right{text-align:right}.total-row{font-weight:bold;background:#f9fafb}
    .net-pos{color:#16a34a}.net-neg{color:#dc2626}
    @media print{body{margin:0}}
  </style>
</head>
<body>
  <h1>Combined Account Statement</h1>
  <p class="sub">Party: <strong>${partyName}</strong> &nbsp;|&nbsp; As Vendor: ${vendor.name} &nbsp;|&nbsp; As Customer: ${customer.companyName || customer.name}</p>
  <table>
    <thead>
      <tr><th>#</th><th>Date</th><th>Ref No.</th><th>Particulars</th><th>Type</th><th class="right">Debit (Dr)</th><th class="right">Credit (Cr)</th><th class="right">Net Balance</th></tr>
    </thead>
    <tbody>
      ${bbf !== 0 ? `<tr><td colspan="5" style="font-weight:bold">Balance Brought Forward</td><td class="right">${bbf > 0 ? fmt(bbf) : '&#8212;'}</td><td class="right">${bbf < 0 ? fmt(Math.abs(bbf)) : '&#8212;'}</td><td class="right ${bbf >= 0 ? 'net-pos' : 'net-neg'}">${fmt(Math.abs(bbf))} ${bbf >= 0 ? 'Dr' : 'Cr'}</td></tr>` : ''}
      ${combinedLedger.map((e, i) => `
        <tr class="${e.source === 'purchase' ? 'purchase' : 'sales'}">
          <td>${i + 1}</td>
          <td>${new Date(e.date).toLocaleDateString('en-IN')}</td>
          <td>${e.refNumber || '-'}</td>
          <td>${e.description || (e.source === 'purchase' ? 'Purchase' : 'Sales')}</td>
          <td><span class="badge ${e.source === 'purchase' ? 'badge-p' : 'badge-s'}">${e.source === 'purchase' ? 'Purchase' : 'Sales'}</span></td>
          <td class="right">${e.combinedDebit > 0 ? fmt(e.combinedDebit) : '&#8212;'}</td>
          <td class="right">${e.combinedCredit > 0 ? fmt(e.combinedCredit) : '&#8212;'}</td>
          <td class="right ${e.balance >= 0 ? 'net-pos' : 'net-neg'}">${fmt(Math.abs(e.balance))} ${e.balance >= 0 ? 'Dr' : 'Cr'}</td>
        </tr>`).join('')}
      <tr class="total-row">
        <td colspan="7">Net Balance (Closing)</td>
        <td class="right ${netBalance >= 0 ? 'net-pos' : 'net-neg'}">${fmt(Math.abs(netBalance))} ${netBalance >= 0 ? 'Dr (Party owes you)' : 'Cr (You owe party)'}</td>
      </tr>
    </tbody>
  </table>
  <p style="margin-top:16px;font-size:10px;color:#888">Printed on ${new Date().toLocaleString('en-IN')} | Green = Sales | Orange = Purchase</p>
</body></html>`;
        const win = window.open('', '_blank');
        win.document.write(printContent);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); win.close(); }, 500);
    };

    const vendor = data?.vendor;
    const customer = data?.customer;
    const combinedLedger = data?.combinedLedger || [];
    const netBalance = data?.netBalance ?? 0;
    const bbf = data?.bbf ?? 0;
    const { salesDebitTotal = 0, salesCreditTotal = 0, purchaseCreditTotal = 0, purchaseDebitTotal = 0 } = data || {};

    const entryStyle = (source, type) => {
        if (source === 'purchase') {
            if (type === 'bill')    return { bg: 'bg-orange-50', badge: 'bg-orange-100 text-orange-800', label: '📦 Purchase Bill' };
            if (type === 'payment') return { bg: 'bg-orange-100', badge: 'bg-orange-200 text-orange-900', label: '💸 Paid to Vendor' };
            return { bg: 'bg-orange-50', badge: 'bg-orange-100 text-orange-700', label: '⚙️ Purchase Adj' };
        } else {
            if (type === 'bill')    return { bg: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-800', label: '🧾 Sales Bill' };
            if (type === 'payment') return { bg: 'bg-emerald-100', badge: 'bg-emerald-200 text-emerald-900', label: '✅ Payment Rcvd' };
            return { bg: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-700', label: '⚙️ Sales Adj' };
        }
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
                        placeholder="-- Select Party (Vendor + Customer) --"
                        options={linkedVendors.map(v => ({ value: v._id, label: `${v.name}${v.companyName ? ` – ${v.companyName}` : ''}` }))}
                    />
                </div>
                <button
                    onClick={handlePrint}
                    disabled={!selectedVendorId || !data}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold text-sm shadow disabled:opacity-50"
                >
                    🖨️ Print Statement
                </button>
            </div>

            {/* Page Title Banner */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl px-6 py-4 text-white shadow-lg">
                <div className="flex items-center gap-3">
                    <span className="text-3xl">🔗</span>
                    <div>
                        <h1 className="text-xl font-black">Combined Party Ledger</h1>
                        <p className="text-purple-200 text-sm">
                            All Sales (Customer) + Purchase (Vendor) transactions — net balance shows the true position with this party.
                        </p>
                    </div>
                </div>
                {vendor && customer && (
                    <div className="mt-3 flex flex-wrap gap-3">
                        <span className="bg-white bg-opacity-20 rounded-lg px-3 py-1 text-sm font-semibold">
                            🧾 As Customer: {customer.companyName || customer.name}
                        </span>
                        <span className="bg-white bg-opacity-20 rounded-lg px-3 py-1 text-sm font-semibold">
                            📦 As Vendor: {vendor.companyName || vendor.name}
                        </span>
                    </div>
                )}
            </div>

            {/* Date Filters */}
            <div className="flex flex-wrap items-end gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">From Date</label>
                    <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">To Date</label>
                    <input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
                </div>
                <button onClick={fetchCombined} className="px-4 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold text-sm shadow">Apply</button>
                {(from || to) && (
                    <button onClick={() => { setFrom(''); setTo(''); }} className="px-4 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Clear</button>
                )}
            </div>

            {/* Summary Cards */}
            {data && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className={`col-span-2 rounded-2xl p-5 shadow border-2 ${netBalance > 0 ? 'bg-emerald-50 border-emerald-400' : netBalance < 0 ? 'bg-red-50 border-red-400' : 'bg-gray-50 border-gray-300'}`}>
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">NET Balance (True Party Position)</p>
                        <p className={`text-4xl font-black mt-1 ${netBalance > 0 ? 'text-emerald-600' : netBalance < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                            ₹{fmt(Math.abs(netBalance))}
                        </p>
                        <p className={`text-sm mt-1 font-bold ${netBalance > 0 ? 'text-emerald-700' : netBalance < 0 ? 'text-red-700' : 'text-gray-500'}`}>
                            {netBalance > 0 ? '✅ Party owes YOU — Net Receivable (Dr)' : netBalance < 0 ? '⚠️ You owe PARTY — Net Payable (Cr)' : '✔ Fully Settled'}
                        </p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 shadow-sm">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sales (Billed)</p>
                        <p className="text-2xl font-black mt-1 text-emerald-600">₹{fmt(salesDebitTotal)}</p>
                        <p className="text-xs mt-1 text-emerald-700">Received: ₹{fmt(salesCreditTotal)}</p>
                    </div>
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 shadow-sm">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Purchase (Billed)</p>
                        <p className="text-2xl font-black mt-1 text-orange-600">₹{fmt(purchaseCreditTotal)}</p>
                        <p className="text-xs mt-1 text-orange-700">Paid: ₹{fmt(purchaseDebitTotal)}</p>
                    </div>
                </div>
            )}

            {/* Legend */}
            {data && (
                <div className="flex flex-wrap gap-3 text-xs font-semibold">
                    <span className="flex items-center gap-1.5 bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-full">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Green = Sales / Customer
                    </span>
                    <span className="flex items-center gap-1.5 bg-orange-100 text-orange-800 px-3 py-1.5 rounded-full">
                        <span className="w-2 h-2 rounded-full bg-orange-400 inline-block"></span> Orange = Purchase / Vendor
                    </span>
                    <span className="flex items-center gap-1.5 bg-blue-100 text-blue-800 px-3 py-1.5 rounded-full">
                        Dr = Party owes you &nbsp;|&nbsp; Cr = You owe party
                    </span>
                </div>
            )}

            {/* Combined Ledger Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-purple-50 to-indigo-50">
                    <h2 className="font-bold text-gray-800">Combined Transaction Statement</h2>
                    <span className="text-sm text-gray-500">{combinedLedger.length} entries</span>
                </div>
                {loading ? (
                    <div className="flex justify-center items-center h-48">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
                    </div>
                ) : !selectedVendorId ? (
                    <div className="text-center py-16 text-gray-400">
                        <p className="text-4xl mb-3 mt-4">🔗</p>
                        <p className="text-lg font-medium">Select a Linked Party</p>
                        <p className="text-sm">Only vendors linked to a customer account appear here.</p>
                        {linkedVendors.length === 0 && (
                            <p className="text-sm mt-3 text-orange-600 font-medium">
                                No linked parties yet. Go to{' '}
                                <button onClick={() => navigate('/vendors')} className="underline text-orange-700 font-bold">Vendors</button>
                                {' '}and link a vendor to a customer account.
                            </p>
                        )}
                    </div>
                ) : combinedLedger.length === 0 && !loading ? (
                    <div className="text-center py-16 text-gray-400">
                        <p className="text-4xl mb-3">📒</p>
                        <p className="text-lg font-medium">No transactions found</p>
                        <p className="text-sm">Sales and Purchase entries will appear here once recorded.</p>
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
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Debit (Dr)</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Credit (Cr)</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Net Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {bbf !== 0 && (
                                    <tr className="bg-blue-50">
                                        <td className="px-4 py-2 text-gray-400 text-xs">—</td>
                                        <td className="px-4 py-2 text-xs text-gray-500 font-semibold" colSpan={3}>Balance Brought Forward</td>
                                        <td className="px-4 py-2"><span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">B/F</span></td>
                                        <td className="px-4 py-2 text-right text-xs font-bold text-gray-700">{bbf > 0 ? fmt(bbf) : '—'}</td>
                                        <td className="px-4 py-2 text-right text-xs font-bold text-gray-700">{bbf < 0 ? fmt(Math.abs(bbf)) : '—'}</td>
                                        <td className="px-4 py-2 text-right">
                                            <span className={`text-sm font-black ${bbf >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                ₹{fmt(Math.abs(bbf))} <span className="text-xs font-bold">{bbf >= 0 ? 'Dr' : 'Cr'}</span>
                                            </span>
                                        </td>
                                    </tr>
                                )}
                                {combinedLedger.map((entry, i) => {
                                    const st = entryStyle(entry.source, entry.type);
                                    return (
                                        <tr key={`${entry._id}-${i}`} className={`${st.bg} hover:brightness-95 transition-all`}>
                                            <td className="px-4 py-3 text-gray-400 text-sm">{i + 1}</td>
                                            <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                                                {new Date(entry.date).toLocaleDateString('en-IN')}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-mono font-semibold text-gray-800">{entry.refNumber || '-'}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                                                {entry.description || (entry.source === 'purchase' ? 'Purchase transaction' : 'Sales transaction')}
                                                {entry.notes && <div className="text-xs text-gray-400 mt-0.5">{entry.notes}</div>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${st.badge}`}>{st.label}</span>
                                                {entry.paymentMode && entry.paymentMode !== 'cash' && (
                                                    <span className="ml-1 inline-block text-[10px] font-bold text-gray-400 uppercase">{entry.paymentMode}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold">
                                                {entry.combinedDebit > 0
                                                    ? <span className="text-emerald-700">₹{fmt(entry.combinedDebit)}</span>
                                                    : <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold">
                                                {entry.combinedCredit > 0
                                                    ? <span className="text-red-600">₹{fmt(entry.combinedCredit)}</span>
                                                    : <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`text-sm font-black ${entry.balance > 0 ? 'text-emerald-600' : entry.balance < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                                    ₹{fmt(Math.abs(entry.balance))}
                                                </span>
                                                <span className={`text-[10px] font-bold ml-1 ${entry.balance > 0 ? 'text-emerald-500' : entry.balance < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                                    {entry.balance > 0 ? 'Dr' : entry.balance < 0 ? 'Cr' : ''}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            {combinedLedger.length > 0 && (
                                <tfoot>
                                    <tr className="bg-gray-100 border-t-2 border-gray-300">
                                        <td colSpan={7} className="px-4 py-3 font-bold text-gray-700 text-sm">Net Closing Balance</td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`text-base font-black ${netBalance > 0 ? 'text-emerald-600' : netBalance < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                                ₹{fmt(Math.abs(netBalance))}
                                                <span className="text-xs ml-1">{netBalance > 0 ? 'Dr' : netBalance < 0 ? 'Cr' : ''}</span>
                                            </span>
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CombinedLedger;
