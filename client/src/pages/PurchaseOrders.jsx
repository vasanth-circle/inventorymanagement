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
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [receiveData, setReceiveData] = useState([]);
    const [receiveVendorBillNo, setReceiveVendorBillNo] = useState('');
    const [taxType, setTaxType] = useState('cgst'); // 'cgst' (intra) or 'igst' (inter)
    const [formData, setFormData] = useState({
        vendor: '',
        vendorBillNumber: '',
        taxRate: 18,
        items: [{ 
            item: '', 
            quantity: '', 
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
        setFormData(prev => ({ ...prev, vendor: vendorId }));
        if (!vendorId) return;
        const selectedVendor = vendors.find(v => v._id === vendorId);
        const companyGstin = billingSettings?.gstNumber || '';
        const vendorGstin = selectedVendor?.gstin || '';
        const companyState = getGstStateCode(companyGstin);
        const vendorState = getGstStateCode(vendorGstin);
        const isInterState = vendorState && companyState && vendorState !== companyState;
        setTaxType(isInterState ? 'igst' : 'cgst');
    };

    const API_URL = '/api/purchase-orders';

    useEffect(() => {
        fetchOrders();
        fetchVendorsAndItems();
    }, []);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const res = await axios.get(API_URL, {
                headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
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
            const [vendRes, itemRes, hsnRes] = await Promise.allSettled([
                axios.get('/api/vendors', { params: { limit: 1000 }, headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } }),
                axios.get('/api/items', { params: { limit: 10000 }, headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } }),
                axios.get('/api/hsn', { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } }),
            ]);
            if (vendRes.status === 'fulfilled') setVendors(vendRes.value.data.data?.vendors || []);
            if (itemRes.status === 'fulfilled') setItems(itemRes.value.data.items || []);
            if (hsnRes.status === 'fulfilled') setHsnCodes(hsnRes.value.data.data || hsnRes.value.data || []);
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
                price: '', 
                taxRate: formData.taxRate,
                boxCount: '', 
                totalPcs: '', 
                totalSqFt: '',
                brand: '',
                size: '',
                billingUnit: billingSettings?.unitConfig?.quantityBasis === 'sqft' ? 'sqft' : 'pieces'
            }]
        });
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
                    const autoTaxRate = hsnEntry ? hsnEntry.gstRate : (formData.taxRate || 0);

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
                        billingUnit: (billingSettings?.industry === 'tiles' && Number(selectedItem.sqFtPerPc) > 0) ? 'sqft' : 'pieces'
                    };
                    
                    // Recalculate totals with the new defaults
                    newItems[index] = calculateItemValues(newItems[index], 'price', newItems[index].price, billingSettings?.industry);
                }
            } else if (field === 'piecesCount') {
                const row = newItems[index];
                const pcs = Number(value || 0);
                row.totalPcs = pcs;
                row.totalSqFt = Number((pcs * (row.sqFtPerPc || 0)).toFixed(4));
                row.boxCount = row.pcsPerBox > 0 ? pcs / row.pcsPerBox : 0;
                row.quantity = row.billingUnit === 'sqft' ? row.totalSqFt : (row.billingUnit === 'boxes' ? row.boxCount : pcs);
                row.total = Number((row.totalSqFt * row.price).toFixed(2));
            } else if (field === 'sqftTotal') {
                const row = newItems[index];
                const sqft = Number(value || 0);
                row.totalSqFt = sqft;
                row.totalPcs = row.sqFtPerPc > 0 ? sqft / row.sqFtPerPc : 0;
                row.boxCount = row.pcsPerBox > 0 ? row.totalPcs / row.pcsPerBox : 0;
                row.quantity = row.billingUnit === 'sqft' ? row.totalSqFt : (row.billingUnit === 'boxes' ? row.boxCount : row.totalPcs);
                row.total = Number((row.totalSqFt * row.price).toFixed(2));
            } else {
                // Apply standard calculations using central utility
                const row = newItems[index];
                newItems[index] = calculateItemValues(row, field, value, billingSettings?.industry);
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

            await axios.post(API_URL, submissionData, {
                headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
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
                        <h1 className="text-2xl font-bold text-gray-800">Purchase Orders</h1>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                        >
                            Create Purchase Order
                        </button>
                    </div>

            {loading ? (
                <div className="flex justify-center items-center h-64 print:hidden">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-md overflow-hidden print:hidden">
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
                                    <td className="px-6 py-4 font-medium text-primary-600 cursor-pointer hover:underline" onClick={() => openViewModal(order)}>{order.orderNumber}</td>
                                    <td className="px-6 py-4 text-gray-900">{order.vendor?.name}</td>
                                    <td className="px-6 py-4 text-gray-600">{new Date(order.orderDate).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-semibold text-gray-900">₹{order.totalAmount.toLocaleString()}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium uppercase ${getStatusColor(order.status)}`}>
                                            {order.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button onClick={() => openViewModal(order)} className="text-primary-600 hover:text-primary-800 text-sm font-medium mr-2">View</button>
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
            </>
            )}

            {isModalOpen && (
                <div className="max-w-6xl mx-auto space-y-6">
                    <div className="flex justify-between items-center border-b pb-4">
                        <h2 className="text-2xl font-bold text-gray-800">New Purchase Order</h2>
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
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Bill No.</label>
                                    <input type="text" value={formData.vendorBillNumber} onChange={(e) => setFormData({ ...formData, vendorBillNumber: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder="Optional" />
                                </div>
                                <div className="w-1/5 min-w-[130px]">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Default Tax Rate (%)</label>
                                    <select value={formData.taxRate} onChange={(e) => { const r = Number(e.target.value); setFormData(prev => ({ ...prev, taxRate: r, items: prev.items.map(it => ({...it, taxRate: r})) })); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none">
                                        <option value={0}>No Tax (0%)</option>
                                        <option value={5}>GST 5%</option>
                                        <option value={12}>GST 12%</option>
                                        <option value={18}>GST 18%</option>
                                        <option value={28}>GST 28%</option>
                                    </select>
                                </div>
                                <div className="flex items-end min-w-[140px]">
                                    <div className={`px-3 py-2 rounded-lg text-sm font-bold border-2 ${ taxType === 'igst' ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-green-50 border-green-300 text-green-700'}`}>
                                        {taxType === 'igst' ? '🔴 IGST (Inter-State)' : '🟢 CGST+SGST (Intra-State)'}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-semibold text-gray-700">Item Details</h3>
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-48">Item</th>
                                            <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-24 text-center">Qty / Boxes</th>
                                            <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-28">{!isGodown && 'Rate'}</th>
                                            <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-20 text-center">GST%</th>
                                            <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-20">Unit</th>
                                            <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-24 text-right">{!isGodown && 'Taxable'}</th>
                                            <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-24 text-right">{!isGodown && 'Total (w/Tax)'}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {formData.items.map((row, index) => {
                                            const isTile = billingSettings?.industry === 'tiles' && row.sqFtPerPc > 0;
                                            return (
                                            <tr key={index}>
                                                <td className="py-2 pr-2">
                                                    <SearchableSelect
                                                        value={row.item}
                                                        onChange={(e) => handleItemChange(index, 'item', e.target.value)}
                                                        options={items.map(i => ({ value: i._id, label: `${i.name}${i.size ? ` - ${i.size}` : ''} (${i.sku || 'No SKU'})` }))}
                                                        placeholder="Select Item"
                                                        searchPlaceholder="Search Item..."
                                                        className="w-full"
                                                    />
                                                </td>
                                                <td className="px-2 py-2">
                                                    {isTile ? (
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex gap-1 items-center">
                                                                <input type="number" step="0.5" min="0" value={row.boxCount || ''} onChange={(e) => handleItemChange(index, 'boxCount', e.target.value)} placeholder="Boxes" className="w-16 px-1 py-1 border rounded-md text-center text-xs font-bold focus:ring-1 focus:ring-primary-400 outline-none" />
                                                                <span className="text-[10px] text-gray-400">Bx</span>
                                                                <input type="number" step="1" min="0" value={row.totalPcs || ''} onChange={(e) => handleItemChange(index, 'piecesCount', e.target.value)} placeholder="Pcs" className="w-16 px-1 py-1 border rounded-md text-center text-xs font-bold focus:ring-1 focus:ring-primary-400 outline-none" />
                                                                <span className="text-[10px] text-gray-400">Pc</span>
                                                            </div>
                                                            <div className="flex items-center gap-1 mt-1">
                                                                <input type="number" step="0.01" min="0" value={row.totalSqFt || ''} onChange={(e) => handleItemChange(index, 'sqftTotal', e.target.value)} placeholder="SqFt" className="w-full px-1 py-1 border border-primary-300 bg-primary-50 rounded-md text-center text-xs font-bold text-primary-700 outline-none focus:ring-1 focus:ring-primary-500" />
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
                                                <td className="px-2 py-2">
                                                    {!isGodown && <input required type="number" step="0.01" value={row.price === 0 ? '' : row.price} onChange={(e) => handleItemChange(index, 'price', e.target.value)} className="w-full px-2 py-2 border rounded-lg border-gray-200 text-right font-bold focus:ring-1 focus:ring-primary-400 outline-none" placeholder="Rate" />}
                                                </td>
                                                <td className="px-2 py-2">
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
                                                <td className="px-2 py-2">
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
                                                <td className="px-2 py-2 font-bold text-gray-700 text-right text-sm">
                                                    {!isGodown && `₹${(row.total || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`}
                                                </td>
                                                <td className="px-2 py-2 font-bold text-green-700 text-right text-sm">
                                                    {!isGodown && `₹${((row.total || 0) * (1 + (row.taxRate ?? formData.taxRate) / 100)).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`}
                                                </td>
                                            </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                <button type="button" onClick={handleAddItem} className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center">
                                    <span className="text-lg mr-1">+</span> Add another line
                                </button>
                            </div>

                            <div className="flex justify-end pt-4 pb-2">
                                <div className="w-80 space-y-1.5 text-right">
                                    {(() => {
                                        const taxableTotal = formData.items.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
                                        const taxTotal = formData.items.reduce((s, i) => s + (parseFloat(i.total) || 0) * (parseFloat(i.taxRate ?? formData.taxRate) || 0) / 100, 0);
                                        const grandTotal = taxableTotal + taxTotal;
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
                                            <div className="flex justify-between text-lg text-gray-900 font-bold border-t pt-2">
                                                <span>Net Amount:</span>
                                                <span>₹{grandTotal.toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                                            </div>
                                        </>);
                                    })()}
                                </div>
                            </div>

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
                                <h2 className="text-lg font-bold text-gray-800">Purchase Order Details</h2>
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
                                    <div className="text-xs font-semibold uppercase text-gray-400">Purchase Order</div>
                                    <div className="text-lg font-bold text-gray-800">{selectedOrder.orderNumber}</div>
                                    <div className="text-xs text-gray-500">Date: {new Date(selectedOrder.orderDate).toLocaleDateString()}</div>
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
                                    {selectedOrder.vendor?.phone && <div className="text-xs text-gray-500">Phone: {selectedOrder.vendor.phone}</div>}
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
                                                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase text-center w-28">Total SqFt</th>
                                                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase text-right w-28">Rate (SqFt)</th>
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
                                                    <td className="px-4 py-3 text-center text-primary-700 font-bold">{row.quantity?.toLocaleString() || '-'}</td>
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
        </div>
    );
};

export default PurchaseOrders;
