import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const SalesOrders = () => {
    const [orders, setOrders] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        customer: '',
        items: [{ item: '', quantity: 1, price: 0 }],
        notes: '',
    });

    const API_URL = '/api/sales-orders';

    useEffect(() => {
        fetchOrders();
        fetchCustomersAndItems();
    }, []);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const res = await axios.get(API_URL, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setOrders(res.data.data.orders);
        } catch (error) {
            toast.error('Failed to fetch sales orders');
        } finally {
            setLoading(false);
        }
    };

    const fetchCustomersAndItems = async () => {
        try {
            const [custRes, itemRes] = await Promise.all([
                axios.get('/api/customers', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
                axios.get('/api/items', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
            ]);
            setCustomers(custRes.data.data.customers);
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
                newItems[index].price = selectedItem.price;
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
            toast.success('Sales order created successfully');
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

    const getStatusColor = (status) => {
        switch (status) {
            case 'draft': return 'bg-gray-100 text-gray-800';
            case 'confirmed': return 'bg-blue-100 text-blue-800';
            case 'shipped': return 'bg-yellow-100 text-yellow-800';
            case 'delivered': return 'bg-green-100 text-green-800';
            case 'invoiced': return 'bg-purple-100 text-purple-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Sales Orders</h1>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                    Create Sales Order
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
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Order #</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Customer</th>
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
                                    <td className="px-6 py-4 text-gray-900">{order.customer?.companyName || order.customer?.name}</td>
                                    <td className="px-6 py-4 text-gray-600">{new Date(order.orderDate).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-semibold text-gray-900">₹{order.totalAmount.toLocaleString()}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium uppercase ${getStatusColor(order.status)}`}>
                                            {order.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        {order.status === 'draft' && (
                                            <button onClick={() => handleStatusUpdate(order._id, 'confirmed')} className="text-blue-600 hover:text-blue-800 text-sm">Confirm</button>
                                        )}
                                        {order.status === 'confirmed' && (
                                            <button onClick={() => handleStatusUpdate(order._id, 'shipped')} className="text-yellow-600 hover:text-yellow-800 text-sm">Ship</button>
                                        )}
                                        {order.status === 'shipped' && (
                                            <button onClick={() => handleStatusUpdate(order._id, 'delivered')} className="text-green-600 hover:text-green-800 text-sm">Deliver</button>
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
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-800">New Sales Order</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div className="w-1/2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
                                <select required value={formData.customer} onChange={(e) => setFormData({ ...formData, customer: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none">
                                    <option value="">Select Customer</option>
                                    {customers.map(c => <option key={c._id} value={c._id}>{c.companyName || c.name}</option>)}
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
                                                    <select required value={row.item} onChange={(e) => handleItemChange(index, 'item', e.target.value)} className="w-full px-2 py-1 border rounded focus:ring-1 focus:ring-primary-400 outline-none border-gray-200">
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
                                                <td className="px-2 py-2 font-medium text-gray-700">
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

                            <div className="flex justify-end gap-3 pt-6 border-t">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                                <button type="submit" className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-bold">Save Order</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesOrders;
