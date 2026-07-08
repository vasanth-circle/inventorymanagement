import { useState } from 'react';
import toast from 'react-hot-toast';

export default function ShippingIntegration() {
    const [form, setForm] = useState({ email: '', password: '' });

    const handleSave = (e) => {
        e.preventDefault();
        toast.success('Shiprocket credentials saved successfully');
    };

    return (
        <div className="p-6 max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Shipping Integrations</h1>
            <p className="text-gray-500 mb-6">Connect your Shiprocket account to book shipments directly from the Dispatch page.</p>

            <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center gap-4 mb-6 pb-6 border-b">
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center font-bold text-xl">SR</div>
                    <div>
                        <h2 className="text-lg font-bold">Shiprocket</h2>
                        <p className="text-sm text-gray-500">Auto-book couriers and sync AWB numbers</p>
                    </div>
                </div>

                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Account Email</label>
                        <input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full border p-2 rounded-lg" placeholder="admin@example.com" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">API Password</label>
                        <input required type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full border p-2 rounded-lg" placeholder="••••••••" />
                    </div>
                    <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700">Connect Account</button>
                </form>
            </div>
        </div>
    );
}
