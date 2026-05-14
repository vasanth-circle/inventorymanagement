import { useState, useContext } from 'react';
import { InventoryContext } from '../context/InventoryContext';
import { formatCurrency, formatDateTime, exportToCSV } from '../utils/helpers';
import toast from 'react-hot-toast';

const Reports = () => {
    const { fetchTransactions, fetchSalesOrders, fetchItems } = useContext(InventoryContext);
    const [reportType, setReportType] = useState('stock');
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
    });
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(false);

    const handleGenerateReport = async () => {
        setLoading(true);
        try {
            if (reportType === 'stock') {
                const data = await fetchItems({ limit: 5000 });
                if (data && data.items) {
                    setReportData(data.items);
                    toast.success('Current Stock report generated');
                }
            } else if (reportType === 'inward') {
                const data = await fetchTransactions({ ...filters, type: 'inward', limit: 5000 });
                if (data && data.transactions) {
                    setReportData(data.transactions);
                    toast.success('Inward Flow report generated');
                }
            } else if (reportType === 'sales') {
                const data = await fetchSalesOrders({ ...filters, limit: 5000 });
                if (data && data.orders) {
                    setReportData(data.orders);
                    toast.success('Sales report generated');
                }
            } else if (reportType === 'performance') {
                const data = await fetchSalesOrders({ ...filters, limit: 5000 });
                if (data && data.orders) {
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
                    setReportData(Object.values(userMap).sort((a, b) => b.totalAmount - a.totalAmount));
                    toast.success('Sales Performance report generated');
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
        if (reportType === 'stock') {
            exportData = reportData.map(item => ({
                'Item Name': item.name,
                'Category': item.category?.name || 'N/A',
                'Stock Quantity': item.quantity,
                'Total SqFt': item.totalSqFt || 0,
                'Purchase Price': formatCurrency(item.purchasePrice || 0),
                'Selling Price': formatCurrency(item.price || 0),
                'Total Value (Purchase)': formatCurrency((item.quantity || 0) * (item.purchasePrice || 0))
            }));
        } else if (reportType === 'inward') {
            exportData = reportData.map(transaction => ({
                'Date': formatDateTime(transaction.createdAt),
                'Item': transaction.item?.name || 'N/A',
                'Quantity': transaction.quantity,
                'Reason / Supplier': transaction.reason || 'N/A',
                'Received By': transaction.user?.name || 'N/A',
            }));
        } else if (reportType === 'sales') {
            exportData = reportData.map(order => ({
                'Date': formatDateTime(order.orderDate),
                'Order No': order.orderNumber,
                'Customer': order.customer?.companyName || order.customer?.name || 'N/A',
                'Net Amount': formatCurrency(order.totalAmount),
                'Status': order.status,
                'Sales Rep': order.user?.name || 'System'
            }));
        } else if (reportType === 'performance') {
            exportData = reportData.map(user => ({
                'Sales Person': user.name,
                'Total Bills Created': user.orderCount,
                'Total Sales Amount': formatCurrency(user.totalAmount)
            }));
        }

        exportToCSV(exportData, `report-${reportType}-${new Date().toISOString().split('T')[0]}`);
        toast.success(`${reportType} report exported`);
    };

    const renderTable = () => {
        if (reportType === 'stock') {
            return (
                <table className="min-w-full">
                    <thead className="bg-white border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Item</th>
                            <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Qty</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Value</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 font-medium">
                        {reportData.map((item) => (
                            <tr key={item._id} className="hover:bg-gray-50/50">
                                <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-gray-900">{item.name}<br/><span className="text-[10px] font-normal text-gray-400">{item.category?.name || 'N/A'}</span></td>
                                <td className="px-6 py-4 whitespace-nowrap text-center text-xs font-black text-gray-900">{item.quantity} <span className="text-[9px] font-bold text-gray-400">{item.unit || ''}</span></td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-xs text-gray-900 font-bold">{formatCurrency((item.quantity || 0) * (item.purchasePrice || item.price || 0))}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
        } else if (reportType === 'inward') {
            return (
                <table className="min-w-full">
                    <thead className="bg-white border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Item</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Qty</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Supplier/Reason</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 font-medium">
                        {reportData.map((t) => (
                            <tr key={t._id} className="hover:bg-gray-50/50">
                                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-900">{formatDateTime(t.createdAt)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-gray-900">{t.item?.name || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-xs font-black text-green-600">+{t.quantity}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600">{t.reason || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
        } else if (reportType === 'sales') {
            return (
                <table className="min-w-full">
                    <thead className="bg-white border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Order #</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Customer</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Net Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 font-medium">
                        {reportData.map((order) => (
                            <tr key={order._id} className="hover:bg-gray-50/50">
                                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-900">{new Date(order.orderDate).toLocaleDateString()}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-primary-600">{order.orderNumber}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-800">{order.customer?.companyName || order.customer?.name || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-xs font-black text-gray-900 text-right">{formatCurrency(order.totalAmount)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
        } else if (reportType === 'performance') {
            return (
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {reportData.map((user, idx) => (
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
            );
        }
    };

    const navButtons = [
        { id: 'stock', label: '📦 Current Stock' },
        { id: 'inward', label: '📥 Inward / Purchases' },
        { id: 'sales', label: '📤 Outward / Sales' },
        { id: 'performance', label: '👤 Sales by User' },
    ];

    return (
        <div className="space-y-4 pb-24 lg:pb-8">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-white shadow-sm border border-gray-100 rounded flex items-center justify-center text-lg">📊</div>
                    <div>
                        <h1 className="text-lg font-bold text-gray-800 leading-tight">Intelligence & Analytics</h1>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Comprehensive Business Reports</p>
                    </div>
                </div>
            </div>

            {/* Compact Top Filter Bar */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex flex-col xl:flex-row gap-4 justify-between items-center">
                {/* Tabs */}
                <div className="flex bg-gray-100 p-1 rounded-md w-full xl:w-auto overflow-x-auto">
                    {navButtons.map(btn => (
                        <button
                            key={btn.id}
                            onClick={() => { setReportType(btn.id); setReportData([]); }}
                            className={`flex-1 whitespace-nowrap px-4 py-2 text-xs font-bold rounded transition-all ${reportType === btn.id ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            {btn.label}
                        </button>
                    ))}
                </div>

                {/* Filters & Actions */}
                <div className="flex items-center gap-2 w-full xl:w-auto overflow-x-auto">
                    {reportType !== 'stock' && (
                        <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-md border border-gray-100">
                            <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="text-[11px] bg-transparent font-medium text-gray-700 outline-none px-2 py-1" />
                            <span className="text-[10px] text-gray-400 font-bold uppercase">TO</span>
                            <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="text-[11px] bg-transparent font-medium text-gray-700 outline-none px-2 py-1" />
                        </div>
                    )}
                    <button onClick={handleGenerateReport} disabled={loading} className="whitespace-nowrap bg-gray-900 text-white px-4 py-2 rounded text-[10px] font-black uppercase tracking-wider hover:bg-black transition-all disabled:opacity-50">
                        {loading ? 'Processing...' : 'Generate Analysis'}
                    </button>
                    <button onClick={handleExport} disabled={reportData.length === 0} className="whitespace-nowrap bg-emerald-50 text-emerald-600 border border-emerald-200 px-4 py-2 rounded text-[10px] font-black uppercase tracking-wider hover:bg-emerald-100 transition-all disabled:opacity-50 disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-200">
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Results Area */}
            <div>
                {reportData.length > 0 ? (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                            <h2 className="text-xs font-black text-gray-700 uppercase tracking-wider">
                                {navButtons.find(b => b.id === reportType)?.label} Data
                            </h2>
                            <span className="text-[10px] font-bold bg-white px-2 py-1 rounded text-gray-500 border border-gray-200">
                                {reportData.length} records found
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            {renderTable()}
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-lg border border-dashed border-gray-300 flex flex-col items-center justify-center p-12 text-center h-[50vh]">
                        <div className="text-4xl mb-4 grayscale opacity-20">📊</div>
                        <h3 className="text-sm font-black text-gray-600 uppercase tracking-widest">No Intelligence Generated</h3>
                        <p className="text-xs text-gray-400 max-w-xs mt-2">Select your report type and click generate to view data.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Reports;
