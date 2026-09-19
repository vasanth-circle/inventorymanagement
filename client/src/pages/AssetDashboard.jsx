import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const daysUntil = (d) => Math.ceil((new Date(d) - new Date()) / (1000 * 60 * 60 * 24));

const STATUS_COLORS = {
    Available:  { bg: '#dcfce7', text: '#15803d', dot: '#22c55e' },
    Assigned:   { bg: '#dbeafe', text: '#1d4ed8', dot: '#3b82f6' },
    'In Service': { bg: '#fef9c3', text: '#a16207', dot: '#eab308' },
    Returned:   { bg: '#f3e8ff', text: '#7e22ce', dot: '#a855f7' },
    Retired:    { bg: '#fee2e2', text: '#b91c1c', dot: '#ef4444' },
};

const TYPE_ICONS = {
    System: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2"/><polyline points="8 21 12 17 16 21"/>
        </svg>
    ),
    Vehicle: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-1"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>
        </svg>
    ),
    Furniture: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/><rect x="2" y="9" width="20" height="3" rx="1"/><path d="M4 12v5"/><path d="M20 12v5"/><path d="M7 17h10"/>
        </svg>
    ),
    Networking: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="2" width="6" height="4" rx="1"/><rect x="1" y="18" width="6" height="4" rx="1"/><rect x="17" y="18" width="6" height="4" rx="1"/><path d="M12 6v4M4 18v-4h16v4"/><path d="M12 10h8v4"/>
        </svg>
    ),
    Other: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>
        </svg>
    ),
};

// ─── Donut Chart (pure SVG) ───────────────────────────────────────────────────
const DonutChart = ({ data, total }) => {
    const COLORS = ['#6366f1','#22c55e','#eab308','#a855f7','#ef4444'];
    const r = 54, cx = 70, cy = 70, strokeW = 20;
    const circ = 2 * Math.PI * r;
    let offset = 0;
    const slices = Object.entries(data).map(([label, val], i) => {
        const pct = total > 0 ? val / total : 0;
        const len = pct * circ;
        const slice = { label, val, pct, color: COLORS[i % COLORS.length], dash: `${len} ${circ - len}`, offset };
        offset += len;
        return slice;
    });
    return (
        <div className="flex items-center gap-6">
            <svg width="140" height="140" viewBox="0 0 140 140">
                {total === 0 ? (
                    <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={strokeW} />
                ) : slices.map((s, i) => (
                    <circle key={i} cx={cx} cy={cy} r={r} fill="none"
                        stroke={s.color} strokeWidth={strokeW}
                        strokeDasharray={s.dash}
                        strokeDashoffset={-s.offset}
                        transform="rotate(-90 70 70)"
                        style={{ transition: 'stroke-dasharray 0.6s ease' }}
                    />
                ))}
                <text x={cx} y={cy - 6} textAnchor="middle" className="font-bold" style={{ fontSize: 22, fill: '#1e293b', fontFamily: 'Outfit, sans-serif', fontWeight: 700 }}>{total}</text>
                <text x={cx} y={cy + 12} textAnchor="middle" style={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>Total</text>
            </svg>
            <div className="flex flex-col gap-2">
                {slices.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="text-slate-600 text-xs font-medium">{s.label}</span>
                        <span className="ml-auto text-slate-800 font-bold text-xs">{s.val}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── Horizontal Bar Chart ─────────────────────────────────────────────────────
const BarChart = ({ data }) => {
    const entries = Object.entries(data).sort(([,a],[,b]) => b - a).slice(0, 7);
    const max = Math.max(...entries.map(([,v]) => v), 1);
    const COLORS = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#f97316','#ef4444'];
    return (
        <div className="space-y-2.5">
            {entries.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-4">No data yet</p>
            ) : entries.map(([label, val], i) => (
                <div key={label} className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 w-20 truncate flex-shrink-0">{label}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${(val / max) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                    </div>
                    <span className="text-xs font-bold text-slate-700 w-5 text-right">{val}</span>
                </div>
            ))}
        </div>
    );
};

// ─── KPI Card — vertical compact layout so labels never truncate ──────────────
const KpiCard = ({ icon, label, value, sub, accent, trend }) => (
    <div className="bg-white rounded-xl border border-gray-100 px-4 py-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
        {/* Top: icon + optional alert badge */}
        <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: accent + '1a', color: accent }}>
                {icon}
            </div>
            {trend !== undefined && trend > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-500 leading-none">⚠</span>
            )}
        </div>
        {/* Bottom: label + value */}
        <div>
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide leading-tight mb-1">{label}</p>
            <p className="text-xl font-extrabold text-slate-900 leading-none" style={{ fontFamily: 'Outfit, sans-serif' }}>{value}</p>
            {sub && <p className="text-[11px] text-slate-400 mt-1 leading-tight">{sub}</p>}
        </div>
    </div>
);

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
    const c = STATUS_COLORS[status] || { bg: '#f1f5f9', text: '#475569', dot: '#94a3b8' };
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: c.bg, color: c.text }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.dot }} />
            {status}
        </span>
    );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const AssetDashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const { data } = await api.get('/assets/dashboard');
                if (data.success) setStats(data.data);
            } catch (error) {
                toast.error(error.response?.data?.message || 'Error fetching stats');
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center h-full min-h-[400px] gap-3">
                <div className="w-10 h-10 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                <p className="text-sm text-slate-400">Loading dashboard…</p>
            </div>
        );
    }

    const s = stats || {};
    const alerts = [...(s.warrantyAlerts || []).map(a => ({ ...a, kind: 'warranty' })), ...(s.insuranceAlerts || []).map(a => ({ ...a, kind: 'insurance' }))];

    return (
        <div className="space-y-6 pb-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Asset Dashboard</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Real-time overview of all company assets</p>
                </div>
                <div className="flex items-center gap-2">
                    <Link to="/assets/reports" className="px-4 py-2 text-sm font-semibold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors">
                        📊 Reports
                    </Link>
                    <Link to="/assets" className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-1.5">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Manage Assets
                    </Link>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <KpiCard icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>} label="Total Assets" value={s.totalAssets || 0} sub={`${s.activeAssets || 0} active`} accent="#6366f1" />
                <KpiCard icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><polyline points="8 21 12 17 16 21"/></svg>} label="Systems" value={s.totalSystems || 0} sub="Computers & equip." accent="#6366f1" />
                <KpiCard icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-1"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>} label="Vehicles" value={s.totalVehicles || 0} sub="Fleet & transport" accent="#0ea5e9" />
                <KpiCard icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>} label="In Service" value={s.inServiceAssets || 0} sub="Under maintenance" accent="#f59e0b" trend={s.inServiceAssets} />
                <KpiCard icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>} label="Total Value" value={fmt(s.totalCurrentValue)} sub={`Paid: ${fmt(s.totalPurchaseValue)}`} accent="#10b981" />
                <KpiCard icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>} label="Warranty Expiring" value={s.warrantyExpiringSoon || 0} sub="Within 30 days" accent="#ef4444" trend={s.warrantyExpiringSoon} />
            </div>

            {/* Alerts Panel */}
            {alerts.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <h3 className="text-sm font-bold text-amber-800 mb-3 flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        {alerts.length} Alert{alerts.length > 1 ? 's' : ''} Require Attention
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {alerts.slice(0, 5).map((a, i) => {
                            const expiry = a.kind === 'warranty' ? a.warrantyExpiry : a.insuranceData?.expiryDate;
                            const days = expiry ? daysUntil(expiry) : null;
                            return (
                                <div key={i} className="bg-white border border-amber-200 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
                                    <span className="font-mono text-amber-600 font-bold">{a.assetTag || '—'}</span>
                                    <span className="text-slate-700 font-medium">{a.name}</span>
                                    <span className="text-amber-700 font-semibold">
                                        {a.kind === 'warranty' ? '🛡 Warranty' : '📋 Insurance'} expires in {days}d
                                    </span>
                                </div>
                            );
                        })}
                        {alerts.length > 5 && <span className="text-xs text-amber-600 font-semibold self-center">+{alerts.length - 5} more</span>}
                    </div>
                </div>
            )}

            {/* Charts + Recent Table */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Status Donut */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <h2 className="text-sm font-bold text-slate-800 mb-4">Status Distribution</h2>
                    <DonutChart data={s.statusBreakdown || {}} total={s.totalAssets || 0} />
                </div>

                {/* Category Bar */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <h2 className="text-sm font-bold text-slate-800 mb-4">Assets by Category</h2>
                    <BarChart data={s.categoryBreakdown || {}} />
                </div>

                {/* Financial Summary */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
                    <h2 className="text-sm font-bold text-slate-800">Financial Summary</h2>
                    <div className="space-y-3">
                        {[
                            { label: 'Total Purchase Value', value: fmt(s.totalPurchaseValue), color: '#6366f1' },
                            { label: 'Current Book Value', value: fmt(s.totalCurrentValue), color: '#10b981' },
                            { label: 'Total Maintenance Cost', value: fmt(s.totalMaintenanceCost), color: '#f59e0b' },
                            { label: 'Value Depreciated', value: fmt((s.totalPurchaseValue || 0) - (s.totalCurrentValue || 0)), color: '#ef4444' },
                        ].map(({ label, value, color }) => (
                            <div key={label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                                <span className="text-xs text-slate-500">{label}</span>
                                <span className="text-sm font-bold" style={{ color }}>{value}</span>
                            </div>
                        ))}
                    </div>
                    <Link to="/assets/maintenance" className="mt-auto text-center text-xs font-semibold text-indigo-600 hover:text-indigo-800 py-2 border border-indigo-100 rounded-lg hover:bg-indigo-50 transition-colors">
                        View Maintenance Logs →
                    </Link>
                </div>
            </div>

            {/* Recent Assets Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-bold text-slate-800">Recently Added Assets</h2>
                        <p className="text-xs text-slate-400 mt-0.5">Last 8 assets registered</p>
                    </div>
                    <Link to="/assets" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-3 py-1.5 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors">
                        View All →
                    </Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                            <tr className="border-b border-gray-50">
                                {['Tag', 'Asset', 'Category', 'Location', 'Assignee', 'Status'].map(h => (
                                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {(s.recentAssets || []).length > 0 ? s.recentAssets.map(asset => (
                                <tr key={asset._id} className="border-b border-gray-50 hover:bg-slate-50 transition-colors">
                                    <td className="px-5 py-3">
                                        <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">{asset.assetTag || '—'}</span>
                                    </td>
                                    <td className="px-5 py-3">
                                        <div className="font-semibold text-slate-800 text-sm">{asset.name}</div>
                                        {asset.make && <div className="text-xs text-slate-400">{asset.make} {asset.model}</div>}
                                    </td>
                                    <td className="px-5 py-3 text-xs text-slate-600">{asset.category || asset.assetType}</td>
                                    <td className="px-5 py-3 text-xs text-slate-600">📍 {asset.branch?.name || '—'}</td>
                                    <td className="px-5 py-3 text-xs text-slate-600">{asset.assignee?.name || <span className="text-slate-300 italic">Unassigned</span>}</td>
                                    <td className="px-5 py-3"><StatusBadge status={asset.status} /></td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="6" className="px-5 py-12 text-center">
                                        <div className="flex flex-col items-center gap-2 text-slate-400">
                                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                                            <p className="text-sm font-medium">No assets found</p>
                                            <Link to="/assets" className="text-xs text-indigo-600 hover:underline font-semibold">Add your first asset →</Link>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AssetDashboard;
