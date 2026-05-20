import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { InventoryContext } from '../context/InventoryContext';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { printDocument } from '../utils/printTemplates';
import { shareViaWhatsApp, shareViaEmail } from '../utils/shareUtils';

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
    physicalStock: 0
});

const emptyForm = () => ({
    customer: '',
    items: [emptyItem()],
    notes: '',
    terms: '',
    taxRate: 0,
    taxAmount: 0,
    loadingCharges: 0,
    unloadingCharges: 0,
    transportCharges: 0,
    oldBalance: 0,
    discountAmount: 0,
    validUntil: new Date(Date.now() + 30 * 86400000).toISOString().substring(0, 10),
});

const Quotations = () => {
    const navigate = useNavigate();
    const { billingSettings, calculateItemValues } = useContext(InventoryContext);
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
    const [userFilter, setUserFilter] = useState('');
    const [convertingId, setConvertingId] = useState(null);
    const [fetchingBalance, setFetchingBalance] = useState(false);

    const token = () => localStorage.getItem('token');
    const headers = () => ({ headers: { Authorization: `Bearer ${token()}` } });

    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        try {
            setLoading(true);
            const [quotRes, custRes, itemsRes] = await Promise.all([
                api.get('/quotations'),
                api.get('/customers?limit=1000'),
                api.get('/items?limit=1000'),
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
    const handleCustomerChange = async (customerId) => {
        setFormData(p => ({ ...p, customer: customerId }));
        if (customerId) {
            setFetchingBalance(true);
            try {
                const res = await api.get(`/customers/${customerId}/balance`);
                const bal = res.data.data?.balance ?? 0;
                setFormData(p => ({ ...p, oldBalance: bal }));
            } catch (err) {
                console.error('Error fetching balance');
            } finally {
                setFetchingBalance(false);
            }
        }
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...formData.items];
        let row = { ...newItems[index], [field]: value };

        if (field === 'item') {
            const found = allItems.find(i => i._id === value);
            if (found) {
                row.name = found.name;
                row.brand = found.brand || '';
                row.size = found.size || '';
                row.hsn = found.hsn || '';
                row.pcsPerBox = Number(found.pcsPerBox) || 1;
                row.sqFtPerPc = Number(found.sqFtPerPc) || 0;
                row.physicalStock = Number(found.quantity) || 0;
                row.availableBatches = found.batches || [];
                row.price = found.batches?.length ? (Number(found.batches[0].price) || 0) : (Number(found.price) || 0);
                if (found.batches?.length) row.batchId = found.batches[0]._id;
                
                // Default to 'boxes' for tiles (matches inward unit), 'pieces' for others
                if (row.sqFtPerPc > 0) {
                    row.billingUnit = 'boxes';
                    row.stockUnit = 'boxes';
                } else {
                    row.billingUnit = 'pieces';
                    row.stockUnit = 'pieces';
                }
            } else {
                // Reset if cleared
                row = emptyItem();
                row.item = '';
            }
        }

        if (field === 'batchId') {
            const batch = row.availableBatches?.find(b => b._id === value);
            if (batch) row.price = Number(batch.price) || 0;
        }

        // Use the centralized calculation engine
        newItems[index] = calculateItemValues(row, field, value, billingSettings?.industry);

        setFormData(prev => ({ ...prev, items: newItems }));
    };

    const calcTotals = () => {
        const itemsTotal = formData.items.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
        
        // Auto-calculate tax amount if taxRate is provided
        const taxRate = parseFloat(formData.taxRate) || 0;
        let taxAmt = parseFloat(formData.taxAmount) || 0;
        
        if (taxRate > 0) {
            taxAmt = parseFloat((itemsTotal * taxRate / 100).toFixed(2));
        }

        const net = itemsTotal + (parseFloat(formData.loadingCharges) || 0) + (parseFloat(formData.unloadingCharges) || 0) + (parseFloat(formData.transportCharges) || 0) + taxAmt + (parseFloat(formData.oldBalance) || 0) - (parseFloat(formData.discountAmount) || 0);
        return { itemsTotal, taxAmount: taxAmt, net: parseFloat(net.toFixed(2)) };
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
            unloadingCharges: Number(formData.unloadingCharges) || 0,
            transportCharges: Number(formData.transportCharges) || 0,
            oldBalance: Number(formData.oldBalance) || 0,
            discountAmount: Number(formData.discountAmount) || 0,
            itemsTotal, 
            totalAmount: net 
        };
        
        try {
            if (editingQuotation) {
                await api.put(`/quotations/${editingQuotation._id}`, payload);
                toast.success('Quotation updated');
            } else {
                await api.post('/quotations', payload);
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
            const res = await api.post(`/quotations/${quotation._id}/convert`, {});
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
            await api.delete(`/quotations/${quotation._id}`);
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
                    physicalStock: foundItem?.quantity || 0
                };
            }),
            notes: q.notes || '',
            terms: q.terms || '',
            taxRate: q.taxRate || 0,
            taxAmount: q.taxAmount || 0,
            loadingCharges: q.loadingCharges || 0,
            unloadingCharges: q.unloadingCharges || 0,
            transportCharges: q.transportCharges || 0,
            oldBalance: q.oldBalance || 0,
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
        const matchUser = !userFilter || q.user?._id === userFilter;
        return matchSearch && matchStatus && matchUser;
    });

    const uniqueUsers = Array.from(new Set(quotations.filter(q => q.user?._id).map(q => JSON.stringify({ id: q.user._id, name: q.user.name || 'Unknown' })))).map(u => JSON.parse(u));

    const { itemsTotal, taxAmount, net } = calcTotals();

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
                <select
                    value={userFilter}
                    onChange={e => setUserFilter(e.target.value)}
                    className="h-10 px-3 bg-white border border-gray-100 rounded-lg text-sm font-medium focus:ring-2 focus:ring-rose-500"
                >
                    <option value="">All Reps / Users</option>
                    {uniqueUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                </select>
            </div>

            {/* Table / Card View */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden pb-24 lg:pb-0">
                {loading ? (
                    <div className="p-12 text-center text-gray-400">Loading...</div>
                ) : filtered.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">No quotations found. Create one!</div>
                ) : (
                    <>
                        {/* Desktop Table View */}
                        <div className="hidden lg:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 bg-gray-50">
                                    <tr>
                                        <th className="text-left p-4">Quotation #</th>
                                        <th className="text-left p-4">Customer</th>
                                        <th className="text-left p-4">Date</th>
                                        <th className="text-left p-4">Valid Until</th>
                                        <th className="text-left p-4">Created By</th>
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
                                            <td className="p-4 text-xs font-semibold text-gray-600">
                                                {q.user?.name || 'System'}
                                            </td>
                                            <td className="p-4 text-right font-bold text-gray-800">₹{(q.totalAmount || 0).toLocaleString()}</td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[q.status] || 'bg-gray-100 text-gray-600'}`}>
                                                    {q.status}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                                    <button onClick={() => handlePrint(q)} title="Print" className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-bold">📄</button>
                                                    <button onClick={() => openEdit(q)} title="Edit" className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded text-xs font-bold">✏️</button>
                                                    {q.status !== 'converted' && q.status !== 'rejected' && (
                                                        <>
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
                        </div>

                        {/* Mobile Card View */}
                        <div className="lg:hidden p-4 space-y-4 bg-gray-50/50">
                            {filtered.map(q => (
                                <div key={q._id} className="bg-white rounded-2xl border border-gray-100 shadow-lg p-5 relative overflow-hidden group active:scale-[0.98] transition-all">
                                    {/* Top Line */}
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">{q.quotationNumber}</span>
                                            <h3 className="font-extrabold text-gray-900 text-base leading-tight mt-0.5">{q.customer?.companyName || q.customer?.name}</h3>
                                        </div>
                                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider shadow-sm ${STATUS_COLORS[q.status] || 'bg-gray-100 text-gray-600'}`}>
                                            {q.status}
                                        </span>
                                    </div>

                                    {/* Middle Section */}
                                    <div className="flex items-center gap-4 text-gray-500 mb-5">
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs">📅</span>
                                            <span className="text-[10px] font-bold uppercase">{new Date(q.quotationDate || q.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs">👤</span>
                                            <span className="text-[10px] font-bold uppercase truncate max-w-[80px]">{q.user?.name || 'Admin'}</span>
                                        </div>
                                    </div>

                                    {/* Amount Section */}
                                    <div className="bg-gray-900 -mx-5 -mb-5 px-5 py-4 flex justify-between items-center mt-auto">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Total Amount</span>
                                            <span className="text-xl font-black text-rose-400">₹{(q.totalAmount || 0).toLocaleString()}</span>
                                        </div>
                                        
                                        {/* Action Buttons */}
                                        <div className="flex gap-2">
                                            <button onClick={() => handlePrint(q)} className="w-9 h-9 bg-gray-800 hover:bg-gray-700 text-white rounded-xl flex items-center justify-center text-sm shadow-md transition-colors" title="Print/PDF">📄</button>
                                            <button onClick={() => shareViaWhatsApp(q, billingSettings, 'quotation')} className="w-9 h-9 bg-green-600 hover:bg-green-700 text-white rounded-xl flex items-center justify-center text-sm shadow-md transition-colors" title="WhatsApp Share">💬</button>
                                            <button onClick={() => shareViaEmail(q, billingSettings, 'quotation')} className="w-9 h-9 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center text-sm shadow-md transition-colors" title="Email Share">✉️</button>
                                            <button onClick={() => openEdit(q)} className="w-9 h-9 bg-amber-500 hover:bg-amber-600 text-white rounded-xl flex items-center justify-center text-sm shadow-md transition-colors" title="Edit">✏️</button>
                                        </div>
                                    </div>

                                    {/* Conversion Button (Floating if accepted) */}
                                    {q.status === 'accepted' && (
                                        <button 
                                            onClick={() => handleConvert(q)} 
                                            disabled={convertingId === q._id} 
                                            className="absolute top-1/2 right-4 -translate-y-12 bg-green-500 text-white px-3 py-1.5 rounded-full text-[9px] font-black uppercase shadow-lg animate-bounce"
                                        >
                                            {convertingId === q._id ? '...' : '✅ Convert to Bill'}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
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
                                    <select required value={formData.customer} onChange={e => handleCustomerChange(e.target.value)}
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
                                    {/* Desktop view */}
                                    <div className="hidden md:block space-y-3">
                                        {formData.items.map((row, idx) => {
                                            const isTile = billingSettings?.industry === 'tiles' && row.sqFtPerPc > 0;
                                            const qtyLabel = isTile
                                                ? (row.billingUnit === 'boxes' ? 'Boxes (0.5 ok)' : row.billingUnit === 'qty' ? 'Pieces' : 'Sq.Ft')
                                                : (billingSettings?.unitConfig?.quantityLabel || 'Qty');
                                            return (
                                                <div key={idx} className="grid grid-cols-12 gap-2 items-start bg-gray-50 p-3 rounded-lg">
                                                    {/* Item select — col-span-4 */}
                                                    <div className="col-span-4">
                                                        <select value={row.item} onChange={e => handleItemChange(idx, 'item', e.target.value)}
                                                            className="w-full h-9 px-2 bg-white border border-gray-100 rounded-lg text-xs font-bold focus:ring-2 focus:ring-rose-500">
                                                            <option value="">-- Item --</option>
                                                            {allItems.map(i => <option key={i._id} value={i._id}>{i.name}{i.size ? ` [${i.size}]` : ''}</option>)}
                                                        </select>
                                                        <div className="flex justify-between items-center mt-1 px-1">
                                                            {row.size && <span className="text-[8px] font-black text-amber-600 bg-amber-50 px-1 rounded">{row.size}</span>}
                                                            <span className={`text-[9px] font-black uppercase ${row.physicalStock > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                                Stock: {row.physicalStock || 0}
                                                            </span>
                                                        </div>
                                                        {row.availableBatches?.length > 0 && (
                                                            <select value={row.batchId} onChange={e => handleItemChange(idx, 'batchId', e.target.value)}
                                                                className="w-full mt-1.5 h-9 px-2 bg-white border border-gray-100 rounded-lg text-xs focus:ring-2 focus:ring-rose-500">
                                                                {row.availableBatches.map(b => <option key={b._id} value={b._id}>Batch: {b.batchNumber} — ₹{b.price} ({b.quantity})</option>)}
                                                            </select>
                                                        )}
                                                    </div>

                                                    {/* Billing mode + Qty — col-span-3 (tiles) or col-span-2 (others) */}
                                                    {isTile ? (
                                                        <div className="col-span-3">
                                                            <div className="flex rounded-lg overflow-hidden border border-gray-200 mb-1">
                                                                {[{v:'boxes',l:'📦 Box'},{v:'qty',l:'🧩 Pcs'},{v:'sqft',l:'📐 SqFt'}].map(u => (
                                                                    <button type="button" key={u.v}
                                                                        onClick={() => handleItemChange(idx, 'billingUnit', u.v)}
                                                                        className={`flex-1 py-1 text-[8px] font-black uppercase transition-all ${row.billingUnit === u.v ? 'bg-rose-600 text-white' : 'bg-white text-gray-500 hover:bg-rose-50'}`}>
                                                                        {u.l}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            <input type="number" min="0" step={row.billingUnit === 'boxes' ? '0.5' : '1'}
                                                                value={row.quantity}
                                                                onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                                                                placeholder={qtyLabel}
                                                                className="w-full h-9 px-2 bg-white border border-gray-100 rounded-lg text-xs font-bold text-center focus:ring-2 focus:ring-rose-500" />
                                                            {row.totalSqFt > 0 && (
                                                                <div className="mt-1 text-[7px] font-black text-rose-500 uppercase leading-tight">
                                                                    {row.boxCount?.toFixed(2)}box · {Math.round(row.totalPcs)}pcs · {row.totalSqFt?.toFixed(2)}sqft
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="col-span-2">
                                                            <label className="text-[9px] text-gray-400 font-bold uppercase">{qtyLabel}</label>
                                                            <input type="number" min="0" step="1" value={row.quantity}
                                                                onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                                                                className="w-full h-9 px-2 bg-white border border-gray-100 rounded-lg text-xs font-bold text-center focus:ring-2 focus:ring-rose-500" />
                                                        </div>
                                                    )}

                                                    {/* Rate — col-span-2 */}
                                                    <div className="col-span-2">
                                                        <label className="text-[9px] text-gray-400 font-bold uppercase">
                                                            {isTile ? 'Rate / SqFt' : (billingSettings?.unitConfig?.rateLabel || 'Rate')}
                                                        </label>
                                                        <input type="number" min="0" step="0.01" value={row.price}
                                                            onChange={e => handleItemChange(idx, 'price', e.target.value)}
                                                            className="w-full h-9 px-2 bg-white border border-gray-100 rounded-lg text-xs font-bold text-right focus:ring-2 focus:ring-rose-500" />
                                                    </div>

                                                    {/* Total — col-span-2 */}
                                                    <div className="col-span-2">
                                                        <label className="text-[9px] text-gray-400 font-bold uppercase">Total</label>
                                                        <div className="h-9 px-2 bg-gray-900 text-white border border-gray-200 rounded-lg text-xs font-black text-right flex items-center justify-end">
                                                            ₹{(row.total || 0).toLocaleString()}
                                                        </div>
                                                    </div>

                                                    {/* Remove — col-span-1 */}
                                                    <div className="col-span-1 flex items-end justify-end">
                                                        {formData.items.length > 1 && (
                                                            <button type="button" onClick={() => setFormData(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))}
                                                                className="h-9 w-9 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg text-xs font-bold">✕</button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>


                                    {/* Mobile view */}
                                    <div className="md:hidden space-y-4">
                                        {formData.items.map((row, idx) => (
                                            <div key={idx} className="bg-white border-2 border-gray-100 rounded-2xl p-4 shadow-sm relative space-y-4">
                                                <button type="button" onClick={() => setFormData(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))} className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-red-50 text-red-500 rounded-full font-bold">✕</button>

                                                {(() => {
                                                    const isTile = billingSettings?.industry === 'tiles' && row.sqFtPerPc > 0;
                                                    return (<>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Select Item</label>
                                                            <select value={row.item} onChange={e => handleItemChange(idx, 'item', e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none font-bold text-sm">
                                                                <option value="">-- Item --</option>
                                                                {allItems.map(i => <option key={i._id} value={i._id}>{i.name}{i.size ? ` [${i.size}]` : ''}</option>)}
                                                            </select>
                                                            <div className="flex justify-between items-center px-1">
                                                                {row.size && <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-1.5 rounded">{row.size}</span>}
                                                                <span className={`text-[10px] font-black uppercase ${row.physicalStock > 0 ? 'text-green-500' : 'text-red-500'}`}>Stock: {row.physicalStock || 0}</span>
                                                            </div>
                                                        </div>

                                                        {row.availableBatches?.length > 0 && (
                                                            <div className="space-y-1">
                                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Batch</label>
                                                                <select value={row.batchId} onChange={e => handleItemChange(idx, 'batchId', e.target.value)} className="w-full px-4 py-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-800 font-bold outline-none text-sm">
                                                                    {row.availableBatches.map(b => <option key={b._id} value={b._id}>Batch: {b.batchNumber} — ₹{b.price} ({b.quantity})</option>)}
                                                                </select>
                                                            </div>
                                                        )}

                                                        {isTile && (
                                                            <div className="space-y-1">
                                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Billing Mode</label>
                                                                <div className="flex rounded-xl overflow-hidden border border-gray-200">
                                                                    {[{v:'boxes',l:'📦 Box'},{v:'qty',l:'🧩 Pieces'},{v:'sqft',l:'📐 SqFt'}].map(u => (
                                                                        <button type="button" key={u.v}
                                                                            onClick={() => handleItemChange(idx, 'billingUnit', u.v)}
                                                                            className={`flex-1 py-2.5 text-[10px] font-black uppercase transition-all ${row.billingUnit === u.v ? 'bg-rose-600 text-white' : 'bg-white text-gray-500'}`}>
                                                                            {u.l}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="space-y-1">
                                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                                    {isTile ? (row.billingUnit === 'boxes' ? 'Boxes (0.5 ok)' : row.billingUnit === 'qty' ? 'Pieces' : 'Sq.Ft') : 'Qty'}
                                                                </label>
                                                                <input type="number" min="0" step={isTile && row.billingUnit === 'boxes' ? '0.5' : '1'}
                                                                    value={row.quantity} onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                                                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none text-center font-bold" />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                                    {isTile ? 'Rate / SqFt' : 'Rate'}
                                                                </label>
                                                                <input type="number" min="0" step="0.01" value={row.price}
                                                                    onChange={e => handleItemChange(idx, 'price', e.target.value)}
                                                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none font-bold text-right" />
                                                            </div>
                                                        </div>

                                                        {isTile && row.totalSqFt > 0 && (
                                                            <div className="flex justify-between items-center px-3 py-2 bg-rose-50 rounded-xl border border-rose-100">
                                                                <span className="text-[10px] font-black text-rose-700 uppercase">{row.boxCount?.toFixed(2)} Boxes</span>
                                                                <span className="text-[10px] font-black text-rose-700 uppercase">{Math.round(row.totalPcs)} Pcs</span>
                                                                <span className="text-[10px] font-black text-rose-700 uppercase">{row.totalSqFt?.toFixed(2)} SqFt</span>
                                                            </div>
                                                        )}

                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total</label>
                                                            <div className="w-full px-4 py-3 bg-gray-900 text-white rounded-xl font-black text-right text-lg">₹{(row.total || 0).toLocaleString()}</div>
                                                        </div>
                                                    </>);
                                                })()}
                                            </div>
                                        ))}
                                    </div>

                                </div>
                            </div>

                            {/* Charges */}
                            <div className="grid grid-cols-2 md:grid-cols-7 gap-4 bg-gray-50 p-4 rounded-xl">
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
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Unloading</label>
                                    <input type="number" min="0" step="0.01" value={formData.unloadingCharges}
                                        onChange={e => setFormData(p => ({ ...p, unloadingCharges: e.target.value }))}
                                        className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-rose-500" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Transport</label>
                                    <input type="number" min="0" step="0.01" value={formData.transportCharges}
                                        onChange={e => setFormData(p => ({ ...p, transportCharges: e.target.value }))}
                                        className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-rose-500" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                        Old Bal {fetchingBalance && <span className="animate-pulse">⏳</span>}
                                    </label>
                                    <input type="number" value={formData.oldBalance}
                                        onChange={e => setFormData(p => ({ ...p, oldBalance: e.target.value }))}
                                        className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm font-bold text-red-600 focus:ring-2 focus:ring-rose-500" />
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
                                    <div>Old Balance Reflected: ₹{(Number(formData.oldBalance) || 0).toLocaleString()}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-gray-400 uppercase tracking-widest">Net Amount</div>
                                    <div className="text-2xl font-black text-rose-500">₹{net.toLocaleString()}</div>
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
