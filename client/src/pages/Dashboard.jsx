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
        <div className="p-1 space-y-4 max-w-[1600px] mx-auto pb-24 lg:pb-8">
            {/* Header Section */}
            <div className="flex justify-between items-end pb-2 border-b border-gray-100">
                <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 bg-white shadow-sm border border-gray-100 rounded-lg flex items-center justify-center text-lg overflow-hidden">
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
                        <h1 className="text-xl font-bold text-gray-800 leading-tight">Hello, {stats?.userName || 'User'}!</h1>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">{stats?.companyName || 'Inventory Management'}</p>
                    </div>
                </div>
                <button onClick={fetchDashboardData} className="p-2 text-gray-400 hover:text-rose-600 transition-colors text-xs font-bold uppercase tracking-widest">
                    Refresh
                </button>
            </div>

            <div className="grid grid-cols-12 gap-4 lg:gap-6">
                {/* Main Content */}
                <div className="col-span-12 lg:col-span-8 space-y-4 lg:space-y-6">

                    {/* Sales Activity */}
                    <div className="zoho-card border-l-4 border-l-rose-500 overflow-hidden">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sales Activity</h2>
                            <span className="text-[9px] text-gray-300 font-bold uppercase">This Month</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                            {[
                                { key: 'packed', label: 'To Be Packed', color: 'text-blue-600', icon: '📦' },
                                { key: 'shipped', label: 'To Be Shipped', color: 'text-rose-500', icon: '🚚' },
                                { key: 'delivered', label: 'To Be Delivered', color: 'text-emerald-500', icon: '🏠' },
                                { key: 'invoiced', label: 'To Be Invoiced', color: 'text-yellow-600', icon: '📄' }
                            ].map((activity, idx) => (
                                <div key={activity.key} className={`p-2 text-center group cursor-pointer ${idx >= 2 ? 'pt-4 md:pt-2' : ''}`}>
                                    <div className={`text-2xl font-black mb-0.5 ${activity.color}`}>
                                        {stats?.salesActivity?.[activity.key] || 0}
                                    </div>
                                    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter group-hover:text-gray-600 whitespace-nowrap">
                                        {activity.label}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Stock Movement Trend */}
                    <div className="zoho-card">
                        <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
                            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Stock Trend</h3>
                            <div className="flex items-center space-x-3">
                                <div className="flex items-center space-x-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                    <span className="text-[8px] font-bold text-gray-400 uppercase">In</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                                    <span className="text-[8px] font-bold text-gray-400 uppercase">Out</span>
                                </div>
                            </div>
                        </div>
                        <div className="h-[180px] lg:h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis 
                                        dataKey="date" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{fontSize: 8, fill: '#94a3b8', fontWeight: 600}}
                                        tickFormatter={(str) => new Date(str).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                    />
                                    <YAxis tick={{fontSize: 8, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '9px', fontWeight: 'bold' }}
                                    />
                                    <Area type="monotone" dataKey="inward" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorIn)" />
                                    <Area type="monotone" dataKey="outward" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorOut)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Summary Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="zoho-card">
                            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Stock Details</h3>
                            <div className="space-y-2">
                                {[
                                    { label: 'Low Stock', value: stats?.lowStockItems || 0, color: 'text-rose-600' },
                                    { label: 'Item Groups', value: stats?.totalCategories || 0, color: 'text-slate-700' },
                                    { label: 'Total Items', value: stats?.totalItems || 0, color: 'text-slate-700' },
                                    { label: 'Out of Stock', value: stats?.outOfStockItems || 0, color: 'text-orange-600' }
                                ].map((row, i) => (
                                    <div key={i} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded-lg transition-colors border-b border-gray-50 last:border-0">
                                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">{row.label}</span>
                                        <span className={`text-xs font-black ${row.color}`}>{row.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="zoho-card">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Top Items</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {stats?.topSellingItems?.length > 0 ? (
                                    stats.topSellingItems.slice(0, 2).map((item, i) => (
                                        <div key={i} className="text-center p-2 border border-gray-50 rounded-xl bg-slate-50/50">
                                            <div className="text-[9px] font-bold text-gray-400 uppercase truncate mb-1" title={item.name}>{item.name}</div>
                                            <div className="text-xs font-black text-gray-700">{item.totalSold} <span className="text-[8px] font-normal">PCS</span></div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-2 text-center py-4 text-[9px] text-gray-300 font-bold uppercase">No data</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar Column */}
                <div className="col-span-12 lg:col-span-4 space-y-4 lg:space-y-6">
                    {/* Finance Card */}
                    {isFinancialAdmin && (
                        <div className="zoho-card bg-slate-900 text-white border-none shadow-lg">
                            <div className="flex justify-between items-center mb-4 opacity-60">
                                <span className="text-[10px] font-bold uppercase tracking-widest">Stock Valuation</span>
                                <span className="text-lg">💎</span>
                            </div>
                            <div className="text-2xl font-black tracking-tight mb-1">
                                {formatCurrency(stats?.stockValue || 0)}
                            </div>
                            <div className="text-[9px] opacity-40 font-bold uppercase tracking-tighter">Total value at cost</div>
                        </div>
                    )}

                    {/* Inventory Summary */}
                    <div className="zoho-card p-0 overflow-hidden">
                        <div className="bg-slate-50 px-4 py-2 border-b border-gray-100">
                            <h3 className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Inventory Summary</h3>
                        </div>
                        <div className="divide-y divide-gray-50">
                            <div className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Qty in Hand</span>
                                <span className="text-sm font-black text-gray-800">{stats?.totalItemsCount || 0}</span>
                            </div>
                            <div className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Pending Rect</span>
                                <span className="text-sm font-black text-gray-800">{stats?.pendingReceipts || 0}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
