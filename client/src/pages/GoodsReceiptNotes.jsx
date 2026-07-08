import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL || '';

const statusColors = {
    draft: 'bg-yellow-100 text-yellow-800',
    received: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
};

export default function GoodsReceiptNotes() {
    const [grns, setGrns] = useState([]);
    const [purchaseOrders, setPurchaseOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [expandedGRN, setExpandedGRN] = useState(null);
    const [form, setForm] = useState({
        purchaseOrder: '',
        notes: '',
        receiptDate: new Date().toISOString().split('T')[0],
        items: [],
    });
    const [selectedPO, setSelectedPO] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [grnRes, poRes] = await Promise.all([
                axios.get(`${API}/api/grn`),
                axios.get(`${API}/api/purchase-orders?limit=200`),
            ]);
            setGrns(grnRes.data?.grns || []);
            setPurchaseOrders(poRes.data?.orders || poRes.data || []);
        } catch (e) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handlePOSelect = (poId) => {
        const po = purchaseOrders.find(p => p._id === poId);
        setSelectedPO(po);
        if (po) {
            setForm(prev => ({
                ...prev,
                purchaseOrder: poId,
                items: (po.items || []).map(li => ({
                    item: li.item?._id || li.item,
                    name: li.name || li.item?.name || '',
                    orderedQuantity: li.boxCount || li.quantity || 0,
                    receivedQuantity: li.boxCount || li.quantity || 0,
                    damagedQuantity: 0,
                    price: li.price || 0,
                    batchNumber: '',
                    expiryDate: '',
                    binLocation: '',
                })),
            }));
        }
    };

    const handleItemChange = (idx, field, value) => {
        setForm(prev => {
            const newItems = [...prev.items];
            newItems[idx] = { ...newItems[idx], [field]: value };
            return { ...prev, items: newItems };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.purchaseOrder || !form.items.length) return toast.error('Select a PO and items');
        try {
            await axios.post(`${API}/api/grn`, form);
            toast.success('GRN created. Click "Receive" to update stock.');
            setShowModal(false);
            setForm({ purchaseOrder: '', notes: '', receiptDate: new Date().toISOString().split('T')[0], items: [] });
            setSelectedPO(null);
            fetchData();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to create GRN');
        }
    };

    const handleReceive = async (id) => {
        if (!window.confirm('Mark GRN as received? This will update stock immediately.')) return;
        try {
            await axios.put(`${API}/api/grn/${id}/receive`);
            toast.success('GRN received — stock updated!');
            fetchData();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to receive GRN');
        }
    };

    const handleCancel = async (id) => {
        if (!window.confirm('Cancel this GRN?')) return;
        try {
            await axios.put(`${API}/api/grn/${id}/cancel`);
            toast.success('GRN cancelled');
            fetchData();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Cannot cancel received GRN');
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Goods Receipt Notes (GRN)</h1>
                    <p className="text-gray-500 text-sm mt-1">Track partial deliveries against Purchase Orders</p>
                </div>
                <button onClick={() => setShowModal(true)}
                    className="bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition flex items-center gap-2">
                    <span>+</span> Create GRN
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Draft GRNs', value: grns.filter(g => g.status === 'draft').length, color: 'text-yellow-600' },
                    { label: 'Received', value: grns.filter(g => g.status === 'received').length, color: 'text-emerald-600' },
                    { label: 'Cancelled', value: grns.filter(g => g.status === 'cancelled').length, color: 'text-red-500' },
                ].map(s => (
                    <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                        <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                        <div className="text-gray-500 text-sm">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex justify-center items-center py-16"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
                ) : grns.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">No GRNs yet. Create your first one from a Purchase Order.</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                            <tr>{['GRN Number', 'PO Number', 'Vendor', 'Receipt Date', 'Items', 'Status', 'Actions'].map(h => (
                                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                            ))}</tr>
                        </thead>
                        <tbody>
                            {grns.map(grn => (
                                <>
                                    <tr key={grn._id} className="border-b hover:bg-gray-50 transition cursor-pointer" onClick={() => setExpandedGRN(expandedGRN === grn._id ? null : grn._id)}>
                                        <td className="px-4 py-3 font-semibold text-emerald-700">{grn.grnNumber}</td>
                                        <td className="px-4 py-3">{grn.purchaseOrderNumber || '—'}</td>
                                        <td className="px-4 py-3">{grn.vendor?.name || '—'}</td>
                                        <td className="px-4 py-3">{new Date(grn.receiptDate).toLocaleDateString('en-IN')}</td>
                                        <td className="px-4 py-3">{grn.items?.length || 0} item(s)</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColors[grn.status] || 'bg-gray-100 text-gray-600'}`}>
                                                {grn.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 flex gap-2" onClick={e => e.stopPropagation()}>
                                            {grn.status === 'draft' && (
                                                <>
                                                    <button onClick={() => handleReceive(grn._id)} className="bg-emerald-500 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-emerald-600">Receive</button>
                                                    <button onClick={() => handleCancel(grn._id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Cancel</button>
                                                </>
                                            )}
                                            {grn.status === 'received' && <span className="text-xs text-gray-400">Stock Updated ✓</span>}
                                        </td>
                                    </tr>
                                    {expandedGRN === grn._id && (
                                        <tr key={`${grn._id}-expand`}>
                                            <td colSpan={7} className="px-4 py-3 bg-gray-50">
                                                <table className="w-full text-xs">
                                                    <thead>
                                                        <tr className="text-gray-500">
                                                            <th className="text-left py-1">Item</th>
                                                            <th className="text-right py-1">Ordered</th>
                                                            <th className="text-right py-1">Received</th>
                                                            <th className="text-right py-1">Damaged</th>
                                                            <th className="text-right py-1">Accepted</th>
                                                            <th className="text-left py-1">Batch</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {(grn.items || []).map((li, i) => (
                                                            <tr key={i} className="border-t border-gray-100">
                                                                <td className="py-1">{li.name || li.item?.name || '—'}</td>
                                                                <td className="text-right">{li.orderedQuantity}</td>
                                                                <td className="text-right text-blue-600">{li.receivedQuantity}</td>
                                                                <td className="text-right text-red-500">{li.damagedQuantity || 0}</td>
                                                                <td className="text-right text-green-600 font-semibold">{li.acceptedQuantity || li.receivedQuantity - (li.damagedQuantity || 0)}</td>
                                                                <td className="text-left text-gray-400">{li.batchNumber || '—'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                                {grn.notes && <div className="mt-2 text-gray-500 italic text-xs">Notes: {grn.notes}</div>}
                                            </td>
                                        </tr>
                                    )}
                                </>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b">
                            <h2 className="text-xl font-bold text-gray-800">Create Goods Receipt Note</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">Purchase Order <span className="text-red-500">*</span></label>
                                    <select required value={form.purchaseOrder} onChange={e => handlePOSelect(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-400">
                                        <option value="">Select PO</option>
                                        {purchaseOrders.filter(po => !['void', 'billed'].includes(po.status)).map(po => (
                                            <option key={po._id} value={po._id}>{po.orderNumber} — {po.vendor?.name || ''} ({po.receivedStatus || po.status})</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">Receipt Date</label>
                                    <input type="date" value={form.receiptDate} onChange={e => setForm(p => ({ ...p, receiptDate: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                                </div>
                            </div>

                            {form.items.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Line Items — Enter Received Quantities</h3>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-gray-50">
                                                    {['Item', 'Ordered', 'Received', 'Damaged', 'Batch #', 'Expiry', 'Bin Location'].map(h => (
                                                        <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-500">{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {form.items.map((li, idx) => (
                                                    <tr key={idx} className="border-b">
                                                        <td className="px-3 py-2 font-medium">{li.name}</td>
                                                        <td className="px-3 py-2 text-gray-500">{li.orderedQuantity}</td>
                                                        <td className="px-3 py-2">
                                                            <input type="number" min="0" value={li.receivedQuantity} onChange={e => handleItemChange(idx, 'receivedQuantity', Number(e.target.value))} className="w-20 border border-gray-200 rounded px-2 py-1 text-sm" />
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <input type="number" min="0" value={li.damagedQuantity} onChange={e => handleItemChange(idx, 'damagedQuantity', Number(e.target.value))} className="w-20 border border-gray-200 rounded px-2 py-1 text-sm" />
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <input type="text" value={li.batchNumber} onChange={e => handleItemChange(idx, 'batchNumber', e.target.value)} placeholder="BATCH-001" className="w-28 border border-gray-200 rounded px-2 py-1 text-sm" />
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <input type="date" value={li.expiryDate} onChange={e => handleItemChange(idx, 'expiryDate', e.target.value)} className="w-36 border border-gray-200 rounded px-2 py-1 text-sm" />
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <input type="text" value={li.binLocation} onChange={e => handleItemChange(idx, 'binLocation', e.target.value)} placeholder="A-1-1" className="w-24 border border-gray-200 rounded px-2 py-1 text-sm" />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">Notes / Remarks</label>
                                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50">Cancel</button>
                                <button type="submit" className="flex-1 bg-emerald-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-emerald-700">Create GRN (Draft)</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
