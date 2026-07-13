import { useState, useEffect, useContext } from 'react';
import { InventoryContext } from '../context/InventoryContext';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { printShippingLabels } from '../utils/printTemplates';

const DispatchManagement = () => {
    const { billingSettings } = useContext(InventoryContext);
    const { user } = useContext(AuthContext);
    
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);
    
    // For Sales Person Requesting Dispatch
    const [requestData, setRequestData] = useState({
        items: [],
        notes: ''
    });
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    
    // For Godown Fulfilling Dispatch
    const [selectedDispatch, setSelectedDispatch] = useState(null);
    const [fulfillData, setFulfillData] = useState({
        vehicleNumber: '',
        driverPhone: '',
        notes: ''
    });
    const [isFulfillModalOpen, setIsFulfillModalOpen] = useState(false);
    
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [orderDetails, setOrderDetails] = useState(null);

    const isStrictlyGodown = user?.role === 'godown_staff' || user?.appRoles?.inventory === 'godown_staff' || user?.role === 'godown staff' || user?.appRoles?.inventory === 'godown staff';
    const [activeTab, setActiveTab] = useState(isStrictlyGodown ? 'loading' : 'pending'); // pending, loading, history
    const [dispatches, setDispatches] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    
    // Search states
    const [pendingSearch, setPendingSearch] = useState('');
    const [loadingSearch, setLoadingSearch] = useState('');
    const [historySearch, setHistorySearch] = useState('');

    useEffect(() => {
        if (!isStrictlyGodown) {
            fetchPendingOrders();
        }
        fetchDispatches();
    }, [isStrictlyGodown]);

    const fetchDispatches = async () => {
        try {
            setHistoryLoading(true);
            const res = await api.get('/dispatches');
            setDispatches(res.data?.data || res.data || []);
        } catch (error) {
            console.error('Fetch dispatch history error:', error);
            toast.error('Failed to fetch dispatches');
        } finally {
            setHistoryLoading(false);
        }
    };

    const fetchPendingOrders = async () => {
        try {
            setLoading(true);
            // Fetch only real invoices (type=invoice excludes estimations at API level)
            const [confirmedRes, partialRes, pendingDispatchRes] = await Promise.all([
                api.get('/sales-orders?status=confirmed&type=invoice&limit=1000'),
                api.get('/sales-orders?status=partially_dispatched&type=invoice&limit=1000'),
                api.get('/dispatches') // fetch all dispatches to detect pending_loading ones
            ]);
            
            const confirmedOrders = confirmedRes.data?.data?.orders || [];
            const partialOrders   = partialRes.data?.data?.orders || [];
            const allDispatches   = pendingDispatchRes.data?.data || pendingDispatchRes.data || [];

            // Build set of order IDs that already have a pending_loading dispatch request
            // We no longer completely hide these orders, because the user might want to request the remaining items.
            // The remaining quantity calculation below naturally filters out fully requested items.

            // Exclude estimations (double-safety)
            let allOrders = [...confirmedOrders, ...partialOrders].filter(order =>
                !order.isEstimation
            );

            // Filter out items that are already fully dispatched and show only pending quantity
            allOrders = allOrders.map(order => {
                const orderDispatches = allDispatches.filter(d => 
                    String(d.order?._id || d.order) === String(order._id) && d.status !== 'cancelled'
                );

                const pendingItems = order.items.map(item => {
                    const itemId = item.item?._id || item.item;
                    if (!itemId) return null;

                    const stockLimit = Number(item.stockQty) || 0;
                    const billedQty = Number(item.quantity) || 0;
                    const targetedStockLimit = stockLimit > 0 ? stockLimit : billedQty;

                    const dispatchedSum = orderDispatches.reduce((sum, d) => {
                        const dMatch = d.items.find(di => String(di.item?._id || di.item) === String(itemId));
                        return sum + (dMatch ? Number(dMatch.quantity) || 0 : 0);
                    }, 0);

                    const pending = Math.max(0, targetedStockLimit - dispatchedSum);
                    return {
                        ...item,
                        quantity: Number(pending.toFixed(2)) // Display the remaining pending quantity
                    };
                }).filter(i => i !== null && i.quantity > 0);

                return { 
                    ...order, 
                    items: pendingItems,
                    isPartiallyRequested: orderDispatches.length > 0
                };
            }).filter(order => order.items.length > 0);

            setOrders(allOrders);
        } catch (error) {
            console.error('Fetch orders error:', error);
            toast.error('Failed to fetch pending orders');
        } finally {
            setLoading(false);
        }
    };

    const handlePrintDispatchLog = async (dispatchLog) => {
        const toastId = toast.loading('Preparing print document...');
        try {
            const orderId = dispatchLog.order?._id || dispatchLog.order;
            
            // 1. Fetch full Sales Order details
            const orderRes = await api.get(`/sales-orders/${orderId}`);
            const fullOrder = orderRes.data?.data || orderRes.data;
            
            // 2. Fetch all dispatches for this order to build the summary
            const dispatchesRes = await api.get(`/dispatches/order/${orderId}`);
            const dispatchesList = dispatchesRes.data?.data || dispatchesRes.data || [];
            
            toast.dismiss(toastId);
            handlePrintSummary(fullOrder, dispatchesList);
        } catch (error) {
            toast.dismiss(toastId);
            console.error('Print dispatch log error:', error);
            toast.error('Failed to load dispatch details for printing');
        }
    };

    const handlePrintLabels = async (dispatchLog) => {
        const toastId = toast.loading('Preparing shipping labels...');
        try {
            const orderId = dispatchLog.order?._id || dispatchLog.order;
            const orderRes = await api.get(`/sales-orders/${orderId}`);
            const fullOrder = orderRes.data?.data || orderRes.data;
            toast.dismiss(toastId);
            printShippingLabels(dispatchLog, fullOrder, billingSettings);
        } catch (error) {
            toast.dismiss(toastId);
            console.error('Print labels error:', error);
            toast.error('Failed to load details for printing labels');
        }
    };

    const handleOpenRequestModal = async (order) => {
        setSelectedOrder(order);
        setRequestData({ notes: '', items: [] }); 

        try {
            // Fetch past dispatches to prevent over-dispatching
            const res = await api.get(`/dispatches/order/${order._id}`);
            const pastDispatches = res.data?.data || [];
            
            // Filter out cancelled ones if they exist
            const activeDispatches = pastDispatches.filter(d => d.status !== 'cancelled');

            const mappedItems = order.items.map(item => {
                const itemId = item.item?._id || item.item;
                if (!itemId) return null;

                const stockLimit = Number(item.stockQty) || 0;
                const billedQty = Number(item.quantity) || 0;
                const targetedStockLimit = stockLimit > 0 ? stockLimit : billedQty;

                const dispatchedSum = activeDispatches.reduce((sum, d) => {
                    const dMatch = d.items.find(di => {
                        const diItemId = di.item?._id || di.item;
                        return String(diItemId) === String(itemId);
                    });
                    return sum + (dMatch ? Number(dMatch.quantity) || 0 : 0);
                }, 0);

                const pending = Math.max(0, targetedStockLimit - dispatchedSum);

                return {
                    item: itemId,
                    name: item.name,
                    brand: item.brand,
                    size: item.size,
                    orderedQuantity: targetedStockLimit,
                    previouslyDispatched: dispatchedSum,
                    pendingQuantity: Number(pending.toFixed(2)),
                    quantity: '', // Default empty instead of 0
                    selected: false,
                    stockUnit: item.stockUnit || (item.sqFtPerPc ? 'Boxes' : 'Boxes')
                };
            }).filter(i => i !== null && i.pendingQuantity > 0);

            setRequestData(prev => ({
                ...prev,
                items: mappedItems
            }));
            
            setIsRequestModalOpen(true);
        } catch (err) {
            console.error('Dispatch limit load error:', err);
            toast.error('Failed to load dispatch limits');
        }
    };

    const handleItemToggle = (index) => {
        const newItems = [...requestData.items];
        newItems[index].selected = !newItems[index].selected;
        if (newItems[index].selected && (newItems[index].quantity === '' || newItems[index].quantity === 0)) {
            newItems[index].quantity = newItems[index].pendingQuantity;
        }
        setRequestData({ ...requestData, items: newItems });
    };

    const handleQtyChange = (index, value) => {
        const newItems = [...requestData.items];
        let parsed = value === '' ? '' : parseFloat(value);
        if (parsed > newItems[index].pendingQuantity) {
            parsed = newItems[index].pendingQuantity;
        }
        newItems[index].quantity = parsed;
        setRequestData({ ...requestData, items: newItems });
    };

    const handleSelectAllItems = () => {
        const allSelected = requestData.items.length > 0 && requestData.items.every(i => i.selected);
        const newItems = requestData.items.map(item => ({
            ...item,
            selected: !allSelected,
            quantity: !allSelected ? item.pendingQuantity : ''
        }));
        setRequestData({ ...requestData, items: newItems });
    };

    const handleSubmitRequest = async (e) => {
        e.preventDefault();
        const selectedItems = requestData.items.filter(i => i.selected && Number(i.quantity) > 0);
        
        if (selectedItems.length === 0) {
            return toast.error('Please select at least one item and enter a valid quantity');
        }

        try {
            await api.post('/dispatches', {
                order: selectedOrder._id,
                notes: requestData.notes,
                items: selectedItems.map(i => ({
                    item: i.item,
                    quantity: Number(i.quantity)
                }))
            });

            toast.success('Dispatch requested successfully');
            setIsRequestModalOpen(false);
            fetchPendingOrders();
            fetchDispatches();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error recording dispatch request');
        }
    };

    const handleOpenFulfillModal = (dispatchLog) => {
        setSelectedDispatch(dispatchLog);
        setFulfillData({
            vehicleNumber: dispatchLog.vehicleNumber || '',
            driverPhone: dispatchLog.driverPhone || '',
            notes: ''
        });
        setIsFulfillModalOpen(true);
    };

    const handleSubmitFulfill = async (e) => {
        e.preventDefault();
        // Vehicle number is optional now

        try {
            await api.put(`/dispatches/${selectedDispatch._id}/fulfill`, {
                vehicleNumber: fulfillData.vehicleNumber,
                driverPhone: fulfillData.driverPhone,
                notes: fulfillData.notes
            });

            toast.success('Vehicle loaded and dispatch finalized');
            setIsFulfillModalOpen(false);
            fetchPendingOrders();
            fetchDispatches();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error finalizing dispatch');
        }
    };

    const handlePrintSummary = (order, dispatchesList) => {
        const completedDispatches = dispatchesList.filter(d => d.status === 'dispatched');
        const printContent = `
            <html>
                <head>
                    <title>Dispatch Summary - ${order.orderNumber}</title>
                    <style>
                        @page { size: A4; margin: 15mm; }
                        body { font-family: 'Segoe UI', sans-serif; font-size: 11px; line-height: 1.4; color: #333; }
                        .header h1 { margin: 0; font-size: 20px; text-transform: uppercase; }
                        .summary-title { text-align: center; font-weight: bold; font-size: 14px; text-decoration: underline; margin-bottom: 20px; }
                        
                        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; border: 1px solid #ddd; padding: 10px; margin-bottom: 20px; background: #f9f9f9; }
                        .info-label { font-weight: bold; width: 100px; display: inline-block; }
                        
                        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                        th { border: 1px solid #000; padding: 8px; background: #eee; text-align: left; }
                        td { border: 1px solid #000; padding: 6px; }
                        
                        .total-summary { margin-top: 30px; }
                        .footer { margin-top: 50px; display: flex; justify-content: space-between; }
                        .sign-box { border-top: 1px solid #000; width: 150px; text-align: center; padding-top: 5px; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <div style="display:flex; justify-content:center; align-items:center; gap:20px; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px;">
                        ${billingSettings?.branding?.logoUrl ? `<img src="${billingSettings.branding.logoUrl.startsWith('http') ? billingSettings.branding.logoUrl : window.location.origin + billingSettings.branding.logoUrl}" style="max-height: 60px; max-width: 150px; object-fit: contain;" />` : ''}
                        <div style="text-align: center;">
                            <h1 style="margin: 0; font-size: 20px; text-transform: uppercase;">${billingSettings?.companyName || 'INVENTORY SYSTEM'}</h1>
                            <p style="margin: 2px 0;">${billingSettings?.address || ''}</p>
                            <p style="margin: 2px 0;">Phone: ${billingSettings?.phone1 || ''}</p>
                        </div>
                    </div>
                    
                    <div class="summary-title">CUSTOMER DISPATCH SUMMARY REPORT</div>
                    
                    <div class="info-grid">
                        <div>
                            <div><span class="info-label">Customer:</span> ${(order.customer?.companyName || order.customer?.name || '').toUpperCase()}</div>
                            <div><span class="info-label">Order No:</span> ${order.orderNumber}</div>
                        </div>
                        <div style="text-align: right;">
                            <div><span class="info-label">Order Date:</span> ${new Date(order.orderDate).toLocaleDateString()}</div>
                            <div><span class="info-label">Printed On:</span> ${new Date().toLocaleDateString()}</div>
                        </div>
                    </div>

                    <h3>1. ITEM DISPATCH LOG (DATE-WISE)</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Vehicle No</th>
                                <th>Items Dispatched</th>
                                <th>Weight/Qty</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${completedDispatches.length > 0 ? completedDispatches.map(d => `
                                <tr>
                                    <td>${new Date(d.dispatchDate || d.createdAt).toLocaleDateString()}</td>
                                    <td>${d.vehicleNumber || 'N/A'}</td>
                                    <td>
                                        ${d.items.map(i => {
                                            const itemDoc = order.items.find(oi => String(oi.item._id || oi.item) === String(i.item?._id || i.item));
                                            return `<div>- ${i.item?.name || itemDoc?.name || 'Unknown Item'}</div>`;
                                        }).join('')}
                                    </td>
                                    <td>
                                        ${d.items.map(i => {
                                            const itemDoc = order.items.find(oi => String(oi.item._id || oi.item) === String(i.item?._id || i.item));
                                            return `<div>${i.quantity} ${itemDoc?.stockUnit || 'Boxes'}</div>`;
                                        }).join('')}
                                    </td>
                                </tr>
                            `).join('') : '<tr><td colspan="4" style="text-align:center">No completed dispatches yet</td></tr>'}
                        </tbody>
                    </table>

                    <h3>2. PENDING PHYSICAL STOCK SUMMARY</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Item Name</th>
                                <th>Total Ordered (Stock)</th>
                                <th>Total Dispatched</th>
                                <th>Balance Pending</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${order.items.map(oi => {
                                const oiId = oi.item._id || oi.item;
                                const targetedStockLimit = oi.stockQty || oi.quantity;
                                const totalDisp = completedDispatches.reduce((sum, d) => {
                                    const match = d.items.find(di => String(di.item._id || di.item) === String(oiId));
                                    return sum + (match ? match.quantity : 0);
                                }, 0);
                                return `
                                    <tr>
                                        <td>${oi.name || oi.item?.name || 'Unknown Item'}</td>
                                        <td>${targetedStockLimit} ${oi.stockUnit || (oi.sqFtPerPc > 0 ? 'Boxes' : 'Boxes')}</td>
                                        <td>${totalDisp}</td>
                                        <td style="font-weight:bold; color:${targetedStockLimit - totalDisp > 0 ? 'red' : 'green'}">${(targetedStockLimit - totalDisp).toFixed(2)}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>

                    <div class="footer">
                        <div class="sign-box">Customer Signature</div>
                        <div class="sign-box">Dispatch Officer</div>
                        <div class="sign-box">Authorized Signatory</div>
                    </div>
                </body>
            </html>
        `;
        const win = window.open('', '_blank');
        win.document.write(printContent);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 500);
    };

    const handleViewDetails = async (order) => {
        setSelectedOrder(order);
        try {
            const res = await api.get(`/dispatches/order/${order._id}`);
            const logs = res.data?.data || [];
            // Only show completed ones in history details, or show all with status?
            setOrderDetails({
                ...order,
                dispatches: logs
            });
            setIsDetailsModalOpen(true);
        } catch (error) {
            toast.error('Failed to fetch dispatch details');
        }
    };

    // Filter dispatches by status
    const pendingLoadingDispatches = dispatches.filter(d => {
        if (d.status !== 'pending_loading') return false;
        if (!loadingSearch) return true;
        const query = loadingSearch.toLowerCase();
        const dispatchNum = d.dispatchNumber?.toLowerCase() || '';
        const orderNum = d.order?.orderNumber?.toLowerCase() || '';
        const custName = (d.order?.customer?.companyName || d.order?.customer?.name || '').toLowerCase();
        return dispatchNum.includes(query) || orderNum.includes(query) || custName.includes(query);
    });
    const completedDispatches = dispatches.filter(d => d.status === 'dispatched');
    
    // Check if user is godown staff or admin
    const isGodownStaff = ['admin', 'manager', 'tenant_owner', 'godown_staff', 'godown staff'].includes(user?.role);

    return (
        <div className="space-y-8 pb-24 lg:pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 py-4">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Dispatch Management</h1>
                    <p className="text-sm text-gray-500 mt-1">Pending shipments, loading queue and delivery logs</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 overflow-x-auto">
                {!isStrictlyGodown && (
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`whitespace-nowrap py-4 px-6 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
                            activeTab === 'pending'
                                ? 'border-indigo-600 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        📦 Pending Shipments ({orders.length})
                    </button>
                )}
                <button
                    onClick={() => setActiveTab('loading')}
                    className={`whitespace-nowrap py-4 px-6 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
                        activeTab === 'loading'
                            ? 'border-amber-600 text-amber-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    🚚 Pending Loading ({pendingLoadingDispatches.length})
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`whitespace-nowrap py-4 px-6 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
                        activeTab === 'history'
                            ? 'border-emerald-600 text-emerald-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    📜 Dispatch Logs ({completedDispatches.length})
                </button>
            </div>

            {activeTab === 'pending' && (
                <div className="space-y-6">
                    <div className="flex gap-3">
                        <input
                            type="text"
                            placeholder="Search by Order # or Customer Name..."
                            value={pendingSearch}
                            onChange={e => setPendingSearch(e.target.value)}
                            className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                        />
                    </div>
                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {orders.filter(order => {
                                const q = pendingSearch.toLowerCase();
                                const cName = (order.customer?.companyName || order.customer?.name || '').toLowerCase();
                                const oNum = (order.orderNumber || '').toLowerCase();
                                return cName.includes(q) || oNum.includes(q);
                            }).length > 0 ? (
                                orders.filter(order => {
                                    const q = pendingSearch.toLowerCase();
                                    const cName = (order.customer?.companyName || order.customer?.name || '').toLowerCase();
                                    const oNum = (order.orderNumber || '').toLowerCase();
                                    return cName.includes(q) || oNum.includes(q);
                                }).map((order) => (
                                    <div key={order._id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:border-gray-300 transition-colors flex flex-col group">
                                        <div className="p-6 border-b border-gray-100 flex justify-between items-start">
                                            <div>
                                                <p className="text-xs font-medium text-indigo-600 uppercase tracking-wider mb-1">Order</p>
                                                <h3 className="text-lg font-semibold text-gray-900">{order.orderNumber}</h3>
                                            </div>
                                            <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${(order.status === 'confirmed' && !order.isPartiallyRequested) ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                                {(order.status === 'partially_dispatched' || order.isPartiallyRequested) ? 'partial dispatch' : order.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                        
                                        <div className="p-6 flex-1 flex flex-col">
                                            <div className="flex items-center mb-6">
                                                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 mr-4 border border-gray-100">
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                </div>
                                                <div className="overflow-hidden">
                                                    <p className="text-xs text-gray-500 font-medium">Customer</p>
                                                    <p className="font-medium text-gray-900 truncate text-sm">{order.customer?.companyName || order.customer?.name}</p>
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-3 mb-6 flex-1 flex flex-col">
                                                <div className="flex justify-between items-center">
                                                    <p className="text-xs text-gray-500 font-medium">Pending Items</p>
                                                    {(order.status === 'partially_dispatched' || order.isPartiallyRequested) && (
                                                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 uppercase tracking-wider">Partial Dispatch</span>
                                                    )}
                                                </div>
                                                <div className="space-y-2 max-h-56 overflow-y-auto pr-2 custom-scrollbar flex-1">
                                                    {order.items.map((item, idx) => (
                                                        <div key={idx} className="flex justify-between items-start text-sm">
                                                            <span className="text-gray-700 pr-4">{item.name}</span>
                                                            <span className="font-medium text-gray-900 whitespace-nowrap bg-gray-50 px-1.5 py-0.5 rounded">x {item.quantity}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-4 gap-3 mt-auto pt-4 border-t border-gray-100">
                                                <button 
                                                    onClick={() => handleViewDetails(order)}
                                                    className="col-span-1 flex items-center justify-center py-2.5 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-colors"
                                                    title="View History"
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                </button>
                                                <button 
                                                    onClick={async () => {
                                                        const res = await api.get(`/dispatches/order/${order._id}`);
                                                        handlePrintSummary(order, res.data?.data || []);
                                                    }}
                                                    className="col-span-1 flex items-center justify-center py-2.5 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-colors"
                                                    title="Print Document"
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                                </button>
                                                <button 
                                                    onClick={() => handleOpenRequestModal(order)}
                                                    className="col-span-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 font-medium text-sm transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                                    Request Dispatch
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-full py-20 px-6 bg-white rounded-2xl border border-gray-200 text-center flex flex-col items-center justify-center">
                                    <h3 className="text-lg font-medium text-gray-900">No Pending Dispatches found</h3>
                                    <p className="text-sm text-gray-500 mt-1 max-w-sm">No orders match your search.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'loading' && (
                <div className="space-y-6">
                    <div className="flex gap-3">
                        <input
                            type="text"
                            placeholder="Search by Dispatch #, Order #, or Customer..."
                            value={loadingSearch}
                            onChange={e => setLoadingSearch(e.target.value)}
                            className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none shadow-sm"
                        />
                    </div>
                    {historyLoading ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {pendingLoadingDispatches.length > 0 ? (
                                pendingLoadingDispatches.map((dh) => (
                                    <div key={dh._id} className="bg-white rounded-2xl shadow-sm border border-amber-200 overflow-hidden hover:border-amber-400 hover:shadow-md transition-all flex flex-col p-6 space-y-4">
                                        <div className="flex justify-between items-start border-b border-gray-100 pb-4">
                                            <div>
                                                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest flex items-center gap-1">
                                                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                                                    WAITING FOR LOADING
                                                </span>
                                                <h3 className="text-base font-black text-gray-900 mt-0.5">{dh.dispatchNumber}</h3>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-black inline-block">
                                                    ORDER: {dh.order?.orderNumber || 'N/A'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-xl text-xs">
                                            <div>
                                                <span className="text-gray-400 font-medium block uppercase text-[9px] tracking-wider">Customer / Client</span>
                                                <span className="font-bold text-gray-900 block mt-0.5 truncate">
                                                    {dh.order?.customer?.companyName || dh.order?.customer?.name || 'Walk-in Customer'}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-gray-400 font-medium block uppercase text-[9px] tracking-wider">Requested By</span>
                                                <span className="font-bold text-gray-900 block mt-0.5 truncate">
                                                    {dh.createdBy?.name || 'System'}
                                                </span>
                                            </div>
                                        </div>

                                        <div>
                                            <span className="text-xs font-bold text-gray-700 block mb-2">Items to Load</span>
                                            <div className="border border-gray-100 rounded-xl overflow-hidden text-xs">
                                                <table className="w-full text-left">
                                                    <thead>
                                                        <tr className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100">
                                                            <th className="px-3 py-2">Item Details</th>
                                                            <th className="px-3 py-2 text-right">Required Qty</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-50">
                                                        {dh.items.map((di, idx) => (
                                                            <tr key={idx} className="hover:bg-gray-50">
                                                                <td className="px-3 py-2 font-medium text-gray-900">
                                                                    {di.item?.name || 'Unknown Item'}
                                                                    <span className="text-[10px] text-gray-400 block font-normal">
                                                                        {di.item?.brand} | {di.item?.size}
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-bold text-amber-600 bg-amber-50/20">
                                                                    {di.quantity} Boxes
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                        
                                        {dh.notes && (
                                            <div className="text-xs bg-gray-50 text-gray-800 p-2.5 rounded-xl border border-gray-100">
                                                <strong className="block mb-0.5 text-[10px] uppercase tracking-wider text-gray-500">Sales Notes</strong>
                                                {dh.notes}
                                            </div>
                                        )}

                                        <div className="pt-3 border-t border-gray-100">
                                            {isGodownStaff ? (
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenFulfillModal(dh)}
                                                    className="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
                                                >
                                                    🚚 Load Vehicle & Dispatch
                                                </button>
                                            ) : (
                                                <div className="text-center text-xs text-gray-500 py-2">
                                                    Waiting for Godown staff to load vehicle...
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-full py-20 px-6 bg-white rounded-2xl border border-gray-200 text-center flex flex-col items-center justify-center">
                                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 mb-4 border border-gray-100">
                                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-900">No Pending Loading</h3>
                                    <p className="text-sm text-gray-500 mt-1 max-w-sm">No dispatch requests from sales team.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'history' && (
                <div className="space-y-6">
                    <div className="flex gap-3">
                        <input
                            type="text"
                            placeholder="Search by Dispatch #, Order #, Vehicle, or Customer..."
                            value={historySearch}
                            onChange={e => setHistorySearch(e.target.value)}
                            className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                        />
                    </div>

                    {historyLoading ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {completedDispatches.filter(dh => {
                                const query = historySearch.toLowerCase();
                                const dispatchNum = dh.dispatchNumber?.toLowerCase() || '';
                                const orderNum = dh.order?.orderNumber?.toLowerCase() || '';
                                const vehicleNum = dh.vehicleNumber?.toLowerCase() || '';
                                const driverPh = dh.driverPhone?.toLowerCase() || '';
                                const custName = (dh.order?.customer?.companyName || dh.order?.customer?.name || '').toLowerCase();
                                
                                return dispatchNum.includes(query) || 
                                       orderNum.includes(query) || 
                                       vehicleNum.includes(query) || 
                                       driverPh.includes(query) ||
                                       custName.includes(query);
                            }).length > 0 ? (
                                completedDispatches.filter(dh => {
                                    const query = historySearch.toLowerCase();
                                    const dispatchNum = dh.dispatchNumber?.toLowerCase() || '';
                                    const orderNum = dh.order?.orderNumber?.toLowerCase() || '';
                                    const vehicleNum = dh.vehicleNumber?.toLowerCase() || '';
                                    const driverPh = dh.driverPhone?.toLowerCase() || '';
                                    const custName = (dh.order?.customer?.companyName || dh.order?.customer?.name || '').toLowerCase();
                                    
                                    return dispatchNum.includes(query) || 
                                           orderNum.includes(query) || 
                                           vehicleNum.includes(query) || 
                                           driverPh.includes(query) ||
                                           custName.includes(query);
                                }).map((dh) => (
                                    <div key={dh._id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:border-indigo-300 hover:shadow-md transition-all flex flex-col p-6 space-y-4">
                                        <div className="flex justify-between items-start border-b border-gray-100 pb-4">
                                            <div>
                                                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">DISPATCHED</span>
                                                <h3 className="text-base font-black text-gray-900 mt-0.5">{dh.dispatchNumber}</h3>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xs text-gray-400 font-bold block">{new Date(dh.dispatchDate || dh.createdAt).toLocaleDateString()}</span>
                                                <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-black mt-1 inline-block">
                                                    ORDER: {dh.order?.orderNumber || 'N/A'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-xl text-xs">
                                            <div>
                                                <span className="text-gray-400 font-medium block uppercase text-[9px] tracking-wider">Customer / Client</span>
                                                <span className="font-bold text-gray-900 block mt-0.5 truncate">
                                                    {dh.order?.customer?.companyName || dh.order?.customer?.name || 'Walk-in Customer'}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-gray-400 font-medium block uppercase text-[9px] tracking-wider">Vehicle Number</span>
                                                <span className="font-bold text-indigo-700 block mt-0.5 uppercase">
                                                    {dh.vehicleNumber || 'N/A'}
                                                </span>
                                            </div>
                                            {dh.driverPhone && (
                                                <div>
                                                    <span className="text-gray-400 font-medium block uppercase text-[9px] tracking-wider">Driver Phone</span>
                                                    <span className="font-bold text-gray-900 block mt-0.5">
                                                        {dh.driverPhone}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <span className="text-xs font-bold text-gray-700 block mb-2">Dispatched Items</span>
                                            <div className="border border-gray-100 rounded-xl overflow-hidden text-xs">
                                                <table className="w-full text-left">
                                                    <thead>
                                                        <tr className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100">
                                                            <th className="px-3 py-2">Item Details</th>
                                                            <th className="px-3 py-2 text-right">Loaded Qty</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-50">
                                                        {dh.items.map((di, idx) => (
                                                            <tr key={idx} className="hover:bg-gray-50">
                                                                <td className="px-3 py-2 font-medium text-gray-900">
                                                                    {di.item?.name || 'Unknown Item'}
                                                                    <span className="text-[10px] text-gray-400 block font-normal">
                                                                        {di.item?.brand} | {di.item?.size}
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-bold text-emerald-600 bg-emerald-50/20">
                                                                    {di.quantity} Boxes
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                        
                                        {dh.notes && (
                                            <div className="text-xs bg-amber-50 text-amber-800 p-2.5 rounded-xl border border-amber-100/50">
                                                <strong className="block mb-0.5 text-[10px] uppercase tracking-wider text-amber-600">Gate / Delivery Notes</strong>
                                                {dh.notes}
                                            </div>
                                        )}

                                        <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                                            <button
                                                type="button"
                                                onClick={() => handlePrintLabels(dh)}
                                                className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
                                            >
                                                🏷️ Print Labels
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handlePrintDispatchLog(dh)}
                                                className="w-full bg-slate-900 hover:bg-black text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
                                            >
                                                📄 Print Delivery Slip
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-full py-20 px-6 bg-white rounded-2xl border border-gray-200 text-center flex flex-col items-center justify-center">
                                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 mb-4 border border-gray-100">
                                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-900">No matching logs found</h3>
                                    <p className="text-sm text-gray-500 mt-1 max-w-sm">No dispatches match your search filters.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Sales Request Dispatch Modal */}
            {isRequestModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-0 sm:p-6">
                    <div className="bg-white sm:rounded-2xl shadow-xl w-full h-full sm:h-auto sm:max-h-[90vh] max-w-3xl flex flex-col animate-[fadeIn_0.15s_ease-out]">
                        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-white sm:rounded-t-2xl z-10 shrink-0">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">Request Dispatch</h2>
                                <p className="text-xs text-gray-500 mt-1">{selectedOrder?.orderNumber} • {selectedOrder?.customer?.name}</p>
                            </div>
                            <button onClick={() => setIsRequestModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-2 -mr-2">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmitRequest} className="flex-1 overflow-y-auto p-6 space-y-8">
                            <div>
                                <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-4">
                                    <div className="flex items-center gap-4">
                                        <h3 className="text-sm font-semibold text-gray-900">Select Items to Request</h3>
                                        {requestData.items.length > 0 && (
                                            <button 
                                                type="button"
                                                onClick={handleSelectAllItems}
                                                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                                            >
                                                {requestData.items.every(i => i.selected) ? 'Deselect All' : 'Select All'}
                                            </button>
                                        )}
                                    </div>
                                    <span className="text-xs text-gray-500">{requestData.items.filter(i => i.selected).length} selected</span>
                                </div>
                                
                                <div className="space-y-3">
                                    {requestData.items.map((item, index) => (
                                        <div key={index} className={`flex flex-col sm:flex-row gap-4 p-4 rounded-xl border transition-colors cursor-pointer ${item.selected ? 'border-indigo-500 bg-indigo-50/30' : 'border-gray-200 hover:border-gray-300 bg-white'}`} onClick={(e) => { if (e.target.tagName !== 'INPUT') handleItemToggle(index); }}>
                                            <div className="flex items-start gap-4 flex-1">
                                                <div className="mt-0.5">
                                                    <input 
                                                        type="checkbox" 
                                                        className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                        checked={item.selected}
                                                        onChange={() => handleItemToggle(index)}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                                                    <p className="text-xs text-gray-500 mt-0.5">{item.brand} • {item.size}</p>
                                                    <div className="mt-2 flex gap-4 text-xs">
                                                        <span className="text-gray-500">Ordered: {item.orderedQuantity} Boxes</span>
                                                        <span className="text-emerald-600 font-medium">Done: {item.previouslyDispatched} Boxes</span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="sm:w-32 flex flex-col justify-center" onClick={e => e.stopPropagation()}>
                                                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 flex justify-between">
                                                    <span>Req Qty</span>
                                                </label>
                                                <div className="relative">
                                                    <input 
                                                        type="number" 
                                                        step="any"
                                                        disabled={!item.selected}
                                                        value={item.quantity} 
                                                        max={item.pendingQuantity}
                                                        onChange={(e) => handleQtyChange(index, e.target.value)}
                                                        className={`w-full px-3 py-2 rounded-lg border outline-none text-right transition-colors sm:text-sm ${item.selected ? 'border-gray-300 focus:border-indigo-500 text-gray-900 bg-white' : 'bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed'}`}
                                                    />
                                                </div>
                                                <div className="text-[10px] text-gray-400 mt-1 text-right">Max: {item.pendingQuantity} Boxes</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1.5">Request Notes (Optional)</label>
                                <textarea rows="2" value={requestData.notes} onChange={(e) => setRequestData({ ...requestData, notes: e.target.value })} placeholder="Instructions for godown staff" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"></textarea>
                            </div>
                        </form>
                        
                        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex flex-col-reverse sm:flex-row justify-end gap-3 sm:rounded-b-2xl shrink-0">
                            <button type="button" onClick={() => setIsRequestModalOpen(false)} className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm">Cancel</button>
                            <button type="submit" onClick={handleSubmitRequest} className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors text-sm flex items-center justify-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                Send to Godown
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Godown Fulfill Modal */}
            {isFulfillModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col animate-[fadeIn_0.15s_ease-out]">
                        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-white rounded-t-2xl">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">Load Vehicle</h2>
                                <p className="text-xs text-gray-500 mt-1">{selectedDispatch?.dispatchNumber}</p>
                            </div>
                            <button onClick={() => setIsFulfillModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmitFulfill} className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1.5">Vehicle Number (Optional)</label>
                                <input type="text" value={fulfillData.vehicleNumber} onChange={(e) => setFulfillData({ ...fulfillData, vehicleNumber: e.target.value.toUpperCase() })} placeholder="e.g. TN 01 AB 1234" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-gray-900 uppercase sm:text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1.5">Driver Phone</label>
                                <input type="tel" value={fulfillData.driverPhone} onChange={(e) => setFulfillData({ ...fulfillData, driverPhone: e.target.value })} placeholder="10-digit number" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-gray-900 sm:text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1.5">Additional Notes</label>
                                <textarea rows="2" value={fulfillData.notes} onChange={(e) => setFulfillData({ ...fulfillData, notes: e.target.value })} placeholder="Gate pass details, etc." className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-sm"></textarea>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsFulfillModalOpen(false)} className="flex-1 px-4 py-2.5 text-gray-700 bg-white border border-gray-300 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm">Cancel</button>
                                <button type="submit" className="flex-1 px-4 py-2.5 bg-amber-500 text-white font-medium rounded-xl hover:bg-amber-600 transition-colors text-sm flex items-center justify-center gap-2">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    Confirm Load
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* History Details Modal */}
            {isDetailsModalOpen && orderDetails && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-0 sm:p-6">
                    <div className="bg-white sm:rounded-2xl shadow-xl w-full h-full sm:h-auto sm:max-h-[90vh] max-w-4xl flex flex-col animate-[fadeIn_0.15s_ease-out]">
                        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-white sm:rounded-t-2xl z-10 shrink-0">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">Dispatch History</h2>
                                <p className="text-xs text-gray-500 mt-1">{orderDetails.orderNumber} • {orderDetails.customer?.name}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handlePrintSummary(orderDetails, orderDetails.dispatches)}
                                    className="hidden sm:flex px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg text-sm font-medium transition-colors items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                    Print
                                </button>
                                <button onClick={() => setIsDetailsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-2 -mr-2 transition-colors">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div>
                                    <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100 pb-3 mb-4">Overall Status</h3>
                                    <div className="space-y-4">
                                        {orderDetails.items.map((item, idx) => {
                                            const totalDispatched = orderDetails.dispatches.filter(d => d.status !== 'cancelled').reduce((sum, d) => {
                                                const dItem = d.items.find(di => String(di.item._id || di.item) === String(item.item._id || item.item));
                                                return sum + (dItem ? dItem.quantity : 0);
                                            }, 0);
                                            const pending = (item.stockQty || item.quantity) - totalDispatched;
                                            const isComplete = pending <= 0;
                                            
                                            return (
                                                <div key={idx} className="bg-white p-4 rounded-xl border border-gray-200 flex flex-col gap-4 relative overflow-hidden">
                                                    {isComplete && <div className="absolute top-0 right-0 w-8 h-8 bg-emerald-500 -mr-4 -mt-4 rotate-45"></div>}
                                                    
                                                    <div>
                                                        <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                                                        <p className="text-xs text-gray-500 mt-1">{item.brand} | {item.size}</p>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-3 gap-1 bg-gray-50 rounded-lg p-3 text-center">
                                                        <div>
                                                            <p className="text-[10px] text-gray-500 uppercase">Ordered</p>
                                                            <p className="font-semibold text-gray-900 mt-1">{item.stockQty || item.quantity}</p>
                                                        </div>
                                                        <div className="border-l border-gray-200">
                                                            <p className="text-[10px] text-gray-500 uppercase">Shipped</p>
                                                            <p className="font-semibold text-emerald-600 mt-1">{totalDispatched}</p>
                                                        </div>
                                                        <div className="border-l border-gray-200">
                                                            <p className="text-[10px] text-gray-500 uppercase">Pending</p>
                                                            <p className={`font-semibold mt-1 ${pending > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{pending}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                
                                <div>
                                    <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100 pb-3 mb-4">Dispatch Logs</h3>
                                    <div className="space-y-4">
                                        {orderDetails.dispatches.length > 0 ? (
                                            orderDetails.dispatches.map((dispatch, idx) => (
                                                <div key={idx} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                                                        <span className="text-xs font-semibold text-gray-700">{dispatch.dispatchNumber}</span>
                                                        <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${dispatch.status === 'pending_loading' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                            {dispatch.status.replace('_', ' ').toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div className="p-4">
                                                        {dispatch.status === 'dispatched' && (
                                                            <div className="flex items-center gap-3 mb-4">
                                                                <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
                                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                                                </div>
                                                                <div>
                                                                    <p className="text-[10px] text-gray-500 uppercase">Vehicle</p>
                                                                    <p className="font-medium text-gray-900 text-sm">{dispatch.vehicleNumber}</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                        
                                                        <div className="space-y-2 border-t border-gray-100 pt-3">
                                                            {dispatch.items.map((di, didx) => (
                                                                <div key={didx} className="flex justify-between items-center text-sm">
                                                                    <span className="text-gray-600 truncate pr-4">
                                                                        {di.item?.name || 'Item'}
                                                                    </span>
                                                                    <span className="font-medium text-gray-900 bg-gray-50 px-2 py-0.5 rounded">{di.quantity} Boxes</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="border border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-500 text-sm">
                                                No dispatches recorded yet.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center sm:rounded-b-2xl shrink-0">
                            <button
                                onClick={() => handlePrintSummary(orderDetails, orderDetails.dispatches)}
                                className="sm:hidden flex px-4 py-2 bg-white text-indigo-600 border border-gray-200 text-sm font-medium rounded-lg items-center gap-2 shadow-sm"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                Print
                            </button>
                            <button onClick={() => setIsDetailsModalOpen(false)} className="w-full sm:w-auto px-8 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-black transition-colors ml-auto">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DispatchManagement;
