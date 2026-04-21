import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { InventoryContext } from '../context/InventoryContext';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import { printDocument } from '../utils/printTemplates';

const STATUS_COLORS = {
    draft:     'bg-gray-100 text-gray-600',
    sent:      'bg-blue-100 text-blue-700',
    accepted:  'bg-green-100 text-green-700',
    rejected:  'bg-red-100 text-red-600',
    converted: 'bg-purple-100 text-purple-700',
};

const emptyItem = () => ({
    item: '', name: '', brand: '', size: '', hsn: '',
    quantity: 1, price: 0, total: 0,
    pcsPerBox: 1, sqFtPerPc: 0,
    billingUnit: 'boxes', // boxes, sqft, pieces
    stockQty: 0,         // what to deduct
    stockUnit: 'boxes',
    primaryQty: 0, secondaryQty: 0, unitLabel: 'units', rateLabel: 'per unit',
    availableBatches: [], batchId: '',
});

const emptyForm = () => ({
    customer: '',
    items: [emptyItem()],
    notes: '',
    terms: '',
    taxRate: 0,
    taxAmount: 0,
    loadingCharges: 0,
    transportCharges: 0,
    discountAmount: 0,
    validUntil: new Date(Date.now() + 30 * 86400000).toISOString().substring(0, 10),
});

const Quotations = () => {
    const navigate = useNavigate();
    const { billingSettings } = useContext(InventoryContext);
    const { user } = useContext(AuthContext);

    const [quotations, setQuotations] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [allItems, setAllItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingQuotation, setEditingQuotation] = useState(null);
    const [formData, setFormData] = useState(emptyForm());
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [convertingId, setConvertingId] = useState(null);

    const token = () => localStorage.getItem('token');
    const headers = () => ({ headers: { Authorization: `Bearer ${token()}` } });

    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        try {
            setLoading(true);
            const [quotRes, custRes, itemsRes] = await Promise.all([
                axios.get('/api/quotations', headers()),
                axios.get('/api/customers?limit=1000', headers()),
                axios.get('/api/items?limit=1000', headers()),
            ]);
            setQuotations(quotRes.data.data?.quotations || []);
            setCustomers(custRes.data.data?.customers || []);
            setAllItems(itemsRes.data?.items || []);
        } catch (err) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    /* ── Form helpers ──────────────────────────────────────────────── */
    const handleItemChange = (index, field, value) => {
        const newItems = [...formData.items];
        newItems[index] = { ...newItems[index], [field]: value };

        if (field === 'item') {
            const found = allItems.find(i => i._id === value);
            if (found) {
                newItems[index].name = found.name;
                newItems[index].brand = found.brand || '';
                newItems[index].size = found.size || '';
                newItems[index].hsn = found.hsn || '';
                newItems[index].pcsPerBox = found.pcsPerBox || 1;
                newItems[index].sqFtPerPc = found.sqFtPerPc || 0;
                newItems[index].availableBatches = found.batches || [];
                newItems[index].price = found.batches?.length ? found.batches[0].price : (found.price || 0);
                if (found.batches?.length) newItems[index].batchId = found.batches[0]._id;
                
                // Set default billing unit based on if it's a tile
                if (found.sqFtPerPc > 0) {
                    newItems[index].billingUnit = 'sqft'; 
                    newItems[index].stockUnit = 'boxes';
                } else {
                    newItems[index].billingUnit = 'pieces';
                    newItems[index].stockUnit = 'pieces';
                }
            }
        }

        if (field === 'batchId') {
            const batch = newItems[index].availableBatches.find(b => b._id === value);
            if (batch) newItems[index].price = batch.price;
        }

        // Recalc total
        const q = Number(newItems[index].quantity) || 0; // This is the input qty (e.g. Boxes or Pieces)
        const p = Number(newItems[index].price) || 0;
        const bUnit = newItems[index].billingUnit;
        const pcsPerBox = Number(newItems[index].pcsPerBox) || 1;
        const sqFtPerPc = Number(newItems[index].sqFtPerPc) || 0;

        if (sqFtPerPc > 0) {
            // It's a tile/box item
            newItems[index].boxCount = q;
            newItems[index].totalPcs = q * pcsPerBox;
            newItems[index].totalSqFt = parseFloat((q * pcsPerBox * sqFtPerPc).toFixed(2));
            newItems[index].stockQty = q; // Deduct physical boxes
            newItems[index].stockUnit = 'boxes';

            if (bUnit === 'sqft') {
                newItems[index].total = parseFloat((newItems[index].totalSqFt * p).toFixed(2));
            } else {
                newItems[index].total = parseFloat((q * p).toFixed(2));
            }
        } else {
            // Generic item
            newItems[index].stockQty = q;
            newItems[index].stockUnit = 'pieces';
            newItems[index].total = parseFloat((q * p).toFixed(2));
        }

        setFormData(prev => ({ ...prev, items: newItems }));
    };

    const calcTotals = () => {
        const itemsTotal = formData.items.reduce((s, i) => s + (Number(i.total) || 0), 0);
        
        // Auto-calculate tax amount if taxRate is provided
        const taxRate = Number(formData.taxRate) || 0;
        let taxAmt = Number(formData.taxAmount) || 0;
        
        if (taxRate > 0) {
            taxAmt = parseFloat((itemsTotal * taxRate / 100).toFixed(2));
        }

        const net = itemsTotal + (Number(formData.loadingCharges) || 0) + (Number(formData.transportCharges) || 0) + taxAmt - (Number(formData.discountAmount) || 0);
        return { itemsTotal, taxAmount: taxAmt, net };
    };

    /* ── CRUD ──────────────────────────────────────────────────────── */
    const handleSubmit = async (e) => {
        e.preventDefault();
        const { itemsTotal, taxAmount, net } = calcTotals();
        
        // Clean numeric payloads to avoid Mongoose CastErrors with empty strings
        const payload = { 
            ...formData, 
            items: formData.items.map(i => {
                const qVal = Number(i.quantity) || 0;
                return {
                    ...i,
                    quantity: i.billingUnit === 'sqft' ? i.totalSqFt : qVal, // formal billed qty
                    price: Number(i.price) || 0,
                    total: Number(i.total) || 0,
                    stockQty: Number(i.stockQty) || 0,
                };
            }),
            taxRate: Number(formData.taxRate) || 0,
            taxAmount, 
            loadingCharges: Number(formData.loadingCharges) || 0,
            transportCharges: Number(formData.transportCharges) || 0,
            discountAmount: Number(formData.discountAmount) || 0,
            itemsTotal, 
            totalAmount: net 
        };
        
        try {
            if (editingQuotation) {
                await axios.put(`/api/quotations/${editingQuotation._id}`, payload, headers());
                toast.success('Quotation updated');
            } else {
                await axios.post('/api/quotations', payload, headers());
                toast.success('Quotation created');
            }
            closeModal();
            fetchAll();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error saving quotation');
        }
    };

    const handleConvert = async (quotation) => {
        if (!window.confirm(`Convert Quotation ${quotation.quotationNumber} to an Invoice? This cannot be undone.`)) return;
        setConvertingId(quotation._id);
        try {
            const res = await axios.post(`/api/quotations/${quotation._id}/convert`, {}, headers());
            toast.success(`Invoice ${res.data.data.salesOrder.orderNumber} created!`);
            fetchAll();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Conversion failed');
        } finally {
            setConvertingId(null);
        }
    };

    const handleDelete = async (quotation) => {
        if (!window.confirm(`Reject Quotation ${quotation.quotationNumber}?`)) return;
        try {
            await axios.delete(`/api/quotations/${quotation._id}`, headers());
            toast.success('Quotation rejected');
            fetchAll();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed');
        }
    };

    const openEdit = (q) => {
        setEditingQuotation(q);
        setFormData({
            customer: q.customer?._id || q.customer,
            items: q.items.map(i => {
                const itemId = i.item?._id || i.item;
                const foundItem = allItems.find(x => x._id === itemId);
                const sqFtPerPc = foundItem?.sqFtPerPc || 0;
                const isTile = sqFtPerPc > 0;
                return {
                    ...i,
                    item: itemId,
                    quantity: isTile ? (i.boxCount || 0) : i.quantity,
                    total: i.total || i.quantity * i.price,
                    availableBatches: foundItem?.batches || [],
                    pcsPerBox: foundItem?.pcsPerBox || 1,
                    sqFtPerPc: sqFtPerPc,
                };
            }),
            notes: q.notes || '',
            terms: q.terms || '',
            taxRate: q.taxRate || 0,
            taxAmount: q.taxAmount || 0,
            loadingCharges: q.loadingCharges || 0,
            transportCharges: q.transportCharges || 0,
            discountAmount: q.discountAmount || 0,
            validUntil: q.validUntil ? q.validUntil.substring(0, 10) : '',
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingQuotation(null);
        setFormData(emptyForm());
    };

    /* ── Print ─────────────────────────────────────────────────────── */
    const handlePrint = (q) => {
        printDocument(q, billingSettings, 'quotation');
    };

    /* ── Filtered list ─────────────────────────────────────────────── */
    const filtered = quotations.filter(q => {
        const matchSearch = !searchTerm || q.quotationNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (q.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (q.customer?.companyName || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = !statusFilter || q.status === statusFilter;
        return matchSearch && matchStatus;
    });

    const { itemsTotal, net } = calcTotals();

    /* ── Render ────────────────────────────────────────────────────── */
    return (
        <div className="p-1 space-y-6 max-w-[1200px] mx-auto">
            {/* Header */}
            <div className="flex justify-between items-end pb-2 border-b border-gray-100">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-white shadow-sm border border-gray-100 rounded-lg flex items-center justify-center text-xl">📋</div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Quotations</h1>
                        <p className="text-xs text-gray-400 font-medium">Create quotations and convert to invoices</p>
                    </div>
                </div>
                <button
                    onClick={() => { setEditingQuotation(null); setFormData(emptyForm()); setIsModalOpen(true); }}
                    className="px-5 py-2.5 bg-rose-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg"
                >
                    + New Quotation
                </button>
            </div>

            {/* Filters */}
            <div className="flex gap-3 flex-wrap">
                <input
                    type="text"
                    placeholder="Search by number or customer..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="flex-1 min-w-[200px] h-10 px-4 bg-white border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-rose-500"
                />
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="h-10 px-3 bg-white border border-gray-100 rounded-lg text-sm font-medium focus:ring-2 focus:ring-rose-500"
                >
                    <option value="">All Statuses</option>
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                    <option value="converted">Converted</option>
                </select>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-gray-400">Loading...</div>
                ) : filtered.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">No quotations found. Create one!</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 bg-gray-50">
                            <tr>
                                <th className="text-left p-4">Quotation #</th>
                                <th className="text-left p-4">Customer</th>
                                <th className="text-left p-4">Date</th>
                                <th className="text-left p-4">Valid Until</th>
                                <th className="text-right p-4">Amount</th>
                                <th className="text-center p-4">Status</th>
                                <th className="text-center p-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filtered.map(q => (
                                <tr key={q._id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4 font-bold text-gray-800">{q.quotationNumber}</td>
                                    <td className="p-4">
                                        <div className="font-semibold text-gray-700">{q.customer?.companyName || q.customer?.name}</div>
                                        <div className="text-xs text-gray-400">{q.customer?.phone}</div>
                                    </td>
                                    <td className="p-4 text-gray-500 text-xs">{new Date(q.quotationDate || q.createdAt).toLocaleDateString()}</td>
                                    <td className={`p-4 text-xs font-medium ${q.validUntil && new Date(q.validUntil) < new Date() && q.status !== 'converted' ? 'text-red-500' : 'text-gray-500'}`}>
                                        {q.validUntil ? new Date(q.validUntil).toLocaleDateString() : '-'}
                                    </td>
                                    <td className="p-4 text-right font-bold text-gray-800">₹{(q.totalAmount || 0).toLocaleString()}</td>
                                    <td className="p-4 text-center">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[q.status] || 'bg-gray-100 text-gray-600'}`}>
                                            {q.status}
                                        </span>
                                        {q.convertedToInvoice && (
                                            <div className="text-[9px] text-purple-500 mt-1">Invoice created</div>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                            <button onClick={() => handlePrint(q)} title="Print" className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-bold">📄</button>
                                            {q.status !== 'converted' && q.status !== 'rejected' && (
                                                <>
                                                    <button onClick={() => openEdit(q)} title="Edit" className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded text-xs font-bold">✏️</button>
                                                    <button
                                                        onClick={() => handleConvert(q)}
                                                        disabled={convertingId === q._id}
                                                        title="Convert to Invoice"
                                                        className="px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded text-xs font-bold disabled:opacity-50"
                                                    >
                                                        {convertingId === q._id ? '...' : '✅ Invoice'}
                                                    </button>
                                                    <button onClick={() => handleDelete(q)} title="Reject" className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-xs font-bold">✕</button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Create / Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex justify-between items-center z-10">
                            <h2 className="text-lg font-black text-gray-800">
                                {editingQuotation ? `Edit ${editingQuotation.quotationNumber}` : 'New Quotation'}
                            </h2>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-700 text-xl font-bold">✕</button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            {/* Customer + Validity */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Customer *</label>
                                    <select required value={formData.customer} onChange={e => setFormData(p => ({ ...p, customer: e.target.value }))}
                                        className="w-full h-11 px-4 bg-gray-50 rounded-lg text-sm font-bold focus:ring-2 focus:ring-rose-500">
                                        <option value="">-- Select Customer --</option>
                                        {customers.map(c => <option key={c._id} value={c._id}>{c.companyName || c.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Valid Until</label>
                                    <input type="date" value={formData.validUntil} onChange={e => setFormData(p => ({ ...p, validUntil: e.target.value }))}
                                        className="w-full h-11 px-4 bg-gray-50 rounded-lg text-sm font-bold focus:ring-2 focus:ring-rose-500" />
                                </div>
                            </div>

                            {/* Items */}
                            <div>
                                <div className="flex justify-between items-center mb-3">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Items</label>
                                    <button type="button" onClick={() => setFormData(p => ({ ...p, items: [...p.items, emptyItem()] }))}
                                        className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1">
                                        + Add Item
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {formData.items.map((row, idx) => (
                                        <div key={idx} className="grid grid-cols-12 gap-2 items-start bg-gray-50 p-3 rounded-lg">
                                            {/* Item select */}
                                            <div className="col-span-4">
                                                <select value={row.item} onChange={e => handleItemChange(idx, 'item', e.target.value)}
                                                    className="w-full h-9 px-2 bg-white border border-gray-100 rounded-lg text-xs font-bold focus:ring-2 focus:ring-rose-500">
                                                    <option value="">-- Item --</option>
                                                    {allItems.map(i => <option key={i._id} value={i._id}>{i.name} ({i.brand} - {i.size})</option>)}
                                                </select>
                                                {row.availableBatches?.length > 0 && (
                                                    <select value={row.batchId} onChange={e => handleItemChange(idx, 'batchId', e.target.value)}
                                                        className="w-full mt-1.5 h-9 px-2 bg-white border border-gray-100 rounded-lg text-xs focus:ring-2 focus:ring-rose-500">
                                                        {row.availableBatches.map(b => <option key={b._id} value={b._id}>Batch: {b.batchNumber} — ₹{b.price}</option>)}
                                                    </select>
                                                )}
                                            </div>
                                            {/* Qty */}
                                            <div className="col-span-2">
                                                <label className="text-[9px] text-gray-400 font-bold uppercase">Qty {row.sqFtPerPc > 0 ? '(Boxes)' : ''}</label>
                                                <input type="number" min="0" step="any" value={row.quantity}
                                                    onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                                                    className="w-full h-9 px-2 bg-white border border-gray-100 rounded-lg text-xs font-bold text-center focus:ring-2 focus:ring-rose-500" />
                                                {row.sqFtPerPc > 0 && <div className="text-[10px] text-gray-400 text-center mt-0.5">{((row.quantity || 0) * (row.pcsPerBox || 1) * row.sqFtPerPc).toFixed(2)} SqFt</div>}
                                            </div>
                                            {/* Rate */}
                                            <div className="col-span-2">
                                                <label className="text-[9px] text-gray-400 font-bold uppercase">Rate</label>
                                                <input type="number" min="0" step="0.01" value={row.price}
                                                    onChange={e => handleItemChange(idx, 'price', e.target.value)}
                                                    className="w-full h-9 px-2 bg-white border border-gray-100 rounded-lg text-xs font-bold text-right focus:ring-2 focus:ring-rose-500" />
                                            </div>
                                            {/* Billing Unit Select */}
                                            {row.sqFtPerPc > 0 && (
                                                <div className="col-span-1">
                                                    <label className="text-[9px] text-gray-400 font-bold uppercase">Unit</label>
                                                    <select value={row.billingUnit} onChange={e => handleItemChange(idx, 'billingUnit', e.target.value)}
                                                        className="w-full h-9 px-1 bg-white border border-gray-100 rounded-lg text-[10px] font-bold focus:ring-2 focus:ring-rose-500">
                                                        <option value="sqft">SqFt</option>
                                                        <option value="boxes">Box</option>
                                                    </select>
                                                </div>
                                            )}
                                            {/* Total */}
                                            <div className={row.sqFtPerPc > 0 ? "col-span-1" : "col-span-2"}>
                                                <label className="text-[9px] text-gray-400 font-bold uppercase">Total</label>
                                                <div className="h-9 px-2 bg-gray-100 border border-gray-200 rounded-lg text-xs font-black text-right flex items-center justify-end text-gray-700">
                                                    ₹{(row.total || 0).toLocaleString()}
                                                </div>
                                            </div>
                                            {/* Remove */}
                                            <div className="col-span-2 flex items-end justify-end">
                                                {formData.items.length > 1 && (
                                                    <button type="button" onClick={() => setFormData(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))}
                                                        className="h-9 w-9 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg text-xs font-bold">✕</button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Charges */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-gray-50 p-4 rounded-xl">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tax Rate (%)</label>
                                    <input type="number" min="0" step="0.1" value={formData.taxRate}
                                        onChange={e => setFormData(p => ({ ...p, taxRate: e.target.value }))}
                                        className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-rose-500" placeholder="e.g. 18" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tax Amount</label>
                                    <input type="number" min="0" step="0.01" value={formData.taxRate > 0 ? parseFloat((itemsTotal * formData.taxRate / 100).toFixed(2)) : formData.taxAmount}
                                        onChange={e => setFormData(p => ({ ...p, taxAmount: e.target.value }))}
                                        disabled={formData.taxRate > 0}
                                        className={`w-full h-10 px-3 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-rose-500 ${formData.taxRate > 0 ? 'bg-gray-100 text-gray-500' : 'bg-white'}`} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Loading</label>
                                    <input type="number" min="0" step="0.01" value={formData.loadingCharges}
                                        onChange={e => setFormData(p => ({ ...p, loadingCharges: e.target.value }))}
                                        className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-rose-500" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Transport</label>
                                    <input type="number" min="0" step="0.01" value={formData.transportCharges}
                                        onChange={e => setFormData(p => ({ ...p, transportCharges: e.target.value }))}
                                        className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-rose-500" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Discount</label>
                                    <input type="number" min="0" step="0.01" value={formData.discountAmount}
                                        onChange={e => setFormData(p => ({ ...p, discountAmount: e.target.value }))}
                                        className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-rose-500" />
                                </div>
                            </div>

                            {/* Totals summary */}
                            <div className="bg-gray-900 text-white rounded-xl p-4 flex justify-between items-center">
                                <div className="text-xs text-gray-400 space-y-1">
                                    <div>Items Total: ₹{itemsTotal.toLocaleString()}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-gray-400 uppercase tracking-widest">Net Amount</div>
                                    <div className="text-2xl font-black">₹{net.toLocaleString()}</div>
                                </div>
                            </div>

                            {/* Notes & Terms */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Notes</label>
                                    <textarea rows={3} value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                                        className="w-full p-3 bg-gray-50 rounded-lg text-sm focus:ring-2 focus:ring-rose-500" placeholder="Internal notes..." />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Terms & Conditions</label>
                                    <textarea rows={3} value={formData.terms} onChange={e => setFormData(p => ({ ...p, terms: e.target.value }))}
                                        className="w-full p-3 bg-gray-50 rounded-lg text-sm focus:ring-2 focus:ring-rose-500" placeholder="Payment terms, delivery conditions..." />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={closeModal} className="px-6 py-2.5 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-gray-600">Cancel</button>
                                <button type="submit" className="px-8 py-2.5 bg-rose-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-rose-700 shadow-lg">
                                    {editingQuotation ? 'Update Quotation' : 'Create Quotation'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Quotations;
