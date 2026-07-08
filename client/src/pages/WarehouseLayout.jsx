import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL || '';

export default function WarehouseLayout() {
    const [locations, setLocations] = useState([]);
    const [bins, setBins] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ location: '', rack: '', bin: '', description: '' });

    const fetchData = useCallback(async () => {
        try {
            const [locRes, binRes] = await Promise.all([
                axios.get('/api/locations', { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } }),
                axios.get(`${API}/api/phase3/bins`, { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } })
            ]);
            setLocations(locRes.data?.data || []);
            setBins(binRes.data?.data || []);
        } catch (e) {
            toast.error('Failed to load data');
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API}/api/phase3/bins`, form, { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } });
            toast.success('Bin created');
            setShowModal(false);
            setForm({ location: form.location, rack: '', bin: '', description: '' });
            fetchData();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to create bin');
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Advanced Warehouse Layout</h1>
                    <p className="text-gray-500 text-sm mt-1">Manage physical racks and bins within your locations</p>
                </div>
                <button onClick={() => setShowModal(true)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg hover:bg-indigo-700">+ Add Bin</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {locations.map(loc => {
                    const locBins = bins.filter(b => b.location?._id === loc._id);
                    if(locBins.length === 0) return null;
                    
                    // Group by rack
                    const racks = locBins.reduce((acc, bin) => {
                        if (!acc[bin.rack]) acc[bin.rack] = [];
                        acc[bin.rack].push(bin);
                        return acc;
                    }, {});

                    return (
                        <div key={loc._id} className="bg-white rounded-xl shadow-sm border p-5">
                            <h2 className="font-bold text-lg border-b pb-3 mb-4">{loc.name}</h2>
                            {Object.entries(racks).map(([rack, rackBins]) => (
                                <div key={rack} className="mb-4">
                                    <h3 className="text-sm font-semibold text-gray-600 mb-2">Rack: {rack}</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {rackBins.map(b => (
                                            <div key={b._id} className="px-3 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-800 rounded text-sm font-medium" title={b.description}>
                                                Bin: {b.bin}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    );
                })}
                {bins.length === 0 && <div className="col-span-full py-10 text-center text-gray-500 bg-white border rounded-xl">No bins configured. Click Add Bin to start.</div>}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">Add Rack/Bin</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Warehouse/Location</label>
                                <select required value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="w-full border p-2 rounded">
                                    <option value="">Select Location</option>
                                    {locations.map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Rack Identifier (e.g. A1, Zone-B)</label>
                                <input required value={form.rack} onChange={e => setForm({...form, rack: e.target.value})} className="w-full border p-2 rounded" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Bin Identifier (e.g. 01, Top-Shelf)</label>
                                <input required value={form.bin} onChange={e => setForm({...form, bin: e.target.value})} className="w-full border p-2 rounded" />
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded">Save Bin</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
