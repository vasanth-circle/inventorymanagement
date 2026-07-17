import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import SearchableSelect from '../components/SearchableSelect';
import { InventoryContext } from '../context/InventoryContext';
import { AuthContext } from '../context/AuthContext';
import { generatePurchaseOrderHtml } from '../utils/printTemplates';

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
    const [isQuickAddItemOpen, setIsQuickAddItemOpen] = useState(false);
    const [quickAddItemData, setQuickAddItemData] = useState({ name: '', sku: '', purchasePrice: '', category: '', hsn: '', unitType: 'pieces', size: '', pcsPerBox: '', sqFtPerPc: '' });
    const [formData, setFormData] = useState({
        vendor: '',
        vendorBillNumber: '',
        billDate: new Date().toISOString().split('T')[0],
        roundOffAmount: '',
        taxRate: 18,
        items: [{ 
            item: '', 
            quantity: '', 
            damagedQuantity: '',
            price: '', 
            taxRate: 18,
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
        fetchOrders();
        fetchVendorsAndItems();
    }, []);

    const fetchOrders = async (page = 1) => {
        try {
            setLoading(true);
            const params = { page, limit: 10 };
            if (from) params.from = from;
            if (to) params.to = to;
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
            taxRate: order.taxRate || 18,
            notes: order.notes || '',
            items: order.items.map(i => ({
                item: i.item?._id || i.item,
                quantity: i.quantity,
                damagedQuantity: i.damagedQuantity || '',
                price: i.price,
                taxRate: i.taxRate || order.taxRate || 18,
                boxCount: i.boxCount || '',
                totalPcs: i.totalPcs || '',
                brand: i.item?.brand || i.brand || '',
                size: i.item?.size || i.size || '',
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

    return (
        <div className="space-y-6 print:space-y-0 print:m-0 print:p-0">
            {!isModalOpen && (
                <>
                    <div className="flex justify-between items-center print:hidden">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">
                                {billingSettings?.industry === 'machinery' ? 'Parts Purchase Order' : 'Purchase Entry'}
                            </h1>
                        </div>
                        <div className="flex gap-4 items-end">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">From Date</label>
                                <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">To Date</label>
                                <input type="date" value={to} onChange={e => setTo(e.target.value)}
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                            </div>
                            <button onClick={() => fetchOrders(1)} className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors">
                                Filter
                            </button>
                            <button
                            onClick={() => {
                                setEditingOrder(null);
                                setFormData({
                                    vendor: '',
                                    vendorBillNumber: '',
                                    taxRate: 18,
                                    billDate: new Date().toISOString().split('T')[0],
                                    roundOffAmount: '',
                                    items: [{ 
                                        item: '', 
                                        quantity: '', 
                                        damagedQuantity: '',
                                        price: '', 
                                        taxRate: 18,
                                        boxCount: '', 
                                        totalPcs: '', 
                                        brand: '',
                                        size: '',
                                        billingUnit: billingSettings?.industry === 'tiles' ? 'boxes' : 'pieces'
                                    }],
                                    notes: '',
                                });
                                setIsModalOpen(true);
                            }}
                            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                        >
                            Purchase Entry
                        </button>
                    </div>
                </div>

            {loading ? (
                <div className="flex justify-center items-center h-64 print:hidden">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-md overflow-x-auto print:hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-bottom border-gray-100">
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">PO #</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Bill No</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Bill Date</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Vendor</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Inv Type</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">PO Date</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Amount</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {orders.map((order) => (
                                <tr key={order._id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-primary-600 cursor-pointer hover:underline" onClick={() => openViewModal(order)}>{order.orderNumber}</td>
                                    <td className="px-6 py-4 text-gray-900 font-mono text-xs">{order.vendorBillNumber || '-'}</td>
                                    <td className="px-6 py-4 text-gray-600 whitespace-nowrap text-sm">{order.billDate ? new Date(order.billDate).toLocaleDateString() : '-'}</td>
                                    <td className="px-6 py-4 text-gray-900">{order.vendor?.name}</td>
                                    <td className="px-6 py-4 text-gray-600 font-semibold text-sm">Credit</td>
                                    <td className="px-6 py-4 text-gray-600 whitespace-nowrap text-sm">{new Date(order.orderDate).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-semibold text-gray-900 whitespace-nowrap text-sm">₹{order.totalAmount.toLocaleString()}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium uppercase ${getStatusColor(order.status)}`}>
                                            {order.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button onClick={() => openViewModal(order)} className="text-primary-600 hover:text-primary-800 text-sm font-medium mr-2">View</button>
                                        {order.status === 'draft' && (
                                            <button onClick={() => handleStatusUpdate(order._id, 'issued')} className="text-blue-600 hover:text-blue-800 text-sm mr-2">Issue PO</button>
                                        )}
                                        {order.status === 'issued' && (
                                            <button onClick={() => openReceiveModal(order)} className="text-green-600 hover:text-green-800 text-sm font-semibold mr-2">Convert to Inward</button>
                                        )}
                                        <button onClick={() => handleEdit(order)} className="text-amber-600 hover:text-amber-800 text-sm font-medium mr-2">Edit</button>
                                        <button onClick={() => handleDelete(order._id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    
                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50">
                            <div>
                                <p className="text-sm text-gray-700">
                                    Showing page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span>
                                </p>
                            </div>
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => fetchOrders(Math.max(1, currentPage - 1))}
                                    disabled={currentPage === 1}
                                    className={`relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => fetchOrders(Math.min(totalPages, currentPage + 1))}
                                    disabled={currentPage === totalPages}
                                    className={`relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
            </>
            )}

            {isModalOpen && (
                <div className="max-w-6xl mx-auto space-y-6">
                    <div className="flex justify-between items-center border-b pb-4">
                        <h2 className="text-2xl font-bold text-gray-800">{editingOrder ? 'Edit Purchase Entry' : 'New Purchase Entry'}</h2>
                        <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium">
                            &larr; Back to List
                        </button>
                    </div>
                    <div className="bg-white rounded-xl shadow-md p-6">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="flex gap-4 w-full flex-wrap">
                                <div className="w-1/3 min-w-[220px]">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Vendor *</label>
                                    <SearchableSelect
                                        value={formData.vendor}
                                        onChange={(val) => handleVendorChange(val && val.target ? val.target.value : val)}
                                        options={vendors.map(v => ({ value: v._id, label: `${v.name}${v.gstin ? ` (${v.gstin})` : ''}` }))}
                                        placeholder="Select Vendor"
                                        searchPlaceholder="Search Vendor..."
                                        className="w-full"
                                    />
                                </div>
                                <div className="w-1/4 min-w-[150px]">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Bill No. *</label>
                                    <input required type="text" value={formData.vendorBillNumber} onChange={(e) => setFormData({ ...formData, vendorBillNumber: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder="Enter Bill No." />
                                </div>
                                <div className="w-1/4 min-w-[150px]">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Bill Date</label>
                                    <input type="date" value={formData.billDate} onChange={(e) => setFormData({ ...formData, billDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                                </div>
                                <div className="flex items-end min-w-[140px]">
                                    <div className={`px-3 py-2 rounded-lg text-sm font-bold border-2 ${ taxType === 'igst' ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-green-50 border-green-300 text-green-700'}`}>
                                        {taxType === 'igst' ? '🔴 IGST (Inter-State)' : '🟢 CGST+SGST (Intra-State)'}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-semibold text-gray-700">Item Details</h3>
                                <div className="w-full">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase min-w-[200px]">Item</th>
                                                <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-24 text-center">Qty / Boxes</th>
                                                <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-24 text-center text-red-600">Damaged</th>
                                                {!isGodown && <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-28">Rate</th>}
                                                {!isGodown && <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-20 text-center">GST%</th>}
                                                <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-20">Unit</th>
                                                {!isGodown && <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-24 text-right">Taxable</th>}
                                                {!isGodown && <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-24 text-right">Total (w/Tax)</th>}
                                                <th className="px-3 py-2 w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {formData.items.map((row, index) => {
                                                const isTile = billingSettings?.industry === 'tiles' && row.sqFtPerPc > 0 && !['pieces', 'pcs', 'nos', 'piece'].includes((row.unitType || '').toLowerCase());
                                                return (
                                                <tr key={index}>
                                                    <td className="py-2 pr-2">
                                                        <div className="flex gap-1 items-center">
                                                            <div className="flex-1">
                                                                <SearchableSelect
                                                                    value={row.item}
                                                                    onChange={(e) => handleItemChange(index, 'item', e.target.value)}
                                                                    options={items.map(i => ({ value: i._id, label: `${i.name}${i.size ? ` - ${i.size}` : ''} (${i.sku || 'No SKU'})` }))}
                                                                    placeholder="Select Item"
                                                                    searchPlaceholder="Search Item..."
                                                                    className="w-full min-w-[150px]"
                                                                />
                                                            </div>
                                                            <button type="button" onClick={() => setIsQuickAddItemOpen(true)} className="p-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200" title="Add New Item">
                                                                <span className="font-bold">+</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="px-2 py-2 min-w-[120px]">
                                                        {isTile ? (
                                                            <div className="flex flex-col gap-1">
                                                                <div className="flex gap-1 items-center">
                                                                    <input type="number" step="0.5" min="0" value={row.boxCount || ''} onChange={(e) => handleItemChange(index, 'boxCount', e.target.value)} placeholder="Boxes" className="w-16 px-1 py-1 border rounded-md text-center text-xs font-bold focus:ring-1 focus:ring-primary-400 outline-none" />
                                                                    <span className="text-[10px] text-gray-400">Bx</span>
                                                                    <input type="number" step="1" min="0" value={row.totalPcs || ''} onChange={(e) => handleItemChange(index, 'piecesCount', e.target.value)} placeholder="Pcs" className="w-16 px-1 py-1 border rounded-md text-center text-xs font-bold focus:ring-1 focus:ring-primary-400 outline-none" />
                                                                    <span className="text-[10px] text-gray-400">Pc</span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <input 
                                                                required 
                                                                type="number" 
                                                                step="0.01"
                                                                min="0" 
                                                                value={row.quantity || ''} 
                                                                onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} 
                                                                placeholder="Qty"
                                                                className="w-full px-2 py-2 border rounded-lg border-gray-200 outline-none focus:ring-1 focus:ring-primary-400 text-center font-bold" 
                                                            />
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-2 min-w-[100px]">
                                                        <input 
                                                            type="number" 
                                                            step="0.01" 
                                                            min="0" 
                                                            value={row.damagedQuantity || ''} 
                                                            onChange={(e) => handleItemChange(index, 'damagedQuantity', e.target.value)} 
                                                            placeholder="Damaged"
                                                            className="w-full px-2 py-2 border rounded-lg border-red-200 outline-none focus:ring-1 focus:ring-red-400 text-center font-bold text-red-600" 
                                                        />
                                                    </td>
                                                    {!isGodown && (
                                                        <td className="px-2 py-2 min-w-[100px]">
                                                            <input required type="number" step="0.01" value={row.price === 0 ? '' : row.price} onChange={(e) => handleItemChange(index, 'price', e.target.value)} className="w-full px-2 py-2 border rounded-lg border-gray-200 text-right font-bold focus:ring-1 focus:ring-primary-400 outline-none" placeholder="Rate" />
                                                        </td>
                                                    )}
                                                    {!isGodown && (
                                                        <td className="px-2 py-2 min-w-[80px]">
                                                            {row.hsnCode && (
                                                                <div className="text-[9px] text-blue-600 font-bold mb-0.5 text-center">
                                                                    HSN: {row.hsnCode}
                                                                </div>
                                                            )}
                                                            <select value={row.taxRate ?? formData.taxRate} onChange={(e) => { const newItems = [...formData.items]; newItems[index] = {...newItems[index], taxRate: Number(e.target.value)}; setFormData({...formData, items: newItems}); }} className="w-full px-1 py-1 border rounded-lg border-gray-200 text-xs font-bold focus:ring-1 focus:ring-primary-400 outline-none">
                                                                <option value={0}>0%</option>
                                                                <option value={5}>5%</option>
                                                                <option value={12}>12%</option>
                                                                <option value={18}>18%</option>
                                                                <option value={28}>28%</option>
                                                            </select>
                                                            {row.hsnCode && (
                                                                <div className="text-[9px] text-green-600 font-semibold text-center mt-0.5">✓ from HSN</div>
                                                            )}
                                                        </td>
                                                    )}
                                                    <td className="px-2 py-2 min-w-[80px]">
                                                        {billingSettings?.industry === 'tiles' && isTile ? (
                                                            <select value={row.billingUnit} onChange={(e) => handleItemChange(index, 'billingUnit', e.target.value)} className="w-full px-2 py-2 border rounded-lg border-gray-200 text-xs font-bold focus:ring-1 focus:ring-primary-400 outline-none">
                                                                <option value="boxes">Box</option>
                                                                <option value="pieces">Pieces</option>
                                                            </select>
                                                        ) : (
                                                            <div className="text-xs font-bold text-gray-400 text-center uppercase py-2">
                                                                {billingSettings?.unitConfig?.quantityBasis || 'Pieces'}
                                                            </div>
                                                        )}
                                                    </td>
                                                    {!isGodown && (
                                                        <td className="px-2 py-2 font-bold text-gray-700 text-right text-sm min-w-[100px]">
                                                            {`₹${(row.total || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`}
                                                        </td>
                                                    )}
                                                    {!isGodown && (
                                                        <td className="px-2 py-2 font-bold text-green-700 text-right text-sm min-w-[100px]">
                                                            {`₹${((row.total || 0) * (1 + (row.taxRate ?? formData.taxRate) / 100)).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`}
                                                        </td>
                                                    )}
                                                    <td className="px-2 py-2 text-center align-middle">
                                                        {formData.items.length > 1 && (
                                                            <button type="button" onClick={() => handleRemoveItem(index)} className="text-red-400 hover:text-red-600 text-lg font-bold w-6 h-6 inline-flex items-center justify-center rounded-full hover:bg-red-50" title="Remove Line">
                                                                &times;
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <button type="button" onClick={handleAddItem} className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center">
                                    <span className="text-lg mr-1">+</span> Add another line
                                </button>
                            </div>

                            {!isGodown && (
                                <div className="flex justify-end pt-4 pb-2">
                                    <div className="w-80 space-y-1.5 text-right">
                                        {(() => {
                                            const taxableTotal = formData.items.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
                                            const taxTotal = formData.items.reduce((s, i) => s + (parseFloat(i.total) || 0) * (parseFloat(i.taxRate ?? formData.taxRate) || 0) / 100, 0);
                                            const roundOff = parseFloat(formData.roundOffAmount) || 0;
                                            const grandTotal = taxableTotal + taxTotal + roundOff;
                                            const halfTax = taxTotal / 2;
                                            return (<>
                                                <div className="flex justify-between text-sm text-gray-600 font-medium">
                                                    <span>Taxable Amount:</span>
                                                    <span>₹{taxableTotal.toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                                                </div>
                                                {taxType === 'cgst' ? (
                                                    <>
                                                        <div className="flex justify-between text-sm text-green-700 font-medium">
                                                            <span>CGST:</span><span>₹{halfTax.toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                                                        </div>
                                                        <div className="flex justify-between text-sm text-green-700 font-medium">
                                                            <span>SGST:</span><span>₹{halfTax.toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="flex justify-between text-sm text-orange-700 font-medium">
                                                        <span>IGST:</span><span>₹{taxTotal.toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between items-center text-sm text-gray-700 font-medium pt-1">
                                                    <span>Round Off (+/-):</span>
                                                    <input 
                                                        type="number" 
                                                        step="0.01" 
                                                        value={formData.roundOffAmount} 
                                                        onChange={(e) => setFormData({...formData, roundOffAmount: e.target.value})} 
                                                        className="w-24 px-2 py-1 text-right border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 outline-none text-sm font-bold bg-gray-50" 
                                                        placeholder="0.00" 
                                                    />
                                                </div>
                                                <div className="flex justify-between text-lg text-gray-900 font-bold border-t pt-2">
                                                    <span>Net Amount:</span>
                                                    <span>₹{grandTotal.toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                                                </div>
                                            </>);
                                        })()}
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-4 border-t mt-8">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
                                <button type="submit" className="px-8 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-bold">Save Purchase Order</button>
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
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Bill No.</label>
                                    <input type="text" value={receiveVendorBillNo} onChange={(e) => setReceiveVendorBillNo(e.target.value)} className="w-1/3 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder="Enter bill number" />
                                </div>
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Item Name</th>
                                            <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-24 text-center">Expected (SqFt)</th>
                                            {!isGodown && <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-24 text-center">Rate</th>}
                                            <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-36 text-center text-green-700 font-bold">Good Qty (SqFt)</th>
                                            <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-32 text-center text-red-600 font-bold">Damaged (SqFt)</th>
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
                                                {!isGodown && (
                                                    <td className="px-3 py-3">
                                                        <input required type="number" step="0.01" min="0" value={row.price} onChange={(e) => handleReceiveDataChange(index, 'price', e.target.value)} className="w-full px-2 py-1 border rounded border-gray-200 text-right focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none" />
                                                    </td>
                                                )}
                                                <td className="px-3 py-3">
                                                    <input required type="number" step="0.01" min="0" value={row.receivedQuantity} onChange={(e) => handleReceiveDataChange(index, 'receivedQuantity', e.target.value)} className="w-full px-2 py-1 border rounded border-gray-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none" />
                                                </td>
                                                <td className="px-3 py-3">
                                                    <input required type="number" step="0.01" min="0" value={row.damagedQuantity} onChange={(e) => handleReceiveDataChange(index, 'damagedQuantity', e.target.value)} className="w-full px-2 py-1 border rounded border-red-200 text-red-600 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none" />
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

            {isViewModalOpen && selectedOrder && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto print:static print:bg-white print:p-0 print:block">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl my-8 overflow-hidden print:shadow-none print:m-0 print:max-w-full print:w-full print:border-none print:break-inside-avoid">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 print:bg-white print:px-0">
                            <div>
                                <h2 className="text-lg font-bold text-gray-800">Purchase Invoice Details</h2>
                                <p className="text-xs text-gray-500">Reference document for vendor invoice comparison</p>
                            </div>
                            <button onClick={() => setIsViewModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl font-bold outline-none print:hidden">&times;</button>
                        </div>
                        
                        {/* Content */}
                        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto print:max-h-full print:overflow-visible print:px-0 print:py-4">
                            {/* Company and PO Header */}
                            <div className="flex justify-between items-start border-b border-gray-100 pb-6">
                                <div className="space-y-1">
                                    <div className="text-xl font-extrabold text-primary-600 tracking-tight">{billingSettings?.companyName || 'Company Name'}</div>
                                    <div className="text-xs text-gray-500">Inventory Management Portal</div>
                                </div>
                                <div className="text-right space-y-1">
                                    <div className="text-xs font-semibold uppercase text-gray-400">Purchase Invoice</div>
                                    <div className="text-lg font-bold text-gray-800">{selectedOrder.orderNumber}</div>
                                    <div className="text-xs text-gray-500">PO Date: {new Date(selectedOrder.orderDate).toLocaleDateString()}</div>
                                    {selectedOrder.billDate && (
                                        <div className="text-xs font-bold text-gray-700">Bill Date: {new Date(selectedOrder.billDate).toLocaleDateString()}</div>
                                    )}
                                    <div>
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${getStatusColor(selectedOrder.status)}`}>
                                            {selectedOrder.status}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Vendor Information */}
                            <div className="bg-gray-50 rounded-xl p-4 flex justify-between items-start">
                                <div>
                                    <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-1">Vendor Details</div>
                                    <div className="text-sm font-bold text-gray-800">{selectedOrder.vendor?.name || 'Unknown'}</div>
                                    {selectedOrder.vendor?.companyName && <div className="text-xs text-gray-600">{selectedOrder.vendor.companyName}</div>}
                                    {selectedOrder.vendor?.gstin && <div className="text-xs text-gray-600 font-medium mt-0.5">GSTIN: {selectedOrder.vendor.gstin}</div>}
                                    {selectedOrder.vendor?.address && (
                                        <div className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap">
                                            {[selectedOrder.vendor.address.street, selectedOrder.vendor.address.city, selectedOrder.vendor.address.state, selectedOrder.vendor.address.zipCode].filter(Boolean).join(', ')}
                                        </div>
                                    )}
                                    {selectedOrder.vendor?.phone && <div className="text-xs text-gray-500 mt-0.5">Phone: {selectedOrder.vendor.phone}</div>}
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-1">Inward Details</div>
                                    {selectedOrder.vendorBillNumber && <div className="text-xs text-gray-600">Bill No: <span className="font-bold text-gray-800">{selectedOrder.vendorBillNumber}</span></div>}
                                    <div className="text-xs text-gray-600">Total Billed: <span className="font-bold text-gray-800">₹{selectedOrder.totalAmount.toLocaleString()}</span></div>
                                    {selectedOrder.status === 'received' && <div className="text-xs text-green-600 font-semibold mt-1">✓ Stock Inward Completed</div>}
                                </div>
                            </div>

                            {/* Line Items Table */}
                            <div className="space-y-2">
                                <div className="text-xs font-bold text-gray-700">Order Items</div>
                                <div className="border border-gray-100 rounded-xl overflow-hidden">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Item Description</th>
                                                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase text-center w-24">Boxes</th>
                                                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase text-center w-28">Quantity</th>
                                                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase text-right w-28">Rate</th>
                                                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase text-right w-32">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 text-sm">
                                            {selectedOrder.items?.map((row, index) => (
                                                <tr key={index} className="hover:bg-gray-50/50">
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium text-gray-800">{row.item?.name || row.name || 'Unknown Item'}</div>
                                                        {(row.item?.sku || row.sku) && <div className="text-[10px] text-gray-400">SKU: {row.item?.sku || row.sku}</div>}
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-gray-600 font-semibold">{row.boxCount || '-'}</td>
                                                    <td className="px-4 py-3 text-center text-primary-700 font-bold">
                                                        {row.quantity?.toLocaleString() || '-'}
                                                        {row.billingUnit ? <span className="text-xs text-gray-500 ml-1 font-normal capitalize">({row.billingUnit})</span> : ''}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-gray-600">₹{row.price?.toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-right font-bold text-gray-800">₹{(row.quantity * row.price).toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Summary & Notes */}
                            <div className="flex justify-between items-start pt-4 border-t border-gray-100">
                                <div className="max-w-md space-y-3">
                                    {selectedOrder.notes && (
                                        <div>
                                            <div className="text-[10px] uppercase font-bold text-gray-400">Notes</div>
                                            <div className="text-xs text-gray-600 italic bg-gray-50 rounded-lg p-2.5 mt-1 border border-dashed border-gray-200">{selectedOrder.notes}</div>
                                        </div>
                                    )}
                                </div>
                                <div className="w-64 space-y-1.5 text-right">
                                    <div className="flex justify-between text-xs text-gray-500">
                                        <span>Subtotal</span>
                                        <span>₹{(selectedOrder.totalAmount - (selectedOrder.roundOffAmount || 0)).toLocaleString()}</span>
                                    </div>
                                    {selectedOrder.roundOffAmount !== 0 && selectedOrder.roundOffAmount != null && (
                                        <div className="flex justify-between text-xs text-blue-500">
                                            <span>Round Off</span>
                                            <span>{selectedOrder.roundOffAmount > 0 ? '+' : ''} ₹{selectedOrder.roundOffAmount.toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-100 pt-2">
                                        <span>Total Amount</span>
                                        <span>₹{selectedOrder.totalAmount.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center print:hidden">
                            <div className="text-xs text-gray-400">Generated by {billingSettings?.companyName || 'CRM'}</div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => handlePrintOrder(selectedOrder)}
                                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center"
                                >
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                                    Save as PDF
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsViewModalOpen(false)}
                                    className="px-5 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-sm font-semibold transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {isQuickAddItemOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60] overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 my-8">
                        <h2 className="text-xl font-bold mb-4">Quick Add Item</h2>
                        <form onSubmit={handleQuickAddItemSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium mb-1">Item Name *</label>
                                    <input required type="text" value={quickAddItemData.name} onChange={e => setQuickAddItemData({...quickAddItemData, name: e.target.value})} className="w-full px-3 py-2 border rounded outline-none focus:ring-2 focus:ring-primary-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Category *</label>
                                    <SearchableSelect 
                                        options={categories.map(cat => ({ value: cat._id, label: cat.name }))}
                                        value={quickAddItemData.category}
                                        onChange={e => setQuickAddItemData({...quickAddItemData, category: e.target.value})}
                                        placeholder="Search Category"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">HSN Code</label>
                                    <select value={quickAddItemData.hsn} onChange={e => setQuickAddItemData({...quickAddItemData, hsn: e.target.value})} className="w-full px-3 py-2 border rounded outline-none focus:ring-2 focus:ring-primary-500">
                                        <option value="">Select HSN</option>
                                        {hsnCodes.map(hsn => (
                                            <option key={hsn.code} value={hsn.code}>{hsn.code} - {hsn.description} ({hsn.gstRate}%)</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Purchase Price</label>
                                    <input type="number" step="0.01" value={quickAddItemData.purchasePrice} onChange={e => setQuickAddItemData({...quickAddItemData, purchasePrice: e.target.value})} className="w-full px-3 py-2 border rounded outline-none focus:ring-2 focus:ring-primary-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Unit Type</label>
                                    <select value={quickAddItemData.unitType} onChange={e => setQuickAddItemData({...quickAddItemData, unitType: e.target.value})} className="w-full px-3 py-2 border rounded outline-none focus:ring-2 focus:ring-primary-500">
                                        <option value="pieces">Pieces</option>
                                        <option value="box">Box</option>
                                        <option value="sqft">SqFt</option>
                                        <option value="nos">Nos</option>
                                        <option value="kgs">Kgs</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Size (e.g., 2x2, 4x4)</label>
                                    <SearchableSelect 
                                        options={[...new Set(items.map(i => i.size).filter(Boolean))].map(s => ({ value: s, label: s }))}
                                        value={quickAddItemData.size}
                                        onChange={e => setQuickAddItemData({...quickAddItemData, size: e.target.value})}
                                        placeholder="Search or Type Size"
                                        allowCreate={true}
                                    />
                                </div>
                                {billingSettings?.industry === 'tiles' && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Pieces Per Box</label>
                                            <input type="number" value={quickAddItemData.pcsPerBox} onChange={e => setQuickAddItemData({...quickAddItemData, pcsPerBox: e.target.value})} className="w-full px-3 py-2 border rounded outline-none focus:ring-2 focus:ring-primary-500" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">SqFt Per Piece</label>
                                            <input type="number" step="0.01" value={quickAddItemData.sqFtPerPc} onChange={e => setQuickAddItemData({...quickAddItemData, sqFtPerPc: e.target.value})} className="w-full px-3 py-2 border rounded outline-none focus:ring-2 focus:ring-primary-500" />
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <button type="button" onClick={() => setIsQuickAddItemOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded font-medium">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded font-bold hover:bg-primary-700">Add Item</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PurchaseOrders;
