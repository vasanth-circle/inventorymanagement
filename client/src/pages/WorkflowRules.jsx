import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL || '';

export default function WorkflowRules() {
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({
        name: '',
        trigger: 'so_created',
        conditions: [],
        actions: []
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API}/api/workflows/rules`);
            setRules(res.data?.data || res.data || []);
        } catch (e) {
            toast.error('Failed to load rules');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API}/api/workflows/rules`, form);
            toast.success('Rule created');
            setShowModal(false);
            setForm({ name: '', trigger: 'so_created', conditions: [], actions: [] });
            fetchData();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to create rule');
        }
    };

    const addAction = () => {
        setForm(p => ({ ...p, actions: [...p.actions, { type: 'send_email', config: { to: '' } }] }));
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Workflow Automation</h1>
                    <p className="text-gray-500 text-sm mt-1">Automate tasks based on triggers and conditions</p>
                </div>
                <button onClick={() => setShowModal(true)} className="bg-purple-600 text-white px-5 py-2.5 rounded-lg hover:bg-purple-700">+ New Rule</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? <div className="p-10 col-span-full text-center">Loading...</div> :
                 rules.length === 0 ? <div className="p-10 col-span-full text-center bg-white rounded-xl border">No rules configured yet</div> :
                 rules.map(rule => (
                     <div key={rule._id} className="bg-white p-5 rounded-xl border shadow-sm">
                         <div className="flex justify-between items-start mb-3">
                             <h3 className="font-bold text-lg">{rule.name}</h3>
                             <span className={`px-2 py-1 text-xs rounded-full ${rule.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                 {rule.isActive ? 'Active' : 'Disabled'}
                             </span>
                         </div>
                         <div className="text-sm text-gray-600 mb-2"><span className="font-semibold text-purple-600">WHEN</span> {rule.trigger}</div>
                         <div className="text-sm text-gray-600"><span className="font-semibold text-purple-600">THEN</span> {rule.actions.length} action(s)</div>
                         <div className="mt-4 pt-4 border-t text-xs text-gray-400">Run count: {rule.runCount}</div>
                     </div>
                 ))}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-2xl">
                        <h2 className="text-xl font-bold mb-4">Create Workflow Rule</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Rule Name</label>
                                <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full border p-2 rounded" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Trigger (WHEN)</label>
                                <select value={form.trigger} onChange={e => setForm({...form, trigger: e.target.value})} className="w-full border p-2 rounded">
                                    <option value="so_created">Sales Order Created</option>
                                    <option value="stock_below_threshold">Stock Below Threshold</option>
                                    <option value="payment_received">Payment Received</option>
                                </select>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-sm font-medium">Actions (THEN)</label>
                                    <button type="button" onClick={addAction} className="text-xs text-purple-600">+ Add Action</button>
                                </div>
                                {form.actions.map((act, i) => (
                                    <div key={i} className="flex gap-2 mb-2">
                                        <select value={act.type} onChange={e => {
                                            const newActs = [...form.actions];
                                            newActs[i].type = e.target.value;
                                            setForm({...form, actions: newActs});
                                        }} className="border p-2 rounded flex-1">
                                            <option value="send_email">Send Email</option>
                                            <option value="send_webhook">Trigger Webhook</option>
                                            <option value="create_task">Create Task</option>
                                        </select>
                                        <input placeholder="Config (e.g. email address)" value={act.config.to || ''} onChange={e => {
                                            const newActs = [...form.actions];
                                            newActs[i].config.to = e.target.value;
                                            setForm({...form, actions: newActs});
                                        }} className="border p-2 rounded flex-1" />
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded">Create Rule</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
