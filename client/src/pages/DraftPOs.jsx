import { useState, useEffect, useContext } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { InventoryContext } from '../context/InventoryContext';
import SearchableSelect from '../components/SearchableSelect';
import FullScreenModal from '../components/FullScreenModal';
import { printDraftPO } from '../utils/printTemplates';
import { confirmDelete } from '../utils/confirmHelper';

const DraftPOs = () => {
    const { items: allItems, fetchItems, billingSettings } = useContext(InventoryContext);
    const [draftPOs, setDraftPOs] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    // Form state
    const [vendorName, setVendorName] = useState('');
    const [notes, setNotes] = useState('');
    const [selectedItems, setSelectedItems] = useState([]);

    const fetchDraftPOs = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/draft-pos');
            setDraftPOs(data);
        } catch (error) {
            toast.error('Failed to load Draft POs');
        } finally {
            setLoading(false);
        }
    };

    const fetchVendors = async () => {
        try {
            const { data } = await api.get('/vendors?limit=1000');
            setVendors(data?.data?.vendors || []);
        } catch (error) {
            console.error('Failed to fetch vendors');
        }
    };

    useEffect(() => {
        fetchDraftPOs();
        fetchVendors();
        if (allItems.length === 0) {
            fetchItems();
        }
    }, []);

    const handleAddItem = (itemObj) => {
        if (!itemObj) return;
        const exists = selectedItems.find(i => i.item === itemObj._id);
        if (exists) {
            toast.error('Item already added');
            return;
        }
        setSelectedItems([...selectedItems, {
            item: itemObj._id,
            name: itemObj.name,
            quantity: 1,
            price: itemObj.purchasePrice || itemObj.price || 0,
            unitType: itemObj.unitType || 'Nos'
        }]);
    };

    const updateItemQty = (index, qty) => {
        const newItems = [...selectedItems];
        newItems[index].quantity = qty;
        setSelectedItems(newItems);
    };
    
    const updateItemPrice = (index, price) => {
        const newItems = [...selectedItems];
        newItems[index].price = price;
        setSelectedItems(newItems);
    };

    const removeItem = (index) => {
        setSelectedItems(selectedItems.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (selectedItems.length === 0) {
            toast.error('Please add at least one item');
            return;
        }
        try {
            const { data } = await api.post('/draft-pos', {
                vendorName,
                notes,
                items: selectedItems
            });
            toast.success(`Draft PO ${data.poNumber} created!`);
            setIsCreating(false);
            setVendorName('');
            setNotes('');
            setSelectedItems([]);
            fetchDraftPOs();
            // Automatically print the newly created PO
            printDraftPO(data, billingSettings);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create Draft PO');
        }
    };

    const handleDelete = async (id) => {
        confirmDelete(
            'Are you sure you want to delete this Draft PO? This action cannot be undone.',
            async () => {
                try {
                    await api.delete(`/draft-pos/${id}`);
                    toast.success('Draft PO deleted');
                    fetchDraftPOs();
                } catch (error) {
                    toast.error('Failed to delete Draft PO');
                }
            }
        );
    };

    const itemOptions = allItems.map(i => ({
        value: i,
        label: `${i.name} (Stock: ${i.quantity})`
    }));

    const vendorOptions = vendors.map(v => ({
        value: v.companyName || v.name,
        label: v.companyName || v.name
    }));

    if (isCreating) {
        return (
            <div className="space-y-4 pb-24">
                <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4">
                    <h1 className="text-xl md:text-2xl font-bold text-gray-800">Create Draft Purchase Order</h1>
                    <button 
                        onClick={() => setIsCreating(false)}
                        className="text-gray-500 hover:bg-gray-100 px-4 py-2 rounded font-bold transition-colors"
                    >
                        ← Back to List
                    </button>
                </div>

                <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Vendor Name / Ref (Optional)</label>
                        <SearchableSelect 
                            options={vendorOptions}
                            value={vendorName}
                            onChange={(e) => setVendorName(e.target.value)}
                            placeholder="Search or type vendor name..."
                            allowCreate={true}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Select Item to Add</label>
                        <SearchableSelect 
                            options={itemOptions}
                            value=""
                            onChange={(e) => handleAddItem(e.target.value)}
                            placeholder="Search items..."
                        />
                    </div>
                </div>

                {selectedItems.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="p-3 text-xs font-bold text-gray-500">Item Name</th>
                                        <th className="p-3 text-xs font-bold text-gray-500 w-32">Price</th>
                                        <th className="p-3 text-xs font-bold text-gray-500 w-32">Qty</th>
                                        <th className="p-3 text-xs font-bold text-gray-500 w-40 text-right">Total</th>
                                        <th className="p-3 text-xs font-bold text-gray-500 w-16 text-center">X</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {selectedItems.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50/50">
                                            <td className="p-3 text-sm font-bold text-gray-800">{item.name}</td>
                                            <td className="p-3">
                                                <input 
                                                    type="number"
                                                    value={item.price}
                                                    onChange={e => updateItemPrice(idx, Number(e.target.value))}
                                                    className="w-full p-2 border rounded text-right text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                />
                                            </td>
                                            <td className="p-3">
                                                <input 
                                                    type="number"
                                                    min="1"
                                                    value={item.quantity}
                                                    onChange={e => updateItemQty(idx, Number(e.target.value))}
                                                    className="w-full p-2 border rounded text-right text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                />
                                            </td>
                                            <td className="p-3 text-sm font-bold text-right text-gray-800">
                                                ₹{(item.price * item.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="p-3 text-center">
                                                <button onClick={() => removeItem(idx)} className="text-red-500 hover:bg-red-50 p-2 rounded transition-colors font-bold text-lg">✕</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-50 border-t border-gray-200">
                                    <tr>
                                        <td colSpan="3" className="p-4 text-right text-sm font-bold text-gray-500 uppercase">Grand Total</td>
                                        <td className="p-4 text-right text-lg font-black text-indigo-700">
                                            ₹{selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}

                <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Notes (Optional)</label>
                    <textarea 
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                        rows="3"
                        placeholder="Any additional notes for this PO..."
                    />
                </div>

                <div className="fixed bottom-0 left-0 lg:left-64 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-gray-200 flex justify-end gap-4 z-40">
                    <button 
                        onClick={() => setIsCreating(false)}
                        className="px-6 py-2.5 rounded-lg font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave}
                        className="px-6 py-2.5 rounded-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow transition-colors flex items-center gap-2"
                    >
                        Save & Print PO
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Generate PO (Internal)</h1>
                <button 
                    onClick={() => setIsCreating(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-indigo-700 transition-colors"
                >
                    + Create Draft PO
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-400">Loading...</div>
                ) : draftPOs.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">No Draft POs found. Create one to get started!</div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider">PO Number</th>
                                <th className="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Vendor / Ref</th>
                                <th className="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Items</th>
                                <th className="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Amount</th>
                                <th className="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {draftPOs.map(po => (
                                <tr key={po._id} className="hover:bg-gray-50/50">
                                    <td className="p-3 text-sm text-gray-600">{new Date(po.createdAt).toLocaleDateString()}</td>
                                    <td className="p-3 text-sm font-bold text-gray-900">{po.poNumber}</td>
                                    <td className="p-3 text-sm text-gray-600">{po.vendorName || '-'}</td>
                                    <td className="p-3 text-sm text-gray-600 text-right">{po.items?.length || 0} items</td>
                                    <td className="p-3 text-sm font-bold text-emerald-600 text-right">₹{po.totalAmount?.toLocaleString() || 0}</td>
                                    <td className="p-3 flex justify-center gap-2">
                                        <button 
                                            onClick={() => printDraftPO(po, billingSettings)}
                                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold hover:bg-blue-200"
                                        >
                                            Print
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(po._id)}
                                            className="px-3 py-1 bg-red-100 text-red-700 rounded text-xs font-bold hover:bg-red-200"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default DraftPOs;
