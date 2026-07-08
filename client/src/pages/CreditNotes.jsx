import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL || '';

const statusColors = {
    draft: 'bg-yellow-100 text-yellow-800',
    issued: 'bg-green-100 text-green-800',
    void: 'bg-red-100 text-red-800',
};

export default function CreditNotes() {
    const [creditNotes, setCreditNotes] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [salesOrders, setSalesOrders] = useState([]);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedCN, setSelectedCN] = useState(null);
    const [form, setForm] = useState({
        customer: '',
        salesOrder: '',
        salesOrderNumber: '',
        reason: '',
        notes: '',
        taxAmount: 0,
        items: [{ item: '', name: '', quantity: 1, price: 0 }],
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [cnRes, custRes, soRes, itemRes] = await Promise.all([
                axios.get(`${API}/api/credit-notes`),
                axios.get(`${API}/api/customers`),
                axios.get(`${API}/api/sales-orders?limit=200`),
                axios.get(`${API}/api/items?limit=500`),
            ]);
            setCreditNotes(cnRes.data?.creditNotes || []);
            setCustomers(custRes.data?.customers || custRes.data || []);
            setSalesOrders(soRes.data?.orders || soRes.data || []);
            setItems(itemRes.data?.items || itemRes.data || []);
        } catch (e) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleLineChange = (idx, field, value) => {
        setForm(prev => {
            const newItems = [...prev.items];
            newItems[idx] = { ...newItems[idx], [field]: value };
            if (field === 'item') {
                const found = items.find(i => i._id === value);
                if (found) {
                    newItems[idx].name = found.name;
                    newItems[idx].price = found.price || 0;
                }
            }
            return { ...prev, items: newItems };
        });
    };

    const addLine = () => setForm(prev => ({ ...prev, items: [...prev.items, { item: '', name: '', quantity: 1, price: 0 }] }));
    const removeLine = (idx) => setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));

    const handleSOChange = (soId) => {
        const so = salesOrders.find(s => s._id === soId);
        setForm(prev => ({
            ...prev,
            salesOrder: soId,
            salesOrderNumber: so?.orderNumber || '',
            customer: so?.customer?._id || so?.customer || prev.customer,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.customer || !form.reason || form.items.some(i => !i.item || i.quantity <= 0)) {
            return toast.error('Please fill all required fields');
        }
        try {
            await axios.post(`${API}/api/credit-notes`, form);
            toast.success('Credit Note created and posted to ledger');
            setShowModal(false);
            setForm({ customer: '', salesOrder: '', salesOrderNumber: '', reason: '', notes: '', taxAmount: 0, items: [{ item: '', name: '', quantity: 1, price: 0 }] });
            fetchData();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to create credit note');
        }
    };

    const handleVoid = async (id) => {
        if (!window.confirm('Void this credit note? This will reverse the ledger credit.')) return;
        try {
            await axios.put(`${API}/api/credit-notes/${id}/void`);
            toast.success('Credit note voided');
            fetchData();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to void');
        }
    };

    const printCN = (cn) => {
        const w = window.open('', '_blank');
        w.document.write(`
            <html><head><title>Credit Note ${cn.creditNoteNumber}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 32px; color: #1a1a2e; }
                h1 { color: #6c47ff; margin-bottom: 4px; } h3 { margin: 0; color: #555; }
                .header { display: flex; justify-content: space-between; margin-bottom: 24px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th { background: #f3f0ff; padding: 10px; text-align: left; font-size: 13px; }
                td { padding: 9px 10px; border-bottom: 1px solid #eee; font-size: 13px; }
                .total { text-align: right; margin-top: 16px; font-size: 15px; }
                .badge { display: inline-block; padding: 3px 12px; border-radius: 20px; background: #dcfce7; color: #16a34a; font-weight: 600; }
            </style></head><body>
            <div class="header">
                <div><h1>CREDIT NOTE</h1><h3>${cn.creditNoteNumber}</h3></div>
                <div style="text-align:right">
                    <div><strong>Customer:</strong> ${cn.customer?.name || ''}</div>
                    <div><strong>Date:</strong> ${new Date(cn.issueDate).toLocaleDateString('en-IN')}</div>
                    ${cn.salesOrderNumber ? `<div><strong>Against Invoice:</strong> ${cn.salesOrderNumber}</div>` : ''}
                    <div style="margin-top:6px"><span class="badge">${cn.status.toUpperCase()}</span></div>
                </div>
            </div>
            <div><strong>Reason:</strong> ${cn.reason}</div>
            <table>
                <thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
                <tbody>
                ${(cn.items || []).map((li, i) => `
                    <tr><td>${i+1}</td><td>${li.name || li.item?.name || ''}</td>
                    <td>${li.quantity}</td>
                    <td>₹${(li.price || 0).toFixed(2)}</td>
                    <td>₹${(li.total || 0).toFixed(2)}</td></tr>`).join('')}
                </tbody>
            </table>
            <div class="total">
                <div>Items Total: ₹${(cn.itemsTotal || 0).toFixed(2)}</div>
                ${cn.taxAmount ? `<div>Tax: ₹${cn.taxAmount.toFixed(2)}</div>` : ''}
                <div style="font-size:18px;font-weight:bold;margin-top:8px">Total Credit: ₹${(cn.totalAmount || 0).toFixed(2)}</div>
            </div>
            ${cn.notes ? `<div style="margin-top:20px;color:#666"><em>Notes: ${cn.notes}</em></div>` : ''}
            </body></html>`);
        w.document.close();
        w.print();
    };

    const lineTotal = form.items.reduce((s, i) => s + (Number(i.quantity) * Number(i.price)), 0);
    const grandTotal = lineTotal + Number(form.taxAmount || 0);

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Credit Notes</h1>
                    <p className="text-gray-500 text-sm mt-1">Issue credits to customers and post to ledger automatically</p>
                </div>
                <button onClick={() => setShowModal(true)}
                    className="bg-purple-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-purple-700 transition flex items-center gap-2">
                    <span>+</span> New Credit Note
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Total Issued', value: creditNotes.filter(c => c.status === 'issued').length, color: 'text-green-600' },
                    { label: 'Total Amount', value: `₹${creditNotes.filter(c=>c.status==='issued').reduce((s,c)=>s+(c.totalAmount||0),0).toLocaleString('en-IN')}`, color: 'text-purple-600' },
                    { label: 'Voided', value: creditNotes.filter(c => c.status === 'void').length, color: 'text-red-500' },
                ].map(stat => (
                    <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                        <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                        <div className="text-gray-500 text-sm">{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex justify-center items-center py-16"><div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>
                ) : creditNotes.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">No credit notes yet. Create your first one.</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                            <tr>{['CN Number', 'Customer', 'Against Invoice', 'Date', 'Amount', 'Status', 'Actions'].map(h => (
                                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                            ))}</tr>
                        </thead>
                        <tbody>
                            {creditNotes.map(cn => (
                                <tr key={cn._id} className="border-b hover:bg-gray-50 transition">
                                    <td className="px-4 py-3 font-semibold text-purple-700">{cn.creditNoteNumber}</td>
                                    <td className="px-4 py-3">{cn.customer?.name || '—'}</td>
                                    <td className="px-4 py-3 text-gray-500">{cn.salesOrderNumber || '—'}</td>
                                    <td className="px-4 py-3">{new Date(cn.issueDate).toLocaleDateString('en-IN')}</td>
                                    <td className="px-4 py-3 font-semibold">₹{(cn.totalAmount || 0).toLocaleString('en-IN')}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColors[cn.status] || 'bg-gray-100 text-gray-600'}`}>
                                            {cn.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 flex gap-2">
                                        <button onClick={() => printCN(cn)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Print</button>
                                        {cn.status !== 'void' && (
                                            <button onClick={() => handleVoid(cn._id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Void</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b">
                            <h2 className="text-xl font-bold text-gray-800">Create Credit Note</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">Against Invoice (optional)</label>
                                    <select value={form.salesOrder} onChange={e => handleSOChange(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-400 focus:border-transparent">
                                        <option value="">— None —</option>
                                        {salesOrders.map(so => <option key={so._id} value={so._id}>{so.orderNumber} — {so.customer?.name || ''}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">Customer <span className="text-red-500">*</span></label>
                                    <select required value={form.customer} onChange={e => setForm(p => ({ ...p, customer: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-400 focus:border-transparent">
                                        <option value="">Select Customer</option>
                                        {customers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">Reason <span className="text-red-500">*</span></label>
                                <input required value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder="e.g. Damaged goods, Price correction, Return" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-400 focus:border-transparent" />
                            </div>

                            {/* Line Items */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-semibold text-gray-700">Line Items</span>
                                    <button type="button" onClick={addLine} className="text-purple-600 text-xs font-medium hover:underline">+ Add Item</button>
                                </div>
                                <div className="space-y-2">
                                    {form.items.map((li, idx) => (
                                        <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                                            <div className="col-span-5">
                                                <select value={li.item} onChange={e => handleLineChange(idx, 'item', e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
                                                    <option value="">Select item</option>
                                                    {items.map(it => <option key={it._id} value={it._id}>{it.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="col-span-2">
                                                <input type="number" min="0.01" step="0.01" value={li.quantity} onChange={e => handleLineChange(idx, 'quantity', e.target.value)} placeholder="Qty" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
                                            </div>
                                            <div className="col-span-2">
                                                <input type="number" min="0" step="0.01" value={li.price} onChange={e => handleLineChange(idx, 'price', e.target.value)} placeholder="Rate" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
                                            </div>
                                            <div className="col-span-2 text-right text-sm font-medium text-gray-700">
                                                ₹{(Number(li.quantity) * Number(li.price)).toFixed(2)}
                                            </div>
                                            <div className="col-span-1 text-center">
                                                {form.items.length > 1 && <button type="button" onClick={() => removeLine(idx)} className="text-red-400 hover:text-red-600 text-lg">×</button>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">Tax Amount (₹)</label>
                                    <input type="number" min="0" value={form.taxAmount} onChange={e => setForm(p => ({ ...p, taxAmount: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                                </div>
                                <div className="flex items-end">
                                    <div className="bg-purple-50 rounded-lg px-4 py-2 w-full text-right">
                                        <div className="text-sm text-gray-500">Total Credit</div>
                                        <div className="text-xl font-bold text-purple-700">₹{grandTotal.toFixed(2)}</div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
                                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50">Cancel</button>
                                <button type="submit" className="flex-1 bg-purple-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-purple-700">Issue Credit Note</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
