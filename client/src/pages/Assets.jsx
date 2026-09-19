import { useState, useEffect, useContext, useCallback } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { confirmDelete } from '../utils/confirmHelper.jsx';
import { AuthContext } from '../context/AuthContext';
import { InventoryContext } from '../context/InventoryContext';

// ─── Constants ────────────────────────────────────────────────────────────────
const ASSET_TYPES = ['System', 'Vehicle', 'Furniture', 'Networking', 'Other'];
const CATEGORIES = {
    System: ['Laptop', 'Desktop', 'Server', 'Printer', 'Projector', 'Tablet', 'Phone', 'Other'],
    Vehicle: ['Car', 'Truck', 'Bike', 'Other'],
    Furniture: ['Chair', 'Desk', 'Cabinet', 'Other'],
    Networking: ['Router', 'Switch', 'Other'],
    Other: ['Other'],
};
const STATUSES = ['Available', 'Assigned', 'In Service', 'Returned', 'Retired'];
const CONDITIONS = ['Excellent', 'Good', 'Fair', 'Poor'];
const MAINTENANCE_TYPES = ['Preventive', 'Corrective', 'Inspection', 'Upgrade', 'Other'];

const STATUS_COLORS = {
    Available:    { bg: '#dcfce7', text: '#15803d', dot: '#22c55e' },
    Assigned:     { bg: '#dbeafe', text: '#1d4ed8', dot: '#3b82f6' },
    'In Service': { bg: '#fef9c3', text: '#a16207', dot: '#eab308' },
    Returned:     { bg: '#f3e8ff', text: '#7e22ce', dot: '#a855f7' },
    Retired:      { bg: '#fee2e2', text: '#b91c1c', dot: '#ef4444' },
};

const CONDITION_COLORS = {
    Excellent: '#10b981', Good: '#6366f1', Fair: '#f59e0b', Poor: '#ef4444',
};

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const daysUntil = (d) => Math.ceil((new Date(d) - new Date()) / (1000 * 60 * 60 * 24));

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

// ─── Asset Type Icon ──────────────────────────────────────────────────────────
const TypeIcon = ({ type, size = 18 }) => {
    const icons = {
        System: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><polyline points="8 21 12 17 16 21"/></svg>,
        Vehicle: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-1"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>,
        Furniture: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/><rect x="2" y="9" width="20" height="3" rx="1"/><path d="M4 12v5"/><path d="M20 12v5"/><path d="M7 17h10"/></svg>,
        Networking: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="4" rx="1"/><rect x="1" y="18" width="6" height="4" rx="1"/><rect x="17" y="18" width="6" height="4" rx="1"/><path d="M12 6v4M4 18v-4h16v4"/></svg>,
        Other: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>,
    };
    return icons[type] || icons.Other;
};

// ─── Form Field ───────────────────────────────────────────────────────────────
const Field = ({ label, required, children }) => (
    <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {children}
    </div>
);

const inputCls = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all";
const selectCls = inputCls;

// ─── Asset Card View ──────────────────────────────────────────────────────────
const AssetCard = ({ asset, onEdit, onDelete, onViewDetail }) => {
    const warrantyDays = asset.warrantyExpiry ? daysUntil(asset.warrantyExpiry) : null;
    const isWarrantyAlert = warrantyDays !== null && warrantyDays <= 30 && warrantyDays >= 0;

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group">
            {/* Card Header */}
            <div className="p-4 pb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-50 text-indigo-600 flex-shrink-0">
                        <TypeIcon type={asset.assetType} size={20} />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">{asset.assetTag || '—'}</span>
                            {isWarrantyAlert && <span className="text-xs text-amber-600 font-bold">⚠</span>}
                        </div>
                        <p className="font-bold text-slate-800 text-sm mt-0.5 truncate max-w-[160px]">{asset.name}</p>
                    </div>
                </div>
                <StatusBadge status={asset.status} />
            </div>

            {/* Details */}
            <div className="px-4 pb-3 space-y-1.5">
                {(asset.make || asset.model) && (
                    <p className="text-xs text-slate-500">{[asset.make, asset.model].filter(Boolean).join(' · ')}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>📍 {asset.branch?.name || '—'}</span>
                    <span>📂 {asset.category || asset.assetType}</span>
                </div>
                {asset.assignee ? (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                            {asset.assignee.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <span>{asset.assignee.name}</span>
                    </div>
                ) : (
                    <p className="text-xs text-slate-300 italic">Unassigned</p>
                )}
                {asset.purchaseCost > 0 && (
                    <p className="text-xs font-semibold text-emerald-600">{fmt(asset.currentValue || asset.purchaseCost)}</p>
                )}
                {(asset.maintenanceLogs?.length > 0) && (
                    <p className="text-xs text-amber-600">{asset.maintenanceLogs.length} maintenance log{asset.maintenanceLogs.length > 1 ? 's' : ''}</p>
                )}
            </div>

            {/* Condition bar */}
            <div className="px-4 pb-3">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">Condition:</span>
                    <span className="text-[10px] font-bold" style={{ color: CONDITION_COLORS[asset.condition] || '#6366f1' }}>{asset.condition || 'Good'}</span>
                </div>
            </div>

            {/* Actions */}
            <div className="px-4 py-2.5 bg-slate-50 border-t border-gray-100 flex items-center gap-2">
                <button onClick={() => onViewDetail(asset)} className="flex-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 py-1 transition-colors">View Details</button>
                <button onClick={() => onEdit(asset)} className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100 transition-colors">Edit</button>
                <button onClick={() => onDelete(asset._id)} className="text-xs font-semibold text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors">Delete</button>
            </div>
        </div>
    );
};

// ─── Detail Drawer ────────────────────────────────────────────────────────────
const DetailDrawer = ({ asset, onClose, onEdit, onMaintenanceAdded }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [mForm, setMForm] = useState({ date: new Date().toISOString().split('T')[0], description: '', cost: '', performedBy: '', type: 'Other' });
    const [addingMaint, setAddingMaint] = useState(false);

    const handleAddMaintenance = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/assets/${asset._id}/maintenance`, mForm);
            toast.success('Maintenance log added');
            setMForm({ date: new Date().toISOString().split('T')[0], description: '', cost: '', performedBy: '', type: 'Other' });
            setAddingMaint(false);
            onMaintenanceAdded();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error adding log');
        }
    };

    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'maintenance', label: `Logs (${asset.maintenanceLogs?.length || 0})` },
        { id: 'financial', label: 'Financial' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-slide-in-right overflow-hidden" style={{ animation: 'slideInRight 0.25s ease-out' }}>
                {/* Drawer Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                            <TypeIcon type={asset.assetType} size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-indigo-500">{asset.assetTag || '—'}</span>
                                <StatusBadge status={asset.status} />
                            </div>
                            <p className="font-bold text-slate-900 text-sm">{asset.name}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => onEdit(asset)} className="text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">Edit</button>
                        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-slate-500 transition-colors">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100 px-6">
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={`text-xs font-semibold py-3 px-1 mr-5 border-b-2 transition-colors ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Drawer Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {activeTab === 'overview' && (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: 'Type', value: asset.assetType },
                                    { label: 'Category', value: asset.category || '—' },
                                    { label: 'Make', value: asset.make || '—' },
                                    { label: 'Model', value: asset.model || '—' },
                                    { label: 'Condition', value: <span style={{ color: CONDITION_COLORS[asset.condition] }} className="font-bold">{asset.condition || '—'}</span> },
                                    { label: 'Location', value: asset.branch?.name || '—' },
                                    { label: 'Assignee', value: asset.assignee?.name || 'Unassigned' },
                                    { label: 'Added By', value: asset.createdBy?.name || '—' },
                                ].map(({ label, value }) => (
                                    <div key={label} className="bg-slate-50 rounded-lg p-3">
                                        <p className="text-xs text-slate-400 mb-1">{label}</p>
                                        <p className="text-sm font-semibold text-slate-800">{value}</p>
                                    </div>
                                ))}
                            </div>
                            {asset.serialNumber && (
                                <div className="bg-slate-50 rounded-lg p-3">
                                    <p className="text-xs text-slate-400 mb-1">Serial Number</p>
                                    <p className="text-sm font-mono font-bold text-slate-800">{asset.serialNumber}</p>
                                </div>
                            )}
                            {asset.warrantyExpiry && (
                                <div className={`rounded-lg p-3 ${daysUntil(asset.warrantyExpiry) <= 30 ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'}`}>
                                    <p className="text-xs text-slate-400 mb-1">Warranty Expiry</p>
                                    <p className="text-sm font-semibold text-slate-800">{fmtDate(asset.warrantyExpiry)}</p>
                                    {daysUntil(asset.warrantyExpiry) <= 30 && <p className="text-xs text-amber-600 font-bold mt-1">⚠ Expires in {daysUntil(asset.warrantyExpiry)} days</p>}
                                </div>
                            )}
                            {asset.assetType === 'Vehicle' && asset.insuranceData?.policyNumber && (
                                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-2">
                                    <p className="text-xs font-bold text-blue-800">Insurance Details</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div><p className="text-xs text-slate-400">Provider</p><p className="text-sm font-semibold text-slate-700">{asset.insuranceData.provider || '—'}</p></div>
                                        <div><p className="text-xs text-slate-400">Policy No.</p><p className="text-sm font-semibold text-slate-700">{asset.insuranceData.policyNumber}</p></div>
                                        <div><p className="text-xs text-slate-400">Expiry</p><p className="text-sm font-semibold text-slate-700">{fmtDate(asset.insuranceData.expiryDate)}</p></div>
                                    </div>
                                </div>
                            )}
                            {asset.notes && (
                                <div className="bg-slate-50 rounded-lg p-3">
                                    <p className="text-xs text-slate-400 mb-1">Notes</p>
                                    <p className="text-sm text-slate-700">{asset.notes}</p>
                                </div>
                            )}
                            <div className="text-xs text-slate-400">
                                Registered on {fmtDate(asset.createdAt)}
                            </div>
                        </>
                    )}

                    {activeTab === 'maintenance' && (
                        <>
                            <button onClick={() => setAddingMaint(!addingMaint)}
                                className="w-full py-2 text-sm font-semibold text-indigo-600 border-2 border-dashed border-indigo-200 rounded-xl hover:bg-indigo-50 transition-colors">
                                {addingMaint ? '✕ Cancel' : '+ Add Maintenance Log'}
                            </button>

                            {addingMaint && (
                                <form onSubmit={handleAddMaintenance} className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label="Date" required>
                                            <input type="date" value={mForm.date} onChange={e => setMForm({ ...mForm, date: e.target.value })} className={inputCls} required />
                                        </Field>
                                        <Field label="Type">
                                            <select value={mForm.type} onChange={e => setMForm({ ...mForm, type: e.target.value })} className={selectCls}>
                                                {MAINTENANCE_TYPES.map(t => <option key={t}>{t}</option>)}
                                            </select>
                                        </Field>
                                    </div>
                                    <Field label="Description" required>
                                        <input type="text" value={mForm.description} onChange={e => setMForm({ ...mForm, description: e.target.value })} className={inputCls} placeholder="What was done?" required />
                                    </Field>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label="Cost (₹)">
                                            <input type="number" value={mForm.cost} onChange={e => setMForm({ ...mForm, cost: e.target.value })} className={inputCls} placeholder="0" min="0" />
                                        </Field>
                                        <Field label="Performed By">
                                            <input type="text" value={mForm.performedBy} onChange={e => setMForm({ ...mForm, performedBy: e.target.value })} className={inputCls} placeholder="Vendor / tech name" />
                                        </Field>
                                    </div>
                                    <button type="submit" className="w-full py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors">Save Log</button>
                                </form>
                            )}

                            {(asset.maintenanceLogs || []).length === 0 ? (
                                <div className="text-center py-8 text-slate-400">
                                    <svg className="mx-auto mb-2 opacity-30" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                                    <p className="text-sm">No maintenance logs yet</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {asset.maintenanceLogs.map((log, i) => (
                                        <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{log.type}</span>
                                                    <p className="font-semibold text-slate-800 text-sm mt-1">{log.description}</p>
                                                </div>
                                                {log.cost > 0 && <span className="text-sm font-bold text-emerald-600">{fmt(log.cost)}</span>}
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-slate-400">
                                                <span>📅 {fmtDate(log.date)}</span>
                                                {log.performedBy && <span>👤 {log.performedBy}</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {activeTab === 'financial' && (
                        <div className="space-y-3">
                            {[
                                { label: 'Purchase Date', value: fmtDate(asset.purchaseDate) },
                                { label: 'Purchase Cost', value: fmt(asset.purchaseCost), highlight: true },
                                { label: 'Current Value', value: fmt(asset.currentValue), highlight: true, color: '#10b981' },
                                { label: 'Depreciation Rate', value: asset.depreciationRate ? `${asset.depreciationRate}% / year` : '—' },
                                { label: 'Vendor / Supplier', value: asset.vendor || '—' },
                                { label: 'Total Maintenance Cost', value: fmt((asset.maintenanceLogs || []).reduce((s, l) => s + (l.cost || 0), 0)), color: '#f59e0b' },
                            ].map(({ label, value, highlight, color }) => (
                                <div key={label} className={`rounded-lg p-4 ${highlight ? 'bg-indigo-50 border border-indigo-100' : 'bg-slate-50'}`}>
                                    <p className="text-xs text-slate-400 mb-1">{label}</p>
                                    <p className="text-base font-bold" style={{ color: color || (highlight ? '#4f46e5' : '#1e293b') }}>{value}</p>
                                </div>
                            ))}
                            <div className="bg-slate-50 rounded-lg p-4">
                                <p className="text-xs text-slate-400 mb-1">Total Cost of Ownership</p>
                                <p className="text-base font-bold text-slate-800">
                                    {fmt((asset.purchaseCost || 0) + (asset.maintenanceLogs || []).reduce((s, l) => s + (l.cost || 0), 0))}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Default Form Data ─────────────────────────────────────────────────────────
const defaultForm = () => ({
    name: '', assetType: 'System', category: 'Laptop',
    make: '', model: '', condition: 'Good',
    serialNumber: '', branch: '', assignee: '', status: 'Available', notes: '',
    purchaseDate: '', purchaseCost: '', currentValue: '', depreciationRate: '', vendor: '',
    warrantyExpiry: '',
    insuranceData: { policyNumber: '', provider: '', expiryDate: '' }
});

// ─── Main Component ───────────────────────────────────────────────────────────
const Assets = () => {
    const { user } = useContext(AuthContext);
    const { assetLocations, fetchAssetLocations } = useContext(InventoryContext);

    const [assets, setAssets] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('table'); // 'table' | 'card'
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState(null);
    const [detailAsset, setDetailAsset] = useState(null);
    const [formData, setFormData] = useState(defaultForm());

    // Filters
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterCategory, setFilterCategory] = useState('');

    useEffect(() => {
        fetchAssets();
        fetchUsers();
        fetchAssetLocations();
    }, []);

    const fetchAssets = useCallback(async () => {
        try {
            const { data } = await api.get('/assets');
            setAssets(data.data);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error fetching assets');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await api.get('/auth/users');
            if (res.data?.success) setUsers(res.data.data || []);
        } catch (error) {
            console.error('Error fetching users', error);
        }
    };

    // Derived: filtered assets
    const filteredAssets = assets.filter(a => {
        if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !(a.assetTag || '').toLowerCase().includes(search.toLowerCase())) return false;
        if (filterType && a.assetType !== filterType) return false;
        if (filterStatus && a.status !== filterStatus) return false;
        if (filterCategory && a.category !== filterCategory) return false;
        return true;
    });

    const handleOpenModal = (asset = null) => {
        if (asset) {
            setEditingAsset(asset);
            setFormData({
                name: asset.name,
                assetType: asset.assetType,
                category: asset.category || 'Other',
                make: asset.make || '',
                model: asset.model || '',
                condition: asset.condition || 'Good',
                serialNumber: asset.serialNumber || '',
                branch: asset.branch?._id || asset.branch || '',
                assignee: asset.assignee?._id || asset.assignee || '',
                status: asset.status || 'Available',
                notes: asset.notes || '',
                purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().split('T')[0] : '',
                purchaseCost: asset.purchaseCost || '',
                currentValue: asset.currentValue || '',
                depreciationRate: asset.depreciationRate || '',
                vendor: asset.vendor || '',
                warrantyExpiry: asset.warrantyExpiry ? new Date(asset.warrantyExpiry).toISOString().split('T')[0] : '',
                insuranceData: {
                    policyNumber: asset.insuranceData?.policyNumber || '',
                    provider: asset.insuranceData?.provider || '',
                    expiryDate: asset.insuranceData?.expiryDate ? new Date(asset.insuranceData.expiryDate).toISOString().split('T')[0] : ''
                }
            });
        } else {
            setEditingAsset(null);
            setFormData({ ...defaultForm(), branch: assetLocations.length > 0 ? assetLocations[0]._id : '' });
        }
        setIsModalOpen(true);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name.startsWith('insuranceData.')) {
            const key = name.split('.')[1];
            setFormData(prev => ({ ...prev, insuranceData: { ...prev.insuranceData, [key]: value } }));
        } else if (name === 'assetType') {
            const defaultCat = (CATEGORIES[value] || ['Other'])[0];
            setFormData(prev => ({ ...prev, [name]: value, category: defaultCat }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...formData, assignee: formData.assignee || null };
            if (editingAsset) {
                await api.put(`/assets/${editingAsset._id}`, payload);
                toast.success('Asset updated successfully');
            } else {
                await api.post('/assets', payload);
                toast.success('Asset created successfully');
            }
            fetchAssets();
            setIsModalOpen(false);
            setEditingAsset(null);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error saving asset');
        }
    };

    const handleDelete = async (id) => {
        const confirmed = await confirmDelete('Are you sure you want to delete this asset?');
        if (confirmed) {
            try {
                await api.delete(`/assets/${id}`);
                toast.success('Asset deleted');
                fetchAssets();
            } catch (error) {
                toast.error(error.response?.data?.message || 'Error deleting asset');
            }
        }
    };

    const handleMaintenanceAdded = async () => {
        await fetchAssets();
        // refresh detail asset
        if (detailAsset) {
            const refreshed = await api.get(`/assets/${detailAsset._id}`);
            if (refreshed.data?.success) setDetailAsset(refreshed.data.data);
        }
    };

    const categoriesForType = CATEGORIES[formData.assetType] || ['Other'];

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Asset Management</h1>
                    <p className="text-sm text-slate-500">{assets.length} total assets registered</p>
                </div>
                <button onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 shadow-sm transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add New Asset
                </button>
            </div>

            {/* Filters Bar */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[180px] relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" placeholder="Search by name or tag…" value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                </div>
                <select value={filterType} onChange={e => setFilterType(e.target.value)} className="py-2 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">All Types</option>
                    {ASSET_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="py-2 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">All Statuses</option>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="py-2 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">All Categories</option>
                    {Object.values(CATEGORIES).flat().filter((v, i, a) => a.indexOf(v) === i).map(c => <option key={c}>{c}</option>)}
                </select>
                {(search || filterType || filterStatus || filterCategory) && (
                    <button onClick={() => { setSearch(''); setFilterType(''); setFilterStatus(''); setFilterCategory(''); }}
                        className="text-xs font-semibold text-red-500 hover:text-red-700 px-2 py-1.5 rounded hover:bg-red-50 transition-colors">Clear</button>
                )}
                <div className="ml-auto flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                    {[{ mode: 'table', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> },
                     { mode: 'card', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> }
                    ].map(({ mode, icon }) => (
                        <button key={mode} onClick={() => setViewMode(mode)}
                            className={`p-1.5 rounded-md transition-colors ${viewMode === mode ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
                            {icon}
                        </button>
                    ))}
                </div>
                <span className="text-xs text-slate-400 font-medium">{filteredAssets.length} result{filteredAssets.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Asset List — Table View */}
            {viewMode === 'table' && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead>
                                <tr className="border-b border-gray-100 bg-slate-50">
                                    {['Tag', 'Asset', 'Category', 'Location / Assignee', 'Condition', 'Value', 'Status', 'Actions'].map(h => (
                                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="8" className="px-5 py-16 text-center">
                                        <div className="flex flex-col items-center gap-2 text-slate-400">
                                            <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                                            <span className="text-sm">Loading assets…</span>
                                        </div>
                                    </td></tr>
                                ) : filteredAssets.length === 0 ? (
                                    <tr><td colSpan="8" className="px-5 py-16 text-center">
                                        <div className="flex flex-col items-center gap-2 text-slate-400">
                                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                                            <p className="text-sm font-medium">{search || filterType || filterStatus ? 'No assets match filters' : 'No assets yet'}</p>
                                            {!search && !filterType && !filterStatus && (
                                                <button onClick={() => handleOpenModal()} className="text-xs text-indigo-600 font-semibold hover:underline">+ Add first asset</button>
                                            )}
                                        </div>
                                    </td></tr>
                                ) : filteredAssets.map(asset => (
                                    <tr key={asset._id} className="border-b border-gray-50 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setDetailAsset(asset)}>
                                        <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                                            <span className="font-mono text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded">{asset.assetTag || '—'}</span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                                                    <TypeIcon type={asset.assetType} size={16} />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-800 text-sm">{asset.name}</p>
                                                    {(asset.make || asset.model) && <p className="text-xs text-slate-400">{[asset.make, asset.model].filter(Boolean).join(' · ')}</p>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-xs text-slate-600">{asset.category || asset.assetType}</td>
                                        <td className="px-5 py-3.5">
                                            <p className="text-xs text-slate-700">📍 {asset.branch?.name || '—'}</p>
                                            <p className="text-xs text-slate-400">{asset.assignee?.name || <span className="italic">Unassigned</span>}</p>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className="text-xs font-semibold" style={{ color: CONDITION_COLORS[asset.condition] || '#6366f1' }}>{asset.condition || '—'}</span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            {asset.purchaseCost > 0 ? (
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800">{fmt(asset.currentValue || asset.purchaseCost)}</p>
                                                    {asset.currentValue && asset.currentValue !== asset.purchaseCost && <p className="text-xs text-slate-400">Paid {fmt(asset.purchaseCost)}</p>}
                                                </div>
                                            ) : <span className="text-xs text-slate-300">—</span>}
                                        </td>
                                        <td className="px-5 py-3.5"><StatusBadge status={asset.status} /></td>
                                        <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => handleOpenModal(asset)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50 transition-colors">Edit</button>
                                                <button onClick={() => handleDelete(asset._id)} className="text-xs font-semibold text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors">Delete</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Card View */}
            {viewMode === 'card' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {loading ? (
                        Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 h-48 animate-pulse">
                                <div className="flex gap-3 mb-3"><div className="w-10 h-10 bg-slate-100 rounded-xl" /><div className="flex-1"><div className="h-3 bg-slate-100 rounded mb-2 w-16" /><div className="h-4 bg-slate-100 rounded w-32" /></div></div>
                                <div className="h-3 bg-slate-50 rounded mb-1.5 w-full" /><div className="h-3 bg-slate-50 rounded w-2/3" />
                            </div>
                        ))
                    ) : filteredAssets.length === 0 ? (
                        <div className="col-span-full text-center py-16 text-slate-400">
                            <p className="text-sm font-medium">No assets found</p>
                        </div>
                    ) : filteredAssets.map(asset => (
                        <AssetCard key={asset._id} asset={asset}
                            onEdit={handleOpenModal}
                            onDelete={handleDelete}
                            onViewDetail={setDetailAsset}
                        />
                    ))}
                </div>
            )}

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh] overflow-hidden">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-gray-100 bg-slate-50 flex items-center justify-between flex-shrink-0">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">{editingAsset ? 'Edit Asset' : 'Add New Asset'}</h2>
                                {editingAsset && <p className="text-xs text-slate-400 mt-0.5 font-mono">{editingAsset.assetTag}</p>}
                            </div>
                            <button onClick={() => { setIsModalOpen(false); setEditingAsset(null); }}
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-slate-500 transition-colors">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                            <div className="p-6 overflow-y-auto space-y-5">
                                {/* Identity */}
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Basic Info</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <Field label="Asset Name" required>
                                                <input type="text" name="name" required value={formData.name} onChange={handleChange} className={inputCls} placeholder="e.g. MacBook Pro M3" />
                                            </Field>
                                        </div>
                                        <Field label="Asset Type" required>
                                            <select name="assetType" required value={formData.assetType} onChange={handleChange} className={selectCls}>
                                                {ASSET_TYPES.map(t => <option key={t}>{t}</option>)}
                                            </select>
                                        </Field>
                                        <Field label="Category" required>
                                            <select name="category" value={formData.category} onChange={handleChange} className={selectCls}>
                                                {categoriesForType.map(c => <option key={c}>{c}</option>)}
                                            </select>
                                        </Field>
                                        <Field label="Make / Brand">
                                            <input type="text" name="make" value={formData.make} onChange={handleChange} className={inputCls} placeholder="e.g. Apple" />
                                        </Field>
                                        <Field label="Model">
                                            <input type="text" name="model" value={formData.model} onChange={handleChange} className={inputCls} placeholder="e.g. MacBook Pro 14-inch" />
                                        </Field>
                                        <Field label="Condition">
                                            <select name="condition" value={formData.condition} onChange={handleChange} className={selectCls}>
                                                {CONDITIONS.map(c => <option key={c}>{c}</option>)}
                                            </select>
                                        </Field>
                                        <Field label="Status">
                                            <select name="status" value={formData.status} onChange={handleChange} className={selectCls}>
                                                {STATUSES.map(s => <option key={s}>{s}</option>)}
                                            </select>
                                        </Field>
                                    </div>
                                </div>

                                {/* System fields */}
                                {(formData.assetType === 'System' || formData.assetType === 'Networking') && (
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">System Details</p>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="col-span-2">
                                                <Field label="Serial Number">
                                                    <input type="text" name="serialNumber" value={formData.serialNumber} onChange={handleChange} className={`${inputCls} font-mono`} placeholder="S/N XXXXXXX" />
                                                </Field>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Vehicle fields */}
                                {formData.assetType === 'Vehicle' && (
                                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                                        <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-3">Insurance Details</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <Field label="Policy Provider">
                                                <input type="text" name="insuranceData.provider" value={formData.insuranceData.provider} onChange={handleChange} className={inputCls} />
                                            </Field>
                                            <Field label="Policy Number">
                                                <input type="text" name="insuranceData.policyNumber" value={formData.insuranceData.policyNumber} onChange={handleChange} className={`${inputCls} font-mono`} />
                                            </Field>
                                            <div className="col-span-2">
                                                <Field label="Insurance Expiry Date">
                                                    <input type="date" name="insuranceData.expiryDate" value={formData.insuranceData.expiryDate} onChange={handleChange} className={inputCls} />
                                                </Field>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Assignment */}
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Assignment</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Field label="Branch / Location" required>
                                            <select name="branch" required value={formData.branch} onChange={handleChange} className={selectCls}>
                                                <option value="" disabled>Select Branch</option>
                                                {assetLocations.map(loc => <option key={loc._id} value={loc._id}>{loc.name}</option>)}
                                            </select>
                                        </Field>
                                        <Field label="Assignee">
                                            <select name="assignee" value={formData.assignee} onChange={handleChange} className={selectCls}>
                                                <option value="">— Unassigned —</option>
                                                {Array.isArray(users) && users.map(u => <option key={u._id} value={u._id}>{u.name} ({u.email})</option>)}
                                            </select>
                                        </Field>
                                    </div>
                                </div>

                                {/* Financial */}
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Financial Info</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Field label="Purchase Date">
                                            <input type="date" name="purchaseDate" value={formData.purchaseDate} onChange={handleChange} className={inputCls} />
                                        </Field>
                                        <Field label="Vendor / Supplier">
                                            <input type="text" name="vendor" value={formData.vendor} onChange={handleChange} className={inputCls} placeholder="Supplier name" />
                                        </Field>
                                        <Field label="Purchase Cost (₹)">
                                            <input type="number" name="purchaseCost" value={formData.purchaseCost} onChange={handleChange} className={inputCls} placeholder="0" min="0" />
                                        </Field>
                                        <Field label="Current Value (₹)">
                                            <input type="number" name="currentValue" value={formData.currentValue} onChange={handleChange} className={inputCls} placeholder="Same as purchase if new" min="0" />
                                        </Field>
                                        <Field label="Depreciation Rate (% / year)">
                                            <input type="number" name="depreciationRate" value={formData.depreciationRate} onChange={handleChange} className={inputCls} placeholder="0" min="0" max="100" />
                                        </Field>
                                        <Field label="Warranty Expiry">
                                            <input type="date" name="warrantyExpiry" value={formData.warrantyExpiry} onChange={handleChange} className={inputCls} />
                                        </Field>
                                    </div>
                                </div>

                                {/* Notes */}
                                <Field label="Notes / Remarks">
                                    <textarea name="notes" rows="2" value={formData.notes} onChange={handleChange} className={inputCls} placeholder="Any additional information…" />
                                </Field>
                            </div>

                            <div className="px-6 py-4 bg-slate-50 border-t border-gray-100 flex gap-3 flex-shrink-0">
                                <button type="submit" className="flex-1 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
                                    {editingAsset ? 'Save Changes' : 'Create Asset'}
                                </button>
                                <button type="button" onClick={() => { setIsModalOpen(false); setEditingAsset(null); }}
                                    className="flex-1 py-2.5 bg-white text-slate-700 text-sm font-semibold border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Detail Drawer */}
            {detailAsset && (
                <DetailDrawer
                    asset={detailAsset}
                    onClose={() => setDetailAsset(null)}
                    onEdit={(a) => { setDetailAsset(null); handleOpenModal(a); }}
                    onMaintenanceAdded={handleMaintenanceAdded}
                />
            )}
        </div>
    );
};

export default Assets;
