import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL || '';

export default function BOM() {
    const [boms, setBoms] = useState([]);
    const [items, setItems] = useState([]);
    const [showModal, setShowModal] = useState(false);
    
    const [form, setForm] = useState({
        name: '',
        finishedGood: '',
        productionCost: '',
        rawMaterials: []
    });

    const fetchData = useCallback(async () => {
        try {
            const [bomRes, itemRes] = await Promise.all([
                axios.get(`${API}/api/phase3/boms`, { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } }),
                axios.get('/api/items', { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } })
            ]);
            setBoms(bomRes.data?.data || []);
            setItems(itemRes.data?.data || []);
        } catch (e) {
            toast.error('Failed to load BOMs');
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API}/api/phase3/boms`, form, { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } });
            toast.success('Bill of Materials created');
            setShowModal(false);
            fetchData();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Creation failed');
        }
    };

    const addMaterial = () => {
        setForm(p => ({ ...p, rawMaterials: [...p.rawMaterials, { item: '', quantity: 1, scrapPercentage: 0 }] }));
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Bill of Materials (BOM)</h1>
                    <p className="text-gray-500 text-sm mt-1">Define assembly recipes for finished goods</p>
                </div>
                <button onClick={() => {
                    setForm({ name: '', finishedGood: '', productionCost: '', rawMaterials: [] });
                    setShowModal(true);
                }} className="bg-orange-600 text-white px-5 py-2.5 rounded-lg hover:bg-orange-700">+ Create BOM</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {boms.map(bom => (
                    <div key={bom._id} className="bg-white rounded-xl shadow-sm border p-5">
                        <div className="border-b pb-3 mb-3">
                            <h2 className="font-bold text-lg text-gray-800">{bom.name}</h2>
                            <p className="text-sm text-gray-600">Product: <span className="font-semibold text-orange-600">{bom.finishedGood?.name}</span></p>
                        </div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Raw Materials Required:</h4>
                        <ul className="space-y-1 mb-4">
                            {bom.rawMaterials.map((rm, i) => (
                                <li key={i} className="text-sm text-gray-700 flex justify-between">
                                    <span>{rm.quantity}x {rm.item?.name}</span>
                                    {rm.scrapPercentage > 0 && <span className="text-xs text-red-500">(+{rm.scrapPercentage}% scrap)</span>}
                                </li>
                            ))}
                        </ul>
                        <div className="text-xs text-gray-500 pt-3 border-t">Est. Labor/Overhead Cost: ₹{bom.productionCost || 0}</div>
                    </div>
                ))}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4">Create Bill of Materials</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium mb-1">BOM Name</label>
                                    <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full border p-2 rounded" placeholder="e.g. Standard Chair Assembly" />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-medium mb-1">Finished Good</label>
                                    <select required value={form.finishedGood} onChange={e => setForm({...form, finishedGood: e.target.value})} className="w-full border p-2 rounded">
                                        <option value="">Select Item to produce</option>
                                        {items.map(i => <option key={i._id} value={i._id}>{i.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-sm font-medium">Raw Materials</label>
                                    <button type="button" onClick={addMaterial} className="text-xs font-bold text-orange-600">+ Add Material</button>
                                </div>
                                {form.rawMaterials.map((rm, idx) => (
                                    <div key={idx} className="flex gap-2 mb-2">
                                        <select required value={rm.item} onChange={e => {
                                            const arr = [...form.rawMaterials]; arr[idx].item = e.target.value; setForm({...form, rawMaterials: arr});
                                        }} className="flex-1 border p-2 rounded text-sm">
                                            <option value="">Select Material</option>
                                            {items.map(i => <option key={i._id} value={i._id}>{i.name}</option>)}
                                        </select>
                                        <input required type="number" min="0.001" step="0.001" value={rm.quantity} onChange={e => {
                                            const arr = [...form.rawMaterials]; arr[idx].quantity = e.target.value; setForm({...form, rawMaterials: arr});
                                        }} className="w-24 border p-2 rounded text-sm" placeholder="Qty" />
                                        <input type="number" min="0" value={rm.scrapPercentage} onChange={e => {
                                            const arr = [...form.rawMaterials]; arr[idx].scrapPercentage = e.target.value; setForm({...form, rawMaterials: arr});
                                        }} className="w-24 border p-2 rounded text-sm" placeholder="Scrap %" />
                                        <button type="button" onClick={() => {
                                            const arr = form.rawMaterials.filter((_, i) => i !== idx); setForm({...form, rawMaterials: arr});
                                        }} className="px-2 text-red-500 text-xl">&times;</button>
                                    </div>
                                ))}
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium mb-1">Additional Cost (Labor/Overhead)</label>
                                <input type="number" value={form.productionCost} onChange={e => setForm({...form, productionCost: e.target.value})} className="w-full border p-2 rounded" placeholder="₹0.00" />
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-orange-600 text-white rounded">Save BOM</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
