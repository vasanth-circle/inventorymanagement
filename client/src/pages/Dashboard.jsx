import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { formatCurrency } from '../utils/helpers';
import { AuthContext } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, 
    BarChart, Bar, Cell 
} from 'recharts';

import { InventoryContext } from '../context/InventoryContext';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
    const { user } = useContext(AuthContext);
    const { billingSettings, loading: settingsLoading } = useContext(InventoryContext);
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [lowStockItems, setLowStockItems] = useState([]);
    const [trendData, setTrendData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Redirect to onboarding if industry is not set or still generic
        if (!settingsLoading && billingSettings && (!billingSettings.industry || billingSettings.industry === 'generic')) {
            navigate('/onboarding');
        }
    }, [billingSettings, settingsLoading, navigate]);

    const isFinancialAdmin = ['super_admin', 'admin', 'tenant_owner', 'tenant_admin', 'manager', 'accounts'].includes(user?.role);
    const isAdmin = ['super_admin', 'admin', 'tenant_owner', 'tenant_admin', 'manager'].includes(user?.role);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const [statsRes, lowStockRes, trendRes] = await Promise.all([
                api.get('/dashboard/stats'),
                api.get('/dashboard/low-stock'),
                api.get('/dashboard/stock-trend'),
            ]);
            setStats(statsRes.data);
            setLowStockItems(lowStockRes.data);
            
            // Process trend data for Recharts
            const processedTrend = processTrendData(trendRes.data);
            setTrendData(processedTrend);
        } catch (error) {
            toast.error('Failed to fetch dashboard data');
        } finally {
            setLoading(false);
        }
    };

    const processTrendData = (data) => {
        const dateMap = {};
        data.forEach(item => {
            const date = item._id.date;
            if (!dateMap[date]) {
                dateMap[date] = { date, inward: 0, outward: 0 };
            }
            dateMap[date][item._id.type] = item.total;
        });
        return Object.values(dateMap).sort((a, b) => new Date(a.date) - new Date(b.date));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[80vh]">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-rose-600"></div>
            </div>
        );
    }

    return (
        <div className="p-2 sm:p-4 space-y-4 max-w-[1600px] mx-auto pb-24 lg:pb-8">
            {/* Header Section */}
            <div className="flex justify-between items-end pb-3 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-white shadow-sm border border-gray-200 rounded-lg flex items-center justify-center text-xl overflow-hidden">
                        {billingSettings?.branding?.logoUrl ? (
                            <img 
                                src={billingSettings.branding.logoUrl} 
                                alt="Logo" 
                                className="w-full h-full object-contain"
                            />
                        ) : (
                            '🏠'
                        )}
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 leading-tight">Dashboard</h1>
                        <p className="text-xs text-gray-500 font-medium tracking-wide uppercase">{stats?.companyName || 'Inventory Management'}</p>
                    </div>
                </div>
                <button onClick={fetchDashboardData} className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all text-xs font-bold uppercase tracking-widest shadow-sm flex items-center gap-2">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Refresh
                </button>
            </div>

            <div className="grid grid-cols-12 gap-4">
                {/* Top Metrics Row */}
                <div className="col-span-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                    {isFinancialAdmin && (
                        <div className="bg-slate-900 rounded-xl text-white shadow-md p-4 sm:p-5 flex flex-col justify-center relative overflow-hidden group">
                            <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-all"></div>
                            <div className="flex justify-between items-center mb-2 opacity-80 relative z-10">
                                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest">Stock Value</span>
                                <span className="text-sm">💎</span>
                            </div>
                            <div className="text-lg sm:text-2xl font-black tracking-tight relative z-10 truncate">
                                {formatCurrency(stats?.stockValue || 0)}
                            </div>
                        </div>
                    )}
                    {[
                        { key: 'packed', label: 'To Pack', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', icon: '📦' },
                        { key: 'shipped', label: 'To Ship', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', icon: '🚚' },
                        { key: 'delivered', label: 'To Deliver', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', icon: '🏠' },
                        { key: 'invoiced', label: 'To Invoice', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', icon: '📄' }
                    ].map((activity) => (
                        <div key={activity.key} className={`rounded-xl border ${activity.border} bg-white shadow-sm p-4 sm:p-5 flex flex-col justify-center hover:shadow-md transition-all relative overflow-hidden group`}>
                            <div className={`absolute -right-6 -bottom-6 w-20 h-20 ${activity.bg} rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500`}></div>
                            <div className="flex justify-between items-center mb-2 relative z-10">
                                <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest">{activity.label}</span>
                                <span className="opacity-70 text-sm grayscale group-hover:grayscale-0 transition-all">{activity.icon}</span>
                            </div>
                            <div className={`text-xl sm:text-3xl font-black relative z-10 ${activity.color}`}>
                                {stats?.salesActivity?.[activity.key] || 0}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Main Content Area */}
                <div className="col-span-12 lg:col-span-8 space-y-4">
                    {/* Stock Movement Trend */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-widest flex items-center gap-2">
                                <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
                                Stock Trend (30 Days)
                            </h3>
                            <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-1.5">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm"></div>
                                    <span className="text-[10px] font-bold text-gray-500 uppercase">Inward</span>
                                </div>
                                <div className="flex items-center space-x-1.5">
                                    <div className="w-2 h-2 rounded-full bg-rose-500 shadow-sm"></div>
                                    <span className="text-[10px] font-bold text-gray-500 uppercase">Outward</span>
                                </div>
                            </div>
                        </div>
                        <div className="h-[180px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis 
                                        dataKey="date" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{fontSize: 10, fill: '#64748b', fontWeight: 600}}
                                        tickFormatter={(str) => new Date(str).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                        dy={10}
                                    />
                                    <YAxis tick={{fontSize: 10, fill: '#64748b', fontWeight: 600}} axisLine={false} tickLine={false} dx={-10} />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px', fontWeight: 'bold' }}
                                    />
                                    <Area type="monotone" dataKey="inward" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorIn)" />
                                    <Area type="monotone" dataKey="outward" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorOut)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Top Items List */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gray-50/50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-widest flex items-center gap-2">
                                <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                                Top Selling Items
                            </h3>
                        </div>
                        <div className="p-4">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {stats?.topSellingItems?.length > 0 ? (
                                    stats.topSellingItems.slice(0, 4).map((item, i) => (
                                        <div key={i} className="text-center p-3 border border-gray-100 rounded-xl bg-white hover:border-indigo-200 hover:shadow-sm transition-all group cursor-default">
                                            <div className="text-[10px] font-bold text-gray-500 uppercase truncate mb-1.5 group-hover:text-indigo-600 transition-colors" title={item.name}>{item.name}</div>
                                            <div className="text-lg font-black text-gray-800">{item.totalSold} <span className="text-[9px] font-bold text-gray-400">UNITS</span></div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-full text-center py-6 text-xs text-gray-400 font-bold uppercase bg-gray-50 rounded-xl border border-dashed border-gray-200">No sales data available</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar Column */}
                <div className="col-span-12 lg:col-span-4 space-y-4">
                    {/* Sales Performance Card (Admin Only) */}
                    {isFinancialAdmin && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-gray-50/50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-widest flex items-center gap-2">
                                    <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                                    Sales Performance
                                </h3>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {[
                                    { label: 'Today\'s Sales', value: stats?.todaySales || 0, color: 'text-indigo-600', bg: 'bg-indigo-50/30' },
                                    { label: 'This Week', value: stats?.weekSales || 0, color: 'text-blue-600', bg: 'bg-white' },
                                    { label: 'This Month', value: stats?.monthSales || 0, color: 'text-emerald-600', bg: 'bg-gray-50/30' },
                                    { label: 'Total Sales (All Time)', value: stats?.totalSales || 0, color: 'text-gray-900', bg: 'bg-white' }
                                ].map((row, i) => (
                                    <div key={i} className={`flex justify-between items-center px-4 py-3.5 hover:bg-gray-50 transition-colors ${row.bg}`}>
                                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">{row.label}</span>
                                        <span className={`text-sm font-black ${row.color}`}>{formatCurrency(row.value)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Unified Stock Details & Inventory Summary */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gray-50/50 px-4 py-3 border-b border-gray-100">
                            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-widest flex items-center gap-2">
                                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                Inventory Snapshot
                            </h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {[
                                { label: 'Physical Qty in Hand', value: stats?.totalItemsCount || 0, color: 'text-gray-900', bg: 'bg-white' },
                                { label: 'Total Unique Items', value: stats?.totalItems || 0, color: 'text-gray-700', bg: 'bg-gray-50/30' },
                                { label: 'Item Categories', value: stats?.totalCategories || 0, color: 'text-gray-700', bg: 'bg-white' },
                                { label: 'Pending Receipts', value: stats?.pendingReceipts || 0, color: 'text-indigo-600', bg: 'bg-indigo-50/30' },
                                { label: 'Low Stock Alerts', value: stats?.lowStockItems || 0, color: 'text-amber-600', bg: 'bg-amber-50/30' },
                                { label: 'Out of Stock Items', value: stats?.outOfStockItems || 0, color: 'text-rose-600', bg: 'bg-rose-50/30' }
                            ].map((row, i) => (
                                <div key={i} className={`flex justify-between items-center px-4 py-3.5 hover:bg-gray-50 transition-colors ${row.bg}`}>
                                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">{row.label}</span>
                                    <span className={`text-sm font-black ${row.color}`}>{row.value}</span>
                                </div>
                            ))}
                        </div>
                        {stats?.lowStockItems > 0 && (
                            <div className="p-3 bg-white border-t border-gray-100">
                                <Link to="/inventory/reports" className="block w-full text-center py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold uppercase tracking-widest rounded-lg transition-colors border border-rose-100 hover:border-rose-200">
                                    View Low Stock Report
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
