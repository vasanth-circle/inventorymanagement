import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const STATUS_COLORS = {
    Available:    { bg: '#dcfce7', text: '#15803d', dot: '#22c55e' },
    Assigned:     { bg: '#dbeafe', text: '#1d4ed8', dot: '#3b82f6' },
    'In Service': { bg: '#fef9c3', text: '#a16207', dot: '#eab308' },
    Returned:     { bg: '#f3e8ff', text: '#7e22ce', dot: '#a855f7' },
    Retired:      { bg: '#fee2e2', text: '#b91c1c', dot: '#ef4444' },
};

const StatusBadge = ({ status }) => {
    const c = STATUS_COLORS[status] || { bg: '#f1f5f9', text: '#475569', dot: '#94a3b8' };
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: c.bg, color: c.text }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.dot }} />
            {status}
        </span>
    );
};

const SummaryCard = ({ label, value, sub, accent }) => (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <p className="text-xs text-slate-500 font-medium mb-1">{label}</p>
        <p className="text-2xl font-extrabold leading-tight" style={{ fontFamily: 'Outfit, sans-serif', color: accent || '#1e293b' }}>{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
);

const AssetReports = () => {
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterType, setFilterType] = useState('');

    useEffect(() => {
        const fetchAssets = async () => {
            try {
                const { data } = await api.get('/assets');
                if (data.success) setAssets(data.data);
            } catch (error) {
                toast.error(error.response?.data?.message || 'Error fetching assets');
            } finally {
                setLoading(false);
            }
        };
        fetchAssets();
    }, []);

    // ── Derived stats ─────────────────────────────────────────────────────────
    const totalPurchaseValue = assets.reduce((s, a) => s + (a.purchaseCost || 0), 0);
    const totalCurrentValue  = assets.reduce((s, a) => s + (a.currentValue || a.purchaseCost || 0), 0);
    const totalMaintCost     = assets.reduce((s, a) => s + (a.maintenanceLogs || []).reduce((ms, l) => ms + (l.cost || 0), 0), 0);
    const totalTCO           = totalPurchaseValue + totalMaintCost;
    const avgValue           = assets.length ? totalCurrentValue / assets.length : 0;

    // ── Filtered table data ───────────────────────────────────────────────────
    const filtered = assets.filter(a => {
        if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !(a.assetTag || '').toLowerCase().includes(search.toLowerCase())) return false;
        if (filterStatus && a.status !== filterStatus) return false;
        if (filterType && a.assetType !== filterType) return false;
        return true;
    });

    // ── Maintenance cost per asset (for bottom table) ─────────────────────────
    const maintSummary = assets
        .map(a => ({
            id: a._id,
            tag: a.assetTag,
            name: a.name,
            category: a.category || a.assetType,
            logs: a.maintenanceLogs?.length || 0,
            cost: (a.maintenanceLogs || []).reduce((s, l) => s + (l.cost || 0), 0),
        }))
        .filter(x => x.logs > 0)
        .sort((a, b) => b.cost - a.cost);

    // ── CSV export ────────────────────────────────────────────────────────────
    const handleExport = () => {
        const headers = ['Asset Tag', 'Name', 'Type', 'Category', 'Make', 'Model', 'Condition', 'Serial No.', 'Location', 'Assignee', 'Status', 'Purchase Date', 'Purchase Cost', 'Current Value', 'Depreciation %', 'Warranty Expiry', 'Maintenance Logs', 'Maintenance Cost', 'Vendor'];
        const rows = assets.map(a => [
            a.assetTag || '',
            `"${a.name}"`,
            a.assetType,
            a.category || '',
            a.make || '',
            a.model || '',
            a.condition || '',
            a.serialNumber || (a.insuranceData?.policyNumber || ''),
            a.branch?.name || '',
            a.assignee?.name || 'Unassigned',
            a.status,
            a.purchaseDate ? new Date(a.purchaseDate).toLocaleDateString() : '',
            a.purchaseCost || 0,
            a.currentValue || a.purchaseCost || 0,
            a.depreciationRate || 0,
            a.warrantyExpiry ? new Date(a.warrantyExpiry).toLocaleDateString() : '',
            a.maintenanceLogs?.length || 0,
            (a.maintenanceLogs || []).reduce((s, l) => s + (l.cost || 0), 0),
            a.vendor || '',
        ]);
        const csv = 'data:text/csv;charset=utf-8,' + headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
        const link = document.createElement('a');
        link.setAttribute('href', encodeURI(csv));
        link.setAttribute('download', `AssetReport_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Report exported');
    };

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center h-full min-h-[400px] gap-3">
                <div className="w-10 h-10 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                <p className="text-sm text-slate-400">Loading report data…</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Asset Reports</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Complete financial and operational asset analysis</p>
                </div>
                <button onClick={handleExport}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Export CSV
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <SummaryCard label="Total Assets" value={assets.length} sub="All registered" accent="#6366f1" />
                <SummaryCard label="Purchase Value" value={fmt(totalPurchaseValue)} sub="Cumulative spend" accent="#0ea5e9" />
                <SummaryCard label="Current Value" value={fmt(totalCurrentValue)} sub="Book value today" accent="#10b981" />
                <SummaryCard label="Maintenance Cost" value={fmt(totalMaintCost)} sub="Total service spend" accent="#f59e0b" />
                <SummaryCard label="Total Cost of Ownership" value={fmt(totalTCO)} sub={`Avg: ${fmt(avgValue)}/asset`} accent="#7c3aed" />
            </div>

            {/* Status breakdown chips */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h2 className="text-sm font-bold text-slate-800 mb-4">Status Breakdown</h2>
                <div className="flex flex-wrap gap-3">
                    {Object.entries(STATUS_COLORS).map(([status, c]) => {
                        const count = assets.filter(a => a.status === status).length;
                        return (
                            <div key={status} className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border" style={{ backgroundColor: c.bg + '80', borderColor: c.dot + '40' }}>
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.dot }} />
                                <span className="text-sm font-semibold" style={{ color: c.text }}>{status}</span>
                                <span className="text-xl font-extrabold" style={{ color: c.text, fontFamily: 'Outfit, sans-serif' }}>{count}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Full Asset Directory */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
                    <div>
                        <h2 className="text-sm font-bold text-slate-800">Complete Asset Directory</h2>
                        <p className="text-xs text-slate-400">{filtered.length} of {assets.length} assets shown</p>
                    </div>
                    <div className="ml-auto flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
                                className="pl-8 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-40" />
                        </div>
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="py-1.5 px-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            <option value="">All Statuses</option>
                            {['Available','Assigned','In Service','Returned','Retired'].map(s => <option key={s}>{s}</option>)}
                        </select>
                        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="py-1.5 px-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            <option value="">All Types</option>
                            {['System','Vehicle','Furniture','Networking','Other'].map(t => <option key={t}>{t}</option>)}
                        </select>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                            <tr className="border-b border-gray-100 bg-slate-50">
                                {['Tag','Asset Name','Type','Category','Location','Assignee','Purchase Cost','Current Value','Maint. Cost','Warranty','Status'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan="11" className="px-4 py-12 text-center text-slate-400 text-sm">No assets match filters</td></tr>
                            ) : filtered.map(asset => {
                                const assetMaintCost = (asset.maintenanceLogs || []).reduce((s, l) => s + (l.cost || 0), 0);
                                const warrantyDays = asset.warrantyExpiry ? Math.ceil((new Date(asset.warrantyExpiry) - new Date()) / 86400000) : null;
                                return (
                                    <tr key={asset._id} className="border-b border-gray-50 hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <span className="font-mono text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">{asset.assetTag || '—'}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-semibold text-slate-800 text-sm">{asset.name}</p>
                                            {(asset.make || asset.model) && <p className="text-xs text-slate-400">{[asset.make, asset.model].filter(Boolean).join(' · ')}</p>}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-600">{asset.assetType}</td>
                                        <td className="px-4 py-3 text-xs text-slate-600">{asset.category || '—'}</td>
                                        <td className="px-4 py-3 text-xs text-slate-600">{asset.branch?.name || '—'}</td>
                                        <td className="px-4 py-3 text-xs text-slate-600">{asset.assignee?.name || <span className="text-slate-300 italic">Unassigned</span>}</td>
                                        <td className="px-4 py-3 text-sm font-semibold text-slate-700">{asset.purchaseCost > 0 ? fmt(asset.purchaseCost) : '—'}</td>
                                        <td className="px-4 py-3 text-sm font-bold text-emerald-600">{asset.currentValue > 0 ? fmt(asset.currentValue) : '—'}</td>
                                        <td className="px-4 py-3 text-sm font-semibold text-amber-600">{assetMaintCost > 0 ? fmt(assetMaintCost) : '—'}</td>
                                        <td className="px-4 py-3">
                                            {asset.warrantyExpiry ? (
                                                <span className={`text-xs font-semibold ${warrantyDays !== null && warrantyDays <= 30 ? 'text-red-600' : 'text-slate-600'}`}>
                                                    {warrantyDays !== null && warrantyDays <= 30 ? '⚠ ' : ''}{fmtDate(asset.warrantyExpiry)}
                                                </span>
                                            ) : <span className="text-slate-300 text-xs">—</span>}
                                        </td>
                                        <td className="px-4 py-3"><StatusBadge status={asset.status} /></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Maintenance Cost Summary */}
            {maintSummary.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h2 className="text-sm font-bold text-slate-800">Maintenance Cost by Asset</h2>
                        <p className="text-xs text-slate-400 mt-0.5">Assets with at least one maintenance log</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead>
                                <tr className="border-b border-gray-100 bg-slate-50">
                                    {['Rank','Tag','Asset','Category','Logs','Total Cost'].map(h => (
                                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {maintSummary.map((item, i) => (
                                    <tr key={item.id} className="border-b border-gray-50 hover:bg-slate-50 transition-colors">
                                        <td className="px-5 py-3">
                                            <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-100 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-slate-50 text-slate-400'}`}>
                                                {i + 1}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className="font-mono text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">{item.tag || '—'}</span>
                                        </td>
                                        <td className="px-5 py-3 text-sm font-semibold text-slate-800">{item.name}</td>
                                        <td className="px-5 py-3 text-xs text-slate-500">{item.category}</td>
                                        <td className="px-5 py-3">
                                            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">{item.logs} log{item.logs > 1 ? 's' : ''}</span>
                                        </td>
                                        <td className="px-5 py-3 text-base font-extrabold text-amber-600" style={{ fontFamily: 'Outfit, sans-serif' }}>{fmt(item.cost)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssetReports;
