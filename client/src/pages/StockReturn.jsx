import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';

const StockReturn = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [vendors, setVendors] = useState([]);
    
    const [formData, setFormData] = useState({
        item: '',
        returnType: 'customer',
        quantity: '',
        referenceOrder: '',
        customer: '',
        vendor: '',
        reason: '',
        notes: '',
        rate: '',
    });
    const [pastBills, setPastBills] = useState([]);
    const [selectedBill, setSelectedBill] = useState(null);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const [itemsRes, custRes, vendRes] = await Promise.all([
                api.get('/items?limit=5000'),
                api.get('/customers?limit=5000'),
                api.get('/vendors?limit=1000')
            ]);
            
            // Items API doesn't use the standardResponse wrapper (res.json directly)
            setItems(itemsRes.data.items || itemsRes.data.data?.items || []);
            // Customers and Vendors use standardResponse (res.json({ success, data }))
            setCustomers(custRes.data.data?.customers || []);
            setVendors(vendRes.data.data?.vendors || []);
        } catch (error) {
            console.error('Failed to load initial data:', error);
            toast.error('Failed to load initial data');
        }
    };

    const handleChange = async (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === 'customer' && value) {
            try {
                const res = await api.get(`/sales-orders?customer=${value}&limit=5`);
                setPastBills(res.data.data?.orders || []);
            } catch (error) {
                console.error('Failed to fetch past bills:', error);
            }
        }

        if (name === 'item' && formData.returnType === 'customer' && selectedBill) {
            const billItem = selectedBill.items.find(i => i.item?._id === value);
            if (billItem) {
                setFormData(prev => ({ ...prev, rate: billItem.price }));
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.item || !formData.quantity || !formData.returnType) {
            return toast.error('Please fill all required fields');
        }

        setLoading(true);
        try {
            await api.post('/transactions/return', {
                ...formData,
                quantity: parseFloat(formData.quantity)
            });
            toast.success('Return recorded successfully');
            navigate('/inventory');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to record return');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-1 space-y-6 max-w-[1000px] mx-auto">
             {/* Header Section */}
             <div className="flex justify-between items-end pb-2 border-b border-gray-100">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-white shadow-sm border border-gray-100 rounded-lg flex items-center justify-center text-xl">↩️</div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Stock Return Management</h1>
                        <p className="text-xs text-gray-400 font-medium">Record returns from customers or to vendors</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <form onSubmit={handleSubmit} className="divide-y divide-gray-50">
                    {/* Basic Info */}
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Return Type</label>
                            <select
                                name="returnType"
                                value={formData.returnType}
                                onChange={handleChange}
                                className="w-full h-11 px-4 bg-gray-50 border-none rounded-lg text-sm font-bold text-gray-700 focus:ring-2 focus:ring-rose-500 transition-all cursor-pointer"
                            >
                                <option value="customer">Return from Customer (Stock In)</option>
                                <option value="vendor">Return to Vendor (Stock Out)</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Select Item</label>
                            <select
                                name="item"
                                value={formData.item}
                                onChange={handleChange}
                                required
                                className="w-full h-11 px-4 bg-gray-50 border-none rounded-lg text-sm font-bold text-gray-700 focus:ring-2 focus:ring-rose-500 transition-all cursor-pointer"
                            >
                                <option value="">-- Choose Item --</option>
                                {formData.returnType === 'customer' && selectedBill ? (
                                    selectedBill.items.map(i => (
                                        <option key={i.item?._id} value={i.item?._id}>{i.item?.name} (Billed: {i.quantity})</option>
                                    ))
                                ) : (
                                    items.map(i => (
                                        <option key={i._id} value={i._id}>{i.name} ({i.brand} - {i.size})</option>
                                    ))
                                )}
                            </select>
                        </div>
                    </div>

                    {/* Specific Details */}
                    <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6 bg-slate-50/30">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Quantity</label>
                            <input
                                type="number"
                                name="quantity"
                                value={formData.quantity}
                                onChange={handleChange}
                                required
                                min="0.01"
                                step="0.01"
                                placeholder="0.00"
                                className="w-full h-11 px-4 bg-white border border-gray-100 rounded-lg text-sm font-bold text-gray-700 focus:ring-2 focus:ring-rose-500 transition-all"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Rate / Price</label>
                            <input
                                type="number"
                                name="rate"
                                value={formData.rate}
                                onChange={handleChange}
                                required
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                className="w-full h-11 px-4 bg-white border border-gray-100 rounded-lg text-sm font-bold text-gray-700 focus:ring-2 focus:ring-rose-500 transition-all"
                            />
                        </div>

                        {formData.returnType === 'customer' ? (
                            <>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Customer</label>
                                    <select
                                        name="customer"
                                        value={formData.customer}
                                        onChange={handleChange}
                                        className="w-full h-11 px-4 bg-white border border-gray-100 rounded-lg text-sm font-bold text-gray-700 focus:ring-2 focus:ring-rose-500 transition-all"
                                    >
                                        <option value="">-- Select Customer --</option>
                                        {customers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Select Bill</label>
                                    <select
                                        name="selectedBill"
                                        value={selectedBill?._id || ''}
                                        onChange={(e) => {
                                            const bill = pastBills.find(b => b._id === e.target.value);
                                            setSelectedBill(bill);
                                            if (bill) {
                                                setFormData(prev => ({ ...prev, referenceOrder: bill.orderNumber }));
                                            }
                                        }}
                                        className="w-full h-11 px-4 bg-white border border-gray-100 rounded-lg text-sm font-bold text-gray-700 focus:ring-2 focus:ring-rose-500 transition-all"
                                    >
                                        <option value="">-- Select Bill --</option>
                                        {pastBills.map(b => (
                                            <option key={b._id} value={b._id}>{b.orderNumber} ({new Date(b.orderDate).toLocaleDateString()})</option>
                                        ))}
                                    </select>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Vendor</label>
                                <select
                                    name="vendor"
                                    value={formData.vendor}
                                    onChange={handleChange}
                                    className="w-full h-11 px-4 bg-white border border-gray-100 rounded-lg text-sm font-bold text-gray-700 focus:ring-2 focus:ring-rose-500 transition-all"
                                >
                                    <option value="">-- Select Vendor --</option>
                                    {vendors.map(v => <option key={v._id} value={v._id}>{v.name}</option>)}
                                </select>
                        </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Order # / Ref</label>
                            <input
                                type="text"
                                name="referenceOrder"
                                value={formData.referenceOrder}
                                onChange={handleChange}
                                placeholder="Ref Order Number"
                                className="w-full h-11 px-4 bg-white border border-gray-100 rounded-lg text-sm font-bold text-gray-700 focus:ring-2 focus:ring-rose-500 transition-all"
                            />
                        </div>
                    </div>

                    {/* Reasons & Notes */}
                    <div className="p-6 space-y-6">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Return Reason</label>
                            <input
                                type="text"
                                name="reason"
                                value={formData.reason}
                                onChange={handleChange}
                                placeholder="e.g., Wrong Size, Damaged on arrival, Customer Choice"
                                className="w-full h-11 px-4 bg-gray-50 border-none rounded-lg text-sm font-bold text-gray-700 focus:ring-2 focus:ring-rose-500 transition-all"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Internal Notes</label>
                            <textarea
                                name="notes"
                                value={formData.notes}
                                onChange={handleChange}
                                rows="3"
                                placeholder="Any additional internal details..."
                                className="w-full p-4 bg-gray-50 border-none rounded-lg text-sm font-medium text-gray-700 focus:ring-2 focus:ring-rose-500 transition-all"
                            />
                        </div>
                    </div>

                    {/* Action Bar */}
                    <div className="p-6 bg-gray-50 flex items-center justify-end space-x-3">
                        <button
                            type="button"
                            onClick={() => navigate('/inventory')}
                            className="px-6 py-2.5 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-gray-600"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-8 py-2.5 bg-rose-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg hover:shadow-rose-100 disabled:opacity-50"
                        >
                            {loading ? 'Processing...' : 'Confirm Stock Return ↩️'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default StockReturn;
