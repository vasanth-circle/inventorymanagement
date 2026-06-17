import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext';
import { InventoryContext } from '../context/InventoryContext';
import { printDocument, generateInvoiceHtml } from '../utils/printTemplates';
import { shareViaWhatsApp, shareViaEmail, shareInvoiceAsPdf } from '../utils/shareUtils';
import SearchableSelect from '../components/SearchableSelect';
import { confirmDelete as confirmAction } from '../utils/confirmHelper.jsx';

const API_URL = '/api/sales-orders';
const CUSTOMERS_API = '/api/customers';
const ITEMS_API = '/api/items';

const SalesOrders = () => {
    const { user } = useContext(AuthContext);
    const { billingSettings, calculateItemValues } = useContext(InventoryContext);
    const [orders, setOrders] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState(null);
    const [fetchingBalance, setFetchingBalance] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [userFilter, setUserFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [usersList, setUsersList] = useState([]);
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;
    // Sites for the currently selected customer
    const [selectedCustomerSites, setSelectedCustomerSites] = useState([]);
    // Mobile share bottom sheet
    const [shareMenuOrder, setShareMenuOrder] = useState(null);

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
        unloadingCharges: '',
        transportCharges: '',
        taxAmount: '',
        oldBalance: '',
        advanceAmount: '',
        advancePaymentType: '',
        discountAmount: '',
        siteName: '',
        siteAddress: '',
        customerType: 'Regular Customer',
        referredBy: ''
    });

    useEffect(() => {
        fetchOrders();
        fetchCustomers();
        fetchItems();
        fetchUsersList();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, userFilter, typeFilter, fromDate, toDate]);

    const fetchUsersList = async () => {
        try {
            const res = await axios.get('/api/auth/users', {
                headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
            });
            setUsersList(res.data.data || res.data || []);
        } catch (error) {
            console.error('Failed to fetch users');
        }
    };

    const fetchOrders = async () => {
        try {
            const res = await axios.get(`${API_URL}?limit=1000`, {
                headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
            });
            setOrders(res.data.data?.orders || res.data.orders || []);
            setLoading(false);
        } catch (error) {
            toast.error('Failed to fetch orders');
            setLoading(false);
        }
    };

    const fetchCustomers = async () => {
        try {
            const res = await axios.get(`${CUSTOMERS_API}?limit=5000`, {
                headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
            });
            setCustomers(res.data.data?.customers || res.data.customers || []);
        } catch (error) {
            console.error('Failed to fetch customers');
        }
    };

    const fetchItems = async () => {
        try {
            const res = await axios.get(`${ITEMS_API}?limit=5000`, {
                headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
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
        setFormData(prev => ({ ...prev, customer: customerId, siteName: '', siteAddress: '' }));
        setSelectedCustomerSites([]);
        if (customerId) {
            setFetchingBalance(true);
            try {
                // Load balance
                const res = await axios.get(`${CUSTOMERS_API}/${customerId}/balance`, {
                    headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
                });
                const bal = res.data.data?.balance ?? 0;
                setFormData(prev => ({ ...prev, oldBalance: bal }));

                // Load customer sites
                const custRes = await axios.get(`${CUSTOMERS_API}/${customerId}`, {
                    headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
                });
                const sites = (custRes.data.data?.sites || []).filter(s => s.isActive !== false);
                setSelectedCustomerSites(sites);
                
                if (sites.length > 0) {
                    setFormData(prev => ({ 
                        ...prev, 
                        siteName: sites[0].name, 
                        siteAddress: sites[0].address || '' 
                    }));
                }
            } catch (error) {
                console.error('Error fetching customer balance/sites');
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
                row.name = selectedItem.name;
                row.price = selectedItem.price || 0;
                row.brand = selectedItem.brand;
                row.size = selectedItem.size;
                row.unitType = selectedItem.unitType || 'pieces';
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

        const updatedRow = calculateItemValues(row, field, value, billingSettings?.industry);
        newItems[index] = updatedRow;
        setFormData({ ...formData, items: newItems });
    };

    const calculateTotals = () => {
        const itemsTotal = formData.items.reduce((sum, item) => sum + (item.total || 0), 0);
        let netTotal = itemsTotal + 
            parseFloat(formData.loadingCharges || 0) + 
            parseFloat(formData.unloadingCharges || 0) + 
            parseFloat(formData.transportCharges || 0) + 
            parseFloat(formData.taxAmount || 0) + 
            parseFloat(formData.oldBalance || 0) - 
            parseFloat(formData.discountAmount || 0) -
            parseFloat(formData.advanceAmount || 0);

        let roundOffAmount = 0;
        if (billingSettings?.documentConfig?.enableRoundOff) {
            const roundedTotal = Math.round(netTotal);
            roundOffAmount = roundedTotal - netTotal;
            netTotal = roundedTotal;
        }

        return { itemsTotal, netTotal, roundOffAmount };
    };

    const handleEdit = (order) => {
        setEditingOrder(order);
        // Restore customer sites for the picker
        const custObj = order.customer;
        setSelectedCustomerSites((custObj?.sites || []).filter(s => s.isActive !== false));
        setFormData({
            customer: order.customer?._id || order.customer,
            orderNumber: order.orderNumber,
            orderDate: order.orderDate.split('T')[0],
            items: order.items.map(item => ({
                ...item,
                item: item.item?._id || item.item,
                unitType: item.item?.unitType || 'pieces',
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
            unloadingCharges: order.unloadingCharges || 0,
            transportCharges: order.transportCharges || 0,
            taxAmount: order.taxAmount || 0,
            oldBalance: order.oldBalance || 0,
            advanceAmount: order.advanceAmount || 0,
            advancePaymentType: order.advancePaymentType || '',
            discountAmount: order.discountAmount || 0,
            siteName: order.siteName || (custObj?.sites && custObj.sites.length > 0 ? custObj.sites[0].name : ''),
            siteAddress: order.siteAddress || (custObj?.sites && custObj.sites.length > 0 ? custObj.sites[0].address : ''),
            customerType: order.customerType || 'Regular Customer',
            referredBy: order.referredBy || ''
        });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingOrder(null);
        setSelectedCustomerSites([]);
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
            unloadingCharges: '',
            transportCharges: '',
            taxAmount: '',
            oldBalance: '',
            advanceAmount: '',
            advancePaymentType: '',
            discountAmount: '',
            siteName: '',
            siteAddress: '',
            customerType: 'Regular Customer',
            referredBy: ''
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const { netTotal, roundOffAmount } = calculateTotals();
            const submissionData = { ...formData, totalAmount: netTotal, roundOffAmount };

            // Frontend Pricing & Stock Validation
            let hasNegativeStock = false;
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
                        if (billingSettings?.workflowConfig?.allowNegativeStock === false) {
                            toast.error(`Insufficient stock for ${row.name || 'item'}. Available: ${row.physicalStock}`);
                            return;
                        } else {
                            hasNegativeStock = true;
                        }
                    }
                }
            }

            if (hasNegativeStock) {
                const proceed = await confirmAction("You are billing one or more items with insufficient stock (Negative Billing). Do you want to proceed?");
                if (!proceed) return;
            }
            
            if (editingOrder) {
                await axios.put(`${API_URL}/${editingOrder._id}`, submissionData, {
                    headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
                });
                toast.success('Order updated successfully');
            } else {
                await axios.post(API_URL, submissionData, {
                    headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
                });
                toast.success('Order created successfully');
            }
            handleCloseModal();
            fetchOrders();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error saving order');
        }
    };

    const handleDelete = async (orderId) => {
        const proceed = await confirmAction("Are you sure you want to completely delete this record? This will revert any dispatched stock back to inventory and permanently delete related data.");
        if (!proceed) return;

        try {
            await axios.delete(`${API_URL}/${orderId}`, {
                headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
            });
            toast.success('Deleted successfully and stock reverted');
            fetchOrders();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error deleting order');
        }
    };

    const handleStatusUpdate = async (id, status) => {
        try {
            await axios.patch(`${API_URL}/${id}/status`, { status }, {
                headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
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

    const { itemsTotal, netTotal, roundOffAmount } = calculateTotals();

    const filteredOrders = orders.filter(order => {
        const matchSearch = !searchTerm || 
            order.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (order.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (order.customer?.companyName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (order.customer?.phone || '').includes(searchTerm);
        const matchUser = !userFilter || order.user?._id === userFilter;
        const matchType = !typeFilter || 
            (typeFilter === 'quote' && order.isEstimation) || 
            (typeFilter === 'invoice' && !order.isEstimation);
            
        let matchDate = true;
        if (fromDate || toDate) {
            const orderDate = new Date(order.orderDate).setHours(0,0,0,0);
            const start = fromDate ? new Date(fromDate).setHours(0,0,0,0) : null;
            const end = toDate ? new Date(toDate).setHours(0,0,0,0) : null;
            
            if (start && end) {
                matchDate = orderDate >= start && orderDate <= end;
            } else if (start) {
                matchDate = orderDate >= start;
            } else if (end) {
                matchDate = orderDate <= end;
            }
        }
            
        return matchSearch && matchUser && matchType && matchDate;
    });

    const totalFiltered = filteredOrders.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / itemsPerPage));
    const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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

            <div className="flex gap-3 flex-wrap">
                <input
                    type="text"
                    placeholder="Search by order #, name or phone..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="flex-1 min-w-[200px] h-10 px-4 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none shadow-sm"
                />
                <div className="flex items-center gap-2">
                    <input
                        type="date"
                        value={fromDate}
                        onChange={e => setFromDate(e.target.value)}
                        className="h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none shadow-sm"
                        title="From Date"
                    />
                    <span className="text-gray-500 text-sm font-medium">to</span>
                    <input
                        type="date"
                        value={toDate}
                        onChange={e => setToDate(e.target.value)}
                        className="h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none shadow-sm"
                        title="To Date"
                    />
                </div>
                <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                    className="h-10 px-4 bg-white border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary-500 outline-none shadow-sm"
                >
                    <option value="">All Types</option>
                    <option value="invoice">Invoices</option>
                    <option value="quote">Quotations</option>
                </select>
                <div className="min-w-[200px]">
                    <SearchableSelect
                        value={userFilter}
                        onChange={e => setUserFilter(e.target.value)}
                        options={usersList.map(u => ({ value: u._id, label: u.name }))}
                        placeholder="All Reps / Users"
                        searchPlaceholder="Search users..."
                    />
                </div>
            </div>            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Desktop Table View */}
                    <div className="hidden lg:block bg-white rounded-xl shadow-md overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-bottom border-gray-100">
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase">Order #</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase">Customer</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase">Date</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase">Created By</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase">Net Amount</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase">Status</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paginatedOrders.map((order) => (
                                    <tr key={order._id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-primary-700">
                                            {order.orderNumber}
                                            {order.isEstimation && <span className="ml-2 text-[10px] bg-purple-100 text-purple-600 px-1 rounded">QUOTE</span>}
                                        </td>
                                        <td className="px-6 py-4 text-gray-900 font-medium">{order.customer?.companyName || order.customer?.name}</td>
                                        <td className="px-6 py-4 text-gray-600 text-sm">{new Date(order.orderDate).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-sm font-semibold text-gray-600">{order.user?.name || 'System'}</td>
                                        <td className="px-6 py-4 font-bold text-gray-900">₹{order.totalAmount?.toLocaleString() || 0}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${getStatusColor(order.status)}`}>
                                                {order.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-2">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => handlePrint(order)} className="text-primary-600 hover:text-primary-800 text-lg font-bold border-2 border-primary-100 w-9 h-9 flex items-center justify-center rounded-lg bg-primary-50 transition-all" title="Bill">
                                                    📄
                                                </button>
                                                <button onClick={() => setShareMenuOrder(order)} className="text-blue-600 hover:text-blue-800 text-lg font-bold border-2 border-blue-100 w-9 h-9 flex items-center justify-center rounded-lg bg-blue-50 transition-all" title="Share">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
                                                    </svg>
                                                </button>
                                                {order.isEstimation && ['super_admin', 'admin', 'tenant_owner', 'tenant_admin'].includes(user?.role) && (
                                                    <button 
                                                        onClick={() => handleStatusUpdate(order._id, 'confirmed')} 
                                                        className="text-green-600 hover:text-green-800 text-lg font-bold border-2 border-green-100 w-9 h-9 flex items-center justify-center rounded-lg bg-green-50 transition-all"
                                                        title="Convert to Bill"
                                                    >
                                                        🔄
                                                    </button>
                                                )}
                                                {!['dispatched', 'partially_dispatched'].includes(order.status) && (
                                                    <button 
                                                        onClick={() => handleEdit(order)} 
                                                        className="text-amber-600 hover:text-amber-800 text-lg font-bold border-2 border-amber-100 w-9 h-9 flex items-center justify-center rounded-lg bg-amber-50 transition-all"
                                                        title="Edit"
                                                    >
                                                        ✏️
                                                    </button>
                                                )}
                                                {['super_admin', 'admin', 'tenant_owner', 'tenant_admin'].includes(user?.role) && (
                                                    <button 
                                                        onClick={() => handleDelete(order._id)} 
                                                        className="text-red-600 hover:text-red-800 text-lg font-bold border-2 border-red-100 w-9 h-9 flex items-center justify-center rounded-lg bg-red-50 transition-all"
                                                        title="Delete & Revert Stock"
                                                    >
                                                        🗑️
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="lg:hidden space-y-4">
                        {paginatedOrders.map((order) => (
                            <div key={order._id} className="bg-white rounded-2xl border border-gray-100 shadow-lg p-5 relative overflow-hidden active:scale-[0.98] transition-all">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-primary-600 uppercase tracking-widest flex items-center gap-1">
                                            {order.orderNumber}
                                            {order.isEstimation && <span className="bg-purple-100 text-purple-600 px-1.5 rounded-md text-[8px]">ESTIMATE</span>}
                                        </span>
                                        <h3 className="font-extrabold text-gray-900 text-base leading-tight mt-0.5">{order.customer?.companyName || order.customer?.name}</h3>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider shadow-sm ${getStatusColor(order.status)}`}>
                                        {order.status.replace('_', ' ')}
                                    </span>
                                </div>

                                <div className="flex items-center gap-4 text-gray-500 mb-5">
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs">📅</span>
                                        <span className="text-[10px] font-bold uppercase">{new Date(order.orderDate).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs">👤</span>
                                        <span className="text-[10px] font-bold uppercase truncate max-w-[80px]">{order.user?.name || 'Admin'}</span>
                                    </div>
                                </div>

                                <div className="bg-primary-900 -mx-5 -mb-5 px-5 pt-3 pb-4 mt-auto">
                                    {/* Amount row */}
                                    <div className="flex justify-between items-center mb-3">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black text-primary-300 uppercase tracking-tighter">Amount Due</span>
                                            <span className="text-xl font-black text-white">₹{order.totalAmount?.toLocaleString() || 0}</span>
                                        </div>
                                        {/* Print button always visible */}
                                        <button onClick={() => handlePrint(order)} className="w-9 h-9 bg-primary-800 hover:bg-primary-700 text-white rounded-xl flex items-center justify-center text-sm shadow-md transition-colors flex-shrink-0" title="Print/PDF Bill">📄</button>
                                    </div>
                                    {/* Scrollable action buttons row */}
                                    <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                                        {/* Share PDF */}
                                        <button
                                            onClick={() => setShareMenuOrder(order)}
                                            className="flex-shrink-0 flex items-center gap-1.5 h-9 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
                                            title="Share Invoice"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
                                                <polyline points="16 6 12 2 8 6"/>
                                                <line x1="12" y1="2" x2="12" y2="15"/>
                                            </svg>
                                            Share
                                        </button>
                                        {/* WhatsApp */}
                                        <button onClick={() => shareViaWhatsApp(order, billingSettings, order.isEstimation ? 'quotation' : 'invoice')} className="flex-shrink-0 w-9 h-9 bg-green-500 hover:bg-green-600 text-white rounded-xl flex items-center justify-center text-sm shadow-md transition-colors" title="WhatsApp">💬</button>
                                        {/* Convert */}
                                        {order.isEstimation && ['super_admin', 'admin', 'tenant_owner', 'tenant_admin'].includes(user?.role) && (
                                            <button onClick={() => handleStatusUpdate(order._id, 'confirmed')} className="flex-shrink-0 w-9 h-9 bg-teal-500 hover:bg-teal-600 text-white rounded-xl flex items-center justify-center text-sm shadow-md transition-colors" title="Convert to Bill">🔄</button>
                                        )}
                                        {/* Edit */}
                                        {!['dispatched', 'partially_dispatched'].includes(order.status) && (
                                            <button onClick={() => handleEdit(order)} className="flex-shrink-0 w-9 h-9 bg-amber-500 hover:bg-amber-600 text-white rounded-xl flex items-center justify-center text-sm shadow-md transition-colors" title="Edit">✏️</button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                            <span className="text-sm text-gray-600 font-medium">
                                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalFiltered)} of {totalFiltered} entries
                            </span>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Previous
                                </button>
                                <span className="px-4 py-2 text-sm font-bold text-gray-800 bg-gray-50 rounded-lg hidden sm:block">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button 
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Share Invoice Bottom Sheet (Mobile) ── */}
            {shareMenuOrder && (() => {
                const order = shareMenuOrder;
                const docType = order.isEstimation ? 'quotation' : 'invoice';
                const docLabel = order.isEstimation ? 'Quotation' : 'Invoice';

                const handleShareFile = async () => {
                    try {
                        await shareInvoiceAsPdf(order, billingSettings, docType, generateInvoiceHtml);
                        setShareMenuOrder(null);
                    } catch (err) {
                        if (err?.name !== 'AbortError') {
                            toast.error('Could not share. Try Download instead.');
                        }
                    }
                };

                const handleDownload = async () => {
                    try {
                        // The shareInvoiceAsPdf function already falls back to downloading if share is unavailable
                        await shareInvoiceAsPdf(order, billingSettings, docType, generateInvoiceHtml);
                        toast.success('Downloaded as PDF!');
                        setShareMenuOrder(null);
                    } catch (err) {
                        toast.error('Download failed');
                    }
                };

                return (
                    <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShareMenuOrder(null)}>
                        {/* Backdrop */}
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                        {/* Sheet */}
                        <div
                            className="relative w-full bg-white rounded-t-3xl shadow-2xl animate-[slideUp_0.25s_ease-out]"
                            onClick={e => e.stopPropagation()}
                            style={{ animation: 'slideUp 0.25s ease-out' }}
                        >
                            {/* Handle bar */}
                            <div className="flex justify-center pt-3 pb-1">
                                <div className="w-10 h-1 bg-gray-300 rounded-full" />
                            </div>
                            <div className="px-5 pt-2 pb-6">
                                {/* Header */}
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <p className="text-[10px] font-black text-primary-600 uppercase tracking-widest">{order.orderNumber}</p>
                                        <h3 className="text-base font-extrabold text-gray-900">{order.customer?.companyName || order.customer?.name}</h3>
                                        <p className="text-xs text-gray-500 mt-0.5">₹{(order.totalAmount || 0).toLocaleString('en-IN')} · {docLabel}</p>
                                    </div>
                                    <button onClick={() => setShareMenuOrder(null)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200">✕</button>
                                </div>

                                <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-3">Share Options</p>

                                <div className="space-y-2.5">
                                    {/* Share File (native OS share → WhatsApp, Drive, etc.) */}
                                    <button
                                        onClick={handleShareFile}
                                        className="w-full flex items-center gap-3 p-3.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl shadow-md active:scale-95 transition-all"
                                    >
                                        <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
                                            </svg>
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-black">Share Invoice File</p>
                                            <p className="text-[10px] text-blue-200">Send via WhatsApp, Gmail, Drive…</p>
                                        </div>
                                    </button>

                                    {/* Download */}
                                    <button
                                        onClick={handleDownload}
                                        className="w-full flex items-center gap-3 p-3.5 bg-gray-50 border border-gray-200 text-gray-800 rounded-2xl active:scale-95 transition-all"
                                    >
                                        <div className="w-9 h-9 bg-gray-200 rounded-xl flex items-center justify-center flex-shrink-0">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                                            </svg>
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-bold">Download Invoice</p>
                                            <p className="text-[10px] text-gray-400">Save HTML → Open → Print as PDF</p>
                                        </div>
                                    </button>

                                    {/* WhatsApp text */}
                                    <button
                                        onClick={() => { shareViaWhatsApp(order, billingSettings, docType); setShareMenuOrder(null); }}
                                        className="w-full flex items-center gap-3 p-3.5 bg-green-50 border border-green-200 text-gray-800 rounded-2xl active:scale-95 transition-all"
                                    >
                                        <div className="w-9 h-9 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-lg">💬</div>
                                        <div className="text-left">
                                            <p className="text-sm font-bold text-green-800">WhatsApp Message</p>
                                            <p className="text-[10px] text-gray-400">Send order summary as text</p>
                                        </div>
                                    </button>

                                    {/* Print */}
                                    <button
                                        onClick={() => { handlePrint(order); setShareMenuOrder(null); }}
                                        className="w-full flex items-center gap-3 p-3.5 bg-gray-50 border border-gray-200 text-gray-800 rounded-2xl active:scale-95 transition-all"
                                    >
                                        <div className="w-9 h-9 bg-gray-200 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">🖨️</div>
                                        <div className="text-left">
                                            <p className="text-sm font-bold">Print / Save as PDF</p>
                                            <p className="text-[10px] text-gray-400">Open print dialog</p>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

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
                                        <SearchableSelect
                                            required
                                            value={formData.customer}
                                            onChange={(e) => handleCustomerChange(e.target.value)}
                                            options={customers.map(c => ({ 
                                                value: c._id, 
                                                label: `${c.companyName || c.name}${c.phone ? ` - ${c.phone}` : ''}` 
                                            }))}
                                            placeholder="Select Customer"
                                            searchPlaceholder="Search customer or phone..."
                                            className="w-full"
                                        />
                                        {/* Site Picker - shown only when selected customer has saved sites */}
                                        {selectedCustomerSites.length > 0 && (
                                            <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-xl space-y-2">
                                                <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest">
                                                    🏗️ Select Site / Project
                                                </label>
                                                <select
                                                    value={formData.siteName}
                                                    onChange={(e) => {
                                                        const site = selectedCustomerSites.find(s => s.name === e.target.value);
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            siteName: e.target.value,
                                                            siteAddress: site?.address || ''
                                                        }));
                                                    }}
                                                    className="w-full px-3 py-2 border border-blue-200 rounded-lg bg-white text-sm font-bold text-blue-900 outline-none focus:ring-2 focus:ring-blue-400"
                                                >
                                                    <option value="">— No specific site —</option>
                                                    {selectedCustomerSites.map((s, i) => (
                                                        <option key={i} value={s.name}>{s.name}{s.address ? ` (${s.address})` : ''}</option>
                                                    ))}
                                                </select>
                                                {formData.siteName && (
                                                    <div className="text-[10px] font-bold text-blue-600">
                                                        📍 {formData.siteName}{formData.siteAddress ? ` — ${formData.siteAddress}` : ''}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {/* Free-text site for customers without pre-saved sites */}
                                        {formData.customer && selectedCustomerSites.length === 0 && (
                                            <div className="mt-2">
                                                <input
                                                    type="text"
                                                    value={formData.siteName}
                                                    onChange={e => setFormData(prev => ({ ...prev, siteName: e.target.value }))}
                                                    placeholder="Site / Project name (optional)"
                                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-primary-400 text-gray-600"
                                                />
                                            </div>
                                        )}
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
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Customer Type</label>
                                        <select value={formData.customerType} onChange={(e) => setFormData({ ...formData, customerType: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 bg-white">
                                            <option value="Regular Customer">Regular Customer</option>
                                            <option value="Walk-in">Walk-in</option>
                                            <option value="Digital Marketing">Digital Marketing</option>
                                            <option value="Referral">Referral</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    {formData.customerType === 'Referral' && (
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Referred By</label>
                                            <input type="text" value={formData.referredBy} onChange={(e) => setFormData({ ...formData, referredBy: e.target.value })} placeholder="Name of referrer" className="w-full px-4 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-500" />
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-lg font-black text-gray-800 flex items-center">
                                            <span className="bg-primary-100 text-primary-600 p-1 rounded mr-2 text-sm">📦</span>
                                            Item Details
                                        </h3>
                                    </div>
                                    {/* Items List - Desktop Table */}
                                    <div className="hidden md:block overflow-visible border rounded-xl shadow-sm">
                                        <table className="w-full text-left min-w-[800px]">
                                            <thead>
                                                <tr className="bg-gray-50 border-b border-gray-100">
                                                    <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Item / Batch</th>
                                                    <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest w-32">
                                                        {billingSettings?.unitConfig?.secondaryLabel || (billingSettings?.industry === 'tiles' ? 'Boxes' : 'Quantity')}
                                                    </th>
                                                    <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest w-32">
                                                        {billingSettings?.unitConfig?.quantityLabel || 'Billed Qty'}
                                                    </th>
                                                    <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest w-32">
                                                        {billingSettings?.unitConfig?.rateLabel || 'Rate'}
                                                    </th>
                                                    <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest w-24">Unit</th>
                                                    <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right w-32">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {formData.items.map((row, index) => {
                                                    const isTile = billingSettings?.industry === 'tiles' && row.sqFtPerPc > 0;
                                                    return (
                                                        <tr key={index} className="hover:bg-gray-50">
                                                            <td className="px-4 py-3">
                                                                <div className="flex items-center gap-2">
                                                                    <button type="button" onClick={() => handleRemoveItem(index)} className="text-red-400 hover:text-red-600 font-bold text-lg">&times;</button>
                                                                    <div className="flex-1">
                                                                        <SearchableSelect 
                                                                            value={row.item} 
                                                                            onChange={(e) => handleItemChange(index, 'item', e.target.value)}
                                                                            options={items.map(i => ({ value: i._id, label: `${i.name} (${i.brand} - ${i.size})` }))}
                                                                            placeholder="Select Item"
                                                                            searchPlaceholder="Search items..."
                                                                            className="w-full font-medium text-sm"
                                                                        />
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
                                                                    step={isTile ? "0.5" : (row.unitType === 'box' ? "0.5" : (['sqft', 'kg'].includes(row.unitType) ? "0.01" : "1"))}
                                                                    min="0" 
                                                                    value={isTile ? (row.boxCount || '') : (row.quantity || '')} 
                                                                    onChange={(e) => handleItemChange(index, isTile ? 'boxCount' : 'quantity', e.target.value)} 
                                                                    placeholder={isTile ? "Boxes" : "Qty"}
                                                                    className="w-full px-3 py-2 border rounded-lg border-gray-200 outline-none focus:ring-1 focus:ring-primary-400 text-center font-bold" 
                                                                />
                                                                {isTile && (
                                                                    <div className="mt-1 flex flex-col items-center gap-0.5">
                                                                        <div className="text-[8px] font-black text-rose-500 uppercase">
                                                                            {row.totalPcs} Pieces
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <input 
                                                                    required 
                                                                    type="number" 
                                                                    step="0.01" 
                                                                    readOnly={isTile}
                                                                    value={row.quantity || ''} 
                                                                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} 
                                                                    className={`w-full px-3 py-2 border rounded-lg border-gray-200 outline-none font-medium text-center ${isTile ? 'bg-gray-50' : ''}`} 
                                                                />
                                                                {isTile && <div className="text-[9px] text-gray-400 text-center mt-1 uppercase font-bold">{row.billingUnit === 'sqft' ? (billingSettings?.unitConfig?.quantityLabel || 'SqFt') : 'Boxes'}</div>}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <input required type="number" step="0.01" value={row.price === 0 ? '' : row.price} onChange={(e) => handleItemChange(index, 'price', e.target.value)} className="w-full px-3 py-2 border rounded-lg border-gray-200 outline-none focus:ring-1 focus:ring-primary-400 font-bold text-right" />
                                                                <div className="text-[9px] text-gray-400 text-right mt-1 uppercase font-bold">Per {isTile ? row.billingUnit : 'Piece'}</div>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {billingSettings?.industry === 'tiles' && isTile ? (
                                                                    <select value={row.billingUnit} onChange={(e) => handleItemChange(index, 'billingUnit', e.target.value)} className="w-full px-2 py-2 border rounded-lg border-gray-200 text-xs font-bold focus:ring-1 focus:ring-primary-400 outline-none">
                                                                        <option value="sqft">SqFt</option>
                                                                        <option value="boxes">Box</option>
                                                                    </select>
                                                                ) : (
                                                                    <div className="text-xs font-bold text-gray-400 text-center uppercase py-2">
                                                                        {billingSettings?.unitConfig?.quantityBasis || 'Pieces'}
                                                                    </div>
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

                                    {/* Items List - Mobile Cards */}
                                    <div className="md:hidden space-y-4">
                                        {formData.items.map((row, index) => {
                                            const isTile = billingSettings?.industry === 'tiles' && row.sqFtPerPc > 0;
                                            return (
                                                <div key={index} className="bg-white border-2 border-gray-100 rounded-2xl p-4 shadow-sm relative space-y-4">
                                                    <button type="button" onClick={() => handleRemoveItem(index)} className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-red-50 text-red-500 rounded-full font-bold">✕</button>
                                                    
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Select Item</label>
                                                        <SearchableSelect 
                                                            value={row.item} 
                                                            onChange={(e) => handleItemChange(index, 'item', e.target.value)}
                                                            options={items.map(i => ({ value: i._id, label: `${i.name} (${i.brand} - ${i.size})` }))}
                                                            placeholder="Select Item"
                                                            searchPlaceholder="Search items..."
                                                            className="w-full font-bold text-sm"
                                                        />
                                                        <div className="flex justify-between items-center px-1">
                                                            <span className={`text-[10px] font-black uppercase ${row.physicalStock > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                                Stock: {row.physicalStock || 0}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {row.availableBatches && row.availableBatches.length > 0 && (
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Batch</label>
                                                            <select value={row.batchId} onChange={(e) => handleItemChange(index, 'batchId', e.target.value)} className="w-full px-4 py-3 bg-primary-50 border border-primary-100 rounded-xl text-primary-800 font-bold outline-none text-sm">
                                                                {row.availableBatches.map(b => (
                                                                    <option key={b._id} value={b._id}>{b.batchNumber || 'Batch'} - ₹{b.price} ({b.quantity} Left)</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    )}

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                                {isTile ? 'Boxes' : (billingSettings?.unitConfig?.quantityLabel || 'Qty')}
                                                            </label>
                                                            <input type="number" step={isTile ? "0.5" : (row.unitType === 'box' ? "0.5" : (['sqft', 'kg'].includes(row.unitType) ? "0.01" : "1"))} min="0" value={isTile ? (row.boxCount || '') : (row.quantity || '')} onChange={(e) => handleItemChange(index, isTile ? 'boxCount' : 'quantity', e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none text-center font-bold" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                                {isTile ? row.billingUnit.toUpperCase() : 'Billed Qty'}
                                                            </label>
                                                            <input required type="number" step="0.01" readOnly={isTile} value={row.quantity || ''} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} className={`w-full px-4 py-3 border border-gray-200 rounded-xl outline-none font-bold text-center ${isTile ? 'bg-gray-50' : ''}`} />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Rate (Per {isTile ? row.billingUnit : 'Piece'})</label>
                                                            <input required type="number" step="0.01" value={row.price === 0 ? '' : row.price} onChange={(e) => handleItemChange(index, 'price', e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none font-bold text-right" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Row Total</label>
                                                            <div className="w-full px-4 py-3 bg-gray-900 text-white rounded-xl font-black text-right">₹{(row.total || 0).toLocaleString()}</div>
                                                        </div>
                                                    </div>
                                                    
                                                    {isTile && (
                                                        <div className="flex justify-between items-center px-1 bg-rose-50 p-2 rounded-lg border border-rose-100">
                                                            <span className="text-[10px] font-black text-rose-600 uppercase">Calc: {row.totalPcs} Pcs</span>
                                                            <span className="text-[10px] font-black text-rose-600 uppercase">{row.totalSqFt?.toFixed(2)} {billingSettings?.unitConfig?.quantityLabel || 'SqFt'}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
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
                                                <input type="number" value={formData.loadingCharges === 0 ? '' : formData.loadingCharges} onChange={(e) => setFormData({ ...formData, loadingCharges: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Unloading Charges</label>
                                                <input type="number" value={formData.unloadingCharges === 0 ? '' : formData.unloadingCharges} onChange={(e) => setFormData({ ...formData, unloadingCharges: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Transport Charges</label>
                                                <input type="number" value={formData.transportCharges === 0 ? '' : formData.transportCharges} onChange={(e) => setFormData({ ...formData, transportCharges: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tax Amount</label>
                                                <input type="number" value={formData.taxAmount === 0 ? '' : formData.taxAmount} onChange={(e) => setFormData({ ...formData, taxAmount: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                                                    Old Balance (Add) {fetchingBalance && <span className="text-blue-400 animate-pulse">⏳ loading...</span>}
                                                </label>
                                                <input type="number" value={formData.oldBalance === 0 ? '' : formData.oldBalance} onChange={(e) => setFormData({ ...formData, oldBalance: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none text-red-600 font-bold" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Advance Amount (Subtract)</label>
                                                <input type="number" value={formData.advanceAmount === 0 ? '' : formData.advanceAmount} onChange={(e) => setFormData({ ...formData, advanceAmount: e.target.value })} className="w-full px-3 py-2 border rounded-lg border-primary-300 outline-none text-green-600 font-bold" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Advance Payment Mode</label>
                                                <select
                                                    value={formData.advancePaymentType}
                                                    onChange={(e) => setFormData({ ...formData, advancePaymentType: e.target.value })}
                                                    className="w-full px-3 py-2 border rounded-lg border-primary-300 outline-none text-green-700 font-bold bg-white"
                                                >
                                                    <option value="">-- Select Mode --</option>
                                                    <option value="Cash">💵 Cash</option>
                                                    <option value="NEFT">🏦 NEFT</option>
                                                    <option value="Paytm">📱 Paytm</option>
                                                    <option value="GPay">📲 GPay</option>
                                                    <option value="Other">Other</option>
                                                </select>
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">🏷️ Discount Amount (Subtract)</label>
                                                <input type="number" min="0" step="0.01" value={formData.discountAmount === 0 ? '' : formData.discountAmount} onChange={(e) => setFormData({ ...formData, discountAmount: e.target.value })} className="w-full px-3 py-2 border border-amber-300 rounded-lg outline-none text-amber-700 font-bold" placeholder="0.00" />
                                            </div>
                                        </div>
                                        <div className="pt-6 border-t mt-6 space-y-3">
                                            <div className="flex justify-between text-gray-600 font-medium">
                                                <span>Subtotal Items:</span>
                                                <span>₹{itemsTotal.toLocaleString()}</span>
                                            </div>
                                            {parseFloat(formData.discountAmount || 0) > 0 && (
                                                <div className="flex justify-between text-amber-700 font-semibold text-sm">
                                                    <span>🏷️ Discount:</span>
                                                    <span>- ₹{parseFloat(formData.discountAmount || 0).toLocaleString()}</span>
                                                </div>
                                            )}
                                            {roundOffAmount !== 0 && (
                                                <div className="flex justify-between text-blue-600 font-semibold text-sm">
                                                    <span>🔄 Round Off:</span>
                                                    <span>{roundOffAmount > 0 ? '+' : ''} ₹{roundOffAmount.toFixed(2)}</span>
                                                </div>
                                            )}
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
