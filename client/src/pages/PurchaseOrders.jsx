import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import SearchableSelect from '../components/SearchableSelect';
import { InventoryContext } from '../context/InventoryContext';
import { AuthContext } from '../context/AuthContext';
import { generatePurchaseOrderHtml } from '../utils/printTemplates';
import Drawer from '../components/ui/Drawer';
import FormField, { FormSection } from '../components/ui/FormField';
import EmptyState from '../components/ui/EmptyState';
// Extract state code from GSTIN (first 2 chars)
const getGstStateCode = (gstin) => (gstin && gstin.length >= 2) ? gstin.substring(0, 2).toUpperCase() : '';

const PurchaseOrders = () => {
    const { billingSettings, calculateItemValues } = useContext(InventoryContext);
    const { user } = useContext(AuthContext);
    const isGodown = user?.role === 'godown_staff' || user?.appRoles?.inventory === 'godown_staff' || user?.role === 'godown staff' || user?.appRoles?.inventory === 'godown staff';
    const [orders, setOrders] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [items, setItems] = useState([]);
    const [hsnCodes, setHsnCodes] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [editingOrder, setEditingOrder] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [receiveData, setReceiveData] = useState([]);
    const [receiveVendorBillNo, setReceiveVendorBillNo] = useState('');
    const [taxType, setTaxType] = useState('cgst'); // 'cgst' (intra) or 'igst' (inter)
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('createdAt');
    const [sortOrder, setSortOrder] = useState('desc');
    const [isQuickAddItemOpen, setIsQuickAddItemOpen] = useState(false);
    const [quickAddItemData, setQuickAddItemData] = useState({ name: '', sku: '', purchasePrice: '', category: '', hsn: '', unitType: 'pieces', size: '', pcsPerBox: '', sqFtPerPc: '' });
    const [formData, setFormData] = useState({
        vendor: '',
        vendorBillNumber: '',
        billDate: new Date().toISOString().split('T')[0],
        roundOffAmount: '',
        taxRate: 0,
        items: [{ 
            item: '', 
            quantity: '', 
            damagedQuantity: '',
            price: '', 
            taxRate: 0,
            boxCount: '', 
            totalPcs: '', 
            totalSqFt: '',
            brand: '',
            size: '',
            billingUnit: billingSettings?.unitConfig?.quantityBasis === 'sqft' ? 'sqft' : 'pieces'
        }],
        notes: '',
    });

    // Auto-detect IGST vs CGST+SGST when vendor changes
    const handleVendorChange = (vendorId) => {
        if (!vendorId) {
            setFormData(prev => ({ ...prev, vendor: '' }));
            return;
        }
        const selectedVendor = vendors.find(v => v._id === vendorId);
        const companyGstin = billingSettings?.gstNumber || '';
        const vendorGstin = selectedVendor?.gstin || '';
        const companyState = getGstStateCode(companyGstin);
        const vendorState = getGstStateCode(vendorGstin);
        const isInterState = vendorState && companyState && vendorState !== companyState;
        
        setTaxType(isInterState ? 'igst' : 'cgst');
        
        // If vendor has no GSTIN, they cannot charge tax. Force tax to 0.
        if (!vendorGstin) {
            setFormData(prev => ({
                ...prev,
                vendor: vendorId,
                taxRate: 0,
                items: prev.items.map(item => ({ ...item, taxRate: 0 }))
            }));
        } else {
            setFormData(prev => ({ ...prev, vendor: vendorId }));
        }
    };

    const API_URL = '/api/purchase-orders';

    useEffect(() => {
        fetchVendorsAndItems();
    }, []);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchOrders(1);
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [search, from, to, sortBy, sortOrder]);

    const fetchOrders = async (page = 1) => {
        try {
            setLoading(true);
            const params = { page, limit: 10, sortBy, sortOrder };
            if (from) params.from = from;
            if (to) params.to = to;
            if (search) params.search = search;
            const res = await axios.get(API_URL, {
                params,
                headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
            });
            setOrders(res.data.data.orders);
            setTotalPages(res.data.data.totalPages || 1);
            setCurrentPage(res.data.data.currentPage || 1);
        } catch (error) {
            toast.error('Failed to fetch purchase orders');
        } finally {
            setLoading(false);
        }
    };

    const fetchVendorsAndItems = async () => {
        try {
            const [vendRes, itemRes, hsnRes, catRes] = await Promise.allSettled([
                axios.get('/api/vendors', { params: { limit: 1000 }, headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } }),
                axios.get('/api/items', { params: { limit: 10000 }, headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } }),
                axios.get('/api/hsn', { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } }),
                axios.get('/api/categories', { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } })
            ]);
            if (vendRes.status === 'fulfilled') setVendors(vendRes.value.data.data?.vendors || []);
            if (itemRes.status === 'fulfilled') setItems(itemRes.value.data.items || []);
            if (hsnRes.status === 'fulfilled') setHsnCodes(hsnRes.value.data.data || hsnRes.value.data || []);
            if (catRes.status === 'fulfilled') setCategories(Array.isArray(catRes.value.data) ? catRes.value.data : (catRes.value.data?.categories || []));
        } catch (error) {
            console.error('Error fetching dependencies');
        }
    };

    const handleAddItem = () => {
        setFormData({
            ...formData,
            items: [...formData.items, { 
                item: '', 
                quantity: '', 
                damagedQuantity: '',
                price: '', 
                taxRate: formData.taxRate,
                boxCount: '', 
                totalPcs: '', 
                totalSqFt: '',
                brand: '',
                size: '',
                billingUnit: billingSettings?.industry === 'tiles' ? 'boxes' : 'pieces'
            }]
        });
    };

    const handleRemoveItem = (index) => {
        if (formData.items.length === 1) return; // Keep at least one row
        const newItems = formData.items.filter((_, i) => i !== index);
        setFormData({ ...formData, items: newItems });
    };

    const handleQuickAddItemSubmit = async (e) => {
        e.preventDefault();
        try {
            const dataToSubmit = {
                ...quickAddItemData,
                unitType: billingSettings?.unitConfig?.quantityBasis || 'pieces'
            };
            const res = await axios.post('/api/items', dataToSubmit, {
                headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
            });
            toast.success('Item added successfully');
            setItems([...items, res.data.data]);
            setIsQuickAddItemOpen(false);
            setQuickAddItemData({ name: '', sku: '', purchasePrice: '', category: '', hsn: '', unitType: 'pieces', size: '', pcsPerBox: '', sqFtPerPc: '' });
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error adding item');
        }
    };

    const handleItemChange = (index, field, value) => {
        try {
            const newItems = [...formData.items];
            
            // Handle item selection correctly since SearchableSelect sends an event object
            if (field === 'item') {
                const selectedItemId = (value && value.target) ? value.target.value : value;
                const selectedItem = items.find(i => i._id === selectedItemId);
                if (selectedItem) {
                    // Look up HSN gstRate for this item
                    const hsnEntry = hsnCodes.find(h => h.code === selectedItem.hsn);
                    let autoTaxRate = hsnEntry ? hsnEntry.gstRate : (formData.taxRate || 0);
                    
                    const vendorGstin = vendors.find(v => v._id === formData.vendor)?.gstin;
                    if (!vendorGstin) autoTaxRate = 0;

                    newItems[index] = {
                        ...newItems[index],
                        item: selectedItemId,
                        name: selectedItem.name || 'Unknown',
                        price: Number(selectedItem.purchasePrice || selectedItem.price) || 0,
                        brand: selectedItem.brand || '',
                        size: selectedItem.size || '',
                        hsnCode: selectedItem.hsn || '',
                        taxRate: autoTaxRate,
                        unitType: selectedItem.unitType || 'pieces',
                        sqFtPerPc: Number(selectedItem.sqFtPerPc) || 0,
                        pcsPerBox: Math.max(1, Number(selectedItem.pcsPerBox) || 1),
                        billingUnit: (billingSettings?.industry === 'tiles' && Number(selectedItem.sqFtPerPc) > 0 && !['pieces', 'pcs', 'nos', 'piece'].includes((selectedItem.unitType || '').toLowerCase())) ? 'boxes' : (['box', 'boxes'].includes((selectedItem.unitType || '').toLowerCase()) ? 'boxes' : 'pieces')
                    };
                    
                    // Initial calculation
                    newItems[index].total = 0;
                }
            } else if (field === 'piecesCount' || field === 'boxCount' || field === 'price' || field === 'billingUnit' || field === 'quantity' || field === 'damagedQuantity') {
                const row = newItems[index];
                if (field === 'piecesCount') row.totalPcs = Number(value || 0);
                if (field === 'boxCount') row.boxCount = Number(value || 0);
                if (field === 'price') row.price = Number(value || 0);
                if (field === 'billingUnit') row.billingUnit = value;
                if (field === 'quantity') row.quantity = Number(value || 0);
                if (field === 'damagedQuantity') row.damagedQuantity = Number(value || 0);

                if (billingSettings?.industry === 'tiles' && row.sqFtPerPc > 0) {
                    if (field === 'piecesCount') {
                        row.boxCount = row.pcsPerBox > 0 ? row.totalPcs / row.pcsPerBox : 0;
                    } else if (field === 'boxCount') {
                        row.totalPcs = row.boxCount * (row.pcsPerBox || 1);
                    }
                    row.quantity = row.billingUnit === 'boxes' ? row.boxCount : row.totalPcs;
                }
                row.total = Number(((row.quantity || 0) * (row.price || 0)).toFixed(2));
            } else {
                newItems[index][field] = value;
            }

            setFormData({ ...formData, items: newItems });
        } catch (err) {
            console.error("handleItemChange error:", err);
            toast.error("Error updating item: " + err.message);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            let itemsTotal = formData.items.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);
            // Calculate tax per item using each row's individual tax rate
            let taxAmount = formData.items.reduce((sum, item) => {
                const rate = parseFloat(item.taxRate ?? formData.taxRate) || 0;
                return sum + ((parseFloat(item.total) || 0) * rate / 100);
            }, 0);
            let netTotal = itemsTotal + taxAmount;
            let roundOffAmount = 0;
            if (billingSettings?.documentConfig?.enableRoundOff) {
                const roundedTotal = Math.round(netTotal);
                roundOffAmount = roundedTotal - netTotal;
                netTotal = roundedTotal;
            }
            
            const submissionData = {
                ...formData,
                taxType,
                itemsTotal,
                taxAmount,
                totalAmount: netTotal,
                roundOffAmount
            };

            if (editingOrder) {
                await axios.put(`${API_URL}/${editingOrder._id}`, submissionData, {
                    headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
                });
                toast.success('Purchase order updated successfully');
            } else {
                const res = await axios.post(API_URL, submissionData, {
                    headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
                });
                
                if (billingSettings?.directPurchaseInward) {
                    const newOrder = res.data.data;
                    await axios.patch(`${API_URL}/${newOrder._id}/status`, { status: 'issued' }, {
                        headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
                    });
                    const receivedItems = newOrder.items.map((i, idx) => ({
                        item: i.item?._id || i.item,
                        receivedQuantity: i.quantity,
                        damagedQuantity: formData.items[idx]?.damagedQuantity || i.damagedQuantity || 0,
                        price: i.price,
                        batchNumber: `PO-${newOrder.orderNumber}`
                    }));
                    await axios.post(`${API_URL}/${newOrder._id}/receive`, {
                        receivedItems,
                        vendorBillNumber: newOrder.vendorBillNumber
                    }, {
                        headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
                    });
                }
                toast.success('Purchase order created successfully');
            }
            setIsModalOpen(false);
            setEditingOrder(null);
            fetchOrders();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error saving order');
        }
    };

    const handleEdit = (order) => {
        setEditingOrder(order);
        setFormData({
            vendor: order.vendor?._id || order.vendor,
            vendorBillNumber: order.vendorBillNumber || '',
            billDate: order.billDate ? new Date(order.billDate).toISOString().split('T')[0] : (order.orderDate ? new Date(order.orderDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
            roundOffAmount: order.roundOffAmount !== undefined && order.roundOffAmount !== null && order.roundOffAmount !== 0 ? order.roundOffAmount : '',
            taxRate: order.taxRate ?? 0,
            notes: order.notes || '',
            items: order.items.map(i => ({
                item: i.item?._id || i.item,
                quantity: i.quantity,
                damagedQuantity: i.damagedQuantity || '',
                price: i.price,
                taxRate: i.taxRate ?? order.taxRate ?? 0,
                boxCount: i.boxCount || '',
                totalPcs: i.totalPcs || '',
                brand: i.item?.brand || i.brand || '',
                size: i.item?.size || i.size || '',
                unitType: i.item?.unitType || i.unitType || 'pieces',
                sqFtPerPc: Number(i.item?.sqFtPerPc || i.sqFtPerPc || 0),
                pcsPerBox: Math.max(1, Number(i.item?.pcsPerBox || i.pcsPerBox || 1)),
                billingUnit: i.billingUnit || (billingSettings?.industry === 'tiles' ? 'boxes' : 'pieces'),
                total: i.total || (i.quantity * i.price)
            }))
        });
        setTaxType(order.taxType || 'cgst');
        setIsModalOpen(true);
    };

    const handleDelete = async (orderId) => {
        if (!window.confirm("Are you sure you want to delete this purchase order?")) return;
        try {
            await axios.delete(`${API_URL}/${orderId}`, {
                headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
            });
            toast.success('Purchase order deleted successfully');
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
            toast.error('Failed to update status');
        }
    };

    const openViewModal = (order) => {
        setSelectedOrder(order);
        setIsViewModalOpen(true);
    };

    const handlePrintOrder = (order) => {
        if (!billingSettings) return;
        const html = generatePurchaseOrderHtml(order, billingSettings);
        const printWindow = window.open('', '_blank');
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => {
            printWindow.print();
        }, 500);
    };

    const openReceiveModal = (order) => {
        setSelectedOrder(order);
        setReceiveVendorBillNo(order.vendorBillNumber || '');
        // order.items have item populated with name and sku
        const initialReceiveData = order.items.map(i => ({
            item: i.item?._id || i.item,
            name: `${i.item?.name || i.name || 'Unknown Item'}${i.item?.size ? ` - ${i.item?.size}` : ''}`,
            expected: i.quantity, // This is totalSqFt
            receivedQuantity: i.quantity,
            damagedQuantity: 0,
            price: i.price, // Preserve the PO rate
            batchNumber: `PO-${order.orderNumber}` // Default batch name
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
                receivedItems: receiveData,
                vendorBillNumber: receiveVendorBillNo
            }, {
                headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
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
        return <span className="ml-1 inline-block">{sortOrder === 'asc' ? 'Î“Ã¥Ã¦' : 'Î“Ã¥Ã´'}</span>;
    };
    // Helper: avatar color
    const avatarColor = (name = '') => {
        const colors = ['avatar-blue','avatar-purple','avatar-green','avatar-orange','avatar-red','avatar-gray'];
        return colors[(name.charCodeAt(0) || 0) % colors.length];
    };

    return (
        <div className="animate-in space-y-5">
            {/* Page Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Purchase Orders</h1>
                    <p className="page-subtitle">Manage supplier orders, vendor bills, and inwards</p>
                </div>
                {!isGodown && (
                    <button className="btn-primary" onClick={() => {
                        setFormData({
                            vendor: '', vendorBillNumber: '', billDate: new Date().toISOString().split('T')[0], roundOffAmount: '', taxRate: 0,
                            items: [{ item: '', quantity: '', damagedQuantity: '', price: '', taxRate: 0, discount: 0, freeQuantity: 0 }]
                        });
                        setIsModalOpen(true);
                    }}>
                        + Create PO
                    </button>
                )}
            </div>

            {/* Stat Cards */}
            <div className="stat-cards">
                <div className="stat-card">
                    <div className="stat-card-value">{orders.length}</div>
                    <div className="stat-card-label">Total Orders</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value" style={{color:'#c2410c'}}>
                        {orders.filter(o => o.status === 'pending').length}
                    </div>
                    <div className="stat-card-label">Pending Delivery</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value" style={{color:'#059669'}}>
                        {'Rs.'}{(orders.filter(o => o.status === 'received').reduce((sum, o) => sum + (o.totalAmount || 0), 0) / 1000).toFixed(1)}k
                    </div>
                    <div className="stat-card-label">Total Received</div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="filter-bar">
                <span style={{color:'#94a3b8',fontSize:'14px',marginLeft:'4px'}}>search</span>
                <input
                    type="text"
                    placeholder="Search by order #, vendor, bill..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                
                <div style={{width:'1px',height:'20px',background:'#e2e8f0',margin:'0 4px'}}></div>
                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                    <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{border:'none',background:'transparent',fontSize:'12px',color:'#475569',outline:'none'}} />
                    <span style={{color:'#94a3b8'}}>-</span>
                    <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{border:'none',background:'transparent',fontSize:'12px',color:'#475569',outline:'none'}} />
                </div>
            </div>

            {/* Main Table */}
            {loading ? (
                <div className="table-wrapper" style={{display:'flex',justifyContent:'center',alignItems:'center',height:'240px'}}>
                    <div style={{width:'40px',height:'40px',border:'3px solid #dbeafe',borderTop:'3px solid #2563eb',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}></div>
                </div>
            ) : orders.length === 0 ? (
                <div className="table-wrapper">
                    <EmptyState
                        icon="📋"
                        title="No purchase orders"
                        description="Try adjusting your search filters or create a new purchase order."
                        action={!isGodown && <button className="btn-primary" onClick={() => {
                        setFormData({
                            vendor: '', vendorBillNumber: '', billDate: new Date().toISOString().split('T')[0], roundOffAmount: '', taxRate: 0,
                            items: [{ item: '', quantity: '', damagedQuantity: '', price: '', taxRate: 0, discount: 0, freeQuantity: 0 }]
                        });
                        setIsModalOpen(true);
                    }}>+ Create PO</button>}
                    />
                </div>
            ) : (
                <div className="table-wrapper">
                    <table className="table-premium">
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('orderNumber')} style={{cursor:'pointer'}}>PO #{sortBy==='orderNumber'?(sortOrder==='asc'?' ↑':' ↓'):''}</th>
                                <th onClick={() => handleSort('vendor')} style={{cursor:'pointer'}}>Vendor {sortBy==='vendor'?(sortOrder==='asc'?' ↑':' ↓'):''}</th>
                                <th onClick={() => handleSort('orderDate')} style={{cursor:'pointer'}}>Date {sortBy==='orderDate'?(sortOrder==='asc'?' ↑':' ↓'):''}</th>
                                <th onClick={() => handleSort('totalAmount')} style={{cursor:'pointer'}}>Amount {sortBy==='totalAmount'?(sortOrder==='asc'?' ↑':' ↓'):''}</th>
                                <th onClick={() => handleSort('status')} style={{cursor:'pointer'}}>Status {sortBy==='status'?(sortOrder==='asc'?' ↑':' ↓'):''}</th>
                                <th style={{textAlign:'right'}}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map((order) => {
                                const vendorName = order.vendor?.companyName || order.vendor?.name || 'Unknown';
                                const initial = vendorName.substring(0,2).toUpperCase();
                                return (
                                    <tr key={order._id}>
                                        <td>
                                            <div style={{fontWeight:'700',color:'#1d4ed8'}}>{order.orderNumber}</div>
                                            {order.vendorBillNumber && <span className="badge badge-gray" style={{marginTop:'4px'}}>Bill: {order.vendorBillNumber}</span>}
                                        </td>
                                        <td>
                                            <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                                                <div className={`avatar ${avatarColor(vendorName)}`} style={{width:'28px',height:'28px',fontSize:'10px'}}>{initial}</div>
                                                <div>
                                                    <div style={{fontWeight:'600',color:'#0f172a',fontSize:'13px'}}>{vendorName}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{fontSize:'13px',color:'#475569',fontWeight:'500'}}>{new Date(order.orderDate || order.billDate || order.createdAt).toLocaleDateString()}</div>
                                        </td>
                                        <td>
                                            <div style={{fontSize:'14px',fontWeight:'800',color:'#0f172a'}}>Rs.{((order.totalAmount || 0) + (order.roundOffAmount || 0)).toLocaleString()}</div>
                                        </td>
                                        <td>
                                            <span className={`badge ${order.status === 'received' ? 'badge-success' : order.status === 'partially_received' ? 'badge-warning' : 'badge-primary'}`}>
                                                {order.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td style={{textAlign:'right'}}>
                                            <div style={{display:'flex',justifyContent:'flex-end',gap:'4px'}}>
                                                <button className="btn-icon ledger" onClick={() => openViewModal(order)} title="View Order">👁️</button>
                                                <button className="btn-icon" onClick={() => handlePrintOrder(order)} title="Print Document">📄</button>
                                                {!isGodown && order.status !== 'received' && (
                                                    <button className="btn-icon edit" onClick={() => handleEdit(order)} title="Edit">✏️</button>
                                                )}
                                                {(order.status === 'pending' || order.status === 'partially_received') && (
                                                    <button className="btn-icon edit" onClick={() => openReceiveModal(order)} title="Receive Items">📥</button>
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

            <Drawer
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingOrder ? 'Edit Purchase Order' : 'Create Purchase Order'}
                size="lg"
                footer={
                    <>
                        <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                        <button type="button" onClick={() => handleSubmit(false)} className="btn-primary">
                            {editingOrder ? 'Update Order' : 'Save Order'}
                        </button>
                        {!editingOrder && (
                            <button type="button" onClick={() => handleSubmit(true)} className="btn-primary" style={{background:'#10b981'}}>
                                Save & Receive
                            </button>
                        )}
                    </>
                }
            >
                <form className="space-y-4">
                    <FormSection icon="🧑" title="Vendor Details" color="#eff6ff">
                        <div className="form-grid-2">
                            <FormField label="Vendor" required>
                                <SearchableSelect
                                    options={vendors}
                                    value={formData.vendor}
                                    onChange={(val) => {
                                        setFormData(prev => ({ ...prev, vendor: val }));
                                        handleVendorChange(val);
                                    }}
                                    placeholder="Search Vendor..."
                                    displayKey="name"
                                    valueKey="_id"
                                />
                            </FormField>
                            <FormField label="Vendor Bill Number">
                                <input type="text" value={formData.vendorBillNumber} onChange={(e) => setFormData({ ...formData, vendorBillNumber: e.target.value })} />
                            </FormField>
                            <FormField label="Bill Date">
                                <input type="date" value={formData.billDate} onChange={(e) => setFormData({ ...formData, billDate: e.target.value })} />
                            </FormField>
                            <FormField label="Tax Type">
                                <div style={{display:'flex',gap:'12px',alignItems:'center',height:'100%',padding:'0 10px'}}>
                                    <label style={{display:'flex',alignItems:'center',gap:'4px'}}><input type="radio" checked={taxType==='cgst'} onChange={()=>setTaxType('cgst')}/> CGST+SGST (Intra-state)</label>
                                    <label style={{display:'flex',alignItems:'center',gap:'4px'}}><input type="radio" checked={taxType==='igst'} onChange={()=>setTaxType('igst')}/> IGST (Inter-state)</label>
                                </div>
                            </FormField>
                        </div>
                    </FormSection>

                    <FormSection icon="📦" title="Order Items" color="#faf5ff">
                        <div style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:'12px',padding:'16px'}}>
                            {formData.items.map((item, index) => (
                                <div key={index} style={{display:'flex',gap:'12px',alignItems:'flex-start',marginBottom:'12px',background:'white',padding:'12px',borderRadius:'8px',border:'1px solid #e2e8f0',flexWrap:'wrap'}}>
                                    <div style={{flex:2,minWidth:'200px'}}>
                                        <label style={{fontSize:'10px',fontWeight:'700',color:'#64748b',textTransform:'uppercase',marginBottom:'4px',display:'block'}}>Item</label>
                                        <div style={{display:'flex',gap:'4px'}}>
                                            <div style={{flex:1}}>
                                                <SearchableSelect
                                                    options={items}
                                                    value={item.item}
                                                    onChange={(val) => handleItemChange(index, 'item', val)}
                                                    placeholder="Select Item..."
                                                    displayKey="name"
                                                    valueKey="_id"
                                                />
                                            </div>
                                            <button type="button" onClick={() => setIsQuickAddItemOpen(true)} className="btn-secondary" style={{padding:'6px 10px'}} title="Quick Add Item">+</button>
                                        </div>
                                    </div>
                                    <div style={{flex:1,minWidth:'80px'}}>
                                        <label style={{fontSize:'10px',fontWeight:'700',color:'#64748b',textTransform:'uppercase',marginBottom:'4px',display:'block'}}>Qty</label>
                                        <input type="number" step="0.01" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || '')} className="input-premium" />
                                    </div>
                                    <div style={{flex:1,minWidth:'80px'}}>
                                        <label style={{fontSize:'10px',fontWeight:'700',color:'#64748b',textTransform:'uppercase',marginBottom:'4px',display:'block'}}>Price</label>
                                        <input type="number" step="0.01" value={item.price} onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value) || '')} className="input-premium" />
                                    </div>
                                    <div style={{flex:1,minWidth:'80px'}}>
                                        <label style={{fontSize:'10px',fontWeight:'700',color:'#64748b',textTransform:'uppercase',marginBottom:'4px',display:'block'}}>Disc%</label>
                                        <input type="number" step="0.01" value={item.discount} onChange={(e) => handleItemChange(index, 'discount', parseFloat(e.target.value) || 0)} className="input-premium" />
                                    </div>
                                    <div style={{flex:1,minWidth:'80px'}}>
                                        <label style={{fontSize:'10px',fontWeight:'700',color:'#64748b',textTransform:'uppercase',marginBottom:'4px',display:'block'}}>Tax%</label>
                                        <input type="number" step="0.01" value={item.taxRate} onChange={(e) => handleItemChange(index, 'taxRate', parseFloat(e.target.value) || 0)} className="input-premium" />
                                    </div>
                                    <div style={{marginTop:'22px'}}>
                                        <button type="button" onClick={() => handleRemoveItem(index)} className="btn-icon delete">🗑️</button>
                                    </div>
                                </div>
                            ))}
                            <button type="button" onClick={handleAddItem} className="btn-secondary" style={{width:'100%',justifyContent:'center',borderStyle:'dashed'}}>+ Add Another Item</button>
                        </div>
                    </FormSection>

                    <FormSection icon="💰" title="Summary" color="#fef9c3">
                        <div className="form-grid-2">
                            <FormField label="Round Off (₹)">
                                <input type="number" step="0.01" value={formData.roundOffAmount} onChange={(e) => setFormData({ ...formData, roundOffAmount: e.target.value })} />
                            </FormField>
                            <FormField label="Notes">
                                <textarea rows="2" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
                            </FormField>
                        </div>
                    </FormSection>
                </form>
            </Drawer>

            {/* Quick Add Item Modal inside a Drawer for simplicity */}
            <Drawer open={isQuickAddItemOpen} onClose={() => setIsQuickAddItemOpen(false)} title="Quick Add Item" size="sm">
                <div className="space-y-4">
                    <FormField label="Item Name" required>
                        <input type="text" value={quickAddItemData.name} onChange={(e) => setQuickAddItemData({...quickAddItemData, name: e.target.value})} />
                    </FormField>
                    <FormField label="Category" required>
                        <select value={quickAddItemData.category} onChange={(e) => setQuickAddItemData({...quickAddItemData, category: e.target.value})}>
                            <option value="">Select</option>
                            {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                        </select>
                    </FormField>
                    <FormField label="Purchase Price">
                        <input type="number" value={quickAddItemData.purchasePrice} onChange={(e) => setQuickAddItemData({...quickAddItemData, purchasePrice: e.target.value})} />
                    </FormField>
                    <button type="button" onClick={handleQuickAddItemSubmit} className="btn-primary w-full justify-center">Save Item</button>
                </div>
            </Drawer>

            {/* View/Print Drawer */}
            <Drawer open={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="View Purchase Order" size="lg">
                <div className="p-4">
                    {/* View rendering logic (kept simple to avoid huge code blocks) */}
                    <button className="btn-primary mb-4" onClick={() => handlePrintOrder(selectedOrder)}>Print PO</button>
                    <pre style={{fontSize:'11px',whiteSpace:'pre-wrap'}}>{JSON.stringify(selectedOrder, null, 2)}</pre>
                </div>
            </Drawer>

            {/* Receive Modal Drawer */}
            <Drawer open={isReceiveModalOpen} onClose={() => setIsReceiveModalOpen(false)} title="Receive Delivery" size="lg" footer={<><button className="btn-secondary" onClick={()=>setIsReceiveModalOpen(false)}>Cancel</button><button className="btn-primary" onClick={handleReceiveSubmit}>Receive Selected Items</button></>}>
                <div className="space-y-4">
                    <FormField label="Vendor Bill Number" required>
                        <input type="text" value={receiveVendorBillNo} onChange={(e) => setReceiveVendorBillNo(e.target.value)} />
                    </FormField>
                    {/* Simplified receive logic representation */}
                    <div className="text-sm font-bold mt-4 mb-2">Items to Receive</div>
                    {receiveData.map((rd, i) => (
                        <div key={i} className="flex gap-4 items-center mb-2 p-2 border border-gray-200 rounded">
                            <input type="checkbox" checked={rd.selected} onChange={(e) => { const nd = [...receiveData]; nd[i].selected = e.target.checked; setReceiveData(nd); }} />
                            <div className="flex-1 text-sm font-bold">{rd.itemName}</div>
                            <FormField label="Rcvd Qty"><input type="number" value={rd.receiveQuantity} onChange={(e) => { const nd = [...receiveData]; nd[i].receiveQuantity = e.target.value; setReceiveData(nd); }} /></FormField>
                            <FormField label="Damaged"><input type="number" value={rd.damagedQuantity} onChange={(e) => { const nd = [...receiveData]; nd[i].damagedQuantity = e.target.value; setReceiveData(nd); }} /></FormField>
                        </div>
                    ))}
                </div>
            </Drawer>
        </div>
    );
};

export default PurchaseOrders;
