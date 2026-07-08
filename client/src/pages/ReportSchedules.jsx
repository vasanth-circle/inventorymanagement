import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL || '';

export default function ReportSchedules() {
    const [schedules, setSchedules] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ name: '', reportType: 'daily_stock', frequency: 'daily', time: '09:00', recipients: '' });

    const fetchData = useCallback(async () => {
        try {
            const res = await axios.get(`${API}/api/workflows/schedules`);
            setSchedules(res.data?.data || res.data || []);
        } catch (e) {
            toast.error('Failed to load schedules');
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API}/api/workflows/schedules`, {
                ...form,
                recipients: form.recipients.split(',').map(s => s.trim())
            });
            toast.success('Schedule created');
            setShowModal(false);
            fetchData();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to create schedule');
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Scheduled Reports</h1>
                <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700">+ New Schedule</button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-4">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">Report Type</th>
                            <th className="px-4 py-3">Frequency</th>
                            <th className="px-4 py-3">Time</th>
                            <th className="px-4 py-3">Recipients</th>
                        </tr>
                    </thead>
                    <tbody>
                        {schedules.map(s => (
                            <tr key={s._id} className="border-b">
                                <td className="px-4 py-3 font-semibold">{s.name}</td>
                                <td className="px-4 py-3">{s.reportType}</td>
                                <td className="px-4 py-3 capitalize">{s.frequency}</td>
                                <td className="px-4 py-3">{s.time}</td>
                                <td className="px-4 py-3">{s.recipients?.join(', ')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-lg">
                        <h2 className="text-xl font-bold mb-4">Create Schedule</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <input required placeholder="Schedule Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full border p-2 rounded" />
                            <select value={form.reportType} onChange={e => setForm({...form, reportType: e.target.value})} className="w-full border p-2 rounded">
                                <option value="daily_stock">Daily Stock Summary</option>
                                <option value="overdue_payments">Overdue Payments</option>
                                <option value="low_stock">Low Stock Alerts</option>
                            </select>
                            <div className="flex gap-4">
                                <select value={form.frequency} onChange={e => setForm({...form, frequency: e.target.value})} className="w-full border p-2 rounded">
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                </select>
                                <input type="time" required value={form.time} onChange={e => setForm({...form, time: e.target.value})} className="w-full border p-2 rounded" />
                            </div>
                            <input required placeholder="Comma separated emails" value={form.recipients} onChange={e => setForm({...form, recipients: e.target.value})} className="w-full border p-2 rounded" />
                            <div className="flex justify-end gap-2 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
