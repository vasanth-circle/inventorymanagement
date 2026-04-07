import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const PurchaseOrders = () => {
    const [orders, setOrders] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [receiveData, setReceiveData] = useState([]);
    const [formData, setFormData] = useState({
        vendor: '',
        items: [{ item: '', quantity: 1, price: 0 }],
        notes: '',
    });

    const API_URL = '/api/purchase-orders';

    useEffect(() => {
        fetchOrders();
        fetchVendorsAndItems();
    }, []);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const res = await axios.get(API_URL, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setOrders(res.data.data.orders);
        } catch (error) {
            toast.error('Failed to fetch purchase orders');
        } finally {
            setLoading(false);
        }
    };

    const fetchVendorsAndItems = async () => {
        try {
            const [vendRes, itemRes] = await Promise.all([
                axios.get('/api/vendors', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
                axios.get('/api/items', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
            ]);
            setVendors(vendRes.data.data.vendors);
            setItems(itemRes.data.items);
        } catch (error) {
            console.error('Error fetching dependencies');
        }
    };

    const handleAddItem = () => {
        setFormData({
            ...formData,
            items: [...formData.items, { item: '', quantity: 1, price: 0 }]
        });
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...formData.items];
        newItems[index][field] = value;

        if (field === 'item') {
            const selectedItem = items.find(i => i._id === value);
            if (selectedItem) {
                newItems[index].price = selectedItem.price; // Cost price would be better but using price for now
            }
        }

        setFormData({ ...formData, items: newItems });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post(API_URL, formData, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            toast.success('Purchase order created successfully');
            setIsModalOpen(false);
            fetchOrders();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error creating order');
        }
    };

    const handleStatusUpdate = async (id, status) => {
        try {
            await axios.patch(`${API_URL}/${id}/status`, { status }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            toast.success(`Order marked as ${status}`);
            fetchOrders();
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    const openReceiveModal = (order) => {
        setSelectedOrder(order);
        // order.items have item populated with name and sku
        const initialReceiveData = order.items.map(i => ({
            item: i.item._id || i.item,
            name: i.item.name || 'Unknown Item',
            expected: i.quantity,
            receivedQuantity: i.quantity,
            damagedQuantity: 0
        }));
        setReceiveData(initialReceiveData);
        setIsReceiveModalOpen(true);
    };

    const handleReceiveDataChange = (index, field, value) => {
        const newData = [...receiveData];
        newData[index][field] = value;
        setReceiveData(newData);
    };

    const handleReceiveSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_URL}/${selectedOrder._id}/receive`, {
                receivedItems: receiveData
            }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            toast.success(`Purchase order received successfully`);
            setIsReceiveModalOpen(false);
            fetchOrders();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to receive order');
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'draft': return 'bg-gray-100 text-gray-800';
            case 'issued': return 'bg-blue-100 text-blue-800';
            case 'received': return 'bg-green-100 text-green-800';
            case 'billed': return 'bg-purple-100 text-purple-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Purchase Orders</h1>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                    Create Purchase Order
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-md overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-bottom border-gray-100">
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">PO #</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Vendor</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Date</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Amount</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {orders.map((order) => (
                                <tr key={order._id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-primary-600">{order.orderNumber}</td>
                                    <td className="px-6 py-4 text-gray-900">{order.vendor?.name}</td>
                                    <td className="px-6 py-4 text-gray-600">{new Date(order.orderDate).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-semibold text-gray-900">₹{order.totalAmount.toLocaleString()}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium uppercase ${getStatusColor(order.status)}`}>
                                            {order.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        {order.status === 'draft' && (
                                            <button onClick={() => handleStatusUpdate(order._id, 'issued')} className="text-blue-600 hover:text-blue-800 text-sm">Issue PO</button>
                                        )}
                                        {order.status === 'issued' && (
                                            <button onClick={() => openReceiveModal(order)} className="text-green-600 hover:text-green-800 text-sm font-semibold">Convert to Inward</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl my-8">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white">
                            <h2 className="text-xl font-bold text-gray-800">New Purchase Order</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div className="w-1/2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor *</label>
                                <select required value={formData.vendor} onChange={(e) => setFormData({ ...formData, vendor: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none">
                                    <option value="">Select Vendor</option>
                                    {vendors.map(v => <option key={v._id} value={v._id}>{v.name}</option>)}
                                </select>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-semibold text-gray-700">Item Details</h3>
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Item</th>
                                            <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-24">Qty</th>
                                            <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-32">Rate</th>
                                            <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-32">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {formData.items.map((row, index) => (
                                            <tr key={index}>
                                                <td className="py-2">
                                                    <select required value={row.item} onChange={(e) => handleItemChange(index, 'item', e.target.value)} className="w-full px-2 py-1 border rounded outline-none border-gray-200">
                                                        <option value="">Select Item</option>
                                                        {items.map(i => <option key={i._id} value={i._id}>{i.name} ({i.sku})</option>)}
                                                    </select>
                                                </td>
                                                <td className="px-2 py-2">
                                                    <input required type="number" min="1" value={row.quantity} onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value))} className="w-full px-2 py-1 border rounded border-gray-200" />
                                                </td>
                                                <td className="px-2 py-2">
                                                    <input required type="number" value={row.price} onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value))} className="w-full px-2 py-1 border rounded border-gray-200" />
                                                </td>
                                                <td className="px-2 py-2 font-medium text-gray-700 text-right">
                                                    ₹{(row.quantity * row.price).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <button type="button" onClick={handleAddItem} className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center">
                                    <span className="text-lg mr-1">+</span> Add another line
                                </button>
                            </div>

                            <div className="flex justify-end gap-3 pt-6 border-t sticky bottom-0 bg-white">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                                <button type="submit" className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-bold">Save PO</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isReceiveModalOpen && selectedOrder && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl my-8">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white">
                            <h2 className="text-xl font-bold text-gray-800">Convert to Inward: PO {selectedOrder.orderNumber}</h2>
                            <button onClick={() => setIsReceiveModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                        </div>
                        <form onSubmit={handleReceiveSubmit} className="p-6 space-y-6">
                            <div className="space-y-4">
                                <p className="text-sm text-gray-600 mb-4">Please verify the quantities received and record any damaged stock before converting to an inward transaction. Damaged stock will be recorded but won't be added to your usable inventory count.</p>
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Item Name</th>
                                            <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-24 text-center">Expected</th>
                                            <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-36 text-center text-green-700 font-bold">Good Qty (to Stock)</th>
                                            <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-32 text-center text-red-600 font-bold">Damaged Qty</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {receiveData.map((row, index) => (
                                            <tr key={index}>
                                                <td className="py-3 px-3 font-medium text-gray-800">
                                                    {row.name}
                                                </td>
                                                <td className="px-3 py-3 text-gray-600">
                                                    {row.expected}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <input required type="number" min="0" value={row.receivedQuantity} onChange={(e) => handleReceiveDataChange(index, 'receivedQuantity', parseInt(e.target.value))} className="w-full px-2 py-1 border rounded border-gray-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none" />
                                                </td>
                                                <td className="px-3 py-3">
                                                    <input required type="number" min="0" value={row.damagedQuantity} onChange={(e) => handleReceiveDataChange(index, 'damagedQuantity', parseInt(e.target.value))} className="w-full px-2 py-1 border rounded border-red-200 text-red-600 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none" />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-end gap-3 pt-6 border-t sticky bottom-0 bg-white">
                                <button type="button" onClick={() => setIsReceiveModalOpen(false)} className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                                <button type="submit" className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold">Confirm Inward</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PurchaseOrders;
