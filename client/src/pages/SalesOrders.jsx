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
        items: [{ 
            item: '', 
            quantity: 1, 
            price: 0, 
            boxCount: 0, 
            totalPcs: 0, 
            totalSqFt: 0,
            brand: '',
            size: ''
        }],
        notes: '',
        isEstimation: false,
        status: 'quotation',
        loadingCharges: 0,
        transportCharges: 0,
        oldBalance: 0,
        advanceAmount: 0,
        taxAmount: 0
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
            const token = localStorage.getItem('token');
            const [custRes, itemRes] = await Promise.all([
                axios.get('/api/customers', { headers: { Authorization: `Bearer ${token}` } }),
                axios.get('/api/items', { headers: { Authorization: `Bearer ${token}` } })
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
            items: [...formData.items, { 
                item: '', 
                quantity: 1, 
                price: 0, 
                boxCount: 0, 
                totalPcs: 0, 
                totalSqFt: 0,
                brand: '',
                size: ''
            }]
        });
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...formData.items];
        newItems[index][field] = value;

        if (field === 'item') {
            const selectedItem = items.find(i => i._id === value);
            if (selectedItem) {
                newItems[index].price = selectedItem.price;
                newItems[index].brand = selectedItem.brand || '';
                newItems[index].size = selectedItem.size || '';
                newItems[index].pcsPerBox = selectedItem.pcsPerBox || 1;
                newItems[index].sqFtPerPc = selectedItem.sqFtPerPc || 0;
            }
        }

        // Auto-calculations for tiles
        const item = newItems[index];
        if (field === 'boxCount' || field === 'item' || field === 'quantity') {
            if (item.pcsPerBox) {
                const boxes = Number(item.boxCount) || 0;
                item.totalPcs = boxes * item.pcsPerBox;
                if (item.sqFtPerPc) {
                    item.totalSqFt = item.totalPcs * item.sqFtPerPc;
                    // Usually quantity is tracked in SqFt for tiles
                    item.quantity = item.totalSqFt; 
                } else {
                    // Fallback to total pieces if sqft is not set
                    item.quantity = item.totalPcs;
                }
            }
        }

        setFormData({ ...formData, items: newItems });
    };

    const calculateTotals = () => {
        const itemsTotal = formData.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
        const netTotal = (
            itemsTotal + 
            Number(formData.loadingCharges) + 
            Number(formData.transportCharges) + 
            Number(formData.taxAmount) + 
            Number(formData.oldBalance) - 
            Number(formData.advanceAmount)
        );
        return { itemsTotal, netTotal };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post(API_URL, formData, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            toast.success(formData.isEstimation ? 'Estimation created' : 'Sales order created');
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

    const handlePrint = (order) => {
        const printContent = `
            <html>
                <head>
                    <title>Print Order - ${order.orderNumber}</title>
                    <style>
                        body { font-family: sans-serif; padding: 20px; }
                        .header { text-align: center; border-bottom: 2px solid #000; margin-bottom: 20px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        .totals { margin-top: 20px; float: right; width: 300px; }
                        .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
                        .bold { font-weight: bold; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h2>${order.isEstimation ? 'ESTIMATION' : 'SALES INVOICE'}</h2>
                        <p>Order #: ${order.orderNumber} | Date: ${new Date(order.orderDate).toLocaleDateString()}</p>
                    </div>
                    <p><strong>Customer:</strong> ${order.customer?.companyName || order.customer?.name}</p>
                    <table>
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Brand/Size</th>
                                <th>Boxes</th>
                                <th>Qty (Sq.Ft/Pcs)</th>
                                <th>Rate</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${order.items.map(item => `
                                <tr>
                                    <td>${item.name}</td>
                                    <td>${item.brand || ''} ${item.size || ''}</td>
                                    <td>${item.boxCount || 0}</td>
                                    <td>${item.quantity.toFixed(2)}</td>
                                    <td>₹${item.price}</td>
                                    <td>₹${item.total.toLocaleString()}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <div class="totals">
                        <div><span>Items Total:</span> <span>₹${order.itemsTotal?.toLocaleString() || '0'}</span></div>
                        <div><span>Loading Charges:</span> <span>₹${order.loadingCharges || '0'}</span></div>
                        <div><span>Transport:</span> <span>₹${order.transportCharges || '0'}</span></div>
                        <div><span>Tax:</span> <span>₹${order.taxAmount || '0'}</span></div>
                        <div><span>Old Balance:</span> <span>₹${order.oldBalance || '0'}</span></div>
                        <div class="bold"><span>Advance Paid:</span> <span>- ₹${order.advanceAmount || '0'}</span></div>
                        <div class="bold" style="border-top: 1px solid #000; font-size: 1.2em; margin-top: 5px;">
                            <span>Net Total:</span> <span>₹${order.totalAmount.toLocaleString()}</span>
                        </div>
                    </div>
                </body>
            </html>
        `;
        const win = window.open('', '_blank');
        win.document.write(printContent);
        win.document.close();
        win.print();
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'quotation': return 'bg-purple-100 text-purple-800';
            case 'confirmed': return 'bg-blue-100 text-blue-800';
            case 'dispatched': return 'bg-green-100 text-green-800';
            case 'partially_dispatched': return 'bg-yellow-100 text-yellow-800';
            case 'cancelled': return 'bg-red-100 text-red-800';
            case 'draft': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const { itemsTotal, netTotal } = calculateTotals();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Sales Orders & Estimations</h1>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-bold shadow-md"
                >
                    + Create New (Order/Quote)
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
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase">Order #</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase">Customer</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase">Date</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase">Net Amount</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase">Status</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {orders.map((order) => (
                                <tr key={order._id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-primary-700">
                                        {order.orderNumber}
                                        {order.isEstimation && <span className="ml-2 text-[10px] bg-purple-100 text-purple-600 px-1 rounded">QUOTE</span>}
                                    </td>
                                    <td className="px-6 py-4 text-gray-900 font-medium">{order.customer?.companyName || order.customer?.name}</td>
                                    <td className="px-6 py-4 text-gray-600 text-sm">{new Date(order.orderDate).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-bold text-gray-900">₹{order.totalAmount.toLocaleString()}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${getStatusColor(order.status)}`}>
                                            {order.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button onClick={() => handlePrint(order)} className="text-gray-600 hover:text-gray-900 text-sm border px-2 py-1 rounded">🖨️ Print</button>
                                        {order.status === 'quotation' && (
                                            <button onClick={() => handleStatusUpdate(order._id, 'confirmed')} className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded text-sm font-bold">Accept</button>
                                        )}
                                        {order.status === 'confirmed' && (
                                            <span className="text-xs text-gray-400 italic">Ready for Dispatch</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 overflow-y-auto backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-8">
                        <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                            <div>
                                <h2 className="text-2xl font-black text-gray-800">Create {formData.isEstimation ? 'Quotation' : 'Sales Order'}</h2>
                                <p className="text-xs text-gray-500 font-medium">Specialized Tiles & Granites Billing</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-3xl">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                                <div className="md:col-span-1">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Select Customer *</label>
                                    <select required value={formData.customer} onChange={(e) => setFormData({ ...formData, customer: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none shadow-sm transition-all">
                                        <option value="">Select Customer</option>
                                        {customers.map(c => <option key={c._id} value={c._id}>{c.companyName || c.name}</option>)}
                                    </select>
                                </div>
                                <div className="flex items-center space-x-6 pb-3">
                                    <label className="flex items-center cursor-pointer group">
                                        <div className="relative">
                                            <input 
                                                type="checkbox" 
                                                className="sr-only" 
                                                checked={formData.isEstimation} 
                                                onChange={(e) => setFormData({ 
                                                    ...formData, 
                                                    isEstimation: e.target.checked, 
                                                    status: e.target.checked ? 'quotation' : 'confirmed' 
                                                })} 
                                            />
                                            <div className={`block w-14 h-8 rounded-full transition-colors ${formData.isEstimation ? 'bg-purple-600' : 'bg-gray-300'}`}></div>
                                            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${formData.isEstimation ? 'transform translate-x-6' : ''}`}></div>
                                        </div>
                                        <div className="ml-3 text-gray-700 font-bold select-none">
                                            {formData.isEstimation ? 'Estimation / Quote' : 'Final Bill'}
                                        </div>
                                    </label>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Order Date</label>
                                    <input type="date" value={formData.orderDate?.split('T')[0]} onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-500" />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-black text-gray-800 flex items-center">
                                        <span className="bg-primary-100 text-primary-600 p-1 rounded mr-2 text-sm">📦</span>
                                        Item Details
                                    </h3>
                                </div>
                                <div className="overflow-x-auto border rounded-xl shadow-sm">
                                    <table className="w-full text-left min-w-[800px]">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="px-4 py-3 text-[10px] font-black text-gray-600 uppercase tracking-wider">Item</th>
                                                <th className="px-4 py-3 text-[10px] font-black text-gray-600 uppercase tracking-wider w-24">Boxes</th>
                                                <th className="px-4 py-3 text-[10px] font-black text-gray-600 uppercase tracking-wider w-32">Qty (SqFt/Pcs)</th>
                                                <th className="px-4 py-3 text-[10px] font-black text-gray-600 uppercase tracking-wider w-28">Rate (₹)</th>
                                                <th className="px-4 py-3 text-[10px] font-black text-gray-600 uppercase tracking-wider text-right w-32">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {formData.items.map((row, index) => (
                                                <tr key={index} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3">
                                                        <select required value={row.item} onChange={(e) => handleItemChange(index, 'item', e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-primary-400 outline-none border-gray-200 font-medium text-sm">
                                                            <option value="">Select Item</option>
                                                            {items.map(i => <option key={i._id} value={i._id}>{i.name} ({i.brand} - {i.size})</option>)}
                                                        </select>
                                                        {row.brand && <div className="text-[10px] text-gray-400 mt-1 pl-1">{row.brand} | {row.size}</div>}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input type="number" min="0" value={row.boxCount} onChange={(e) => handleItemChange(index, 'boxCount', e.target.value)} className="w-full px-3 py-2 border rounded-lg border-gray-200 outline-none focus:ring-1 focus:ring-primary-400 text-center font-bold" />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input required type="number" step="0.01" value={row.quantity} onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value))} className="w-full px-3 py-2 border rounded-lg border-gray-200 outline-none bg-gray-50 font-medium" />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input required type="number" step="0.01" value={row.price} onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value))} className="w-full px-3 py-2 border rounded-lg border-gray-200 outline-none focus:ring-1 focus:ring-primary-400 font-bold" />
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-black text-gray-800">
                                                        ₹{(row.quantity * row.price).toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <button type="button" onClick={handleAddItem} className="text-primary-600 hover:text-primary-700 text-sm font-black flex items-center bg-primary-50 px-4 py-2 rounded-lg transition-colors">
                                    <span className="text-xl mr-2">+</span> Add Line Item
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div className="space-y-4">
                                    <label className="block text-sm font-bold text-gray-700">Notes & Terms</label>
                                    <textarea 
                                        rows="4" 
                                        value={formData.notes} 
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })} 
                                        placeholder="Add any specific instructions or terms..."
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-400"
                                    ></textarea>
                                </div>
                                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 space-y-4">
                                    <h4 className="font-bold text-gray-800 border-b pb-2 mb-4">Billing Extra & Offsets</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Loading Charges</label>
                                            <input type="number" value={formData.loadingCharges} onChange={(e) => setFormData({ ...formData, loadingCharges: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Transport / Auto</label>
                                            <input type="number" value={formData.transportCharges} onChange={(e) => setFormData({ ...formData, transportCharges: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tax Amount</label>
                                            <input type="number" value={formData.taxAmount} onChange={(e) => setFormData({ ...formData, taxAmount: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Old Balance (Add)</label>
                                            <input type="number" value={formData.oldBalance} onChange={(e) => setFormData({ ...formData, oldBalance: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none text-red-600 font-bold" />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Advance Amount (Subtract)</label>
                                            <input type="number" value={formData.advanceAmount} onChange={(e) => setFormData({ ...formData, advanceAmount: e.target.value })} className="w-full px-3 py-2 border rounded-lg border-primary-300 outline-none text-green-600 font-bold" />
                                        </div>
                                    </div>
                                    <div className="pt-6 border-t mt-6 space-y-3">
                                        <div className="flex justify-between text-gray-600 font-medium">
                                            <span>Subtotal Items:</span>
                                            <span>₹{itemsTotal.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-2xl font-black text-gray-900 pt-2 border-t border-dashed">
                                            <span>NET TOTAL:</span>
                                            <span className="text-primary-700">₹{netTotal.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-4 pt-6 border-t">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-3 text-gray-600 font-bold border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
                                <button type="submit" className="px-10 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-black shadow-lg shadow-primary-200 transition-all active:scale-95">
                                    {formData.isEstimation ? '💾 Save Quotation' : '✅ Generate Final Bill'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesOrders;
