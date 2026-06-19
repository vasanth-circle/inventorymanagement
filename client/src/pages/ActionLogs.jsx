import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { InventoryContext } from '../context/InventoryContext';

const API_URL = '/api/logs';

const ActionLogs = () => {
    const { billingSettings } = useContext(InventoryContext);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        fetchLogs();
    }, [page, searchTerm]);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${API_URL}?page=${page}&limit=20&entityNumber=${searchTerm}`, {
                headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
            });
            setLogs(res.data.data?.logs || []);
            setTotalPages(res.data.data?.totalPages || 1);
            setLoading(false);
        } catch (error) {
            toast.error('Failed to fetch action logs');
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
        setPage(1);
    };

    const handlePrintReturn = async (log) => {
        try {
            const toastId = toast.loading('Fetching return details...');
            const res = await axios.get(`/api/transactions?_id=${log.entityId}`, {
                headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
            });
            toast.dismiss(toastId);
            if (res.data.transactions && res.data.transactions.length > 0) {
                const tx = res.data.transactions[0];
                import('../utils/printTemplates').then(module => {
                    module.printReturnSlip(tx, billingSettings);
                });
            } else {
                toast.error('Transaction details not found');
            }
        } catch (error) {
            toast.dismiss();
            toast.error('Failed to print return slip');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Action Logs (Audit Trail)</h1>
            </div>

            <div className="flex gap-3 flex-wrap">
                <input
                    type="text"
                    placeholder="Search by Invoice/Quote #..."
                    value={searchTerm}
                    onChange={handleSearch}
                    className="flex-1 min-w-[250px] h-10 px-4 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none shadow-sm"
                />
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-md overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-bottom border-gray-100">
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase">Date & Time</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase">User</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase">Action</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase">Record #</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase">Description</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-10 text-center text-gray-500">
                                        No logs found
                                    </td>
                                </tr>
                            ) : logs.map((log) => (
                                <tr key={log._id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                                        {new Date(log.createdAt).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900">
                                        <div className="font-bold text-gray-800">{log.user?.name || 'Unknown User'}</div>
                                        <div className="text-xs text-gray-500 uppercase">{log.user?.role?.replace('_', ' ')}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-xs font-bold uppercase">
                                            {log.action.replace('_', ' ')}
                                        </span>
                                        {log.action === 'stock_return' && (
                                            <button 
                                                onClick={() => handlePrintReturn(log)}
                                                className="ml-3 px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded"
                                            >
                                                🖨️ Print Slip
                                            </button>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-bold text-gray-700">
                                        {log.entityNumber || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        {log.description}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    
                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                            <span className="text-sm text-gray-600">
                                Page <span className="font-bold">{page}</span> of <span className="font-bold">{totalPages}</span>
                            </span>
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-3 py-1 bg-gray-100 text-gray-600 rounded disabled:opacity-50 hover:bg-gray-200"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="px-3 py-1 bg-gray-100 text-gray-600 rounded disabled:opacity-50 hover:bg-gray-200"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ActionLogs;
