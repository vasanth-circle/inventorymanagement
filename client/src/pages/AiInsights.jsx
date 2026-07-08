import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || '';

export default function AiInsights() {
    const [insights, setInsights] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        try {
            const res = await axios.get(`${API}/api/phase3/insights`, { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } });
            setInsights(res.data.data || []);
        } catch (e) {
            console.error('Failed to load insights', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const getIcon = (type) => {
        if (type === 'critical') return '⚠️';
        if (type === 'trending') return '🔥';
        if (type === 'dead_stock') return '🧊';
        return '💡';
    };

    const getColor = (type) => {
        if (type === 'critical') return 'border-red-200 bg-red-50 text-red-800';
        if (type === 'trending') return 'border-orange-200 bg-orange-50 text-orange-800';
        if (type === 'dead_stock') return 'border-blue-200 bg-blue-50 text-blue-800';
        return 'border-gray-200 bg-gray-50';
    };

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-4 mb-8 pb-6 border-b">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center text-3xl shadow-lg">🧠</div>
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">AI Demand Insights</h1>
                    <p className="text-gray-500 mt-1 text-lg">Smart forecasting based on 30-day historical transaction velocity</p>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20 animate-pulse">
                    <div className="text-4xl mb-4">🤖</div>
                    <div className="text-xl text-gray-500">Analyzing historical data patterns...</div>
                </div>
            ) : insights.length === 0 ? (
                <div className="bg-white p-10 rounded-xl text-center border shadow-sm">
                    <div className="text-4xl mb-3">✅</div>
                    <h3 className="text-xl font-bold text-gray-800">Inventory is Healthy</h3>
                    <p className="text-gray-500">No critical stockouts or dead stock anomalies detected.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {insights.map((insight, idx) => (
                        <div key={idx} className={`p-5 rounded-xl border-2 flex items-start gap-4 ${getColor(insight.type)}`}>
                            <div className="text-3xl bg-white/50 w-12 h-12 rounded-full flex items-center justify-center shadow-sm">
                                {getIcon(insight.type)}
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-lg">{insight.itemName}</h3>
                                <p className="mt-1 font-medium">{insight.message}</p>
                                {insight.suggestedAction && (
                                    <div className="mt-3 bg-white/60 p-3 rounded-lg text-sm font-semibold inline-block">
                                        👉 Action: {insight.suggestedAction}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
