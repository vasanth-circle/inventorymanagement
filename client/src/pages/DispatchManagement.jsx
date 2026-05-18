import { useState, useEffect, useContext } from 'react';
import { InventoryContext } from '../context/InventoryContext';
import api from '../utils/api';
import toast from 'react-hot-toast';

const DispatchManagement = () => {
    const { billingSettings } = useContext(InventoryContext);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [dispatchData, setDispatchData] = useState({
        vehicleNumber: '',
        driverPhone: '',
        items: [],
        notes: ''
    });
    const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [orderDetails, setOrderDetails] = useState(null);

    const [activeTab, setActiveTab] = useState('pending');
    const [dispatchHistory, setDispatchHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historySearch, setHistorySearch] = useState('');

    useEffect(() => {
        fetchPendingOrders();
        fetchDispatchHistory();
    }, []);

    const fetchDispatchHistory = async () => {
        try {
            setHistoryLoading(true);
            const res = await api.get('/dispatches');
            setDispatchHistory(res.data?.data || res.data || []);
        } catch (error) {
            console.error('Fetch dispatch history error:', error);
            toast.error('Failed to fetch dispatch logs');
        } finally {
            setHistoryLoading(false);
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

    const fetchPendingOrders = async () => {
        try {
            setLoading(true);
            const [confirmedRes, partialRes] = await Promise.all([
                api.get('/sales-orders?status=confirmed&limit=1000'),
                api.get('/sales-orders?status=partially_dispatched&limit=1000')
            ]);
            
            const confirmedOrders = confirmedRes.data?.data?.orders || [];
            const partialOrders = partialRes.data?.data?.orders || [];
            
            setOrders([...confirmedOrders, ...partialOrders]);
        } catch (error) {
            console.error('Fetch orders error:', error);
            toast.error('Failed to fetch pending orders');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDispatch = async (order) => {
        setSelectedOrder(order);
        setDispatchData({ vehicleNumber: '', driverPhone: '', notes: '', items: [] }); // Reset first

        try {
            // Fetch past dispatches to prevent over-dispatching
            const res = await api.get(`/dispatches/order/${order._id}`);
            const pastDispatches = res.data?.data || [];

            const mappedItems = order.items.map(item => {
                // Handle both populated and unpopulated item IDs
                const itemId = item.item?._id || item.item;
                if (!itemId) return null;

                // Calculate pending limit using stockQty (physical boxes) for tiles, fallback to quantity for generic items
                // Ensure we use numbers to avoid NaN issues
                const stockLimit = Number(item.stockQty) || 0;
                const billedQty = Number(item.quantity) || 0;
                const targetedStockLimit = stockLimit > 0 ? stockLimit : billedQty;

                const dispatchedSum = pastDispatches.reduce((sum, d) => {
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
                    quantity: 0,
                    selected: false,
                    stockUnit: item.stockUnit || 'Units'
                };
            }).filter(i => i !== null && i.pendingQuantity > 0);

            setDispatchData(prev => ({
                ...prev,
                items: mappedItems
            }));
            
            setIsDispatchModalOpen(true);
        } catch (err) {
            console.error('Dispatch limit load error:', err);
            toast.error('Failed to load dispatch limits');
        }
    };

    const handleItemToggle = (index) => {
        const newItems = [...dispatchData.items];
        newItems[index].selected = !newItems[index].selected;
        if (newItems[index].selected && newItems[index].quantity === 0) {
            newItems[index].quantity = newItems[index].pendingQuantity;
        }
        setDispatchData({ ...dispatchData, items: newItems });
    };

    const handleQtyChange = (index, value) => {
        const newItems = [...dispatchData.items];
        let parsed = parseFloat(value) || 0;
        if (parsed > newItems[index].pendingQuantity) {
            parsed = newItems[index].pendingQuantity;
        }
        newItems[index].quantity = parsed;
        setDispatchData({ ...dispatchData, items: newItems });
    };

    const handlePrintSummary = (order, dispatches) => {
        const printContent = `
            <html>
                <head>
                    <title>Dispatch Summary - ${order.orderNumber}</title>
                    <style>
                        @page { size: A4; margin: 15mm; }
                        body { font-family: 'Segoe UI', sans-serif; font-size: 11px; line-height: 1.4; color: #333; }
                        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
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
                    <div class="header">
                        <h1>${billingSettings?.companyName || 'INVENTORY SYSTEM'}</h1>
                        <p>${billingSettings?.address || ''}</p>
                        <p>Phone: ${billingSettings?.phone1 || ''}</p>
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
                            ${dispatches.length > 0 ? dispatches.map(d => `
                                <tr>
                                    <td>${new Date(d.createdAt).toLocaleDateString()}</td>
                                    <td>${d.vehicleNumber || 'N/A'}</td>
                                    <td>
                                        ${d.items.map(i => `<div>- ${i.item.name}</div>`).join('')}
                                    </td>
                                    <td>
                                        ${d.items.map(i => `<div>${i.quantity} Units</div>`).join('')}
                                    </td>
                                </tr>
                            `).join('') : '<tr><td colspan="4" style="text-align:center">No dispatches recorded yet</td></tr>'}
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
                                const totalDisp = dispatches.reduce((sum, d) => {
                                    const match = d.items.find(di => String(di.item._id || di.item) === String(oiId));
                                    return sum + (match ? match.quantity : 0);
                                }, 0);
                                return `
                                    <tr>
                                        <td>${oi.name}</td>
                                        <td>${targetedStockLimit} ${oi.stockUnit || (oi.sqFtPerPc > 0 ? 'Boxes' : 'Units')}</td>
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
            setOrderDetails({
                ...order,
                dispatches: res.data?.data || []
            });
            setIsDetailsModalOpen(true);
        } catch (error) {
            toast.error('Failed to fetch dispatch details');
        }
    };

    const handleSubmitDispatch = async (e) => {
        e.preventDefault();
        const selectedItems = dispatchData.items.filter(i => i.selected && i.quantity > 0);
        
        if (selectedItems.length === 0) {
            return toast.error('Please select at least one item to dispatch');
        }

        try {
            await api.post('/dispatches', {
                order: selectedOrder._id,
                vehicleNumber: dispatchData.vehicleNumber,
                driverPhone: dispatchData.driverPhone,
                notes: dispatchData.notes,
                items: selectedItems.map(i => ({
                    item: i.item,
                    quantity: i.quantity
                }))
            });

            toast.success('Dispatch recorded successfully');
            setIsDispatchModalOpen(false);
            fetchPendingOrders();
            fetchDispatchHistory();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error recording dispatch');
        }
    };

    return (
        <div className="space-y-8 pb-24 lg:pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 py-4">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Dispatch Management</h1>
                    <p className="text-sm text-gray-500 mt-1">Pending shipments and delivery loading</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`py-4 px-6 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
                        activeTab === 'pending'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    📦 Pending Shipments ({orders.length})
                </button>
                <button
                    onClick={() => {
                        setActiveTab('history');
                        fetchDispatchHistory();
                    }}
                    className={`py-4 px-6 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
                        activeTab === 'history'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    📜 Dispatch Logs / Records ({dispatchHistory.length})
                </button>
            </div>

            {activeTab === 'pending' ? (
                loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {orders.length > 0 ? (
                            orders.map((order) => (
                                <div key={order._id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:border-gray-300 transition-colors flex flex-col group">
                                    <div className="p-6 border-b border-gray-100 flex justify-between items-start">
                                        <div>
                                            <p className="text-xs font-medium text-indigo-600 uppercase tracking-wider mb-1">Order</p>
                                            <h3 className="text-lg font-semibold text-gray-900">{order.orderNumber}</h3>
                                        </div>
                                        <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${order.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                            {order.status.replace('_', ' ')}
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
                                        
                                        <div className="space-y-3 mb-8 flex-1">
                                            <p className="text-xs text-gray-500 font-medium">Pending Items</p>
                                            <div className="space-y-2">
                                                {order.items.slice(0, 3).map((item, idx) => (
                                                    <div key={idx} className="flex justify-between items-center text-sm">
                                                        <span className="text-gray-700 truncate pr-4">{item.name}</span>
                                                        <span className="font-medium text-gray-900">x{item.quantity}</span>
                                                    </div>
                                                ))}
                                                {order.items.length > 3 && <p className="text-xs text-indigo-600 font-medium mt-2">+{order.items.length - 3} more items</p>}
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
                                                onClick={() => handleOpenDispatch(order)}
                                                className="col-span-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 font-medium text-sm transition-colors flex items-center justify-center gap-2"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                                                Dispatch
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full py-20 px-6 bg-white rounded-2xl border border-gray-200 text-center flex flex-col items-center justify-center">
                                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 mb-4 border border-gray-100">
                                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                                </div>
                                <h3 className="text-lg font-medium text-gray-900">No Pending Dispatches</h3>
                                <p className="text-sm text-gray-500 mt-1 max-w-sm">When you accept quotations, they will appear here ready to be shipped.</p>
                            </div>
                        )}
                    </div>
                )
            ) : (
                /* Dispatch Logs/History Tab */
                <div className="space-y-6">
                    {/* Search & Filter */}
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
                            {dispatchHistory.filter(dh => {
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
                                dispatchHistory.filter(dh => {
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
                                                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">DISPATCH SLIP</span>
                                                <h3 className="text-base font-black text-gray-900 mt-0.5">{dh.dispatchNumber}</h3>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xs text-gray-400 font-bold block">{new Date(dh.createdAt).toLocaleDateString()}</span>
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
                                            <div>
                                                <span className="text-gray-400 font-medium block uppercase text-[9px] tracking-wider">Dispatched By</span>
                                                <span className="font-bold text-gray-900 block mt-0.5 truncate">
                                                    {dh.createdBy?.name || 'System'}
                                                </span>
                                            </div>
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
                                                                <td className="px-3 py-2 text-right font-bold text-indigo-600 bg-indigo-50/20">
                                                                    {di.quantity}
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

            {isDispatchModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-0 sm:p-6">
                    <div className="bg-white sm:rounded-2xl shadow-xl w-full h-full sm:h-auto sm:max-h-[90vh] max-w-3xl flex flex-col animate-[fadeIn_0.15s_ease-out]">
                        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-white sm:rounded-t-2xl z-10 shrink-0">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">New Dispatch Entry</h2>
                                <p className="text-xs text-gray-500 mt-1">{selectedOrder?.orderNumber} • {selectedOrder?.customer?.name}</p>
                            </div>
                            <button onClick={() => setIsDispatchModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-2 -mr-2">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmitDispatch} className="flex-1 overflow-y-auto p-6 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Vehicle Number <span className="text-red-500">*</span></label>
                                    <input required type="text" value={dispatchData.vehicleNumber} onChange={(e) => setDispatchData({ ...dispatchData, vehicleNumber: e.target.value.toUpperCase() })} placeholder="e.g. TN 01 AB 1234" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-gray-900 uppercase sm:text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Driver Phone</label>
                                    <input type="tel" value={dispatchData.driverPhone} onChange={(e) => setDispatchData({ ...dispatchData, driverPhone: e.target.value })} placeholder="10-digit number" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-gray-900 sm:text-sm" />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-4">
                                    <h3 className="text-sm font-semibold text-gray-900">Select Items</h3>
                                    <span className="text-xs text-gray-500">{dispatchData.items.filter(i => i.selected).length} selected</span>
                                </div>
                                
                                <div className="space-y-3">
                                    {dispatchData.items.map((item, index) => (
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
                                                        <span className="text-gray-500">Ordered: {item.orderedQuantity}</span>
                                                        <span className="text-emerald-600 font-medium">Done: {item.previouslyDispatched}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="sm:w-32 flex flex-col justify-center" onClick={e => e.stopPropagation()}>
                                                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 flex justify-between">
                                                    <span>Load Qty</span>
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
                                                <div className="text-[10px] text-gray-400 mt-1 text-right">Max: {item.pendingQuantity} {item.stockUnit}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1.5">Notes</label>
                                <textarea rows="2" value={dispatchData.notes} onChange={(e) => setDispatchData({ ...dispatchData, notes: e.target.value })} placeholder="Delivery instructions (optional)" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"></textarea>
                            </div>
                        </form>
                        
                        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex flex-col-reverse sm:flex-row justify-end gap-3 sm:rounded-b-2xl shrink-0">
                            <button type="button" onClick={() => setIsDispatchModalOpen(false)} className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm">Cancel</button>
                            <button type="submit" onClick={handleSubmitDispatch} className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors text-sm flex items-center justify-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                Confirm Dispatch
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                                            const totalDispatched = orderDetails.dispatches.reduce((sum, d) => {
                                                const dItem = d.items.find(di => String(di.item._id || di.item) === String(item.item._id || item.item));
                                                return sum + (dItem ? dItem.quantity : 0);
                                            }, 0);
                                            const pending = item.quantity - totalDispatched;
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
                                                        <span className="text-xs text-gray-500">
                                                            {new Date(dispatch.dispatchDate).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    <div className="p-4">
                                                        <div className="flex items-center gap-3 mb-4">
                                                            <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
                                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] text-gray-500 uppercase">Vehicle</p>
                                                                <p className="font-medium text-gray-900 text-sm">{dispatch.vehicleNumber}</p>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="space-y-2 border-t border-gray-100 pt-3">
                                                            {dispatch.items.map((di, didx) => (
                                                                <div key={didx} className="flex justify-between items-center text-sm">
                                                                    <span className="text-gray-600 truncate pr-4">
                                                                        {di.item?.name || 'Item'}
                                                                    </span>
                                                                    <span className="font-medium text-gray-900 bg-gray-50 px-2 py-0.5 rounded">{di.quantity}</span>
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
