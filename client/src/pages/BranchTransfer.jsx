import { useContext, useState, useEffect } from 'react';
import { InventoryContext } from '../context/InventoryContext';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';

const BranchTransfer = () => {
    const { branches, fetchBranches } = useContext(InventoryContext);
    const { activeBranchId } = useContext(AuthContext);

    const [fromBranch, setFromBranch] = useState(activeBranchId || '');
    const [toBranch, setToBranch] = useState('');
    const [itemSearch, setItemSearch] = useState('');
    const [items, setItems] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [quantity, setQuantity] = useState('');
    const [notes, setNotes] = useState('');
    const [transferring, setTransferring] = useState(false);
    const [history, setHistory] = useState([]);
    const [historyPage, setHistoryPage] = useState(1);
    const [historyTotal, setHistoryTotal] = useState(0);
    const [activeTab, setActiveTab] = useState('transfer');

    useEffect(() => { fetchBranches(); }, []);
    useEffect(() => { fetchHistory(); }, [historyPage]);

    const fetchHistory = async () => {
        try {
            const { data } = await api.get(`/branches/transfer-history?page=${historyPage}&limit=15`);
            setHistory(data.data || []);
            setHistoryTotal(data.total || 0);
        } catch (e) {
            console.error('Failed to fetch transfer history');
        }
    };

    const searchItems = async (q) => {
        setItemSearch(q);
        setSelectedItem(null);
        if (q.length < 2) { setItems([]); return; }
        try {
            const { data } = await api.get(`/items?search=${encodeURIComponent(q)}&limit=10`);
            setItems(data.items || []);
        } catch (e) {
            console.error('Item search failed');
        }
    };

    const getBranchStock = (item, branchId) => {
        if (!item) return 0;
        const entry = item.branchStock?.find(bs => bs.branchId === branchId || bs.branchId?._id === branchId);
        // If no branch entry, fall back to global quantity for legacy items
        return entry ? entry.quantity : (item.quantity || 0);
    };

    const handleTransfer = async (e) => {
        e.preventDefault();
        if (!fromBranch || !toBranch || !selectedItem || !quantity) return toast.error('All fields are required');
        if (fromBranch === toBranch) return toast.error('From and To branch must be different');
        const qty = parseFloat(quantity);
        if (isNaN(qty) || qty <= 0) return toast.error('Enter a valid quantity');

        setTransferring(true);
        try {
            await api.post('/branches/transfer', {
                fromBranchId: fromBranch,
                toBranchId: toBranch,
                itemId: selectedItem._id,
                quantity: qty,
                notes,
            });
            toast.success(`✅ Transferred ${qty} units of "${selectedItem.name}" successfully!`);
            setSelectedItem(null);
            setItemSearch('');
            setItems([]);
            setQuantity('');
            setNotes('');
            fetchHistory();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Transfer failed');
        } finally {
            setTransferring(false);
        }
    };

    const fromBranchName = branches.find(b => b._id === fromBranch)?.name;
    const toBranchName = branches.find(b => b._id === toBranch)?.name;

    return (
        <div className="max-w-5xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Branch Stock Transfer</h1>
                <p className="text-sm text-gray-500 mt-0.5">Move inventory between your business branches</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
                {['transfer', 'history'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-5 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        {tab === 'transfer' ? '🔄 New Transfer' : '📋 History'}
                    </button>
                ))}
            </div>

            {activeTab === 'transfer' && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                        <h2 className="font-bold text-gray-800 dark:text-white">Transfer Details</h2>
                    </div>
                    <form onSubmit={handleTransfer} className="p-6 space-y-5">
                        {/* Branch Selectors */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">From Branch *</label>
                                <select
                                    value={fromBranch}
                                    onChange={e => { setFromBranch(e.target.value); setSelectedItem(null); }}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                    required
                                >
                                    <option value="">Select source branch</option>
                                    {branches.map(b => (
                                        <option key={b._id} value={b._id}>{b.name} ({b.code})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">To Branch *</label>
                                <select
                                    value={toBranch}
                                    onChange={e => setToBranch(e.target.value)}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                    required
                                >
                                    <option value="">Select destination branch</option>
                                    {branches.filter(b => b._id !== fromBranch).map(b => (
                                        <option key={b._id} value={b._id}>{b.name} ({b.code})</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Transfer Arrow Visual */}
                        {fromBranch && toBranch && (
                            <div className="flex items-center justify-center gap-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                                <span className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg font-medium">{fromBranchName}</span>
                                <span className="text-2xl">→</span>
                                <span className="px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg font-medium">{toBranchName}</span>
                            </div>
                        )}

                        {/* Item Search */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Item *</label>
                            <input
                                type="text"
                                value={selectedItem ? selectedItem.name : itemSearch}
                                onChange={e => { if (!selectedItem) searchItems(e.target.value); }}
                                onFocus={() => { if (selectedItem) { setSelectedItem(null); setItemSearch(''); } }}
                                placeholder="Search item by name or barcode..."
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                required={!selectedItem}
                            />
                            {items.length > 0 && !selectedItem && (
                                <div className="mt-1 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 shadow-lg max-h-48 overflow-y-auto">
                                    {items.map(item => (
                                        <button
                                            key={item._id}
                                            type="button"
                                            onClick={() => { setSelectedItem(item); setItems([]); }}
                                            className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-600 text-sm border-b border-gray-100 dark:border-gray-600 last:border-0"
                                        >
                                            <span className="font-medium text-gray-900 dark:text-white">{item.name}</span>
                                            {item.sku && <span className="ml-2 text-xs text-gray-400">SKU: {item.sku}</span>}
                                            <span className="ml-2 text-xs text-gray-500">Stock: {getBranchStock(item, fromBranch)}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Selected item info */}
                        {selectedItem && fromBranch && (
                            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 text-sm">
                                <div>
                                    <span className="font-semibold text-blue-800 dark:text-blue-200">{selectedItem.name}</span>
                                    {selectedItem.sku && <span className="ml-2 text-blue-600 dark:text-blue-400 text-xs">SKU: {selectedItem.sku}</span>}
                                </div>
                                <span className="text-blue-700 dark:text-blue-300 font-medium">
                                    Available at source: <strong>{getBranchStock(selectedItem, fromBranch)}</strong>
                                </span>
                            </div>
                        )}

                        {/* Quantity */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Quantity *</label>
                                <input
                                    type="number"
                                    value={quantity}
                                    onChange={e => setQuantity(e.target.value)}
                                    min="0.01"
                                    step="any"
                                    placeholder="0"
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Notes</label>
                                <input
                                    type="text"
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Optional reason"
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={transferring}
                            className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                            {transferring ? <><span className="animate-spin">⏳</span> Transferring...</> : <><span>🔄</span> Transfer Stock</>}
                        </button>
                    </form>
                </div>
            )}

            {activeTab === 'history' && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                        <h2 className="font-bold text-gray-800 dark:text-white">Transfer History</h2>
                        <span className="text-sm text-gray-500">{historyTotal} transfers</span>
                    </div>
                    {history.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                            <div className="text-4xl mb-2">📋</div>
                            <p>No transfers yet</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-700 text-xs text-gray-500 uppercase tracking-wider">
                                        <th className="px-4 py-3 text-left">Item</th>
                                        <th className="px-4 py-3 text-left">From</th>
                                        <th className="px-4 py-3 text-left">To</th>
                                        <th className="px-4 py-3 text-right">Qty</th>
                                        <th className="px-4 py-3 text-left">By</th>
                                        <th className="px-4 py-3 text-left">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {history.map(t => {
                                        const fb = branches.find(b => b._id === (t.branchId?._id || t.branchId));
                                        const tb = branches.find(b => b._id === (t.toBranchId?._id || t.toBranchId));
                                        return (
                                            <tr key={t._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{t.item?.name || '—'}</td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{fb?.name || t.fromLocation || '—'}</td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{tb?.name || t.toLocation || '—'}</td>
                                                <td className="px-4 py-3 text-right font-semibold text-blue-600 dark:text-blue-400">{t.quantity}</td>
                                                <td className="px-4 py-3 text-gray-500">{t.user?.name || '—'}</td>
                                                <td className="px-4 py-3 text-gray-400 text-xs">{new Date(t.createdAt).toLocaleDateString()}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {historyTotal > 15 && (
                        <div className="p-4 flex items-center justify-between border-t border-gray-100 dark:border-gray-700">
                            <button disabled={historyPage === 1} onClick={() => setHistoryPage(p => p - 1)} className="px-3 py-1.5 text-sm text-gray-600 border rounded-lg disabled:opacity-40 hover:bg-gray-50">← Prev</button>
                            <span className="text-xs text-gray-500">Page {historyPage}</span>
                            <button disabled={historyPage * 15 >= historyTotal} onClick={() => setHistoryPage(p => p + 1)} className="px-3 py-1.5 text-sm text-gray-600 border rounded-lg disabled:opacity-40 hover:bg-gray-50">Next →</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default BranchTransfer;
