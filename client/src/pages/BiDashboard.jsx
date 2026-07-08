import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Line, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement);

const API = import.meta.env.VITE_API_URL || '';

export default function BiDashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        try {
            const res = await axios.get(`${API}/api/phase3/dashboard`, { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } });
            setData(res.data.data);
        } catch (e) {
            console.error('Failed to load dashboard', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    if (loading) return <div className="p-10 text-center">Loading Analytics Engine...</div>;
    if (!data) return <div className="p-10 text-center">No data available</div>;

    const lineChartData = {
        labels: data.salesTrend.map(d => d._id),
        datasets: [{
            label: 'Daily Revenue (₹)',
            data: data.salesTrend.map(d => d.revenue),
            borderColor: '#4f46e5',
            backgroundColor: 'rgba(79, 70, 229, 0.1)',
            fill: true,
            tension: 0.4
        }]
    };

    const doughnutData = {
        labels: data.revenueByCategory.map(d => d._id),
        datasets: [{
            data: data.revenueByCategory.map(d => d.value),
            backgroundColor: ['#f97316', '#8b5cf6', '#06b6d4', '#10b981', '#f43f5e', '#facc15']
        }]
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-800">Business Intelligence</h1>
                <p className="text-gray-500 text-sm mt-1">Drill-down analytics and revenue performance</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border">
                    <h2 className="text-lg font-bold mb-4">30-Day Revenue Trend</h2>
                    <div className="h-[300px] w-full">
                        <Line data={lineChartData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border">
                    <h2 className="text-lg font-bold mb-4">Revenue by Category</h2>
                    <div className="h-[300px] w-full flex items-center justify-center">
                        <Doughnut data={doughnutData} options={{ maintainAspectRatio: false }} />
                    </div>
                </div>
            </div>
        </div>
    );
}
