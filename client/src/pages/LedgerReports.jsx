import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { formatCurrency, exportToCSV } from '../utils/helpers';
import toast from 'react-hot-toast';

const LedgerReports = () => {
    const navigate = useNavigate();
    const [reportType, setReportType] = useState('customer');
    const [reportData, setReportData] = useState([]);
    const [linkedData, setLinkedData] = useState([]); // combined/linked party data
    const [loading, setLoading] = useState(false);
    const [daysFilter, setDaysFilter] = useState(0);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            if (reportType === 'combined') {
                // Fetch all vendors, filter those with linkedCustomerId
                const vendorsRes = await api.get('/vendors?limit=1000');
                const allVendors = vendorsRes.data?.data?.vendors || [];
                const linked = allVendors.filter(v => v.linkedCustomerId);

                // For each linked vendor, fetch their combined ledger summary
                const results = await Promise.all(linked.map(async (vendor) => {
                    try {
                        const res = await api.get(`/vendor-ledger/${vendor._id}/combined`);
                        const d = res.data?.data || {};
                        return {
                            vendorId: vendor._id,
                            name: vendor.companyName || vendor.name,
                            customerName: d.customer?.companyName || d.customer?.name || '—',
                            phone: vendor.phone,
                            netBalance: d.netBalance ?? 0,
                            salesDebitTotal: d.salesDebitTotal ?? 0,
                            salesCreditTotal: d.salesCreditTotal ?? 0,
                            purchaseCreditTotal: d.purchaseCreditTotal ?? 0,
                            purchaseDebitTotal: d.purchaseDebitTotal ?? 0,
                        };
                    } catch {
                        return {
                            vendorId: vendor._id,
                            name: vendor.companyName || vendor.name,
                            customerName: '—',
                            phone: vendor.phone,
                            netBalance: 0,
                            salesDebitTotal: 0,
                            salesCreditTotal: 0,
                            purchaseCreditTotal: 0,
                            purchaseDebitTotal: 0,
                        };
                    }
                }));
                setLinkedData(results);
                setReportData([]);
            } else {
                const endpoint = reportType === 'customer'
                    ? '/customers/statements/overall'
                    : '/vendor-ledger/statements/overall';
                const response = await api.get(endpoint);
                if (response.data && response.data.success) {
                    setReportData(response.data.data);
                }
                setLinkedData([]);
            }
        } catch (error) {
            console.error('Error fetching ledger reports:', error);
            toast.error('Failed to load ledger data');
        } finally {
            setLoading(false);
        }
    }, [reportType]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleExport = () => {
        if (reportType === 'combined') {
            if (linkedData.length === 0) return toast.error('No data to export');
            const exportData = linkedData.map(item => ({
                'Party Name': item.name,
                'Customer Name': item.customerName,
                'Contact': item.phone || 'N/A',
                'Sales Billed': formatCurrency(item.salesDebitTotal),
                'Sales Received': formatCurrency(item.salesCreditTotal),
                'Purchase Billed': formatCurrency(item.purchaseCreditTotal),
                'Purchase Paid': formatCurrency(item.purchaseDebitTotal),
                'Net Balance': formatCurrency(Math.abs(item.netBalance)),
                'Position': item.netBalance >= 0 ? 'Party owes you (Dr)' : 'You owe party (Cr)',
            }));
            exportToCSV(exportData, `combined-ledger-${new Date().toISOString().split('T')[0]}`);
            toast.success('Combined ledger report exported');
        } else {
            if (reportData.length === 0) return toast.error('No data to export');
            const exportData = reportData.map(item => ({
                'Name': item.name,
                'Contact': item.contact || 'N/A',
                'Total Billed': formatCurrency(item.totalBilled),
                'Total Paid': formatCurrency(item.totalPaid),
                'Balance': formatCurrency(item.currentBalance),
                'Oldest Pending (Days)': item.oldestPendingDays || 0
            }));
            exportToCSV(exportData, `ledger-${reportType}-${new Date().toISOString().split('T')[0]}`);
            toast.success(`${reportType === 'customer' ? 'Customer' : 'Vendor'} ledger report exported`);
        }
    };

    const filteredData = reportData.filter(item => (item.oldestPendingDays || 0) >= daysFilter);

    const navButtons = [
        { id: 'customer', label: '👥 Customer Aging' },
        { id: 'vendor',   label: '🏢 Vendor Aging' },
        { id: 'combined', label: '🔗 Combined Accounts' },
    ];

    const renderStandardTable = () => (
        <table className="min-w-full">
            <thead className="bg-white border-b border-gray-100">
                <tr>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Name / Contact</th>
                    <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Billed</th>
                    <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Paid</th>
                    <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Balance</th>
                    <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Days Pending</th>
                    <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Ledger</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 font-medium">
                {filteredData.map((item, idx) => (
                    <tr
                        key={idx}
                        className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                        onClick={() => {
                            if (reportType === 'customer' && item.customerId) navigate(`/customer-ledger/${item.customerId}`);
                            else if (reportType === 'vendor' && item.vendorId) navigate(`/vendor-ledger/${item.vendorId}`);
                        }}
                    >
                        <td className="px-6 py-4 whitespace-nowrap">
                            <p className="text-xs font-bold text-gray-900">{item.name}</p>
                            <p className="text-[10px] text-gray-400">{item.contact || 'No Contact'}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-xs text-gray-600">{formatCurrency(item.totalBilled)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-xs text-emerald-600">{formatCurrency(item.totalPaid)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-black text-gray-900">{formatCurrency(item.currentBalance)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-black tracking-tight ${
                                item.oldestPendingDays > 60 ? 'bg-rose-50 text-rose-600' :
                                item.oldestPendingDays > 30 ? 'bg-amber-50 text-amber-600' :
                                item.oldestPendingDays > 0  ? 'bg-blue-50 text-blue-600' :
                                'bg-gray-50 text-gray-400'
                            }`}>
                                {item.oldestPendingDays || 0} Days
                            </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (reportType === 'customer' && item.customerId) navigate(`/customer-ledger/${item.customerId}`);
                                    else if (reportType === 'vendor' && item.vendorId) navigate(`/vendor-ledger/${item.vendorId}`);
                                }}
                                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 transition-colors"
                            >
                                View →
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );

    const renderCombinedTable = () => {
        if (linkedData.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-[60vh] text-center p-12">
                    <div className="text-5xl mb-4">🔗</div>
                    <h3 className="text-sm font-black text-gray-600 uppercase tracking-widest">No Linked Parties Found</h3>
                    <p className="text-xs text-gray-400 max-w-xs mt-2 mb-6">
                        Link a vendor to a customer account to see their combined Sales + Purchase ledger here.
                    </p>
                    <button
                        onClick={() => navigate('/vendors')}
                        className="px-4 py-2 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 transition-colors"
                    >
                        Go to Vendors → Link Now
                    </button>
                </div>
            );
        }
        return (
            <table className="min-w-full">
                <thead className="bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100">
                    <tr>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-purple-500 uppercase tracking-widest">Party Name</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-purple-500 uppercase tracking-widest">As Customer</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black text-emerald-500 uppercase tracking-widest">Sales Billed</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black text-emerald-500 uppercase tracking-widest">Sales Rcvd</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black text-orange-500 uppercase tracking-widest">Purchase Billed</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black text-orange-500 uppercase tracking-widest">Purchase Paid</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black text-gray-700 uppercase tracking-widest">Net Balance</th>
                        <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Ledger</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {linkedData.map((item, idx) => (
                        <tr
                            key={idx}
                            className="hover:bg-purple-50/40 transition-colors cursor-pointer"
                            onClick={() => navigate(`/combined-ledger/${item.vendorId}`)}
                        >
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                    <span className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 text-xs font-black flex items-center justify-center shrink-0">
                                        {(item.name || '?')[0].toUpperCase()}
                                    </span>
                                    <div>
                                        <p className="text-xs font-bold text-gray-900">{item.name}</p>
                                        <p className="text-[10px] text-gray-400">{item.phone || 'No Contact'}</p>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-bold">
                                    🔗 {item.customerName}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-xs text-emerald-700 font-semibold">{formatCurrency(item.salesDebitTotal)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-xs text-emerald-600">{formatCurrency(item.salesCreditTotal)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-xs text-orange-700 font-semibold">{formatCurrency(item.purchaseCreditTotal)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-xs text-orange-600">{formatCurrency(item.purchaseDebitTotal)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                <div>
                                    <span className={`text-sm font-black ${item.netBalance > 0 ? 'text-emerald-600' : item.netBalance < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                        {formatCurrency(Math.abs(item.netBalance))}
                                    </span>
                                    <span className={`block text-[10px] font-bold mt-0.5 ${item.netBalance > 0 ? 'text-emerald-500' : item.netBalance < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                        {item.netBalance > 0 ? '▲ Party owes you' : item.netBalance < 0 ? '▼ You owe party' : '✔ Settled'}
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <button
                                    onClick={(e) => { e.stopPropagation(); navigate(`/combined-ledger/${item.vendorId}`); }}
                                    className="text-[10px] font-bold text-purple-600 hover:text-purple-800 px-2 py-1.5 rounded bg-purple-50 hover:bg-purple-100 transition-colors whitespace-nowrap"
                                >
                                    🔗 Combined →
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
                {/* Net totals footer */}
                <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-200">
                        <td colSpan={2} className="px-6 py-3 text-xs font-black text-gray-600 uppercase tracking-wider">Totals ({linkedData.length} parties)</td>
                        <td className="px-6 py-3 text-right text-xs font-black text-emerald-700">{formatCurrency(linkedData.reduce((s, i) => s + i.salesDebitTotal, 0))}</td>
                        <td className="px-6 py-3 text-right text-xs font-black text-emerald-600">{formatCurrency(linkedData.reduce((s, i) => s + i.salesCreditTotal, 0))}</td>
                        <td className="px-6 py-3 text-right text-xs font-black text-orange-700">{formatCurrency(linkedData.reduce((s, i) => s + i.purchaseCreditTotal, 0))}</td>
                        <td className="px-6 py-3 text-right text-xs font-black text-orange-600">{formatCurrency(linkedData.reduce((s, i) => s + i.purchaseDebitTotal, 0))}</td>
                        <td className="px-6 py-3 text-right" colSpan={2}>
                            <span className="text-sm font-black text-gray-800">
                                Net: {formatCurrency(Math.abs(linkedData.reduce((s, i) => s + i.netBalance, 0)))}
                            </span>
                        </td>
                    </tr>
                </tfoot>
            </table>
        );
    };

    return (
        <div className="space-y-4 pb-24 lg:pb-8">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-white shadow-sm border border-gray-100 rounded flex items-center justify-center text-lg">📒</div>
                    <div>
                        <h1 className="text-lg font-bold text-gray-800 leading-tight">Financial Ledgers</h1>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Aging & Overall Statements</p>
                    </div>
                </div>
                <button
                    onClick={handleExport}
                    disabled={(reportType === 'combined' ? linkedData.length === 0 : reportData.length === 0)}
                    className="whitespace-nowrap bg-emerald-50 text-emerald-600 border border-emerald-200 px-4 py-2 rounded text-[10px] font-black uppercase tracking-wider hover:bg-emerald-100 transition-all disabled:opacity-50"
                >
                    Export CSV
                </button>
            </div>

            {/* Tabs & Filters */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 flex flex-col md:flex-row gap-2">
                <div className="flex flex-1 gap-2">
                    {navButtons.map(btn => (
                        <button
                            key={btn.id}
                            onClick={() => { setReportType(btn.id); setDaysFilter(0); }}
                            className={`flex-1 px-4 py-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-2 ${
                                reportType === btn.id
                                    ? btn.id === 'combined'
                                        ? 'bg-purple-700 text-white shadow-lg'
                                        : 'bg-gray-900 text-white shadow-lg'
                                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                            }`}
                        >
                            {btn.label}
                        </button>
                    ))}
                </div>

                {reportType !== 'combined' && (
                    <div className="flex items-center space-x-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                        <span className="text-[10px] font-black text-gray-400 uppercase whitespace-nowrap">Min Days Pending:</span>
                        <select
                            value={daysFilter}
                            onChange={(e) => setDaysFilter(Number(e.target.value))}
                            className="bg-transparent text-xs font-bold text-gray-700 outline-none cursor-pointer"
                        >
                            <option value={0}>All Records</option>
                            <option value={15}>15+ Days</option>
                            <option value={30}>30+ Days</option>
                            <option value={60}>60+ Days</option>
                            <option value={90}>90+ Days</option>
                        </select>
                    </div>
                )}
            </div>

            {/* Combined mode info banner */}
            {reportType === 'combined' && (
                <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-xl px-5 py-3">
                    <span className="text-2xl">🔗</span>
                    <div>
                        <p className="text-sm font-bold text-purple-800">Combined Accounts — Linked Parties (Vendor + Customer)</p>
                        <p className="text-xs text-purple-600">
                            Shows vendors who are also customers. Net Balance = Sales receivable minus Purchase payable. 
                            Click any row to open the combined ledger statement.
                        </p>
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[60vh]">
                {loading ? (
                    <div className="flex items-center justify-center h-[60vh]">
                        <div className="flex flex-col items-center space-y-4">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Fetching Ledgers...</p>
                        </div>
                    </div>
                ) : reportType === 'combined' ? (
                    <div className="overflow-x-auto">
                        {renderCombinedTable()}
                    </div>
                ) : filteredData.length > 0 ? (
                    <div className="overflow-x-auto">
                        {renderStandardTable()}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-[60vh] text-center p-12">
                        <div className="text-5xl mb-4 grayscale opacity-20">🕳️</div>
                        <h3 className="text-sm font-black text-gray-600 uppercase tracking-widest">No Matches Found</h3>
                        <p className="text-xs text-gray-400 max-w-xs mt-2">Try adjusting your filters or checking a different category.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LedgerReports;
