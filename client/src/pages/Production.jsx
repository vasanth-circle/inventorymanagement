import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL || '';

export default function Production() {
    const [orders, setOrders] = useState([]);
    const [boms, setBoms] = useState([]);
    const [showModal, setShowModal] = useState(false);
    
    const [form, setForm] = useState({ bom: '', quantityToProduce: 1 });

    const fetchData = useCallback(async () => {
        try {
            const [poRes, bomRes] = await Promise.all([
                axios.get(`${API}/api/phase3/production-orders`, { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } }),
                axios.get(`${API}/api/phase3/boms`, { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } })
            ]);
            setOrders(poRes.data?.data || []);
            setBoms(bomRes.data?.data || []);
        } catch (e) {
            toast.error('Failed to load data');
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API}/api/phase3/production-orders`, form, { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } });
            toast.success('Production Order created');
            setShowModal(false);
            fetchData();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Creation failed');
        }
    };

    const handleComplete = async (id) => {
        if (!confirm('Mark as complete? This will deduct raw materials and add finished goods to stock.')) return;
        toast.loading('Processing...', { id: 'prod' });
        try {
            await axios.post(`${API}/api/phase3/production-orders/${id}/complete`, {}, { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } });
            toast.success('Production completed successfully', { id: 'prod' });
            fetchData();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to complete', { id: 'prod' });
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Production Orders</h1>
                    <p className="text-gray-500 text-sm mt-1">Execute manufacturing and assembly processes</p>
                </div>
                <button onClick={() => { setForm({ bom: '', quantityToProduce: 1 }); setShowModal(true); }} className="bg-gray-800 text-white px-5 py-2.5 rounded-lg hover:bg-gray-900">+ New Order</button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="p-4">Order #</th>
                            <th className="p-4">BOM Reference</th>
                            <th className="p-4">Finished Good</th>
                            <th className="p-4">Target Qty</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {orders.map(o => (
                            <tr key={o._id} className="hover:bg-gray-50">
                                <td className="p-4 font-bold text-gray-700">{o.orderNumber}</td>
                                <td className="p-4">{o.bom?.name}</td>
                                <td className="p-4 font-semibold text-orange-600">{o.bom?.finishedGood?.name}</td>
                                <td className="p-4">{o.quantityToProduce}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${o.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {o.status.replace('_', ' ')}
                                    </span>
                                </td>
                                <td className="p-4 text-right">
                                    {o.status !== 'completed' && (
                                        <button onClick={() => handleComplete(o._id)} className="text-green-600 hover:text-green-800 font-bold text-sm bg-green-50 px-3 py-1.5 rounded">Complete Run</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {orders.length === 0 && <div className="p-10 text-center text-gray-500">No active production orders.</div>}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">New Production Order</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Select BOM</label>
                                <select required value={form.bom} onChange={e => setForm({...form, bom: e.target.value})} className="w-full border p-2 rounded">
                                    <option value="">Select Recipe</option>
                                    {boms.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Quantity to Produce</label>
                                <input required type="number" min="1" value={form.quantityToProduce} onChange={e => setForm({...form, quantityToProduce: e.target.value})} className="w-full border p-2 rounded" />
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-gray-800 text-white rounded">Create Order</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
