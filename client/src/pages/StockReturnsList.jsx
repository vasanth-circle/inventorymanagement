import React, { useState, useEffect, useContext, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { printReturnSlip } from '../utils/printTemplates';
import { InventoryContext } from '../context/InventoryContext';
import { PencilSquareIcon, TrashIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

const API_URL = '/api/transactions';
const authHeader = () => ({ Authorization: `Bearer ${sessionStorage.getItem('token')}` });

// ─── Edit Modal ────────────────────────────────────────────────────────────────
const EditModal = ({ tx, onClose, onSave }) => {
    const [form, setForm] = useState({
        quantity: tx.quantity,
        rate: tx.rate || 0,
        total: tx.total !== undefined ? tx.total : (tx.quantity || 0) * (tx.rate || 0),
        settlementType: tx.settlementType || 'ledger',
        reason: tx.reason || '',
        notes: tx.notes || '',
    });
    const [saving, setSaving] = useState(false);

    const entityName = tx.customer?.companyName || tx.customer?.name || tx.vendor?.companyName || tx.vendor?.name || 'Unknown';

    const handleQtyOrRateChange = (field, value) => {
        const updated = { ...form, [field]: value };
        updated.total = (parseFloat(updated.quantity) || 0) * (parseFloat(updated.rate) || 0);
        setForm(updated);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.quantity || Number(form.quantity) <= 0) return toast.error('Enter a valid quantity');
        setSaving(true);
        try {
            await axios.put(`${API_URL}/return/${tx._id}`, {
                quantity: Number(form.quantity),
                rate: Number(form.rate),
                total: Number(form.total),
                settlementType: form.settlementType,
                reason: form.reason,
                notes: form.notes,
            }, { headers: authHeader() });
            toast.success('Return entry updated successfully');
            onSave();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update return');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4 text-white">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-lg font-black">Edit Return Entry</h2>
                            <p className="text-indigo-200 text-xs mt-0.5">
                                {entityName} · {tx.item?.name} · {tx.returnType === 'customer' ? 'Customer Return' : 'Vendor Return'}
                            </p>
                        </div>
                        <button onClick={onClose} className="text-indigo-200 hover:text-white text-2xl font-bold">×</button>
                    </div>
                </div>

                {/* Read-only info */}
                <div className="flex gap-3 px-6 py-3 bg-amber-50 border-b border-amber-100">
                    <span className="text-amber-600 text-sm">⚠️</span>
                    <p className="text-xs text-amber-700 font-medium">
                        <strong>Item and Party are fixed.</strong> To change those, delete this entry and create a new one.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Quantity *</label>
                            <input
                                type="number" min="1" required
                                value={form.quantity}
                                onChange={e => handleQtyOrRateChange('quantity', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Rate (₹)</label>
                            <input
                                type="number" min="0" step="0.01"
                                value={form.rate}
                                onChange={e => handleQtyOrRateChange('rate', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Total Amount (₹)</label>
                        <input
                            type="number" min="0" step="0.01"
                            value={form.total}
                            onChange={e => setForm({ ...form, total: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">Auto-calculated from Qty × Rate, or override manually.</p>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Settlement Type</label>
                        <select
                            value={form.settlementType}
                            onChange={e => setForm({ ...form, settlementType: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                        >
                            <option value="ledger">📒 Ledger Credit</option>
                            <option value="cash">💵 Cash</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Reason</label>
                        <input
                            type="text"
                            value={form.reason}
                            onChange={e => setForm({ ...form, reason: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                            placeholder="e.g. Damaged goods, Wrong item"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Notes</label>
                        <textarea
                            value={form.notes}
                            onChange={e => setForm({ ...form, notes: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                            rows={2}
                            placeholder="Any additional notes..."
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-50">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ─── Delete Confirm Modal ──────────────────────────────────────────────────────
const DeleteModal = ({ tx, onClose, onDeleted }) => {
    const [deleting, setDeleting] = useState(false);
    const entityName = tx.customer?.companyName || tx.customer?.name || tx.vendor?.companyName || tx.vendor?.name || 'Unknown';
    const amount = tx.total !== undefined ? tx.total : (tx.quantity || 0) * (tx.rate || 0);

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await axios.delete(`${API_URL}/return/${tx._id}`, { headers: authHeader() });
            toast.success('Return entry deleted — stock and ledger reversed');
            onDeleted(tx._id);
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete return');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                <div className="p-6 text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <TrashIcon className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-lg font-black text-gray-800 mb-1">Delete Return Entry?</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        <strong>{entityName}</strong> — {tx.item?.name}
                    </p>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-left space-y-1">
                        <p className="text-xs font-bold text-red-700">This action will:</p>
                        <p className="text-xs text-red-600">• Reverse the stock change ({tx.quantity} qty {tx.returnType === 'customer' ? 'will be removed' : 'will be added back'})</p>
                        <p className="text-xs text-red-600">• Remove the ledger entries (₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {tx.settlementType === 'cash' ? 'cash' : 'credit'} reversed)</p>
                        <p className="text-xs text-red-600">• This cannot be undone</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-50">
                            Cancel
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={deleting}
                            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                            {deleting ? 'Deleting...' : 'Yes, Delete'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const StockReturnsList = () => {
    const { billingSettings } = useContext(InventoryContext);
    const [returns, setReturns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [editingTx, setEditingTx] = useState(null);
    const [deletingTx, setDeletingTx] = useState(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    useEffect(() => { fetchReturns(); }, []);
    useEffect(() => { setCurrentPage(1); }, [searchTerm, fromDate, toDate]);

    const fetchReturns = async () => {
        try {
            const res = await axios.get(`${API_URL}?type=return&limit=1000`, { headers: authHeader() });
            setReturns(res.data.transactions || []);
        } catch {
            toast.error('Failed to fetch returns');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleted = (id) => setReturns(prev => prev.filter(tx => tx._id !== id));
    const handleSaved = () => fetchReturns();
    const handlePrint = (txGroup) => {
        const returnTx = {
            ...txGroup,
            items: txGroup.items.map(t => {
                const isTile = billingSettings?.industry === 'tiles' && t.item?.sqFtPerPc > 0 && !['pieces', 'pcs', 'nos', 'piece'].includes((t.item?.unitType || '').toLowerCase());
                return {
                    name: t.item?.name || 'Unknown',
                    brand: t.item?.brand,
                    size: t.item?.size,
                    hsnCode: t.item?.hsnCode || t.item?.hsn || '',
                    quantity: t.quantity || 0,
                    boxCount: isTile ? ((t.quantity || 0) / (t.item?.pcsPerBox || 1)) : undefined,
                    price: t.rate || 0,
                    total: t.total !== undefined ? t.total : ((t.quantity || 0) * (t.rate || 0)),
                    taxRate: t.item?.taxRate || 0,
                    billingUnit: t.item?.billingUnit || t.item?.unitType || 'Nos',
                    item: t.item
                };
            })
        };
        printReturnSlip(returnTx, billingSettings);
    };

    const [expandedGroups, setExpandedGroups] = useState(new Set());

    const toggleGroup = (groupId) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupId)) next.delete(groupId);
            else next.add(groupId);
            return next;
        });
    };

    const groupedReturns = useMemo(() => {
        const groups = {};
        returns.forEach(tx => {
            const date = new Date(tx.createdAt).toLocaleDateString('en-IN');
            const ref = tx.referenceOrder || 'NO-REF';
            const cust = tx.customer?._id || tx.vendor?._id || 'NO-ENT';
            const key = `${date}-${ref}-${cust}`;
            if (!groups[key]) {
                groups[key] = {
                    ...tx,
                    _id: key,
                    isGroup: true,
                    items: [tx],
                    totalAmount: tx.total !== undefined ? tx.total : ((tx.quantity || 0) * (tx.rate || 0)),
                    totalQty: tx.quantity || 0,
                };
            } else {
                groups[key].items.push(tx);
                groups[key].totalAmount += (tx.total !== undefined ? tx.total : ((tx.quantity || 0) * (tx.rate || 0)));
                groups[key].totalQty += (tx.quantity || 0);
            }
        });
        return Object.values(groups).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }, [returns]);

    const filteredReturns = groupedReturns.filter(group => {
        const entityName = (group.customer?.name || group.customer?.companyName || group.vendor?.name || group.vendor?.companyName || '').toLowerCase();
        const matchSearch = !searchTerm || entityName.includes(searchTerm.toLowerCase()) || group.items.some(it => (it.item?.name || '').toLowerCase().includes(searchTerm.toLowerCase()));
        
        let matchDate = true;
        if (fromDate || toDate) {
            const txDate = new Date(group.createdAt).setHours(0, 0, 0, 0);
            const start = fromDate ? new Date(fromDate).setHours(0, 0, 0, 0) : null;
            const end = toDate ? new Date(toDate).setHours(0, 0, 0, 0) : null;
            if (start && end) matchDate = txDate >= start && txDate <= end;
            else if (start) matchDate = txDate >= start;
            else if (end) matchDate = txDate <= end;
        }
        return matchSearch && matchDate;
    });

    const totalFiltered = filteredReturns.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / itemsPerPage));
    const paginatedReturns = filteredReturns.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="space-y-6">
            {/* Modals */}
            {editingTx && <EditModal tx={editingTx} onClose={() => setEditingTx(null)} onSave={handleSaved} />}
            {deletingTx && <DeleteModal tx={deletingTx} onClose={() => setDeletingTx(null)} onDeleted={handleDeleted} />}

            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Stock Returns List</h1>
            </div>

            <div className="flex gap-3 flex-wrap">
                <input
                    type="text"
                    placeholder="Search by customer, vendor or item..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="flex-1 min-w-[200px] h-10 px-4 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none shadow-sm"
                />
                <div className="flex items-center gap-2">
                    <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                        className="h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none shadow-sm" title="From Date" />
                    <span className="text-gray-500 text-sm font-medium">to</span>
                    <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                        className="h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none shadow-sm" title="To Date" />
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Desktop Table */}
                    <div className="hidden lg:block bg-white rounded-xl shadow-md overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase">Date</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase">Entity</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase">Item</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase text-center">Qty</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase text-right">Amount</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase text-center">Settlement</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paginatedReturns.map((group) => {
                                    const entityName = group.customer?.companyName || group.customer?.name || group.vendor?.companyName || group.vendor?.name || 'Unknown';
                                    const entityType = group.returnType === 'customer' ? 'Customer' : 'Vendor';
                                    const amount = group.totalAmount;
                                    const isExpanded = expandedGroups.has(group._id);

                                    return (
                                        <React.Fragment key={group._id}>
                                            <tr className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                                                <td className="px-6 py-4 text-gray-600 text-sm font-medium whitespace-nowrap">
                                                    {new Date(group.createdAt).toLocaleDateString('en-IN')}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-gray-900 font-bold text-sm">{entityName}</p>
                                                    <span className={`text-[10px] font-bold uppercase ${entityType === 'Customer' ? 'text-blue-500' : 'text-purple-500'}`}>{entityType}</span>
                                                    {group.referenceOrder && <span className="block text-[10px] text-gray-500 mt-0.5">Ref: {group.referenceOrder}</span>}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button onClick={() => toggleGroup(group._id)} className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-semibold text-sm transition-colors">
                                                        {isExpanded ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
                                                        {group.items.length} {group.items.length === 1 ? 'Item' : 'Items'}
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4 text-center font-bold text-gray-900">{group.totalQty}</td>
                                                <td className="px-6 py-4 font-bold text-gray-900 text-right whitespace-nowrap">
                                                    ₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${group.settlementType === 'cash' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                                        {group.settlementType === 'cash' ? '💵 Cash' : '📒 Ledger'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => handlePrint(group)}
                                                            className="text-primary-600 hover:text-primary-800 text-xs font-bold border border-primary-200 px-2.5 py-1.5 rounded-lg bg-primary-50 transition-all hover:bg-primary-100 whitespace-nowrap"
                                                            title="Print Slip"
                                                        >
                                                            🖨️ Print
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {isExpanded && group.items.map((tx, idx) => (
                                                <tr key={tx._id} className="bg-indigo-50/30 border-b border-indigo-50 last:border-b-0">
                                                    <td className="px-6 py-3 pl-12">
                                                        <span className="text-[10px] text-gray-400 font-bold uppercase">Item {idx + 1}</span>
                                                    </td>
                                                    <td colSpan="2" className="px-6 py-3">
                                                        <p className="text-sm font-semibold text-gray-800">{tx.item?.name || 'Unknown'}</p>
                                                        {(tx.item?.brand || tx.item?.size) && (
                                                            <span className="text-[10px] text-gray-500">{[tx.item?.brand, tx.item?.size].filter(Boolean).join(' · ')}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-3 text-center text-sm font-bold text-gray-700">{tx.quantity}</td>
                                                    <td className="px-6 py-3 text-right text-sm font-bold text-gray-700">
                                                        ₹{(tx.total !== undefined ? tx.total : ((tx.quantity || 0) * (tx.rate || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td colSpan="2" className="px-6 py-3">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => setEditingTx(tx)}
                                                                className="p-1.5 rounded-lg text-indigo-500 hover:text-indigo-700 hover:bg-white border border-transparent hover:border-indigo-100 transition-colors"
                                                                title="Edit Item"
                                                            >
                                                                <PencilSquareIcon className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => setDeletingTx(tx)}
                                                                className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-white border border-transparent hover:border-red-100 transition-colors"
                                                                title="Delete Item"
                                                            >
                                                                <TrashIcon className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    );
                                })}
                                {paginatedReturns.length === 0 && (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-12 text-center text-gray-400">
                                            <div className="text-4xl mb-2">📦</div>
                                            <p>No returns found</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="lg:hidden space-y-3">
                        {paginatedReturns.map((group) => {
                            const entityName = group.customer?.companyName || group.customer?.name || group.vendor?.companyName || group.vendor?.name || 'Unknown';
                            const amount = group.totalAmount;
                            const isExpanded = expandedGroups.has(group._id);
                            return (
                                <div key={group._id} className="bg-white rounded-2xl border border-gray-100 shadow-md p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <span className="text-[10px] font-black text-gray-400 uppercase">{new Date(group.createdAt).toLocaleDateString('en-IN')}</span>
                                            <h3 className="font-extrabold text-gray-900 text-sm mt-0.5">{entityName}</h3>
                                            {group.referenceOrder && <span className="block text-[10px] text-gray-500">Ref: {group.referenceOrder}</span>}
                                        </div>
                                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${group.returnType === 'customer' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                            {group.returnType}
                                        </span>
                                    </div>
                                    <div className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-1 cursor-pointer" onClick={() => toggleGroup(group._id)}>
                                        {isExpanded ? <ChevronDownIcon className="w-4 h-4 text-indigo-500" /> : <ChevronRightIcon className="w-4 h-4 text-indigo-500" />}
                                        <span className="text-indigo-600 font-bold">{group.items.length} {group.items.length === 1 ? 'Item' : 'Items'}</span> 
                                        <span className="text-gray-400 mx-1">•</span> 
                                        {group.totalQty} Qty
                                    </div>
                                    
                                    {isExpanded && (
                                        <div className="mb-3 space-y-2 border-l-2 border-indigo-100 pl-3">
                                            {group.items.map((tx, idx) => (
                                                <div key={tx._id} className="bg-gray-50 p-2 rounded-lg">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="text-xs font-semibold text-gray-800">{tx.item?.name || 'Unknown'}</span>
                                                        <span className="text-xs font-bold text-gray-600">₹{(tx.total !== undefined ? tx.total : ((tx.quantity || 0) * (tx.rate || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center mt-2">
                                                        <span className="text-[10px] font-bold text-gray-500">Qty: {tx.quantity}</span>
                                                        <div className="flex gap-2">
                                                            <button onClick={() => setEditingTx(tx)} className="p-1.5 rounded-lg text-indigo-500 hover:text-indigo-700 hover:bg-white transition-colors">
                                                                <PencilSquareIcon className="w-4 h-4" />
                                                            </button>
                                                            <button onClick={() => setDeletingTx(tx)} className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-white transition-colors">
                                                                <TrashIcon className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center pt-3 border-t border-gray-50">
                                        <div>
                                            <span className="font-black text-gray-900">₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                            <span className={`block text-[9px] font-black uppercase mt-1 ${group.settlementType === 'cash' ? 'text-green-600' : 'text-gray-500'}`}>
                                                {group.settlementType === 'cash' ? '💵 Cash Refund' : '📒 Ledger Credit'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => handlePrint(group)} className="h-8 px-3 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded-lg text-xs font-bold border border-primary-200">
                                                🖨️ Print
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                            <span className="text-sm text-gray-600 font-medium">
                                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalFiltered)} of {totalFiltered}
                            </span>
                            <div className="flex gap-2">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                                    Previous
                                </button>
                                <span className="px-4 py-2 text-sm font-bold text-gray-800 bg-gray-50 rounded-lg hidden sm:block">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default StockReturnsList;
