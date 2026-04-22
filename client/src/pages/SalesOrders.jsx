import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext';
import { InventoryContext } from '../context/InventoryContext';
import { printDocument } from '../utils/printTemplates';

const API_URL = '/api/sales-orders';
const CUSTOMERS_API = '/api/customers';
const ITEMS_API = '/api/items';

const SalesOrders = () => {
    const { user } = useContext(AuthContext);
    const { billingSettings } = useContext(InventoryContext);
    const [orders, setOrders] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState(null);
    const [fetchingBalance, setFetchingBalance] = useState(false);

    const [formData, setFormData] = useState({
        customer: '',
        orderNumber: '',
        orderDate: new Date().toISOString().split('T')[0],
        items: [{ 
            item: '', 
            quantity: '', 
            price: '', 
            boxCount: '', 
            totalPcs: '', 
            totalSqFt: '',
            brand: '',
            size: '',
            batchId: '',
            availableBatches: [],
            billingUnit: billingSettings?.unitConfig?.quantityBasis === 'sqft' ? 'sqft' : 'pieces',
            stockQty: 0,
            stockUnit: 'pieces',
            physicalStock: 0
        }],
        totalAmount: 0,
        status: 'confirmed',
        isEstimation: false,
        notes: '',
        loadingCharges: '',
        transportCharges: '',
        taxAmount: '',
        oldBalance: '',
        advanceAmount: ''
    });

    useEffect(() => {
        fetchOrders();
        fetchCustomers();
        fetchItems();
    }, []);

    const fetchOrders = async () => {
        try {
            const res = await axios.get(API_URL, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setOrders(res.data.orders || []);
            setLoading(false);
        } catch (error) {
            toast.error('Failed to fetch orders');
            setLoading(false);
        }
    };

    const fetchCustomers = async () => {
        try {
            const res = await axios.get(CUSTOMERS_API, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setCustomers(res.data.data?.customers || res.data.customers || []);
        } catch (error) {
            console.error('Failed to fetch customers');
        }
    };

    const fetchItems = async () => {
        try {
            const res = await axios.get(ITEMS_API, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setItems(res.data.items || []);
        } catch (error) {
            toast.error('Failed to fetch items');
        }
    };

    const handleAddItem = () => {
        setFormData({
            ...formData,
            items: [...formData.items, { 
                item: '', 
                quantity: '', 
                price: '', 
                boxCount: '', 
                totalPcs: '', 
                totalSqFt: '',
                brand: '',
                size: '',
                batchId: '',
                availableBatches: [],
                billingUnit: billingSettings?.unitConfig?.quantityBasis === 'sqft' ? 'sqft' : 'pieces',
                stockQty: 0,
                stockUnit: 'pieces',
                physicalStock: 0
            }]
        });
    };

    const handleRemoveItem = (index) => {
        const newItems = formData.items.filter((_, i) => i !== index);
        setFormData({ ...formData, items: newItems });
    };

    const handleCustomerChange = async (customerId) => {
        setFormData(prev => ({ ...prev, customer: customerId }));
        if (customerId) {
            setFetchingBalance(true);
            try {
                const res = await axios.get(`${CUSTOMERS_API}/${customerId}/balance`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
                // balance API returns { success, data: { balance, customer } } based on standardResponse
                const bal = res.data.data?.balance ?? 0;
                setFormData(prev => ({ ...prev, oldBalance: bal }));
            } catch (error) {
                console.error('Error fetching customer balance');
            } finally {
                setFetchingBalance(false);
            }
        }
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...formData.items];
        const row = { ...newItems[index] };

        if (field === 'item') {
            const selectedItem = items.find(i => i._id === value);
            if (selectedItem) {
                row.item = value;
                row.price = selectedItem.sellingPrice || 0;
                row.brand = selectedItem.brand;
                row.size = selectedItem.size;
                row.sqFtPerPc = selectedItem.sqFtPerPc || 0;
                row.pcsPerBox = selectedItem.pcsPerBox || 1;
                row.purchasePrice = selectedItem.purchasePrice || 0;
                row.physicalStock = selectedItem.quantity || 0;
                row.billingUnit = row.sqFtPerPc > 0 ? (billingSettings?.unitConfig?.quantityBasis || 'sqft') : 'pieces';
                row.availableBatches = selectedItem.batches || [];
                if (row.availableBatches.length > 0) {
                    row.batchId = row.availableBatches[0]._id;
                    row.price = row.availableBatches[0].price || row.price;
                }
            }
        } else {
            row[field] = value;
        }

        const sqFtPerPc = row.sqFtPerPc || 0;
        const pcsPerBox = row.pcsPerBox || 1;
        const isTile = sqFtPerPc > 0;

        if (isTile) {
            if (field === 'boxCount') {
                row.totalPcs = parseFloat(value || 0) * pcsPerBox;
                row.totalSqFt = row.totalPcs * sqFtPerPc;
                row.quantity = row.billingUnit === 'sqft' ? row.totalSqFt : parseFloat(value || 0);
            } else if (field === 'billingUnit') {
                row.quantity = value === 'sqft' ? row.totalSqFt : row.boxCount;
            } else if (field === 'quantity') {
                if (row.billingUnit === 'sqft') {
                    row.totalSqFt = parseFloat(value || 0);
                    row.totalPcs = row.totalSqFt / sqFtPerPc;
                    row.boxCount = row.totalPcs / pcsPerBox;
                } else {
                    row.boxCount = parseFloat(value || 0);
                    row.totalPcs = row.boxCount * pcsPerBox;
                    row.totalSqFt = row.totalPcs * sqFtPerPc;
                }
            }
        } else {
            row.totalPcs = parseFloat(row.quantity || 0);
        }

        row.total = (parseFloat(row.quantity || 0) * parseFloat(row.price || 0)) || 0;
        newItems[index] = row;
        setFormData({ ...formData, items: newItems });
    };

    const calculateTotals = () => {
        const itemsTotal = formData.items.reduce((sum, item) => sum + (item.total || 0), 0);
        const netTotal = itemsTotal + 
            parseFloat(formData.loadingCharges || 0) + 
            parseFloat(formData.transportCharges || 0) + 
            parseFloat(formData.taxAmount || 0) + 
            parseFloat(formData.oldBalance || 0) - 
            parseFloat(formData.advanceAmount || 0);
        return { itemsTotal, netTotal };
    };

    const handleEdit = (order) => {
        setEditingOrder(order);
        setFormData({
            customer: order.customer?._id || order.customer,
            orderNumber: order.orderNumber,
            orderDate: order.orderDate.split('T')[0],
            items: order.items.map(item => ({
                ...item,
                item: item.item?._id || item.item,
                sqFtPerPc: item.item?.sqFtPerPc || 0,
                pcsPerBox: item.item?.pcsPerBox || 1,
                availableBatches: item.item?.batches || [],
                physicalStock: item.item?.quantity || 0
            })),
            totalAmount: order.totalAmount,
            status: order.status,
            isEstimation: order.isEstimation || false,
            notes: order.notes || '',
            loadingCharges: order.loadingCharges || 0,
            transportCharges: order.transportCharges || 0,
            taxAmount: order.taxAmount || 0,
            oldBalance: order.oldBalance || 0,
            advanceAmount: order.advanceAmount || 0
        });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingOrder(null);
        setFormData({
            customer: '',
            orderNumber: '',
            orderDate: new Date().toISOString().split('T')[0],
            items: [{ 
                item: '', quantity: '', price: '', boxCount: '', totalPcs: '', totalSqFt: '',
                brand: '', size: '', batchId: '', availableBatches: [], billingUnit: billingSettings?.unitConfig?.quantityBasis === 'sqft' ? 'sqft' : 'pieces',
                physicalStock: 0
            }],
            totalAmount: 0,
            status: 'confirmed',
            isEstimation: false,
            notes: '',
            loadingCharges: '',
            transportCharges: '',
            taxAmount: '',
            oldBalance: '',
            advanceAmount: ''
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const { netTotal } = calculateTotals();
            const submissionData = { ...formData, totalAmount: netTotal };

            // Frontend Pricing & Stock Validation
            for (const row of formData.items) {
                if (billingSettings?.pricingConfig?.preventSellingBelowPurchase && !formData.isEstimation) {
                    if (row.price < (row.purchasePrice || 0)) {
                        toast.error(`Price for ${row.name || 'item'} is below purchase price (₹${row.purchasePrice})`);
                        return;
                    }
                }
                // Stock Validation
                if (!formData.isEstimation) {
                    const required = row.stockQty || row.quantity;
                    if (required > row.physicalStock) {
                        toast.error(`Insufficient stock for ${row.name || 'item'}. Available: ${row.physicalStock}`);
                        return;
                    }
                }
            }
            
            if (editingOrder) {
                await axios.put(`${API_URL}/${editingOrder._id}`, submissionData, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
                toast.success('Order updated successfully');
            } else {
                await axios.post(API_URL, submissionData, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
                toast.success('Order created successfully');
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
            toast.error(error.response?.data?.message || 'Failed to update status');
        }
    };

    const handlePrint = (order) => {
        printDocument(order, billingSettings, order.isEstimation ? 'quotation' : 'invoice');
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
                                    <td className="px-6 py-4 font-bold text-gray-900">₹{order.totalAmount?.toLocaleString() || 0}</td>
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
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm overflow-hidden">
                    <div className="bg-white rounded-2xl shadow-2xl w-[95%] max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
                        <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                            <div>
                                <h2 className="text-2xl font-black text-gray-800">
                                    {editingOrder ? 'Edit' : 'Create'} {formData.isEstimation ? 'Quotation' : 'Sales Order'}
                                </h2>
                                <p className="text-xs text-gray-500 font-medium">{billingSettings?.branding?.tagline || 'Business Inventory & Billing System'}</p>
                            </div>
                            <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 text-3xl transition-colors">&times;</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                            <form id="salesOrderForm" onSubmit={handleSubmit} className="space-y-8 pb-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                                    <div className="md:col-span-1">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Select Customer *</label>
                                        <select required value={formData.customer} onChange={(e) => handleCustomerChange(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none shadow-sm transition-all">
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
                                                    <th className="px-4 py-3 text-[10px] font-black text-gray-600 uppercase tracking-wider">Item / Batch</th>
                                                    <th className="px-4 py-3 text-[10px] font-black text-gray-600 uppercase tracking-wider w-24">Input Qty</th>
                                                    <th className="px-4 py-3 text-[10px] font-black text-gray-600 uppercase tracking-wider w-32">Billed Qty</th>
                                                    <th className="px-4 py-3 text-[10px] font-black text-gray-600 uppercase tracking-wider w-32">Rate (₹)</th>
                                                    <th className="px-4 py-3 text-[10px] font-black text-gray-600 uppercase tracking-wider w-32">Unit</th>
                                                    <th className="px-4 py-3 text-[10px] font-black text-gray-600 uppercase tracking-wider text-right w-32">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {formData.items.map((row, index) => {
                                                    const isTile = row.sqFtPerPc > 0;
                                                    return (
                                                        <tr key={index} className="hover:bg-gray-50">
                                                            <td className="px-4 py-3">
                                                                <div className="flex items-center gap-2">
                                                                    <button type="button" onClick={() => handleRemoveItem(index)} className="text-red-400 hover:text-red-600 font-bold text-lg">&times;</button>
                                                                    <div className="flex-1">
                                                                        <select required value={row.item} onChange={(e) => handleItemChange(index, 'item', e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-primary-400 outline-none border-gray-200 font-medium text-sm">
                                                                            <option value="">Select Item</option>
                                                                            {items.map(i => <option key={i._id} value={i._id}>{i.name} ({i.brand} - {i.size})</option>)}
                                                                        </select>
                                                                        <div className="flex justify-between items-center mt-1 px-1">
                                                                            <span className={`text-[10px] font-black uppercase ${row.physicalStock > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                                                Stock: {row.physicalStock || 0}
                                                                            </span>
                                                                        </div>
                                                                        {row.availableBatches && row.availableBatches.length > 0 && (
                                                                            <div className="mt-2 group relative">
                                                                                <select
                                                                                    value={row.batchId}
                                                                                    onChange={(e) => handleItemChange(index, 'batchId', e.target.value)}
                                                                                    className="w-full text-[10px] px-2 py-1.5 border-2 border-primary-200 rounded-lg bg-primary-50 text-primary-800 font-bold outline-none focus:border-primary-400 shadow-sm"
                                                                                >
                                                                                    {row.availableBatches.map(b => (
                                                                                        <option key={b._id} value={b._id}>
                                                                                            {b.batchNumber || 'Batch'} - ₹{b.price} ({b.quantity} Left)
                                                                                        </option>
                                                                                    ))}
                                                                                </select>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <input 
                                                                    type="number" 
                                                                    step="0.01" 
                                                                    min="0" 
                                                                    value={isTile ? row.boxCount : row.quantity} 
                                                                    onChange={(e) => handleItemChange(index, isTile ? 'boxCount' : 'quantity', e.target.value)} 
                                                                    placeholder={isTile ? (billingSettings?.unitConfig?.piecesPerBoxLabel?.replace('Pcs per ', '') || 'Box') : "Qty"}
                                                                    className="w-full px-3 py-2 border rounded-lg border-gray-200 outline-none focus:ring-1 focus:ring-primary-400 text-center font-bold" 
                                                                />
                                                                {isTile && <div className="text-[9px] text-gray-400 text-center mt-1 uppercase font-bold">{billingSettings?.unitConfig?.piecesPerBoxLabel?.replace('Pcs per ', '') || 'Boxes'}</div>}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <input 
                                                                    required 
                                                                    type="number" 
                                                                    step="0.01" 
                                                                    readOnly={isTile}
                                                                    value={row.quantity} 
                                                                    onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value))} 
                                                                    className={`w-full px-3 py-2 border rounded-lg border-gray-200 outline-none font-medium text-center ${isTile ? 'bg-gray-50' : ''}`} 
                                                                />
                                                                {isTile && <div className="text-[9px] text-gray-400 text-center mt-1 uppercase font-bold">{row.billingUnit === 'sqft' ? (billingSettings?.unitConfig?.quantityLabel || 'SqFt') : (billingSettings?.unitConfig?.piecesPerBoxLabel?.replace('Pcs per ', '') || 'Box')}</div>}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <input required type="number" step="0.01" value={row.price} onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value))} className="w-full px-3 py-2 border rounded-lg border-gray-200 outline-none focus:ring-1 focus:ring-primary-400 font-bold text-right" />
                                                                <div className="text-[9px] text-gray-400 text-right mt-1 uppercase font-bold">Per {isTile ? row.billingUnit : 'Piece'}</div>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {isTile ? (
                                                                    <select value={row.billingUnit} onChange={(e) => handleItemChange(index, 'billingUnit', e.target.value)} className="w-full px-2 py-2 border rounded-lg border-gray-200 text-xs font-bold focus:ring-1 focus:ring-primary-400 outline-none">
                                                                        <option value="sqft">SqFt</option>
                                                                        <option value="boxes">Box</option>
                                                                    </select>
                                                                ) : (
                                                                    <div className="text-xs font-bold text-gray-400 text-center uppercase py-2">Pieces</div>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-black text-gray-800 pt-5">
                                                                ₹{(row.total || 0).toLocaleString()}
                                                                {isTile && <div className="text-[10px] text-gray-400 font-normal">({row.billingUnit === 'sqft' ? `${row.totalSqFt?.toFixed(2) || 0} ${billingSettings?.unitConfig?.quantityLabel || 'SqFt'}` : `${row.boxCount || 0} ${billingSettings?.unitConfig?.piecesPerBoxLabel?.replace('Pcs per ', '') || 'Boxes'}`})</div>}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
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
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                                                    Old Balance (Add) {fetchingBalance && <span className="text-blue-400 animate-pulse">⏳ loading...</span>}
                                                </label>
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
                            </form>
                        </div>
                        <div className="flex justify-end gap-4 p-6 border-t bg-gray-50 rounded-b-2xl">
                            <button type="button" onClick={handleCloseModal} className="px-8 py-3 text-gray-600 font-bold border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
                            <button 
                                form="salesOrderForm"
                                type="submit"
                                className="px-10 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-black shadow-lg shadow-primary-200 transition-all active:scale-95"
                            >
                                {editingOrder ? '💾 Update Changes' : (formData.isEstimation ? '💾 Save Quotation' : '✅ Generate Final Bill')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesOrders;
