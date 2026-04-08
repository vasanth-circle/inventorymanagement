import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const DispatchManagement = () => {
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

    useEffect(() => {
        fetchPendingOrders();
    }, []);

    const fetchPendingOrders = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/sales-orders?status=confirmed', {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            // Also include partially dispatched orders
            const res2 = await axios.get('/api/sales-orders?status=partially_dispatched', {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setOrders([...res.data.data.orders, ...res2.data.data.orders]);
        } catch (error) {
            toast.error('Failed to fetch pending orders');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDispatch = (order) => {
        setSelectedOrder(order);
        // Initialize dispatch items with 0 quantity
        setDispatchData({
            vehicleNumber: '',
            driverPhone: '',
            notes: '',
            items: order.items.map(item => ({
                item: item.item._id || item.item,
                name: item.name,
                brand: item.brand,
                size: item.size,
                orderedQuantity: item.quantity,
                quantity: 0,
                selected: false
            }))
        });
        setIsDispatchModalOpen(true);
    };

    const handleItemToggle = (index) => {
        const newItems = [...dispatchData.items];
        newItems[index].selected = !newItems[index].selected;
        if (newItems[index].selected && newItems[index].quantity === 0) {
            newItems[index].quantity = newItems[index].orderedQuantity;
        }
        setDispatchData({ ...dispatchData, items: newItems });
    };

    const handleQtyChange = (index, value) => {
        const newItems = [...dispatchData.items];
        newItems[index].quantity = parseFloat(value) || 0;
        setDispatchData({ ...dispatchData, items: newItems });
    };

    const handleViewDetails = async (order) => {
        setSelectedOrder(order);
        try {
            const res = await axios.get(`/api/dispatches/order/${order._id}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setOrderDetails({
                ...order,
                dispatches: res.data.data
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
            await axios.post('/api/dispatches', {
                order: selectedOrder._id,
                vehicleNumber: dispatchData.vehicleNumber,
                driverPhone: dispatchData.driverPhone,
                notes: dispatchData.notes,
                items: selectedItems.map(i => ({
                    item: i.item,
                    quantity: i.quantity
                }))
            }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });

            toast.success('Dispatch recorded successfully');
            setIsDispatchModalOpen(false);
            fetchPendingOrders();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error recording dispatch');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Godown Dispatch Management</h1>
                <p className="text-sm text-gray-500 font-medium">Pending Shipments & Deliveries</p>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {orders.length > 0 ? (
                        orders.map((order) => (
                            <div key={order._id} className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow group">
                                <div className="p-5 border-b border-gray-50 bg-gray-50 flex justify-between items-center group-hover:bg-primary-50 transition-colors">
                                    <div>
                                        <span className="text-[10px] font-black text-primary-600 uppercase tracking-widest">Order #</span>
                                        <h3 className="text-lg font-black text-gray-900 leading-tight">{order.orderNumber}</h3>
                                    </div>
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${order.status === 'confirmed' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                        {order.status.replace('_', ' ')}
                                    </span>
                                </div>
                                <div className="p-5 space-y-4">
                                    <div className="flex items-center">
                                        <div className="bg-gray-100 p-2 rounded-lg mr-3 text-lg">👤</div>
                                        <div>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase">Customer</p>
                                            <p className="font-bold text-gray-800">{order.customer?.companyName || order.customer?.name}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] text-gray-400 font-bold uppercase mb-2">Items to dispatch</p>
                                        {order.items.slice(0, 3).map((item, idx) => (
                                            <div key={idx} className="flex justify-between text-xs font-medium text-gray-600 border-l-2 border-primary-300 pl-2">
                                                <span>{item.name}</span>
                                                <span className="font-bold">x{item.quantity}</span>
                                            </div>
                                        ))}
                                        {order.items.length > 3 && <p className="text-[10px] text-gray-400 italic">+{order.items.length - 3} more items...</p>}
                                    </div>
                                    <div className="flex gap-2 mt-4">
                                        <button 
                                            onClick={() => handleViewDetails(order)}
                                            className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all"
                                        >
                                            👁️ View Details
                                        </button>
                                        <button 
                                            onClick={() => handleOpenDispatch(order)}
                                            className="flex-[2] bg-primary-600 text-white py-3 rounded-xl font-black text-sm hover:bg-primary-700 shadow-md shadow-primary-200 transition-all active:scale-95"
                                        >
                                            🚚 Record Dispatch
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full bg-white p-12 rounded-2xl border-2 border-dashed text-center">
                            <p className="text-gray-400 font-bold">No orders ready for dispatch</p>
                            <p className="text-xs text-gray-400">Accept quotations to see them here.</p>
                        </div>
                    )}
                </div>
            )}

            {isDispatchModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 overflow-y-auto backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl my-8">
                        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-3xl">
                            <div>
                                <h2 className="text-2xl font-black text-gray-800">New Dispatch Entry</h2>
                                <p className="text-xs text-gray-500 font-medium font-bold">Order: {selectedOrder?.orderNumber} | Customer: {selectedOrder?.customer?.name}</p>
                            </div>
                            <button onClick={() => setIsDispatchModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-3xl">&times;</button>
                        </div>
                        <form onSubmit={handleSubmitDispatch} className="p-8 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-primary-50 p-6 rounded-2xl border border-primary-100">
                                <div>
                                    <label className="block text-xs font-black text-primary-700 uppercase mb-2">Vehicle Number *</label>
                                    <input required type="text" value={dispatchData.vehicleNumber} onChange={(e) => setDispatchData({ ...dispatchData, vehicleNumber: e.target.value })} placeholder="e.g. TN 01 AB 1234" className="w-full px-4 py-3 border border-primary-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 font-bold text-gray-800" />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-primary-700 uppercase mb-2">Driver Phone Number</label>
                                    <input type="text" value={dispatchData.driverPhone} onChange={(e) => setDispatchData({ ...dispatchData, driverPhone: e.target.value })} placeholder="10-digit mobile number" className="w-full px-4 py-3 border border-primary-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 font-bold text-gray-800" />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-lg font-black text-gray-800">Select Items & Quantities</h3>
                                <div className="space-y-3">
                                    {dispatchData.items.map((item, index) => (
                                        <div key={index} className={`flex items-center p-4 rounded-2xl border-2 transition-all ${item.selected ? 'border-primary-500 bg-primary-50/50' : 'border-gray-100 hover:border-gray-200'}`}>
                                            <div className="mr-4">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                                    checked={item.selected}
                                                    onChange={() => handleItemToggle(index)}
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-black text-gray-800">{item.name}</p>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase">{item.brand} | {item.size}</p>
                                            </div>
                                            <div className="text-right mr-6">
                                                <p className="text-[10px] text-gray-400 font-bold uppercase">Ordered</p>
                                                <p className="font-bold text-gray-600">{item.orderedQuantity}</p>
                                            </div>
                                            <div className="w-32">
                                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Dispatching Now</label>
                                                <input 
                                                    type="number" 
                                                    step="0.01"
                                                    disabled={!item.selected}
                                                    value={item.quantity} 
                                                    onChange={(e) => handleQtyChange(index, e.target.value)}
                                                    className={`w-full px-3 py-2 border rounded-xl outline-none text-center font-black ${item.selected ? 'border-primary-400 text-primary-700' : 'bg-gray-50 border-gray-100'}`}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Dispatch Notes (e.g. Delivery location details)</label>
                                <textarea rows="3" value={dispatchData.notes} onChange={(e) => setDispatchData({ ...dispatchData, notes: e.target.value })} className="w-full px-4 py-3 border rounded-2xl outline-none focus:ring-2 focus:ring-primary-400"></textarea>
                            </div>

                            <div className="flex justify-end gap-4 pt-6 border-t font-bold">
                                <button type="button" onClick={() => setIsDispatchModalOpen(false)} className="px-8 py-3 text-gray-500 border border-gray-200 rounded-2xl hover:bg-gray-50 transition-colors">Cancel</button>
                                <button type="submit" className="px-10 py-3 bg-primary-600 text-white rounded-2xl hover:bg-primary-700 shadow-lg shadow-primary-200 transition-all active:scale-95">
                                    📦 Confirm & Dispatch Load
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {isDetailsModalOpen && orderDetails && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 overflow-y-auto backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl my-8">
                        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-3xl">
                            <div>
                                <h2 className="text-2xl font-black text-gray-800">Order & Dispatch Details</h2>
                                <p className="text-xs text-gray-500 font-bold">Order # {orderDetails.orderNumber} | {orderDetails.customer?.name}</p>
                            </div>
                            <button onClick={() => setIsDetailsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-3xl">&times;</button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <h3 className="text-lg font-black text-gray-800 border-b pb-2">📦 Items in Order</h3>
                                    <div className="space-y-3">
                                        {orderDetails.items.map((item, idx) => {
                                            const totalDispatched = orderDetails.dispatches.reduce((sum, d) => {
                                                const dItem = d.items.find(di => (di.item._id || di.item) === (item.item._id || item.item));
                                                return sum + (dItem ? dItem.quantity : 0);
                                            }, 0);
                                            const pending = item.quantity - totalDispatched;
                                            
                                            return (
                                                <div key={idx} className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <p className="font-bold text-gray-800">{item.name}</p>
                                                            <p className="text-[10px] text-gray-400 font-black uppercase">{item.brand} | {item.size}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[10px] text-gray-400 font-black uppercase">Order Total</p>
                                                            <p className="font-black text-primary-600">{item.quantity} Boxes</p>
                                                        </div>
                                                    </div>
                                                    <div className="mt-2 flex gap-4 text-xs font-bold">
                                                        <div className="text-green-600">Dispatched: {totalDispatched}</div>
                                                        <div className={pending > 0 ? "text-orange-600" : "text-gray-400"}>Pending: {pending}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h3 className="text-lg font-black text-gray-800 border-b pb-2">🚚 Dispatch History</h3>
                                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                                        {orderDetails.dispatches.length > 0 ? (
                                            orderDetails.dispatches.map((dispatch, idx) => (
                                                <div key={idx} className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider">{dispatch.dispatchNumber}</span>
                                                        <span className="text-[10px] text-gray-400 font-bold">{new Date(dispatch.dispatchDate).toLocaleDateString()}</span>
                                                    </div>
                                                    <p className="text-xs font-bold text-gray-800">Vehicle: <span className="text-blue-700">{dispatch.vehicleNumber}</span></p>
                                                    <div className="mt-2 space-y-1">
                                                        {dispatch.items.map((di, didx) => (
                                                            <div key={didx} className="flex justify-between text-[10px] font-bold text-gray-600 border-l-2 border-blue-200 pl-2">
                                                                <span>{di.item?.name || 'Item'}</span>
                                                                <span>{di.quantity} Boxes</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-center text-gray-400 py-8 italic">No dispatches recorded yet</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end pt-4">
                                <button onClick={() => setIsDetailsModalOpen(false)} className="px-10 py-3 bg-gray-800 text-white rounded-2xl font-bold hover:bg-gray-900 transition-all">Close Details</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DispatchManagement;
