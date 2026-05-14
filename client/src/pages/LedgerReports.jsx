import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { formatCurrency, exportToCSV } from '../utils/helpers';
import toast from 'react-hot-toast';

const LedgerReports = () => {
    const [reportType, setReportType] = useState('customer');
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [daysFilter, setDaysFilter] = useState(0);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const endpoint = reportType === 'customer' 
                ? '/customers/statements/overall' 
                : '/vendor-ledger/statements/overall';
            const response = await api.get(endpoint);
            if (response.data && response.data.success) {
                setReportData(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching ledger reports:', error);
            if (error.response) {
                console.error('Error Response:', error.response.status, error.response.data);
            }
            toast.error('Failed to load ledger data');
        } finally {
            setLoading(false);
        }
    }, [reportType]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleExport = () => {
        if (reportData.length === 0) {
            toast.error('No data to export');
            return;
        }

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
    };

    const filteredData = reportData.filter(item => (item.oldestPendingDays || 0) >= daysFilter);

    const renderTable = () => {
        return (
            <table className="min-w-full">
                <thead className="bg-white border-b border-gray-100">
                    <tr>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Name / Contact</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Billed</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Paid</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Balance</th>
                        <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Days Pending</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-medium">
                    {filteredData.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
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
                                    item.oldestPendingDays > 0 ? 'bg-blue-50 text-blue-600' :
                                    'bg-gray-50 text-gray-400'
                                }`}>
                                    {item.oldestPendingDays || 0} Days
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    const navButtons = [
        { id: 'customer', label: '👥 Customer Aging / Overall' },
        { id: 'vendor', label: '🏢 Vendor Aging / Overall' },
    ];

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
                    disabled={reportData.length === 0} 
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
                                reportType === btn.id ? 'bg-gray-900 text-white shadow-lg' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                            }`}
                        >
                            {btn.label}
                        </button>
                    ))}
                </div>
                
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
            </div>

            {/* Content */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[60vh]">
                {loading ? (
                    <div className="flex items-center justify-center h-[60vh]">
                        <div className="flex flex-col items-center space-y-4">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Fetching Ledgers...</p>
                        </div>
                    </div>
                ) : filteredData.length > 0 ? (
                    <div className="overflow-x-auto">
                        {renderTable()}
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
