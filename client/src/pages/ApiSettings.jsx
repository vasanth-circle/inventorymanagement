import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL || '';

export default function ApiSettings() {
    const [keys, setKeys] = useState([]);
    const [webhooks, setWebhooks] = useState([]);

    const fetchData = useCallback(async () => {
        try {
            const [kRes, wRes] = await Promise.all([
                axios.get(`${API}/api/workflows/api-keys`),
                axios.get(`${API}/api/workflows/webhooks`)
            ]);
            setKeys(kRes.data?.data || []);
            setWebhooks(wRes.data?.data || []);
        } catch (e) {
            toast.error('Failed to load data');
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleCreateKey = async () => {
        const name = prompt('Enter a name for this API key:');
        if (!name) return;
        try {
            const res = await axios.post(`${API}/api/workflows/api-keys`, { name, scopes: ['read', 'write'] });
            alert(`YOUR API KEY: ${res.data.data.rawKey}\n\nSAVE THIS NOW. It will not be shown again.`);
            fetchData();
        } catch (e) {
            toast.error('Failed to create key');
        }
    };

    const handleCreateWebhook = async () => {
        const url = prompt('Enter webhook URL (e.g. https://your-server.com/webhook):');
        if (!url) return;
        try {
            await axios.post(`${API}/api/workflows/webhooks`, { url, events: ['so_created', 'stock_updated'] });
            toast.success('Webhook registered');
            fetchData();
        } catch (e) {
            toast.error('Failed to create webhook');
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold text-gray-800">REST API Keys</h1>
                    <button onClick={handleCreateKey} className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm">+ Generate Key</button>
                </div>
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 border-b"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Prefix</th><th className="px-4 py-3">Status</th></tr></thead>
                        <tbody>
                            {keys.map(k => (
                                <tr key={k._id} className="border-b">
                                    <td className="px-4 py-3 font-semibold">{k.name}</td>
                                    <td className="px-4 py-3 font-mono">{k.prefix}************************</td>
                                    <td className="px-4 py-3 text-green-600">Active</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div>
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold text-gray-800">Webhooks</h1>
                    <button onClick={handleCreateWebhook} className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm">+ Add Webhook</button>
                </div>
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 border-b"><tr><th className="px-4 py-3">URL</th><th className="px-4 py-3">Events</th><th className="px-4 py-3">Failures</th></tr></thead>
                        <tbody>
                            {webhooks.map(w => (
                                <tr key={w._id} className="border-b">
                                    <td className="px-4 py-3 font-semibold text-blue-600">{w.url}</td>
                                    <td className="px-4 py-3">{w.events.join(', ')}</td>
                                    <td className="px-4 py-3">{w.failureCount}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
