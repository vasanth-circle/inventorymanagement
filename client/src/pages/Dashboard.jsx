import { useState, useEffect, useContext, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { formatCurrency } from '../utils/helpers';
import { AuthContext } from '../context/AuthContext';
import { InventoryContext } from '../context/InventoryContext';
import toast from 'react-hot-toast';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';

// ─── Palette ───────────────────────────────────────────────────────────────────
const PIE_COLORS = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#f43f5e','#8b5cf6','#14b8a6','#fb923c'];

// ─── Tiny helpers ───────────────────────────────────────────────────────────────
const fmtCompact = (n) => {
    n = Number(n) || 0;
    if (n >= 10000000) return `₹${(n/10000000).toFixed(1)}Cr`;
    if (n >= 100000)   return `₹${(n/100000).toFixed(1)}L`;
    if (n >= 1000)     return `₹${(n/1000).toFixed(1)}K`;
    return `₹${n.toFixed(0)}`;
};
const relDate = (d) => {
    const diff = Date.now() - new Date(d);
    const m = Math.floor(diff/60000);
    if (m < 1)  return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m/60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h/24)}d ago`;
};

// ─── Sub-components ────────────────────────────────────────────────────────────
const KpiCard = ({ icon, label, value, sub, color = 'indigo', onClick, urgent }) => {
    const colors = {
        indigo: 'border-indigo-100 bg-indigo-50 text-indigo-600',
        emerald:'border-emerald-100 bg-emerald-50 text-emerald-600',
        amber:  'border-amber-100 bg-amber-50 text-amber-600',
        rose:   'border-rose-100 bg-rose-50 text-rose-600',
        sky:    'border-sky-100 bg-sky-50 text-sky-600',
        violet: 'border-violet-100 bg-violet-50 text-violet-600',
        slate:  'border-slate-100 bg-slate-50 text-slate-600',
        orange: 'border-orange-100 bg-orange-50 text-orange-600',
    };
    return (
        <div
            onClick={onClick}
            className={`bg-white rounded-xl border shadow-sm p-3 sm:p-4 flex flex-col gap-2 transition-all hover:shadow-md ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''} ${urgent ? 'ring-2 ring-rose-300' : 'border-gray-100'}`}
        >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base ${colors[color] || colors.indigo}`}>
                {icon}
            </div>
            <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">{label}</p>
                <p className="text-xl sm:text-2xl font-black text-gray-900 leading-none">{value}</p>
                {sub && <p className="text-[10px] text-gray-400 mt-1 font-medium">{sub}</p>}
            </div>
        </div>
    );
};

const SectionCard = ({ title, icon, children, action, noPad }) => (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-[11px] font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                <span className="text-base">{icon}</span>{title}
            </h3>
            {action}
        </div>
        <div className={noPad ? '' : 'p-4'}>
            {children}
        </div>
    </div>
);

const AlertBadge = ({ alert }) => {
    const cfg = {
        low_stock:  { bg:'bg-amber-50 border-amber-200',  text:'text-amber-700',  icon:'⚠️' },
        out_of_stock:{ bg:'bg-rose-50 border-rose-200',   text:'text-rose-700',   icon:'🔴' },
        pending_po: { bg:'bg-indigo-50 border-indigo-200', text:'text-indigo-700', icon:'📋' },
        damaged:    { bg:'bg-orange-50 border-orange-200', text:'text-orange-700', icon:'🔧' },
    };
    const c = cfg[alert.type] || cfg.low_stock;
    return (
        <div className={`flex items-center gap-3 px-4 py-3 border rounded-lg ${c.bg}`}>
            <span className="text-sm shrink-0">{c.icon}</span>
            <p className={`text-xs font-semibold ${c.text} flex-1`}>{alert.message}</p>
            <span className={`text-xs font-black px-2 py-0.5 rounded-full bg-white border ${c.text}`}>{alert.count}</span>
        </div>
    );
};

const ActivityItem = ({ item }) => {
    const cfg = {
        stock_in: { icon:'📥', color:'text-emerald-600', bg:'bg-emerald-50' },
        stock_out:{ icon:'📤', color:'text-rose-600',    bg:'bg-rose-50' },
        sale:     { icon:'🧾', color:'text-indigo-600',  bg:'bg-indigo-50' },
        purchase: { icon:'🏭', color:'text-sky-600',     bg:'bg-sky-50' },
        inward:   { icon:'📥', color:'text-emerald-600', bg:'bg-emerald-50' },
        outward:  { icon:'📤', color:'text-rose-600',    bg:'bg-rose-50' },
        adjustment:{ icon:'⚙️', color:'text-orange-600', bg:'bg-orange-50' },
        return:   { icon:'↩️', color:'text-violet-600',  bg:'bg-violet-50' },
        transfer: { icon:'🔄', color:'text-slate-600',   bg:'bg-slate-50' },
    };
    const c = cfg[item.type] || cfg.adjustment;
    return (
        <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
            <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs ${c.bg}`}>{c.icon}</div>
            <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold truncate ${c.color}`}>{item.label}</p>
                <p className="text-[10px] text-gray-400 truncate">{item.sub || item.user || ''}{item.qty ? ` · ${item.qty} units` : ''}{item.amount ? ` · ${fmtCompact(item.amount)}` : ''}</p>
            </div>
            <span className="text-[9px] text-gray-300 font-medium whitespace-nowrap mt-0.5">{relDate(item.date)}</span>
        </div>
    );
};

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white rounded-xl shadow-xl border border-gray-100 px-3 py-2.5 text-xs">
            <p className="font-black text-gray-700 mb-1">{label}</p>
            {payload.map((p, i) => (
                <p key={i} style={{ color: p.color }} className="font-bold">
                    {p.name}: {p.name === 'Qty' ? p.value : fmtCompact(p.value)}
                </p>
            ))}
        </div>
    );
};

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
const Dashboard = () => {
    const { user } = useContext(AuthContext);
    const { billingSettings, loading: settingsLoading } = useContext(InventoryContext);
    const navigate = useNavigate();

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [darkMode, setDarkMode] = useState(false);
    const [stockTab, setStockTab] = useState('low'); // 'low' | 'out' | 'damaged'
    const [perfTab, setPerfTab] = useState('top');   // 'top' | 'slow'
    const [dismissedAlerts, setDismissedAlerts] = useState([]);

    // Also keep old stats for existing KPIs used by other card styles
    const [oldStats, setOldStats] = useState(null);
    const [trendData, setTrendData] = useState([]);

    const isFinancialAdmin = ['super_admin','admin','tenant_owner','tenant_admin','manager','accounts'].includes(user?.role);
    // Machinery-specific adaptations — only affects machinery industry
    const isMachinery = billingSettings?.industry === 'machinery';

    useEffect(() => {
        if (!settingsLoading && billingSettings && (!billingSettings.industry || billingSettings.industry === 'generic')) {
            navigate('/onboarding');
        }
    }, [billingSettings, settingsLoading, navigate]);

    const fetchAll = useCallback(async () => {
        try {
            setLoading(true);
            const [invRes, statsRes, trendRes] = await Promise.all([
                api.get('/dashboard/inventory'),
                api.get('/dashboard/stats'),
                api.get('/dashboard/stock-trend'),
            ]);
            setData(invRes.data);
            setOldStats(statsRes.data);
            // Process trend data
            const dateMap = {};
            (trendRes.data || []).forEach(item => {
                const date = item._id.date;
                if (!dateMap[date]) dateMap[date] = { date, inward: 0, outward: 0 };
                dateMap[date][item._id.type] = item.total;
            });
            setTrendData(Object.values(dateMap).sort((a,b) => new Date(a.date)-new Date(b.date)));
        } catch (err) {
            toast.error('Failed to load dashboard');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', darkMode);
    }, [darkMode]);

    if (loading) return (
        <div className="flex items-center justify-center min-h-[80vh] flex-col gap-4">
            <div className="relative">
                <div className="w-14 h-14 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-xl">📦</div>
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest animate-pulse">Loading Dashboard...</p>
        </div>
    );

    const kpi = data?.kpi || {};
    const alerts = (data?.alerts || []).filter(a => !dismissedAlerts.includes(a.type));
    const stockMonitoring = data?.stockMonitoring || { lowStock: [], outOfStock: [], damaged: [] };
    const productPerformance = data?.productPerformance || { topSelling: [], slowMoving: [] };

    const stockTabData = stockTab === 'low' ? stockMonitoring.lowStock : stockTab === 'out' ? stockMonitoring.outOfStock : stockMonitoring.damaged;
    const perfData = perfTab === 'top' ? productPerformance.topSelling : productPerformance.slowMoving;

    return (
        <div className="space-y-5 pb-24 lg:pb-8 max-w-[1600px] mx-auto">
            {/* ─── Header ─────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-200">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white shadow-sm border border-gray-200 rounded-xl flex items-center justify-center overflow-hidden">
                        {billingSettings?.branding?.logoUrl
                            ? <img src={billingSettings.branding.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                            : <span className="text-xl">{isMachinery ? '⚙️' : '🏢'}</span>}
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-gray-900 leading-tight">
                            {isMachinery ? 'Machinery & Parts Dashboard' : 'Inventory Dashboard'}
                        </h1>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{oldStats?.companyName || 'Overview'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => setDarkMode(d => !d)}
                        className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:border-indigo-200 hover:text-indigo-600 transition-all shadow-sm"
                    >
                        {darkMode ? '☀️ Light' : '🌙 Dark'}
                    </button>
                    <button
                        onClick={fetchAll}
                        className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:border-indigo-200 hover:text-indigo-600 transition-all shadow-sm flex items-center gap-1.5"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Refresh
                    </button>
                    <Link to="/inventory" className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm">
                        {isMachinery ? 'Manage Parts →' : 'Manage Stock →'}
                    </Link>
                </div>
            </div>

            {/* ─── Alerts Banner ───────────────────────────────────── */}
            {alerts.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
                    {alerts.map(a => (
                        <div key={a.type} className="relative">
                            <AlertBadge alert={a} />
                            <button
                                onClick={() => setDismissedAlerts(d => [...d, a.type])}
                                className="absolute top-2 right-2 text-gray-300 hover:text-gray-600 text-xs font-bold"
                            >✕</button>
                        </div>
                    ))}
                </div>
            )}

            {/* ─── KPI Cards ───────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3">
                <KpiCard
                    icon={isMachinery ? '⚙️' : '📦'}
                    label={isMachinery ? 'Machines & Parts' : 'Total Products'}
                    value={kpi.totalProducts?.toLocaleString() ?? '—'}
                    sub={isMachinery ? 'Unique machines & spares' : 'Unique items in catalog'}
                    color="indigo" onClick={() => navigate('/inventory')} />
                <KpiCard icon="🏷️" label="Total SKUs" value={kpi.totalSKUs?.toLocaleString() ?? '—'} sub="Items with SKU codes" color="sky" />
                {isFinancialAdmin && <KpiCard icon="💰" label={isMachinery ? 'Parts Stock Value' : 'Inventory Value'} value={fmtCompact(kpi.inventoryValue)} sub="Based on purchase price" color="emerald" />}
                <KpiCard
                    icon={isMachinery ? '🔩' : '📊'}
                    label={isMachinery ? 'Parts in Stock' : 'Available Stock'}
                    value={kpi.availableStock?.toLocaleString() ?? '—'}
                    sub={isMachinery ? 'Total parts in hand' : 'Total units in hand'}
                    color="violet" />
                <KpiCard
                    icon="⚠️"
                    label={isMachinery ? 'Low Parts Alert' : 'Low Stock'}
                    value={kpi.lowStockCount ?? '—'}
                    sub="At or below threshold" color="amber" urgent={kpi.lowStockCount > 0} onClick={() => setStockTab('low')} />
                <KpiCard
                    icon="🔴"
                    label={isMachinery ? 'Parts Out of Stock' : 'Out of Stock'}
                    value={kpi.outOfStockCount ?? '—'}
                    sub="Zero quantity items" color="rose" urgent={kpi.outOfStockCount > 0} onClick={() => setStockTab('out')} />
                <KpiCard icon="📈" label="Overstocked" value={kpi.overStockedCount ?? '—'} sub="3x above threshold" color="orange" />
                {isFinancialAdmin && <KpiCard icon="🔧" label={isMachinery ? 'Damaged Parts' : 'Damaged Units'} value={kpi.damagedTotal?.toLocaleString() ?? '—'} sub={kpi.damagedValue > 0 ? `Value: ${fmtCompact(kpi.damagedValue)} · ${kpi.damagedCount ?? 0} items` : `Total damaged qty · ${kpi.damagedCount ?? 0} items`} color="slate" onClick={() => setStockTab('damaged')} />}
                {isFinancialAdmin && <KpiCard
                    icon={isMachinery ? '🔩' : '🛒'}
                    label={isMachinery ? 'Pending Part Orders' : 'Pending POs'}
                    value={kpi.pendingPOs ?? '—'} sub="Awaiting delivery" color="indigo" onClick={() => navigate('/purchase-orders')} />}
                {isFinancialAdmin && <KpiCard icon="📅" label={isMachinery ? 'Parts Purchase This Month' : 'Purchase This Month'} value={fmtCompact(kpi.purchaseThisMonth)} sub="Current month spend" color="sky" />}
                <KpiCard
                    icon="📥"
                    label={isMachinery ? 'Parts Received Today' : 'Today Stock In'}
                    value={oldStats?.todayInward?.total ?? '—'}
                    sub={`${oldStats?.todayInward?.count ?? 0} transactions`} color="emerald" />
                <KpiCard
                    icon="📤"
                    label={isMachinery ? 'Parts Dispatched Today' : 'Today Stock Out'}
                    value={oldStats?.todayOutward?.total ?? '—'}
                    sub={`${oldStats?.todayOutward?.count ?? 0} transactions`} color="rose" />
            </div>

            {/* ─── Analytics Row ───────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Monthly Purchase vs Sales Trend */}
                {isFinancialAdmin && (
                    <SectionCard title="Purchase vs Sales Trend" icon="📈">
                        <div className="h-[220px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data?.monthlyTrend || []} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="gPurchase" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => fmtCompact(v)} width={55} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px', fontWeight: 700 }} />
                                    <Area type="monotone" dataKey="purchase" name="Purchase" stroke="#6366f1" strokeWidth={2.5} fill="url(#gPurchase)" dot={{ fill: '#6366f1', r: 3 }} />
                                    <Area type="monotone" dataKey="sales"    name="Sales"    stroke="#10b981" strokeWidth={2.5} fill="url(#gSales)"    dot={{ fill: '#10b981', r: 3 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </SectionCard>
                )}

                {/* Weekly Stock Movement */}
                <SectionCard title="Stock Movement (4 Weeks)" icon="📦">
                    <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data?.stockMovement || []} margin={{ top: 5, right: 5, left: -10, bottom: 0 }} barSize={18} barGap={4}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px', fontWeight: 700 }} />
                                <Bar dataKey="inward"  name="Stock In"  fill="#10b981" radius={[4,4,0,0]} />
                                <Bar dataKey="outward" name="Stock Out" fill="#f43f5e" radius={[4,4,0,0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </SectionCard>

                {/* Category Distribution */}
                <SectionCard title="Category Distribution" icon="🗂️">
                    {(data?.categoryDistribution || []).length === 0 ? (
                        <div className="flex items-center justify-center h-[220px] text-gray-300 flex-col gap-2">
                            <span className="text-3xl">📂</span>
                            <p className="text-xs font-bold">No categories yet</p>
                        </div>
                    ) : (
                        <div className="flex flex-col sm:flex-row items-center gap-2 h-[220px]">
                            <div className="w-full sm:w-48 h-[200px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={data.categoryDistribution} dataKey="totalQty" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3}>
                                            {data.categoryDistribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip formatter={(v) => [`${v} units`, '']} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[200px] w-full">
                                {data.categoryDistribution.map((c, i) => (
                                    <div key={i} className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-gray-50">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}></div>
                                            <span className="text-[11px] font-semibold text-gray-700 truncate max-w-[120px]">{c.name}</span>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-[11px] font-black text-gray-800">{c.totalQty?.toLocaleString()}</p>
                                            <p className="text-[9px] text-gray-400">{c.count} items</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </SectionCard>

                {/* Purchase Summary */}
                {isFinancialAdmin && (
                    <SectionCard title="Purchase Overview" icon="🏭">
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            {[
                                { label: 'Total POs', value: data?.purchaseStats?.total ?? 0, color: 'text-gray-800' },
                                { label: 'Pending',   value: data?.purchaseStats?.pending ?? 0, color: 'text-amber-600' },
                                { label: 'Received',  value: data?.purchaseStats?.received ?? 0, color: 'text-emerald-600' },
                                { label: 'This Month',value: data?.purchaseStats?.monthCount ?? 0, color: 'text-indigo-600' },
                            ].map((s, i) => (
                                <div key={i} className="bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{s.label}</p>
                                    <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                                </div>
                            ))}
                        </div>
                        {(data?.supplierAnalytics || []).length > 0 && (
                            <div>
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Top Suppliers</p>
                                <div className="space-y-1.5">
                                    {data.supplierAnalytics.map((s, i) => (
                                        <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50">
                                            <div className="flex items-center gap-2">
                                                <span className="w-5 h-5 bg-indigo-100 text-indigo-700 rounded-full text-[9px] font-black flex items-center justify-center">{i+1}</span>
                                                <span className="text-xs font-semibold text-gray-700 truncate max-w-[140px]">{s.name}</span>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-black text-gray-800">{fmtCompact(s.totalValue)}</p>
                                                <p className="text-[9px] text-gray-400">{s.count} POs</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </SectionCard>
                )}
            </div>

            {/* ─── Stock Monitoring ────────────────────────────────── */}
            <SectionCard
                title="Stock Monitoring"
                icon="🔍"
                noPad
                action={
                    <Link to="/inventory" className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">View All →</Link>
                }
            >
                {/* Tabs */}
                <div className="flex border-b border-gray-100 px-4 bg-gray-50/50">
                    {[
                        { id: 'low',     label: `⚠️ Low Stock (${stockMonitoring.lowStock?.length ?? 0})`,     urgent: (stockMonitoring.lowStock?.length ?? 0) > 0 },
                        { id: 'out',     label: `🔴 Out of Stock (${stockMonitoring.outOfStock?.length ?? 0})`, urgent: (stockMonitoring.outOfStock?.length ?? 0) > 0 },
                        { id: 'damaged', label: `🔧 Damaged (${stockMonitoring.damaged?.length ?? 0})` },
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setStockTab(t.id)}
                            className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-wider transition-all border-b-2 -mb-px ${stockTab === t.id ? 'border-indigo-500 text-indigo-700' : 'border-transparent text-gray-400 hover:text-gray-600'} ${t.urgent && stockTab !== t.id ? 'text-rose-500' : ''}`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
                <div className="overflow-x-auto">
                    {stockTabData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-300 gap-2">
                            <span className="text-3xl">✅</span>
                            <p className="text-xs font-bold text-gray-400">All clear!</p>
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-gray-50">
                                    <th className="px-4 py-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest">Item</th>
                                    <th className="px-4 py-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest">Category</th>
                                    <th className="px-4 py-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">
                                        {stockTab === 'damaged' ? 'Damaged Qty' : 'Qty'}
                                    </th>
                                    {stockTab === 'damaged' && isFinancialAdmin && <th className="px-4 py-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Damage Value</th>}
                                    {stockTab === 'low' && <th className="px-4 py-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Min Threshold</th>}
                                    <th className="px-4 py-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {stockTabData.slice(0, 10).map((item, i) => (
                                    <tr key={item._id || i} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <p className="text-xs font-bold text-gray-800 truncate max-w-[180px]">{item.name}</p>
                                            {item.sku && <p className="text-[9px] text-gray-400 font-mono">{item.sku}</p>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-semibold">{item.category?.name || '—'}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`text-sm font-black ${stockTab === 'out' ? 'text-rose-600' : stockTab === 'low' ? 'text-amber-600' : 'text-orange-600'}`}>
                                                {stockTab === 'damaged' ? item.damagedQuantity : item.quantity}
                                            </span>
                                        </td>
                                        {stockTab === 'damaged' && isFinancialAdmin && (
                                            <td className="px-4 py-3 text-right">
                                                <span className="text-sm font-black text-red-700">
                                                    {fmtCompact((item.damagedQuantity || 0) * (item.purchasePrice || item.price || 0))}
                                                </span>
                                                <p className="text-[9px] text-gray-400">
                                                    @ {fmtCompact(item.purchasePrice || item.price || 0)}/unit
                                                </p>
                                            </td>
                                        )}
                                        {stockTab === 'low' && (
                                            <td className="px-4 py-3 text-right text-xs font-bold text-gray-400">{item.minStockThreshold}</td>
                                        )}
                                        <td className="px-4 py-3 text-right">
                                            <Link to="/stock-inward" className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-all">
                                                Restock
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                {/* Damaged total value footer */}
                {stockTab === 'damaged' && isFinancialAdmin && kpi.damagedValue > 0 && (
                    <div className="px-4 py-3 border-t border-orange-100 bg-orange-50 flex items-center justify-between">
                        <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Total Damaged Goods Value</span>
                        <span className="text-sm font-black text-red-700">{fmtCompact(kpi.damagedValue)}</span>
                    </div>
                )}
            </SectionCard>

            {/* ─── Product Performance ─────────────────────────────── */}
            <SectionCard
                title="Product Performance"
                icon="🏆"
                noPad
                action={
                    <div className="flex">
                        {[{ id:'top', label:'Top Selling' },{ id:'slow', label:'Slow Moving' }].map(t => (
                            <button key={t.id} onClick={() => setPerfTab(t.id)}
                                className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${perfTab === t.id ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400 hover:text-gray-600'}`}>
                                {t.label}
                            </button>
                        ))}
                    </div>
                }
            >
                <div className="overflow-x-auto">
                    {perfData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-300 gap-2">
                            <span className="text-3xl">📊</span>
                            <p className="text-xs font-bold text-gray-400">No data yet</p>
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-gray-50">
                                    <th className="px-4 py-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest">#</th>
                                    <th className="px-4 py-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest">Product</th>
                                    {perfTab === 'top' && <th className="px-4 py-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Units Sold</th>}
                                    {perfTab === 'top' && isFinancialAdmin && <th className="px-4 py-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Revenue</th>}
                                    {perfTab === 'slow' && <th className="px-4 py-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Stock (No Sales 30d)</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {perfData.slice(0, 8).map((item, i) => (
                                    <tr key={item._id || i} className="hover:bg-gray-50/50">
                                        <td className="px-4 py-3">
                                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-400'}`}>
                                                {i + 1}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="text-xs font-bold text-gray-800 truncate max-w-[200px]">{item.name}</p>
                                            {item.category?.name && <p className="text-[9px] text-gray-400">{item.category.name}</p>}
                                        </td>
                                        {perfTab === 'top' && (
                                            <td className="px-4 py-3 text-right">
                                                <span className="text-sm font-black text-emerald-600">{item.totalSold?.toLocaleString()}</span>
                                            </td>
                                        )}
                                        {perfTab === 'top' && isFinancialAdmin && (
                                            <td className="px-4 py-3 text-right text-xs font-black text-gray-800">{fmtCompact(item.revenue)}</td>
                                        )}
                                        {perfTab === 'slow' && (
                                            <td className="px-4 py-3 text-right">
                                                <span className="text-sm font-black text-orange-500">{item.quantity?.toLocaleString()}</span>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </SectionCard>

            {/* ─── Bottom Row: Sales Snapshot + Recent Activity ──── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Sales Snapshot */}
                {isFinancialAdmin && (
                    <SectionCard title="Sales Snapshot" icon="💰">
                        <div className="space-y-2">
                            {[
                                { label: "Today's Sales",         value: oldStats?.todaySales,    color: 'text-indigo-600' },
                                { label: "This Week",             value: oldStats?.weekSales,     color: 'text-blue-600' },
                                { label: "This Month",            value: oldStats?.monthSales,    color: 'text-emerald-600' },
                                { label: "All Time Sales",        value: oldStats?.totalSales,    color: 'text-gray-900' },
                                { label: "Total Purchases",       value: oldStats?.totalPurchase, color: 'text-amber-600' },
                            ].map((row, i) => (
                                <div key={i} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-gray-50 transition-colors">
                                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">{row.label}</span>
                                    <span className={`text-sm font-black ${row.color}`}>{formatCurrency(row.value ?? 0)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 h-[120px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={trendData.slice(-7)} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barSize={12}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={d => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short' })} />
                                    <YAxis hide />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="inward"  name="In"  fill="#10b981" radius={[3,3,0,0]} />
                                    <Bar dataKey="outward" name="Out" fill="#f43f5e" radius={[3,3,0,0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </SectionCard>
                )}

                {/* Recent Activity */}
                <SectionCard title="Recent Activity" icon="🕐"
                    action={<Link to="/reports" className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800">View Reports →</Link>}
                >
                    {(data?.activityFeed || []).length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-gray-300 gap-2">
                            <span className="text-3xl">📋</span>
                            <p className="text-xs font-bold text-gray-400">No recent activity</p>
                        </div>
                    ) : (
                        <div className="overflow-y-auto max-h-[340px]">
                            {data.activityFeed.map((item, i) => <ActivityItem key={i} item={item} />)}
                        </div>
                    )}
                </SectionCard>
            </div>

            {/* ─── Quick Links Row ─────────────────────────────────── */}
            <SectionCard title="Quick Actions" icon="⚡">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[
                        { to:'/stock-inward',    icon:'📥', label:'Stock Inward',   color:'bg-emerald-50 text-emerald-700 border-emerald-100' },
                        { to:'/purchase-orders', icon:'🏭', label:'Purchase Orders', color:'bg-sky-50 text-sky-700 border-sky-100' },
                        { to:'/sales-orders',    icon:'🧾', label:'Sales Orders',    color:'bg-indigo-50 text-indigo-700 border-indigo-100' },
                        { to:'/inventory',       icon:'📦', label:'Inventory',       color:'bg-violet-50 text-violet-700 border-violet-100' },
                        { to:'/reports',         icon:'📊', label:'Reports',         color:'bg-amber-50 text-amber-700 border-amber-100' },
                        { to:'/vendors',         icon:'🤝', label:'Vendors',         color:'bg-rose-50 text-rose-700 border-rose-100' },
                    ].map(link => (
                        <Link key={link.to} to={link.to}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border ${link.color} hover:shadow-md transition-all hover:scale-105 text-center`}
                        >
                            <span className="text-2xl">{link.icon}</span>
                            <span className="text-[10px] font-black uppercase tracking-wide leading-tight">{link.label}</span>
                        </Link>
                    ))}
                </div>
            </SectionCard>
        </div>
    );
};

export default Dashboard;
