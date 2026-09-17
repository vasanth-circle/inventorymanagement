import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext';
import { InventoryContext } from '../context/InventoryContext';
import { printDocument, generateInvoiceHtml } from '../utils/printTemplates';
import { shareViaWhatsApp, shareViaEmail, shareInvoiceAsPdf } from '../utils/shareUtils';
import SearchableSelect from '../components/SearchableSelect';
import { confirmDelete as confirmAction } from '../utils/confirmHelper.jsx';
import Drawer from '../components/ui/Drawer';
import FormField, { FormSection } from '../components/ui/FormField';
import EmptyState from '../components/ui/EmptyState';
const API_URL = '/api/sales-orders';
const CUSTOMERS_API = '/api/customers';
const ITEMS_API = '/api/items';

const SalesOrders = () => {
    const { user } = useContext(AuthContext);
    const { billingSettings, calculateItemValues, customerTypes = [] } = useContext(InventoryContext);
    const [orders, setOrders] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState(null);
    const [fetchingBalance, setFetchingBalance] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [userFilter, setUserFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [sortBy, setSortBy] = useState('orderDate');
    const [sortOrder, setSortOrder] = useState('desc');
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
                row.billingUnit = (row.sqFtPerPc > 0 && !['pieces', 'pcs', 'nos', 'piece'].includes((row.unitType || '').toLowerCase())) ? (billingSettings?.unitConfig?.quantityBasis || 'sqft') : 'pieces';
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
        if (submitting) return; // Guard against double-click
        setSubmitting(true);
        try {
            if (!formData.items || formData.items.length === 0) {
                toast.error('Cannot save an empty bill. Please add at least one item.');
                setSubmitting(false);
                return;
            }

            const { netTotal, roundOffAmount } = calculateTotals();
            const submissionData = { ...formData, totalAmount: netTotal, roundOffAmount };

            // Frontend Pricing & Stock Validation
            let hasNegativeStock = false;
            for (const row of formData.items) {
                if (billingSettings?.pricingConfig?.preventSellingBelowPurchase && !formData.isEstimation) {
                    if (row.price < (row.purchasePrice || 0)) {
                        toast.error(`Price for ${row.name || 'item'} is below purchase price (â‚¹${row.purchasePrice})`);
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
        } finally {
            setSubmitting(false);
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
            const orderDate = new Date(order.orderDate).setHours(0, 0, 0, 0);
            const start = fromDate ? new Date(fromDate).setHours(0, 0, 0, 0) : null;
            const end = toDate ? new Date(toDate).setHours(0, 0, 0, 0) : null;

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

    const sortedOrders = [...filteredOrders].sort((a, b) => {
        let aValue = a[sortBy];
        let bValue = b[sortBy];

        if (sortBy === 'customer') {
            aValue = a.customer?.companyName || a.customer?.name || '';
            bValue = b.customer?.companyName || b.customer?.name || '';
        } else if (sortBy === 'user') {
            aValue = a.user?.name || '';
            bValue = b.user?.name || '';
        }

        if (sortBy === 'orderDate' || sortBy === 'createdAt') {
            return sortOrder === 'asc' ? new Date(aValue) - new Date(bValue) : new Date(bValue) - new Date(aValue);
        }

        if (typeof aValue === 'string') {
            return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }

        return sortOrder === 'asc' ? (aValue > bValue ? 1 : -1) : (bValue > aValue ? 1 : -1);
    });

    const totalFiltered = sortedOrders.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / itemsPerPage));
    const paginatedOrders = sortedOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const handleSort = (field) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('desc');
        }
    };

    const renderSortIcon = (field) => {
        if (sortBy !== field) return null;
        return <span className="ml-1 inline-block">{sortOrder === 'asc' ? 'â†‘' : 'â†“'}</span>;
    };

    // Helper: avatar color by customer
    const avatarColor = (name = '') => {
        const colors = ['avatar-blue','avatar-purple','avatar-green','avatar-orange','avatar-red','avatar-gray'];
        return colors[(name.charCodeAt(0) || 0) % colors.length];
    };

    return (
        <div className="animate-in space-y-5">
            {/* Page Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">{billingSettings?.industry === 'machinery' ? 'Sales / Quotations' : 'Sales Orders'}</h1>
                    <p className="page-subtitle">Manage your sales, estimates, and billing</p>
                </div>
                <button className="btn-primary" onClick={() => { resetForm(); setIsModalOpen(true); }}>
                    + Create New
                </button>
            </div>

            {/* Stat Cards */}
            <div className="stat-cards">
                <div className="stat-card">
                    <div className="stat-card-value">{orders.length}</div>
                    <div className="stat-card-label">Total Orders</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value" style={{color:'#059669'}}>
                        {'Rs.'}{(orders.filter(o => !o.isEstimation).reduce((sum, o) => sum + (o.totalAmount || 0), 0) / 1000).toFixed(1)}k
                    </div>
                    <div className="stat-card-label">Confirmed Sales</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value" style={{color:'#c2410c'}}>
                        {'Rs.'}{(orders.filter(o => o.isEstimation).reduce((sum, o) => sum + (o.totalAmount || 0), 0) / 1000).toFixed(1)}k
                    </div>
                    <div className="stat-card-label">Estimates Value</div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="filter-bar">
                <span style={{color:'#94a3b8',fontSize:'14px',marginLeft:'4px'}}>search</span>
                <input
                    type="text"
                    placeholder="Search by order #, customer..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />

                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{border:'none',background:'transparent',fontSize:'13px',color:'#475569',outline:'none',cursor:'pointer'}}>
                    <option value="">All Types</option>
                    <option value="estimation">Estimates</option>
                    <option value="confirmed">Confirmed</option>
                </select>
                <div style={{width:'1px',height:'20px',background:'#e2e8f0',margin:'0 4px'}}></div>

                {usersList.length > 0 && (
                    <>
                        <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} style={{border:'none',background:'transparent',fontSize:'13px',color:'#475569',outline:'none',cursor:'pointer'}}>
                            <option value="">All Users</option>
                            {usersList.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
                        </select>
                        <div style={{width:'1px',height:'20px',background:'#e2e8f0',margin:'0 4px'}}></div>
                    </>
                )}

                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                    <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{border:'none',background:'transparent',fontSize:'12px',color:'#475569',outline:'none'}} />
                    <span style={{color:'#94a3b8'}}>-</span>
                    <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{border:'none',background:'transparent',fontSize:'12px',color:'#475569',outline:'none'}} />
                </div>
            </div>

            {/* Main Table */}
            {loading ? (
                <div className="table-wrapper" style={{display:'flex',justifyContent:'center',alignItems:'center',height:'240px'}}>
                    <div style={{width:'40px',height:'40px',border:'3px solid #dbeafe',borderTop:'3px solid #2563eb',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}></div>
                </div>
            ) : paginatedOrders.length === 0 ? (
                <div className="table-wrapper">
                    <EmptyState
                        icon="🧾"
                        title="No orders found"
                        description="Try adjusting your filters or create a new order."
                        action={<button className="btn-primary" onClick={() => { resetForm(); setIsModalOpen(true); }}>+ Create New</button>}
                    />
                </div>
            ) : (
                <div className="table-wrapper">
                    <table className="table-premium">
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('orderNumber')} style={{cursor:'pointer'}}>Order #{renderSortIcon('orderNumber')}</th>
                                <th onClick={() => handleSort('customer')} style={{cursor:'pointer'}}>{billingSettings?.industry === 'machinery' ? 'Client' : 'Customer'} {renderSortIcon('customer')}</th>
                                <th onClick={() => handleSort('orderDate')} style={{cursor:'pointer'}}>Date {renderSortIcon('orderDate')}</th>
                                <th onClick={() => handleSort('totalAmount')} style={{cursor:'pointer'}}>Amount {renderSortIcon('totalAmount')}</th>
                                <th onClick={() => handleSort('status')} style={{cursor:'pointer'}}>Status {renderSortIcon('status')}</th>
                                <th style={{textAlign:'right'}}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedOrders.map((order) => {
                                const customerName = order.customer?.companyName || order.customer?.name || 'Unknown';
                                const initial = customerName.substring(0,2).toUpperCase();
                                return (
                                    <tr key={order._id}>
                                        <td>
                                            <div style={{fontWeight:'700',color:'#1d4ed8'}}>{order.orderNumber}</div>
                                            {order.isEstimation && <span className="badge badge-purple" style={{marginTop:'4px'}}>Estimate</span>}
                                        </td>
                                        <td>
                                            <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                                                <div className={`avatar ${avatarColor(customerName)}`} style={{width:'28px',height:'28px',fontSize:'10px'}}>{initial}</div>
                                                <div>
                                                    <div style={{fontWeight:'600',color:'#0f172a',fontSize:'13px'}}>{customerName}</div>
                                                    <div style={{fontSize:'11px',color:'#94a3b8'}}>{order.user?.name || 'System'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{fontSize:'13px',color:'#475569',fontWeight:'500'}}>{new Date(order.orderDate).toLocaleDateString()}</div>
                                        </td>
                                        <td>
                                            <div style={{fontSize:'14px',fontWeight:'800',color:'#0f172a'}}>Rs.{((order.totalAmount || 0) + (order.advanceAmount || 0) - (order.oldBalance || 0)).toLocaleString()}</div>
                                        </td>
                                        <td>
                                            <span className={`badge ${getStatusColor(order.status)}`}>
                                                {order.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td style={{textAlign:'right'}}>
                                            <div style={{display:'flex',justifyContent:'flex-end',gap:'4px'}}>
                                                <button className="btn-icon ledger" onClick={() => handlePrint(order)} title="Print Bill">📄</button>
                                                <button className="btn-icon" onClick={() => setShareMenuOrder(order)} title="Share" style={{color:'#2563eb',background:'#eff6ff'}}>📤</button>
                                                {order.isEstimation && ['super_admin', 'admin', 'tenant_owner', 'tenant_admin'].includes(user?.role) && (
                                                    <button className="btn-icon edit" onClick={() => handleStatusUpdate(order._id, 'confirmed')} title="Convert to Bill">✅</button>
                                                )}
                                                {order.status !== 'dispatched' && (
                                                    <button className="btn-icon edit" onClick={() => handleEdit(order)} title="Edit">✏️</button>
                                                )}
                                                {['super_admin', 'admin', 'tenant_owner', 'tenant_admin'].includes(user?.role) && (
                                                    <button className="btn-icon delete" onClick={() => handleDelete(order._id)} title="Delete">🗑️</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="pagination">
                            <div className="pagination-info">
                                Page {currentPage} of {totalPages}
                            </div>
                            <div className="pagination-controls">
                                <button className="page-btn" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>«</button>
                                <button className="page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>‹</button>
                                <span className="page-btn active">{currentPage}</span>
                                <button className="page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>›</button>
                                <button className="page-btn" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>»</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Create / Edit Drawer */}
            <Drawer
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingOrder ? 'Edit Order' : 'Create New Order'}
                size="lg"
                footer={
                    <>
                        <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                        <button type="button" onClick={() => handleSubmit(false)} className="btn-primary" disabled={submitting}>
                            {submitting ? 'Saving...' : (editingOrder ? 'Update Order' : 'Save Order')}
                        </button>
                        {!editingOrder && (
                            <button type="button" onClick={() => handleSubmit(true)} className="btn-primary" style={{background:'#10b981'}} disabled={submitting}>
                                Save & Print
                            </button>
                        )}
                    </>
                }
            >
                <form id="order-form" className="space-y-4">
                    <FormSection icon="🧑" title="Customer Details" color="#eff6ff">
                        <div className="form-grid-2">
                            <FormField label="Select Customer" required>
                                <SearchableSelect
                                    options={customers}
                                    value={formData.customer}
                                    onChange={(val) => {
                                        setFormData(prev => ({ ...prev, customer: val }));
                                        fetchCustomerBalance(val);
                                        const cust = customers.find(c => c._id === val);
                                        if (cust && cust.sites) {
                                            setSelectedCustomerSites(cust.sites);
                                            // auto select if 1 site
                                            if (cust.sites.length === 1 && cust.sites[0].isActive !== false) {
                                                setFormData(prev => ({...prev, siteId: cust.sites[0]._id}));
                                            }
                                        } else {
                                            setSelectedCustomerSites([]);
                                        }
                                    }}
                                    placeholder="Search Customer..."
                                    displayKey={(c) => `${c.companyName || c.name} - ${c.phone}`}
                                    valueKey="_id"
                                />
                                {fetchingBalance && <div className="hint text-blue-500">Fetching balance...</div>}
                                {!fetchingBalance && formData.customer && formData.oldBalance !== undefined && (
                                    <div className={`hint font-bold ${formData.oldBalance > 0 ? 'text-red-500' : formData.oldBalance < 0 ? 'text-green-500' : 'text-gray-500'}`}>
                                        Previous Balance: {formData.oldBalance > 0 ? `Rs.${Math.abs(formData.oldBalance).toFixed(2)} Dr` : formData.oldBalance < 0 ? `Rs.${Math.abs(formData.oldBalance).toFixed(2)} Cr` : 'Nil'}
                                    </div>
                                )}
                            </FormField>
                            {selectedCustomerSites.length > 0 && (
                                <FormField label="Delivery Site">
                                    <select value={formData.siteId} onChange={(e) => setFormData({...formData, siteId: e.target.value})}>
                                        <option value="">Default Address</option>
                                        {selectedCustomerSites.filter(s => s.isActive !== false).map(site => (
                                            <option key={site._id} value={site._id}>{site.name}</option>
                                        ))}
                                    </select>
                                </FormField>
                            )}
                            <FormField label="Order Type" required>
                                <select value={formData.isEstimation ? 'true' : 'false'} onChange={(e) => setFormData({ ...formData, isEstimation: e.target.value === 'true' })}>
                                    <option value="false">Confirmed Order / Bill</option>
                                    <option value="true">Estimation / Quote</option>
                                </select>
                            </FormField>
                            <FormField label="Order Date" required>
                                <input type="date" value={formData.orderDate.split('T')[0]} onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })} />
                            </FormField>
                        </div>
                    </FormSection>

                    <FormSection icon="📦" title="Order Items" color="#faf5ff">
                        <div style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:'12px',padding:'16px'}}>
                            {formData.items.map((item, index) => (
                                <div key={index} style={{display:'flex',gap:'12px',alignItems:'flex-start',marginBottom:'12px',background:'white',padding:'12px',borderRadius:'8px',border:'1px solid #e2e8f0'}}>
                                    <div style={{flex:2}}>
                                        <label style={{fontSize:'10px',fontWeight:'700',color:'#64748b',textTransform:'uppercase',marginBottom:'4px',display:'block'}}>Item</label>
                                        <SearchableSelect
                                            options={items}
                                            value={item.item}
                                            onChange={(val) => handleItemChange(index, 'item', val)}
                                            placeholder="Select Item..."
                                            displayKey="name"
                                            valueKey="_id"
                                        />
                                    </div>
                                    <div style={{flex:1}}>
                                        <label style={{fontSize:'10px',fontWeight:'700',color:'#64748b',textTransform:'uppercase',marginBottom:'4px',display:'block'}}>Qty / Boxes</label>
                                        <input type="number" min="0.01" step="0.01" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || '')} className="input-premium" />
                                    </div>
                                    <div style={{flex:1}}>
                                        <label style={{fontSize:'10px',fontWeight:'700',color:'#64748b',textTransform:'uppercase',marginBottom:'4px',display:'block'}}>Price</label>
                                        <input type="number" step="0.01" value={item.price} onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value) || '')} className="input-premium" />
                                    </div>
                                    <div style={{flex:1}}>
                                        <label style={{fontSize:'10px',fontWeight:'700',color:'#64748b',textTransform:'uppercase',marginBottom:'4px',display:'block'}}>Discount %</label>
                                        <input type="number" step="0.01" value={item.discount} onChange={(e) => handleItemChange(index, 'discount', parseFloat(e.target.value) || 0)} className="input-premium" />
                                    </div>
                                    <div style={{marginTop:'22px'}}>
                                        <button type="button" onClick={() => handleRemoveItem(index)} className="btn-icon delete">🗑️</button>
                                    </div>
                                </div>
                            ))}
                            <button type="button" onClick={handleAddItem} className="btn-secondary" style={{width:'100%',justifyContent:'center',borderStyle:'dashed'}}>+ Add Another Item</button>
                        </div>
                    </FormSection>

                    <FormSection icon="💰" title="Payment & Notes" color="#f0fdf4">
                        <div className="form-grid-2">
                            <FormField label="Advance Received (₹)">
                                <input type="number" step="0.01" value={formData.advanceAmount} onChange={(e) => setFormData({ ...formData, advanceAmount: parseFloat(e.target.value) || '' })} placeholder="0.00" />
                            </FormField>
                            <FormField label="Payment Method">
                                <select value={formData.paymentMethod} onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}>
                                    <option value="cash">Cash</option>
                                    <option value="bank_transfer">Bank Transfer</option>
                                    <option value="upi">UPI</option>
                                    <option value="credit">Credit</option>
                                    <option value="cheque">Cheque</option>
                                </select>
                            </FormField>
                            <FormField label="Notes" className="form-full">
                                <textarea rows="2" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Internal notes or terms..." />
                            </FormField>
                        </div>
                    </FormSection>
                </form>
            </Drawer>

            {/* Share Bottom Sheet */}
            {shareMenuOrder && (
                <div className="drawer-overlay" onClick={() => setShareMenuOrder(null)} style={{display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
                    <div style={{background:'white',width:'100%',maxWidth:'400px',borderRadius:'24px 24px 0 0',padding:'24px',animation:'slideUpFade 0.3s ease'}} onClick={e => e.stopPropagation()}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
                            <h3 style={{fontWeight:'800',fontSize:'18px',color:'#0f172a'}}>Share Document</h3>
                            <button onClick={() => setShareMenuOrder(null)} style={{background:'#f1f5f9',border:'none',width:'32px',height:'32px',borderRadius:'50%',color:'#64748b',cursor:'pointer'}}>x</button>
                        </div>
                        <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                            <button onClick={() => { shareViaWhatsApp(shareMenuOrder, billingSettings); setShareMenuOrder(null); }} style={{display:'flex',alignItems:'center',gap:'12px',padding:'16px',background:'#ecfdf5',border:'1px solid #d1fae5',borderRadius:'16px',color:'#059669',fontWeight:'700',cursor:'pointer'}}>
                                <span style={{fontSize:'24px'}}>💬</span> WhatsApp Message
                            </button>
                            <button onClick={() => { shareInvoiceAsPdf(shareMenuOrder, billingSettings); setShareMenuOrder(null); }} style={{display:'flex',alignItems:'center',gap:'12px',padding:'16px',background:'#eff6ff',border:'1px solid #dbeafe',borderRadius:'16px',color:'#2563eb',fontWeight:'700',cursor:'pointer'}}>
                                <span style={{fontSize:'24px'}}>📄</span> Share PDF
                            </button>
                            <button onClick={() => { shareViaEmail(shareMenuOrder, billingSettings); setShareMenuOrder(null); }} style={{display:'flex',alignItems:'center',gap:'12px',padding:'16px',background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:'16px',color:'#475569',fontWeight:'700',cursor:'pointer'}}>
                                <span style={{fontSize:'24px'}}>📧</span> Email Link
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesOrders;
