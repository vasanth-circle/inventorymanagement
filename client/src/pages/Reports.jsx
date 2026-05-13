import { useState, useContext } from 'react';
import { InventoryContext } from '../context/InventoryContext';
import { formatCurrency, formatDateTime, exportToCSV } from '../utils/helpers';
import toast from 'react-hot-toast';

const Reports = () => {
    const { fetchTransactions, fetchSalesOrders } = useContext(InventoryContext);
    const [reportType, setReportType] = useState('transactions');
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        type: '',
    });
    const [reportData, setReportData] = useState([]);
    const [aggregatedData, setAggregatedData] = useState([]);
    const [loading, setLoading] = useState(false);

    const handleGenerateReport = async () => {
        setLoading(true);
        try {
            if (reportType === 'transactions') {
                const data = await fetchTransactions(filters);
                if (data) {
                    setReportData(data.transactions);
                    setAggregatedData([]);
                    toast.success('Transaction report generated');
                }
            } else {
                const data = await fetchSalesOrders({
                    ...filters,
                    limit: 1000 // Get more for aggregation
                });
                if (data && data.orders) {
                    setReportData(data.orders);
                    
                    // Aggregate by user
                    const userMap = {};
                    data.orders.forEach(order => {
                        const userName = order.user?.name || 'Unknown';
                        if (!userMap[userName]) {
                            userMap[userName] = { name: userName, totalAmount: 0, orderCount: 0 };
                        }
                        userMap[userName].totalAmount += (order.totalAmount || 0);
                        userMap[userName].orderCount += 1;
                    });
                    
                    setAggregatedData(Object.values(userMap).sort((a, b) => b.totalAmount - a.totalAmount));
                    toast.success('Sales by Person report generated');
                }
            }
        } catch (error) {
            toast.error('Failed to generate report');
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        if (reportData.length === 0) {
            toast.error('No data to export');
            return;
        }

        let exportData = [];
        if (reportType === 'transactions') {
            exportData = reportData.map(transaction => ({
                Date: formatDateTime(transaction.createdAt),
                Item: transaction.item?.name || 'N/A',
                Type: transaction.type,
                Quantity: transaction.quantity,
                Reason: transaction.reason || 'N/A',
                User: transaction.user?.name || 'N/A',
            }));
        } else {
            exportData = aggregatedData.map(user => ({
                'Sales Person': user.name,
                'Total Bill Count': user.orderCount,
                'Total Sales Amount': formatCurrency(user.totalAmount)
            }));
        }

        exportToCSV(exportData, `report-${reportType}-${new Date().toISOString().split('T')[0]}`);
        toast.success(`${reportType} report exported`);
    };

    return (
        <div className="space-y-6 pb-24 lg:pb-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pb-4 border-b border-gray-100">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-white shadow-sm border border-gray-100 rounded-lg flex items-center justify-center text-xl">📊</div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-800 leading-tight">Intelligence & Analytics</h1>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Performance & Flow Tracking</p>
                    </div>
                </div>
                <button
                    onClick={handleExport}
                    disabled={reportData.length === 0}
                    className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg disabled:opacity-50 flex items-center justify-center"
                >
                    Export CSV
                </button>
            </div>

            {/* Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Controls */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 space-y-4">
                        <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Report Type</h2>
                        <div className="space-y-2">
                            <button
                                onClick={() => { setReportType('transactions'); setReportData([]); setAggregatedData([]); }}
                                className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm transition-all ${reportType === 'transactions' ? 'bg-primary-600 text-white shadow-lg shadow-primary-100' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                            >
                                📦 Inventory Flow
                            </button>
                            <button
                                onClick={() => { setReportType('sales'); setReportData([]); setAggregatedData([]); }}
                                className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm transition-all ${reportType === 'sales' ? 'bg-primary-600 text-white shadow-lg shadow-primary-100' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                            >
                                👤 Sales by User
                            </button>
                        </div>

                        <div className="pt-4 space-y-4 border-t border-gray-50">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 px-1">Start Date</label>
                                <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-primary-500" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 px-1">End Date</label>
                                <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-primary-500" />
                            </div>
                            <button onClick={handleGenerateReport} disabled={loading} className="w-full py-3 bg-gray-900 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-black transition-all shadow-xl shadow-gray-200 disabled:opacity-50">
                                {loading ? 'Processing...' : 'Generate Analysis'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Results Section */}
                <div className="lg:col-span-3">
                    {reportData.length > 0 ? (
                        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                                <h2 className="text-sm font-black text-gray-800 uppercase tracking-wider">
                                    {reportType === 'transactions' ? 'Inventory Transaction Ledger' : 'Sales Representative Performance'}
                                </h2>
                                <span className="text-[10px] font-bold bg-white px-2 py-1 rounded-full text-gray-500 border border-gray-200 italic">
                                    {reportData.length} records found
                                </span>
                            </div>

                            {reportType === 'transactions' ? (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full">
                                        <thead className="bg-white border-b border-gray-100">
                                            <tr>
                                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Item</th>
                                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Action</th>
                                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Qty</th>
                                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">User</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50 font-medium">
                                            {reportData.map((transaction) => (
                                                <tr key={transaction._id} className="hover:bg-gray-50/50">
                                                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-900">{formatDateTime(transaction.createdAt)}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-gray-900">{transaction.item?.name || 'N/A'}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`px-2 py-1 text-[9px] font-black uppercase rounded-lg ${transaction.type === 'inward' ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'}`}>
                                                            {transaction.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-xs font-black text-gray-900">{transaction.quantity}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 italic">{transaction.user?.name || 'System'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {aggregatedData.map((user, idx) => (
                                            <div key={idx} className="bg-gray-50/50 border border-gray-100 p-6 rounded-2xl space-y-3 relative overflow-hidden group hover:border-primary-200 transition-all">
                                                <div className="absolute top-0 right-0 w-16 h-16 bg-primary-600/5 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-150"></div>
                                                <div className="flex justify-between items-start relative">
                                                    <div>
                                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Representative</p>
                                                        <p className="text-xl font-black text-gray-800">{user.name}</p>
                                                    </div>
                                                    <span className="text-2xl">🎖️</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 relative">
                                                    <div>
                                                        <p className="text-[9px] font-black text-gray-400 uppercase">Bills Generated</p>
                                                        <p className="text-lg font-bold text-gray-700">{user.orderCount}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-gray-400 uppercase">Total Billed</p>
                                                        <p className="text-lg font-black text-emerald-600">{formatCurrency(user.totalAmount)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-full bg-white rounded-2xl border-2 border-dashed border-gray-100 flex flex-col items-center justify-center p-12 text-center">
                            <div className="text-6xl mb-6 grayscale opacity-20">📊</div>
                            <h3 className="text-lg font-black text-gray-800 uppercase tracking-widest">No Intelligence Generated</h3>
                            <p className="text-sm text-gray-400 max-w-xs mt-2">Select your filters and report type to generate a performance analysis.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Reports;
