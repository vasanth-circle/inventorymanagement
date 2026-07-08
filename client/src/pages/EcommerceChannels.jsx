import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL || '';

export default function EcommerceChannels() {
    const [channels, setChannels] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ platform: 'shopify', shopDomain: '', accessToken: '' });

    const fetchData = useCallback(async () => {
        try {
            const res = await axios.get(`${API}/api/ecommerce/channels`, { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } });
            setChannels(res.data?.data || []);
        } catch (e) {
            toast.error('Failed to load channels');
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API}/api/ecommerce/channels`, form, { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } });
            toast.success('Channel connected');
            setShowModal(false);
            fetchData();
        } catch (e) {
            toast.error('Failed to connect');
        }
    };

    const handleSync = async (channelId, action) => {
        toast.loading('Syncing in progress...', { id: 'sync' });
        try {
            const res = await axios.post(`${API}/api/ecommerce/sync`, { channelId, action }, { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } });
            toast.success(`Sync successful: ${res.data.data.syncedItems || res.data.data.newOrders || 0} items updated`, { id: 'sync' });
            fetchData();
        } catch (e) {
            toast.error('Sync failed', { id: 'sync' });
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">E-Commerce Sync</h1>
                    <p className="text-gray-500 text-sm mt-1">Connect your online stores to sync inventory and orders</p>
                </div>
                <button onClick={() => setShowModal(true)} className="bg-green-600 text-white px-5 py-2.5 rounded-lg hover:bg-green-700">+ Connect Store</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {channels.map(ch => (
                    <div key={ch._id} className="bg-white rounded-xl shadow-sm border p-6">
                        <div className="flex justify-between items-center mb-4 border-b pb-4">
                            <h2 className="font-bold text-lg capitalize">{ch.platform}</h2>
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-semibold">Connected</span>
                        </div>
                        <div className="text-sm text-gray-600 mb-6">
                            <p><strong>Domain:</strong> {ch.shopDomain}</p>
                            <p><strong>Last Sync:</strong> {ch.lastSyncAt ? new Date(ch.lastSyncAt).toLocaleString() : 'Never'}</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => handleSync(ch._id, 'push_inventory')} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 rounded font-medium text-sm">Push Stock</button>
                            <button onClick={() => handleSync(ch._id, 'pull_orders')} className="flex-1 bg-gray-800 hover:bg-gray-900 text-white py-2 rounded font-medium text-sm">Pull Orders</button>
                        </div>
                    </div>
                ))}
                {channels.length === 0 && <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-xl border">No stores connected yet.</div>}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">Connect Store</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <select value={form.platform} onChange={e => setForm({...form, platform: e.target.value})} className="w-full border p-2 rounded">
                                <option value="shopify">Shopify</option>
                                <option value="woocommerce">WooCommerce</option>
                            </select>
                            <input required placeholder="Shop Domain (e.g. my-store.myshopify.com)" value={form.shopDomain} onChange={e => setForm({...form, shopDomain: e.target.value})} className="w-full border p-2 rounded" />
                            <input required type="password" placeholder="Access Token" value={form.accessToken} onChange={e => setForm({...form, accessToken: e.target.value})} className="w-full border p-2 rounded" />
                            <div className="flex justify-end gap-2 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">Connect</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
