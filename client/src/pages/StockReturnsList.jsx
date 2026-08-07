import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { printReturnSlip } from '../utils/printTemplates';
import { InventoryContext } from '../context/InventoryContext';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

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
    const handlePrint = (tx) => printReturnSlip(tx, billingSettings);

    const filteredReturns = returns.filter(tx => {
        const entityName = (tx.customer?.name || tx.customer?.companyName || tx.vendor?.name || tx.vendor?.companyName || '').toLowerCase();
        const itemName = (tx.item?.name || '').toLowerCase();
        const matchSearch = !searchTerm || entityName.includes(searchTerm.toLowerCase()) || itemName.includes(searchTerm.toLowerCase());
        let matchDate = true;
        if (fromDate || toDate) {
            const txDate = new Date(tx.createdAt).setHours(0, 0, 0, 0);
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
                                {paginatedReturns.map((tx) => {
                                    const entityName = tx.customer?.companyName || tx.customer?.name || tx.vendor?.companyName || tx.vendor?.name || 'Unknown';
                                    const entityType = tx.returnType === 'customer' ? 'Customer' : 'Vendor';
                                    const amount = tx.total !== undefined ? tx.total : ((tx.quantity || 0) * (tx.rate || 0));

                                    return (
                                        <tr key={tx._id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 text-gray-600 text-sm font-medium whitespace-nowrap">
                                                {new Date(tx.createdAt).toLocaleDateString('en-IN')}
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-gray-900 font-bold text-sm">{entityName}</p>
                                                <span className={`text-[10px] font-bold uppercase ${entityType === 'Customer' ? 'text-blue-500' : 'text-purple-500'}`}>{entityType}</span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-700 font-medium text-sm">{tx.item?.name || 'N/A'}</td>
                                            <td className="px-6 py-4 text-center font-bold text-gray-900">{tx.quantity}</td>
                                            <td className="px-6 py-4 font-bold text-gray-900 text-right whitespace-nowrap">
                                                ₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${tx.settlementType === 'cash' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                                    {tx.settlementType === 'cash' ? '💵 Cash' : '📒 Ledger'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => handlePrint(tx)}
                                                        className="text-primary-600 hover:text-primary-800 text-xs font-bold border border-primary-200 px-2.5 py-1.5 rounded-lg bg-primary-50 transition-all hover:bg-primary-100 whitespace-nowrap"
                                                        title="Print Slip"
                                                    >
                                                        🖨️ Print
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingTx(tx)}
                                                        className="p-1.5 rounded-lg text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 transition-colors"
                                                        title="Edit Return"
                                                    >
                                                        <PencilSquareIcon className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setDeletingTx(tx)}
                                                        className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                        title="Delete Return"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
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
                        {paginatedReturns.map((tx) => {
                            const entityName = tx.customer?.companyName || tx.customer?.name || tx.vendor?.companyName || tx.vendor?.name || 'Unknown';
                            const amount = tx.total !== undefined ? tx.total : (tx.quantity || 0) * (tx.rate || 0);
                            return (
                                <div key={tx._id} className="bg-white rounded-2xl border border-gray-100 shadow-md p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <span className="text-[10px] font-black text-gray-400 uppercase">{new Date(tx.createdAt).toLocaleDateString('en-IN')}</span>
                                            <h3 className="font-extrabold text-gray-900 text-sm mt-0.5">{entityName}</h3>
                                        </div>
                                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${tx.returnType === 'customer' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                            {tx.returnType}
                                        </span>
                                    </div>
                                    <div className="text-sm font-medium text-gray-600 mb-3">{tx.item?.name} × {tx.quantity}</div>
                                    <div className="flex justify-between items-center pt-3 border-t border-gray-50">
                                        <div>
                                            <span className="font-black text-gray-900">₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                            <span className={`block text-[9px] font-black uppercase mt-1 ${tx.settlementType === 'cash' ? 'text-green-600' : 'text-gray-500'}`}>
                                                {tx.settlementType === 'cash' ? '💵 Cash Refund' : '📒 Ledger Credit'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => handlePrint(tx)} className="h-8 px-3 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded-lg text-xs font-bold border border-primary-200">
                                                🖨️
                                            </button>
                                            <button onClick={() => setEditingTx(tx)} className="h-8 w-8 flex items-center justify-center bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg border border-indigo-200">
                                                <PencilSquareIcon className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => setDeletingTx(tx)} className="h-8 w-8 flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-500 rounded-lg border border-red-200">
                                                <TrashIcon className="w-4 h-4" />
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
