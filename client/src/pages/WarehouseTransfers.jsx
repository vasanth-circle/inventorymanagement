import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL || '';

const statusConfig = {
    draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: '📝' },
    in_transit: { label: 'In Transit', color: 'bg-blue-100 text-blue-700', icon: '🚛' },
    received: { label: 'Received', color: 'bg-green-100 text-green-700', icon: '✅' },
    cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700', icon: '❌' },
};

export default function WarehouseTransfers() {
    const [transfers, setTransfers] = useState([]);
    const [locations, setLocations] = useState([]);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [expandedId, setExpandedId] = useState(null);
    const [form, setForm] = useState({
        fromLocation: { id: '', name: '' },
        toLocation: { id: '', name: '' },
        reason: '',
        notes: '',
        expectedReceiptDate: '',
        items: [{ item: '', name: '', quantity: 1, unit: '' }],
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [tRes, lRes, iRes] = await Promise.all([
                axios.get(`${API}/api/warehouse-transfers`),
                axios.get(`${API}/api/locations`),
                axios.get(`${API}/api/items?limit=500`),
            ]);
            setTransfers(tRes.data?.transfers || []);
            setLocations(lRes.data?.locations || lRes.data || []);
            setItems(iRes.data?.items || iRes.data || []);
        } catch (e) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleLocationChange = (field, locationId) => {
        const loc = locations.find(l => l._id === locationId);
        setForm(prev => ({ ...prev, [field]: { id: locationId, name: loc?.name || '' } }));
    };

    const handleItemChange = (idx, field, value) => {
        setForm(prev => {
            const newItems = [...prev.items];
            newItems[idx] = { ...newItems[idx], [field]: value };
            if (field === 'item') {
                const found = items.find(i => i._id === value);
                if (found) {
                    newItems[idx].name = found.name;
                    newItems[idx].unit = found.unitType || '';
                }
            }
            return { ...prev, items: newItems };
        });
    };

    const addItem = () => setForm(p => ({ ...p, items: [...p.items, { item: '', name: '', quantity: 1, unit: '' }] }));
    const removeItem = idx => setForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.fromLocation.id || !form.toLocation.id) return toast.error('Select source and destination locations');
        if (form.items.some(i => !i.item || i.quantity <= 0)) return toast.error('All items must be filled');
        try {
            await axios.post(`${API}/api/warehouse-transfers`, form);
            toast.success('Warehouse transfer created');
            setShowModal(false);
            setForm({ fromLocation: { id: '', name: '' }, toLocation: { id: '', name: '' }, reason: '', notes: '', expectedReceiptDate: '', items: [{ item: '', name: '', quantity: 1, unit: '' }] });
            fetchData();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to create transfer');
        }
    };

    const handleAction = async (id, action) => {
        const labels = { dispatch: 'dispatch this transfer (deducts stock from source)?', receive: 'mark as received (adds stock to destination)?', cancel: 'cancel this transfer?' };
        if (!window.confirm(`Are you sure you want to ${labels[action]}`)) return;
        try {
            await axios.put(`${API}/api/warehouse-transfers/${id}/${action}`);
            toast.success(`Transfer ${action}ed successfully`);
            fetchData();
        } catch (e) {
            toast.error(e.response?.data?.message || `Failed to ${action}`);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Warehouse Transfers</h1>
                    <p className="text-gray-500 text-sm mt-1">Move stock between locations with full traceability</p>
                </div>
                <button onClick={() => setShowModal(true)}
                    className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition flex items-center gap-2">
                    <span>+</span> New Transfer
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                {Object.entries(statusConfig).map(([key, cfg]) => (
                    <div key={key} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                        <div className="text-2xl font-bold text-gray-800">{transfers.filter(t => t.status === key).length}</div>
                        <div className="text-gray-500 text-sm flex items-center gap-1"><span>{cfg.icon}</span>{cfg.label}</div>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex justify-center items-center py-16"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
                ) : transfers.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">No transfers yet. Create your first warehouse transfer.</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                            <tr>{['Transfer #', 'From', '→', 'To', 'Items', 'Date', 'Status', 'Actions'].map(h => (
                                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                            ))}</tr>
                        </thead>
                        <tbody>
                            {transfers.map(t => {
                                const cfg = statusConfig[t.status] || statusConfig.draft;
                                return (
                                    <>
                                        <tr key={t._id} className="border-b hover:bg-gray-50 transition cursor-pointer" onClick={() => setExpandedId(expandedId === t._id ? null : t._id)}>
                                            <td className="px-4 py-3 font-semibold text-blue-700">{t.transferNumber}</td>
                                            <td className="px-4 py-3">{t.fromLocation?.name || '—'}</td>
                                            <td className="px-4 py-3 text-gray-400">→</td>
                                            <td className="px-4 py-3">{t.toLocation?.name || '—'}</td>
                                            <td className="px-4 py-3">{t.items?.length || 0}</td>
                                            <td className="px-4 py-3">{new Date(t.transferDate || t.createdAt).toLocaleDateString('en-IN')}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
                                                    {cfg.icon} {cfg.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 flex gap-1.5" onClick={e => e.stopPropagation()}>
                                                {t.status === 'draft' && (
                                                    <>
                                                        <button onClick={() => handleAction(t._id, 'dispatch')} className="bg-blue-500 text-white px-2.5 py-1 rounded text-xs hover:bg-blue-600">Dispatch</button>
                                                        <button onClick={() => handleAction(t._id, 'cancel')} className="text-red-500 text-xs hover:underline">Cancel</button>
                                                    </>
                                                )}
                                                {t.status === 'in_transit' && (
                                                    <>
                                                        <button onClick={() => handleAction(t._id, 'receive')} className="bg-green-500 text-white px-2.5 py-1 rounded text-xs hover:bg-green-600">Receive</button>
                                                        <button onClick={() => handleAction(t._id, 'cancel')} className="text-red-500 text-xs hover:underline">Cancel</button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                        {expandedId === t._id && (
                                            <tr key={`${t._id}-exp`}>
                                                <td colSpan={8} className="bg-blue-50 px-6 py-4">
                                                    <div className="text-xs font-semibold text-gray-600 mb-2">Items in this transfer:</div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {(t.items || []).map((li, i) => (
                                                            <div key={i} className="bg-white border border-blue-100 rounded-lg px-3 py-2 text-xs">
                                                                <div className="font-semibold">{li.name || li.item?.name || '—'}</div>
                                                                <div className="text-gray-500">{li.quantity} {li.unit || 'units'}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {t.reason && <div className="mt-2 text-gray-500 text-xs italic">Reason: {t.reason}</div>}
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b">
                            <h2 className="text-xl font-bold text-gray-800">New Warehouse Transfer</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">From Location <span className="text-red-500">*</span></label>
                                    <select required value={form.fromLocation.id} onChange={e => handleLocationChange('fromLocation', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400">
                                        <option value="">Select Source</option>
                                        {locations.map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">To Location <span className="text-red-500">*</span></label>
                                    <select required value={form.toLocation.id} onChange={e => handleLocationChange('toLocation', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400">
                                        <option value="">Select Destination</option>
                                        {locations.filter(l => l._id !== form.fromLocation.id).map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Items */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-semibold text-gray-700">Items to Transfer</span>
                                    <button type="button" onClick={addItem} className="text-blue-600 text-xs font-medium hover:underline">+ Add Item</button>
                                </div>
                                {form.items.map((li, idx) => (
                                    <div key={idx} className="grid grid-cols-12 gap-2 items-center mb-2">
                                        <div className="col-span-7">
                                            <select value={li.item} onChange={e => handleItemChange(idx, 'item', e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
                                                <option value="">Select Item</option>
                                                {items.map(it => <option key={it._id} value={it._id}>{it.name} (Avail: {Math.max(0, it.quantity - (it.reservedQuantity || 0))})</option>)}
                                            </select>
                                        </div>
                                        <div className="col-span-3">
                                            <input type="number" min="0.01" step="0.01" value={li.quantity} onChange={e => handleItemChange(idx, 'quantity', Number(e.target.value))} placeholder="Qty" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
                                        </div>
                                        <div className="col-span-2 text-center">
                                            {form.items.length > 1 && <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 text-lg">×</button>}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">Reason</label>
                                    <input value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder="e.g. Showroom replenishment" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">Expected Receipt Date</label>
                                    <input type="date" value={form.expectedReceiptDate} onChange={e => setForm(p => ({ ...p, expectedReceiptDate: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
                                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50">Cancel</button>
                                <button type="submit" className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700">Create Transfer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
