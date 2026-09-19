import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const MAINT_TYPE_COLORS = {
    Preventive: { bg: '#dbeafe', text: '#1d4ed8' },
    Corrective:  { bg: '#fee2e2', text: '#b91c1c' },
    Inspection:  { bg: '#dcfce7', text: '#15803d' },
    Upgrade:     { bg: '#f3e8ff', text: '#7e22ce' },
    Other:       { bg: '#f1f5f9', text: '#475569' },
};

const AssetMaintenance = () => {
    const [logs, setLogs] = useState([]);
    const [allAssets, setAllAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterAsset, setFilterAsset] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [logsRes, assetsRes] = await Promise.all([
                    api.get('/assets/maintenance/all'),
                    api.get('/assets'),
                ]);
                if (logsRes.data.success) setLogs(logsRes.data.data);
                if (assetsRes.data.success) setAllAssets(assetsRes.data.data);
            } catch (err) {
                toast.error('Error fetching maintenance data');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const totalCost = logs.reduce((s, l) => s + (l.cost || 0), 0);
    const assetsWithLogs = [...new Set(logs.map(l => l.assetId))].length;

    const filtered = logs.filter(l => {
        if (search && !l.assetName?.toLowerCase().includes(search.toLowerCase()) && !l.description?.toLowerCase().includes(search.toLowerCase())) return false;
        if (filterType && l.type !== filterType) return false;
        if (filterAsset && l.assetId !== filterAsset) return false;
        return true;
    });

    // Group by month for timeline
    const grouped = filtered.reduce((acc, log) => {
        const monthKey = log.date
            ? new Date(log.date).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
            : 'Unknown Date';
        if (!acc[monthKey]) acc[monthKey] = [];
        acc[monthKey].push(log);
        return acc;
    }, {});

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center h-full min-h-[400px] gap-3">
                <div className="w-10 h-10 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                <p className="text-sm text-slate-400">Loading maintenance history…</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Maintenance Logs</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Complete service history across all assets</p>
                </div>
            </div>

            {/* Summary chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'Total Entries', value: logs.length, accent: '#6366f1' },
                    { label: 'Assets Serviced', value: assetsWithLogs, accent: '#0ea5e9' },
                    { label: 'Total Spend', value: fmt(totalCost), accent: '#f59e0b' },
                    { label: 'Avg Cost / Service', value: fmt(logs.length ? totalCost / logs.length : 0), accent: '#10b981' },
                ].map(({ label, value, accent }) => (
                    <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <p className="text-xs text-slate-500 mb-1">{label}</p>
                        <p className="text-xl font-extrabold" style={{ fontFamily: 'Outfit, sans-serif', color: accent }}>{value}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[180px]">
                    <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" placeholder="Search logs…" value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                </div>
                <select value={filterType} onChange={e => setFilterType(e.target.value)} className="py-2 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">All Types</option>
                    {['Preventive','Corrective','Inspection','Upgrade','Other'].map(t => <option key={t}>{t}</option>)}
                </select>
                <select value={filterAsset} onChange={e => setFilterAsset(e.target.value)} className="py-2 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">All Assets</option>
                    {allAssets.map(a => <option key={a._id} value={a._id}>{a.assetTag ? `${a.assetTag} — ` : ''}{a.name}</option>)}
                </select>
                {(search || filterType || filterAsset) && (
                    <button onClick={() => { setSearch(''); setFilterType(''); setFilterAsset(''); }}
                        className="text-xs font-semibold text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors">Clear</button>
                )}
                <span className="ml-auto text-xs text-slate-400 font-medium">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Timeline */}
            {filtered.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-20 text-center">
                    <svg className="mx-auto mb-3 text-slate-300" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                    <p className="text-slate-500 font-semibold">No maintenance logs found</p>
                    <p className="text-sm text-slate-400 mt-1">Add logs from the Asset detail drawer in Manage Assets</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {Object.entries(grouped).map(([month, monthLogs]) => (
                        <div key={month}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-px flex-1 bg-gray-100" />
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest px-3 py-1 bg-slate-100 rounded-full">{month}</span>
                                <div className="h-px flex-1 bg-gray-100" />
                            </div>
                            <div className="space-y-3">
                                {monthLogs.map((log, i) => {
                                    const typeColor = MAINT_TYPE_COLORS[log.type] || MAINT_TYPE_COLORS.Other;
                                    return (
                                        <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-start gap-4 hover:shadow-md transition-shadow">
                                            {/* Left accent */}
                                            <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-1">
                                                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: typeColor.bg }}>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={typeColor.text} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                                                    </svg>
                                                </div>
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: typeColor.bg, color: typeColor.text }}>{log.type || 'Other'}</span>
                                                    <span className="font-mono text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">{log.assetTag || '—'}</span>
                                                    <span className="text-xs font-semibold text-slate-700">{log.assetName}</span>
                                                    {log.assetCategory && <span className="text-xs text-slate-400">{log.assetCategory}</span>}
                                                </div>
                                                <p className="text-sm font-semibold text-slate-800 mb-2">{log.description}</p>
                                                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                                                    <span className="flex items-center gap-1">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                                        {fmtDate(log.date)}
                                                    </span>
                                                    {log.performedBy && (
                                                        <span className="flex items-center gap-1">
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                                            {log.performedBy}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Cost */}
                                            {log.cost > 0 && (
                                                <div className="flex-shrink-0 text-right">
                                                    <p className="text-base font-extrabold text-amber-600" style={{ fontFamily: 'Outfit, sans-serif' }}>{fmt(log.cost)}</p>
                                                    <p className="text-xs text-slate-400">service cost</p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AssetMaintenance;
