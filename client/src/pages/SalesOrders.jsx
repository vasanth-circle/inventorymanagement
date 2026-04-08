import { useState, useEffect, useContext } from 'react';
import { InventoryContext } from '../context/InventoryContext';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';

const SalesOrders = () => {
    const { items, billingSettings } = useContext(InventoryContext);
    const { user } = useContext(AuthContext);
    const [orders, setOrders] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState(null);
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
                newItems[index].name = selectedItem.name;
                newItems[index].price = selectedItem.price;
                newItems[index].brand = selectedItem.brand || '';
                newItems[index].size = selectedItem.size || '';
                newItems[index].pcsPerBox = selectedItem.pcsPerBox || 1;
                newItems[index].sqFtPerPc = selectedItem.sqFtPerPc || 0;
            }
        }

        // Auto-calculations for tiles
        const item = newItems[index];
        if (field === 'boxCount' || field === 'item' || field === 'quantity' || field === 'price') {
            if (item.pcsPerBox) {
                const boxes = Number(item.boxCount) || 0;
                item.totalPcs = boxes * item.pcsPerBox;
                if (item.sqFtPerPc) {
                    item.totalSqFt = Number((item.totalPcs * item.sqFtPerPc).toFixed(2));
                    // Bill by SqFt
                    item.quantity = item.totalSqFt; 
                    item.total = Number((item.totalSqFt * (Number(item.price) || 0)).toFixed(2));
                } else {
                    // Fallback to boxes if sqft is not set
                    item.quantity = boxes;
                    item.total = Number((boxes * (Number(item.price) || 0)).toFixed(2));
                }
            }
        }

        setFormData({ ...formData, items: newItems });
    };

    const calculateTotals = () => {
        const itemsTotal = formData.items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
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

    const handleEdit = (order) => {
        setEditingOrder(order);
        setFormData({
            customer: order.customer?._id || order.customer,
            items: order.items.map(item => ({
                ...item,
                item: item.item?._id || item.item,
                // Ensure calculations are preserved or recalculated
                total: item.total || (item.quantity * item.price)
            })),
            notes: order.notes || '',
            isEstimation: order.isEstimation || false,
            status: order.status || (order.isEstimation ? 'quotation' : 'confirmed'),
            loadingCharges: order.loadingCharges || 0,
            transportCharges: order.transportCharges || 0,
            oldBalance: order.oldBalance || 0,
            advanceAmount: order.advanceAmount || 0,
            taxAmount: order.taxAmount || 0,
            orderDate: order.orderDate
        });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingOrder(null);
        setFormData({
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
            taxAmount: 0,
            orderDate: new Date().toISOString()
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            if (editingOrder) {
                await axios.put(`${API_URL}/${editingOrder._id}`, formData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                toast.success('Order updated successfully');
            } else {
                await axios.post(API_URL, formData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                toast.success(formData.isEstimation ? 'Estimation created' : 'Sales order created');
            }
            handleCloseModal();
            fetchOrders();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error saving order');
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

    const numberToWords = (num) => {
        const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
        const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        if ((num = num.toString()).length > 9) return 'Amount too large';
        let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
        if (!n) return '';
        let str = '';
        str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
        str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
        str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
        str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
        str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + 'Only' : 'Only';
        return 'Rupees ' + str;
    };

    const handlePrint = (order) => {
        const printContent = `
            <html>
                <head>
                    <title>Bill - ${order.orderNumber}</title>
                    <style>
                        @page { size: A4; margin: 10mm; }
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.2; padding: 0px; font-size: 10px; }
                        .container { border: 2px solid #000; padding: 0px; min-height: 280mm; display: flex; flex-column: column; }
                        
                        .header { text-align: center; border-bottom: 2px solid #000; padding: 10px 0; position: relative; background: #fff; }
                        .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px; color: #000; }
                        .header p { margin: 2px 0; font-size: 10px; font-weight: bold; }
                        .header .cell { position: absolute; right: 15px; top: 10px; font-size: 10px; font-weight: bold; border: 1px solid #000; padding: 2px 5px; }
                        
                        .doc-title { text-align: center; border-bottom: 1px solid #000; padding: 4px; font-weight: 900; font-size: 14px; background: #eee; text-transform: uppercase; letter-spacing: 3px; }
                        
                        .info-section { display: flex; border-bottom: 1px solid #000; }
                        .customer-box { flex: 1.5; padding: 10px; border-right: 1px solid #000; }
                        .order-box { flex: 1; padding: 10px; }
                        .info-row { display: flex; margin-bottom: 4px; }
                        .info-label { width: 90px; font-weight: bold; color: #555; font-size: 9px; text-transform: uppercase; }
                        .info-val { font-weight: bold; color: #000; }
                        
                        table { width: 100%; border-collapse: collapse; flex: 1; }
                        th { border-bottom: 1px solid #000; border-right: 1px solid #000; padding: 8px 4px; text-align: center; font-size: 9px; text-transform: uppercase; background: #f2f2f2; font-weight: 900; }
                        td { border-right: 1px solid #000; padding: 6px 4px; vertical-align: top; font-size: 10px; height: 18px; font-weight: 600; }
                        th:last-child, td:last-child { border-right: none; }
                        
                        .items-table { border-bottom: 1px solid #000; min-height: 520px; }
                        
                        .footer { margin-top: auto; }
                        .totals-grid { display: flex; border-top: 2px solid #000; }
                        .words-box { flex: 1.5; padding: 10px; border-right: 1px solid #000; background: #fafafa; }
                        .math-box { flex: 1; padding: 0px; }
                        .math-row { display: flex; justify-content: space-between; padding: 5px 10px; border-bottom: 1px solid #ddd; }
                        .math-row:last-child { border-bottom: none; font-weight: 900; font-size: 14px; background: #eee; border-top: 1px solid #000; padding: 8px 10px; }
                        
                        .sign-section { display: flex; justify-content: space-between; padding: 20px 15px 15px 15px; border-top: 1px solid #000; }
                        .sign-box { text-align: center; width: 200px; }
                        .sign-line { border-top: 1px solid #000; margin-top: 40px; padding-top: 5px; font-weight: bold; text-transform: uppercase; font-size: 9px; }
                        
                        .text-right { text-align: right; }
                        .text-center { text-align: center; }
                        .bold { font-weight: bold; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="cell">PH: ${billingSettings?.phone1 || ''} / ${billingSettings?.phone2 || ''}</div>
                            <h1>${billingSettings?.companyName || 'INVENTORY MANAGEMENT SYSTEM'}</h1>
                            <p>${billingSettings?.address || 'Address not set'}</p>
                            ${billingSettings?.gstNumber ? `<p>GSTIN: ${billingSettings.gstNumber}</p>` : ''}
                        </div>
                        
                        <div class="doc-title">${order.isEstimation ? 'Estimation / Quotation' : 'Tax Invoice / Sales Bill'}</div>
                        
                        <div class="info-section">
                            <div class="customer-box">
                                <div class="info-row"><span class="info-label">Customer:</span> <span class="info-val">${(order.customer?.companyName || order.customer?.name || '').toUpperCase()}</span></div>
                                <div class="info-row"><span class="info-label">Address:</span> <span>${order.customer?.address || ''}</span></div>
                                <div class="info-row"><span class="info-label">Contact:</span> <span>${order.customer?.phone || ''}</span></div>
                            </div>
                            <div class="order-box">
                                <div class="info-row"><span class="info-label">Bill Number:</span> <span class="info-val" style="font-size: 14px;">${order.orderNumber}</span></div>
                                <div class="info-row"><span class="info-label">Date:</span> <span class="info-val">${new Date(order.orderDate).toLocaleDateString()}</span></div>
                                <div class="info-row"><span class="info-label">Billed By:</span> <span class="info-val">${order.user?.name || 'Admin'}</span></div>
                                <div class="info-row"><span class="info-label">Terms:</span> <span>${order.terms || 'Credit'}</span></div>
                            </div>
                        </div>
                        
                        <div class="items-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th width="30">S.No</th>
                                        <th>Description of Goods</th>
                                        <th width="40">Boxes</th>
                                        <th width="60">Total SqFt</th>
                                        <th width="70">Rate (SqFt)</th>
                                        <th width="90">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${order.items.map((item, i) => `
                                        <tr>
                                            <td class="text-center">${i + 1}</td>
                                            <td>
                                                <div class="bold">${(item.name || '').toUpperCase()}</div>
                                                <div style="font-size: 8px; color: #555;">${item.brand || ''} | ${item.size || ''}</div>
                                            </td>
                                            <td class="text-center">${item.boxCount ? item.boxCount.toFixed(2) : '-'}</td>
                                            <td class="text-center bold">${item.totalSqFt ? item.totalSqFt.toFixed(2) : item.quantity.toFixed(2)}</td>
                                            <td class="text-right">${item.price.toFixed(2)}</td>
                                            <td class="text-right bold">${item.total.toFixed(2)}</td>
                                        </tr>
                                    `).join('')}
                                    ${Array(Math.max(0, 15 - order.items.length)).fill(0).map(() => `
                                        <tr>
                                            <td class="text-center"></td><td></td><td></td><td></td><td></td><td></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        
                        <div class="footer">
                            <div class="totals-grid">
                                <div class="words-box">
                                    <p style="font-weight: bold; margin-bottom: 2px; font-size: 8px; text-decoration: underline;">AMOUNT IN WORDS</p>
                                    <p style="font-weight: bold; text-transform: uppercase; font-size: 9px;">Rupees ${numberToWords(Math.round(order.totalAmount))} Only</p>
                                    
                                    <div style="margin-top: 20px; font-size: 8px;">
                                        <p><b>Terms & Conditions:</b></p>
                                        <p>1. Goods once sold will not be taken back or exchanged.</p>
                                        <p>2. We are not responsible for any damage after the goods leave our premises.</p>
                                    </div>
                                </div>
                                <div class="math-box">
                                    <div class="math-row"><span>Items Total:</span> <span>₹${order.itemsTotal?.toLocaleString() || '0.00'}</span></div>
                                    ${order.loadingCharges > 0 ? `<div class="math-row"><span>Loading:</span> <span>₹${order.loadingCharges.toLocaleString()}</span></div>` : ''}
                                    ${order.transportCharges > 0 ? `<div class="math-row"><span>Transport:</span> <span>₹${order.transportCharges.toLocaleString()}</span></div>` : ''}
                                    ${order.taxAmount > 0 ? `<div class="math-row"><span>Tax (GST):</span> <span>₹${order.taxAmount.toLocaleString()}</span></div>` : ''}
                                    ${order.oldBalance > 0 ? `<div class="math-row"><span>Old Balance:</span> <span>₹${order.oldBalance.toLocaleString()}</span></div>` : ''}
                                    <div class="math-row"><span style="font-size: 11px;">GRAND TOTAL:</span> <span>₹${order.totalAmount.toLocaleString()}</span></div>
                                </div>
                            </div>
                            
                            <div class="sign-section">
                                <div class="sign-box">
                                    <div class="sign-line">Receiver's Signature</div>
                                </div>
                                <div class="sign-box">
                                    <div style="font-size: 8px; margin-bottom: 10px;">For ${billingSettings?.companyName || 'INVENTORY SYSTEM'}</div>
                                    <div class="sign-line">Authorized Signatory</div>
                                </div>
                            </div>
                            <div style="text-align: center; font-size: 7px; color: #888; padding: 5px;">* This is a computer generated bill and does not require a physical signature. E. & O.E.</div>
                        </div>
                    </div>
                </body>
            </html>
        `;
        const win = window.open('', '_blank');
        win.document.write(printContent);
        win.document.close();
        win.focus();
        setTimeout(() => {
            win.print();
        }, 500);
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
                    onClick={() => {
                        setEditingOrder(null);
                        setIsModalOpen(true);
                    }}
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
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => handlePrint(order)} className="text-primary-600 hover:text-primary-800 text-sm font-bold border-2 border-primary-100 px-3 py-1.5 rounded-lg bg-primary-50 transition-all flex items-center inline-flex">
                                                <span className="mr-1">📄</span> Bill
                                            </button>
                                            
                                            {['super_admin', 'admin', 'tenant_owner', 'tenant_admin'].includes(user?.role) && (
                                                <button 
                                                    onClick={() => handleEdit(order)} 
                                                    className="text-amber-600 hover:text-amber-800 text-sm font-bold border-2 border-amber-100 px-3 py-1.5 rounded-lg bg-amber-50 transition-all flex items-center inline-flex"
                                                >
                                                    <span className="mr-1">✏️</span> Edit
                                                </button>
                                            )}

                                            {order.status === 'quotation' && (
                                                <button onClick={() => handleStatusUpdate(order._id, 'confirmed')} className="bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm transition-all">Accept</button>
                                            )}
                                        </div>
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
                                <h2 className="text-2xl font-black text-gray-800">
                                    {editingOrder ? 'Edit' : 'Create'} {formData.isEstimation ? 'Quotation' : 'Sales Order'}
                                </h2>
                                <p className="text-xs text-gray-500 font-medium">Specialized Tiles & Granites Billing</p>
                            </div>
                            <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 text-3xl">&times;</button>
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
                                                <th className="px-4 py-3 text-[10px] font-black text-gray-600 uppercase tracking-wider">Item Name / Brand</th>
                                                <th className="px-4 py-3 text-[10px] font-black text-gray-600 uppercase tracking-wider w-24">Boxes (Qty)</th>
                                                <th className="px-4 py-3 text-[10px] font-black text-gray-600 uppercase tracking-wider w-32">Total SqFt</th>
                                                <th className="px-4 py-3 text-[10px] font-black text-gray-600 uppercase tracking-wider w-32">Rate (₹/Box)</th>
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
                                                        <input type="number" step="0.01" min="0" value={row.boxCount} onChange={(e) => handleItemChange(index, 'boxCount', e.target.value)} className="w-full px-3 py-2 border rounded-lg border-gray-200 outline-none focus:ring-1 focus:ring-primary-400 text-center font-bold" />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input required type="number" step="0.01" value={row.quantity} onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value))} className="w-full px-3 py-2 border rounded-lg border-gray-200 outline-none bg-gray-50 font-medium" />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input required type="number" step="0.01" value={row.price} onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value))} className="w-full px-3 py-2 border rounded-lg border-gray-200 outline-none focus:ring-1 focus:ring-primary-400 font-bold" />
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-black text-gray-800">
                                                        ₹{(row.boxCount * row.price).toLocaleString()}
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
                                <button type="button" onClick={handleCloseModal} className="px-8 py-3 text-gray-600 font-bold border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
                                <button type="submit" className="px-10 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-black shadow-lg shadow-primary-200 transition-all active:scale-95">
                                    {editingOrder ? '💾 Update Changes' : (formData.isEstimation ? '💾 Save Quotation' : '✅ Generate Final Bill')}
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
