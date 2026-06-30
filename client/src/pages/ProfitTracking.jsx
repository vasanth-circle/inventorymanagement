import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const formatCurrency = (num) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2
    }).format(num || 0);
};

const ProfitTracking = () => {
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState(null);
    const [activeTab, setActiveTab] = useState('bill'); // bill, day, item
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: ''
    });

    const fetchProfitData = async () => {
        setLoading(true);
        try {
            const params = {};
            if (filters.startDate) params.from = filters.startDate;
            if (filters.endDate) params.to = filters.endDate;
            
            const response = await api.get('/profit', { params });
            if (response.data && response.data.data) {
                setReportData(response.data.data);
                toast.success('Profit analysis generated successfully');
            }
        } catch (error) {
            console.error('Failed to fetch profit data:', error);
            toast.error('Failed to fetch profit data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Optional: Fetch automatically on mount or wait for user to click Generate
    }, []);

    const setQuickDate = (type) => {
        const today = new Date();
        let start = new Date();
        let end = new Date();
        if (type === 'this_week') {
            const firstDay = today.getDate() - today.getDay();
            start = new Date(today.setDate(firstDay));
            end = new Date();
        } else if (type === 'this_month') {
            start = new Date(today.getFullYear(), today.getMonth(), 1);
            end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        } else if (type === 'last_month') {
            start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            end = new Date(today.getFullYear(), today.getMonth(), 0);
        } else if (type === 'this_year') {
            start = new Date(today.getFullYear(), 0, 1);
            end = new Date(today.getFullYear(), 11, 31);
        }
        
        const formatDate = (date) => {
            const d = new Date(date);
            let month = '' + (d.getMonth() + 1);
            let day = '' + d.getDate();
            const year = d.getFullYear();
            if (month.length < 2) month = '0' + month;
            if (day.length < 2) day = '0' + day;
            return [year, month, day].join('-');
        };
        setFilters({ startDate: formatDate(start), endDate: formatDate(end) });
    };

    const handleExport = () => {
        if (!reportData) return;

        let exportData = [];
        let filename = 'profit_report.csv';

        if (activeTab === 'bill') {
            filename = 'bill_wise_profit.csv';
            exportData = reportData.billWise.map(b => ({
                'Date': new Date(b.date).toLocaleDateString(),
                'Order No': b.orderNumber,
                'Customer': b.customer,
                'Sales Rep': b.user,
                'Revenue': b.revenue,
                'COGS': b.cogs,
                'Profit': b.profit,
                'Margin %': b.margin
            }));
        } else if (activeTab === 'day') {
            filename = 'day_wise_profit.csv';
            exportData = reportData.dayWise.map(d => ({
                'Date': d.date,
                'Revenue': d.revenue,
                'COGS': d.cogs,
                'Profit': d.profit
            }));
        } else if (activeTab === 'item') {
            filename = 'item_wise_profit.csv';
            exportData = reportData.itemWise.map(i => ({
                'Item Name': i.name,
                'Quantity Sold': i.qtySold,
                'Revenue': i.revenue,
                'COGS': i.cogs,
                'Profit': i.profit
            }));
        } else if (activeTab === 'employee') {
            filename = 'employee_wise_profit.csv';
            exportData = reportData.salesRepWise.map(e => ({
                'Employee': e.salesRep,
                'Revenue': e.revenue,
                'COGS': e.cogs,
                'Profit': e.profit
            }));
        }

        if (exportData.length === 0) {
            toast.error('No data to export');
            return;
        }

        const headers = Object.keys(exportData[0]).join(',') + '\n';
        const rows = exportData.map(obj => Object.values(obj).join(',')).join('\n');
        const csvContent = headers + rows;
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const navTabs = [
        { id: 'bill', label: '📄 Bill-wise Profit' },
        { id: 'day', label: '📅 Day-wise Profit' },
        { id: 'item', label: '📦 Item-wise Profit' },
        { id: 'employee', label: '👤 Employee-wise Profit' },
        { id: 'month', label: '📈 Month-on-Month Analysis' }
    ];

    return (
        <div className="space-y-4 pb-24 lg:pb-8">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-white shadow-sm border border-gray-100 rounded flex items-center justify-center text-lg">💰</div>
                    <div>
                        <h1 className="text-lg font-bold text-gray-800 leading-tight">Profit Tracking</h1>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Revenue vs COGS Analysis</p>
                    </div>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="flex flex-col gap-2 w-full md:w-auto">
                    <div className="flex gap-2">
                        <button onClick={() => setQuickDate('this_week')} className="text-[10px] font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition-colors">This Week</button>
                        <button onClick={() => setQuickDate('this_month')} className="text-[10px] font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition-colors">This Month</button>
                        <button onClick={() => setQuickDate('last_month')} className="text-[10px] font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition-colors">Last Month</button>
                        <button onClick={() => setQuickDate('this_year')} className="text-[10px] font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition-colors">This Year</button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-1 rounded">Date Range</span>
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
                            <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="text-xs bg-transparent font-bold text-gray-700 outline-none" />
                            <span className="text-[10px] text-gray-300 font-black uppercase mx-1">TO</span>
                            <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="text-xs bg-transparent font-bold text-gray-700 outline-none" />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    <button onClick={fetchProfitData} disabled={loading} className="whitespace-nowrap bg-primary-600 text-white px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-primary-700 transition-all disabled:opacity-50 shadow-sm">
                        {loading ? 'Processing...' : 'Generate Profit Report'}
                    </button>
                    
                    <button onClick={handleExport} disabled={!reportData} className="whitespace-nowrap bg-emerald-50 text-emerald-600 border border-emerald-200 px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-emerald-100 transition-all disabled:opacity-50 disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-200 shadow-sm">
                        Export CSV
                    </button>
                </div>
            </div>

            {reportData ? (
                <div className="space-y-4">
                    {/* Summary KPI Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 relative overflow-hidden group">
                            <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-50 rounded-full group-hover:scale-150 transition-transform"></div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest relative z-10">Total Revenue</p>
                            <p className="text-xl font-black text-gray-800 mt-1 relative z-10">{formatCurrency(reportData.summary.totalRevenue)}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 relative overflow-hidden group">
                            <div className="absolute -right-4 -top-4 w-16 h-16 bg-orange-50 rounded-full group-hover:scale-150 transition-transform"></div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest relative z-10">Total COGS</p>
                            <p className="text-xl font-black text-orange-600 mt-1 relative z-10">{formatCurrency(reportData.summary.totalCogs)}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-emerald-200 relative overflow-hidden group">
                            <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-50 rounded-full group-hover:scale-150 transition-transform"></div>
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest relative z-10">Net Profit</p>
                            <p className="text-xl font-black text-emerald-700 mt-1 relative z-10">{formatCurrency(reportData.summary.totalProfit)}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-purple-200 relative overflow-hidden group">
                            <div className="absolute -right-4 -top-4 w-16 h-16 bg-purple-50 rounded-full group-hover:scale-150 transition-transform"></div>
                            <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest relative z-10">Avg Margin</p>
                            <p className="text-xl font-black text-purple-700 mt-1 relative z-10">{reportData.summary.marginPercent}%</p>
                        </div>
                    </div>

                    {/* Report Selection Tabs */}
                    <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
                        <div className="flex space-x-2 min-w-max">
                            {navTabs.map(btn => (
                                <button
                                    key={btn.id}
                                    onClick={() => setActiveTab(btn.id)}
                                    className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-lg transition-all ${activeTab === btn.id ? 'bg-primary-50 text-primary-700 shadow-sm ring-1 ring-primary-200' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}
                                >
                                    {btn.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Data Tables */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            {activeTab === 'bill' && (
                                <table className="min-w-full">
                                    <thead className="bg-gray-50 border-b border-gray-100">
                                        <tr>
                                            <th className="px-3 py-2 sm:px-4 sm:py-3 text-left text-[9px] sm:text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Date</th>
                                            <th className="px-3 py-2 sm:px-4 sm:py-3 text-left text-[9px] sm:text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Order #</th>
                                            <th className="px-3 py-2 sm:px-4 sm:py-3 text-left text-[9px] sm:text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Customer</th>
                                            <th className="px-3 py-2 sm:px-4 sm:py-3 text-left text-[9px] sm:text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Sales Rep</th>
                                            <th className="px-3 py-2 sm:px-4 sm:py-3 text-right text-[9px] sm:text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Revenue</th>
                                            <th className="px-3 py-2 sm:px-4 sm:py-3 text-right text-[9px] sm:text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">COGS</th>
                                            <th className="px-3 py-2 sm:px-4 sm:py-3 text-right text-[9px] sm:text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Profit</th>
                                            <th className="px-3 py-2 sm:px-4 sm:py-3 text-right text-[9px] sm:text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Margin</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {reportData.billWise.map((b, i) => (
                                            <tr key={i} className="hover:bg-gray-50/50">
                                                <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-[11px] sm:text-xs text-gray-700">{new Date(b.date).toLocaleDateString()}</td>
                                                <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-[11px] sm:text-xs font-bold text-gray-900">{b.orderNumber}</td>
                                                <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-[11px] sm:text-xs text-gray-700">{b.customer}</td>
                                                <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-[11px] sm:text-xs text-gray-500 font-medium">{b.user}</td>
                                                <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-[11px] sm:text-xs text-right text-gray-900 font-bold">{formatCurrency(b.revenue)}</td>
                                                <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-[11px] sm:text-xs text-right text-orange-600 font-medium">{formatCurrency(b.cogs)}</td>
                                                <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-[11px] sm:text-xs text-right text-emerald-600 font-black">{formatCurrency(b.profit)}</td>
                                                <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-[11px] sm:text-xs text-right text-purple-600 font-bold">{b.margin}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            {activeTab === 'day' && (
                                <table className="min-w-full">
                                    <thead className="bg-gray-50 border-b border-gray-100">
                                        <tr>
                                            <th className="px-3 py-2 sm:px-4 sm:py-3 text-left text-[9px] sm:text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Date</th>
                                            <th className="px-3 py-2 sm:px-4 sm:py-3 text-right text-[9px] sm:text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Revenue</th>
                                            <th className="px-3 py-2 sm:px-4 sm:py-3 text-right text-[9px] sm:text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">COGS</th>
                                            <th className="px-3 py-2 sm:px-4 sm:py-3 text-right text-[9px] sm:text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Net Profit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {reportData.dayWise.map((d, i) => (
                                            <tr key={i} className="hover:bg-gray-50/50">
                                                <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-[11px] sm:text-xs font-bold text-gray-900">{d.date}</td>
                                                <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-[11px] sm:text-xs text-right text-gray-900 font-bold">{formatCurrency(d.revenue)}</td>
                                                <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-[11px] sm:text-xs text-right text-orange-600 font-medium">{formatCurrency(d.cogs)}</td>
                                                <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-[11px] sm:text-xs text-right text-emerald-600 font-black">{formatCurrency(d.profit)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            {activeTab === 'item' && (
                                <table className="min-w-full">
                                    <thead className="bg-gray-50 border-b border-gray-100">
                                        <tr>
                                            <th className="px-3 py-2 sm:px-4 sm:py-3 text-left text-[9px] sm:text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Item Name</th>
                                            <th className="px-3 py-2 sm:px-4 sm:py-3 text-right text-[9px] sm:text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Qty Sold</th>
                                            <th className="px-3 py-2 sm:px-4 sm:py-3 text-right text-[9px] sm:text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Revenue</th>
                                            <th className="px-3 py-2 sm:px-4 sm:py-3 text-right text-[9px] sm:text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">COGS</th>
                                            <th className="px-3 py-2 sm:px-4 sm:py-3 text-right text-[9px] sm:text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Net Profit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {reportData.itemWise.map((item, i) => (
                                            <tr key={i} className="hover:bg-gray-50/50">
                                                <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-[11px] sm:text-xs font-bold text-gray-900">{item.name}</td>
                                                <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-[11px] sm:text-xs text-right text-blue-600 font-bold">{item.qtySold}</td>
                                                <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-[11px] sm:text-xs text-right text-gray-900 font-bold">{formatCurrency(item.revenue)}</td>
                                                <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-[11px] sm:text-xs text-right text-orange-600 font-medium">{formatCurrency(item.cogs)}</td>
                                                <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-[11px] sm:text-xs text-right text-emerald-600 font-black">{formatCurrency(item.profit)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                            
                            {activeTab === 'employee' && (
                                <table className="min-w-full">
                                    <thead className="bg-gray-50 border-b border-gray-100">
                                        <tr>
                                            <th className="px-3 py-2 sm:px-4 sm:py-3 text-left text-[9px] sm:text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Employee Name</th>
                                            <th className="px-3 py-2 sm:px-4 sm:py-3 text-right text-[9px] sm:text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Revenue</th>
                                            <th className="px-3 py-2 sm:px-4 sm:py-3 text-right text-[9px] sm:text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">COGS</th>
                                            <th className="px-3 py-2 sm:px-4 sm:py-3 text-right text-[9px] sm:text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Net Profit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {reportData.salesRepWise.map((emp, i) => (
                                            <tr key={i} className="hover:bg-gray-50/50">
                                                <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-[11px] sm:text-xs font-bold text-gray-900 flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-black">
                                                        {emp.salesRep.charAt(0).toUpperCase()}
                                                    </div>
                                                    {emp.salesRep}
                                                </td>
                                                <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-[11px] sm:text-xs text-right text-gray-900 font-bold">{formatCurrency(emp.revenue)}</td>
                                                <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-[11px] sm:text-xs text-right text-orange-600 font-medium">{formatCurrency(emp.cogs)}</td>
                                                <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-[11px] sm:text-xs text-right text-emerald-600 font-black">{formatCurrency(emp.profit)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            {activeTab === 'month' && (
                                <div className="p-4 h-[400px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={reportData.monthWise} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(val) => `₹${(val/1000).toFixed(0)}k`} />
                                            <Tooltip 
                                                cursor={{ fill: '#F3F4F6' }}
                                                contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                                formatter={(value) => formatCurrency(value)}
                                            />
                                            <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                                            <Bar dataKey="revenue" name="Revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                            <Bar dataKey="cogs" name="COGS" fill="#F97316" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                            <Bar dataKey="profit" name="Net Profit" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-lg border border-dashed border-gray-300 flex flex-col items-center justify-center p-12 text-center h-[50vh]">
                    <div className="text-4xl mb-4 grayscale opacity-20">💰</div>
                    <h3 className="text-sm font-black text-gray-600 uppercase tracking-widest">No Data Generated</h3>
                    <p className="text-xs text-gray-400 max-w-xs mt-2">Select a date range and click generate to view your profit analysis.</p>
                </div>
            )}
        </div>
    );
};

export default ProfitTracking;
