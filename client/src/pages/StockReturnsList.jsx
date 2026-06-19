import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { printReturnSlip } from '../utils/printTemplates';
import { InventoryContext } from '../context/InventoryContext';

const API_URL = '/api/transactions';

const StockReturnsList = () => {
    const { billingSettings } = useContext(InventoryContext);
    const [returns, setReturns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    useEffect(() => {
        fetchReturns();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, fromDate, toDate]);

    const fetchReturns = async () => {
        try {
            const res = await axios.get(`${API_URL}?type=return&limit=1000`, {
                headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
            });
            setReturns(res.data.transactions || []);
            setLoading(false);
        } catch (error) {
            toast.error('Failed to fetch returns');
            setLoading(false);
        }
    };

    const handlePrint = (returnTx) => {
        printReturnSlip(returnTx, billingSettings);
    };

    const filteredReturns = returns.filter(tx => {
        const entityName = (tx.customer?.name || tx.customer?.companyName || tx.vendor?.name || tx.vendor?.companyName || '').toLowerCase();
        const itemName = (tx.item?.name || '').toLowerCase();
        const matchSearch = !searchTerm || 
            entityName.includes(searchTerm.toLowerCase()) ||
            itemName.includes(searchTerm.toLowerCase());
            
        let matchDate = true;
        if (fromDate || toDate) {
            const txDate = new Date(tx.createdAt).setHours(0,0,0,0);
            const start = fromDate ? new Date(fromDate).setHours(0,0,0,0) : null;
            const end = toDate ? new Date(toDate).setHours(0,0,0,0) : null;
            
            if (start && end) {
                matchDate = txDate >= start && txDate <= end;
            } else if (start) {
                matchDate = txDate >= start;
            } else if (end) {
                matchDate = txDate <= end;
            }
        }
            
        return matchSearch && matchDate;
    });

    const totalFiltered = filteredReturns.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / itemsPerPage));
    const paginatedReturns = filteredReturns.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Stock Returns List</h1>
            </div>

            <div className="flex gap-3 flex-wrap">
                <input
                    type="text"
                    placeholder="Search by customer, vendor or item..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="flex-1 min-w-[200px] h-10 px-4 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none shadow-sm"
                />
                <div className="flex items-center gap-2">
                    <input
                        type="date"
                        value={fromDate}
                        onChange={e => setFromDate(e.target.value)}
                        className="h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none shadow-sm"
                        title="From Date"
                    />
                    <span className="text-gray-500 text-sm font-medium">to</span>
                    <input
                        type="date"
                        value={toDate}
                        onChange={e => setToDate(e.target.value)}
                        className="h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none shadow-sm"
                        title="To Date"
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Desktop Table View */}
                    <div className="hidden lg:block bg-white rounded-xl shadow-md overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-bottom border-gray-100">
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase">Date</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase">Entity</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase">Item</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase text-center">Qty</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase text-right">Amount</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase text-center">Settlement</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paginatedReturns.map((tx) => {
                                    const entityName = tx.customer?.companyName || tx.customer?.name || tx.vendor?.companyName || tx.vendor?.name || 'Unknown';
                                    const entityType = tx.returnType === 'customer' ? 'Customer' : 'Vendor';
                                    const amount = (tx.quantity || 0) * (tx.rate || 0);
                                    
                                    return (
                                        <tr key={tx._id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 text-gray-600 text-sm font-medium">{new Date(tx.createdAt).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-gray-900 font-bold">
                                                {entityName}
                                                <span className="block text-[10px] text-gray-400 font-bold uppercase">{entityType}</span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-700 font-medium">{tx.item?.name || 'N/A'}</td>
                                            <td className="px-6 py-4 text-center font-bold text-gray-900">{tx.quantity}</td>
                                            <td className="px-6 py-4 font-bold text-gray-900 text-right">₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${tx.settlementType === 'cash' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                                    {tx.settlementType === 'cash' ? '💵 Cash' : '📒 Ledger'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button onClick={() => handlePrint(tx)} className="text-primary-600 hover:text-primary-800 text-sm font-bold border border-primary-200 px-3 py-1.5 rounded-lg bg-primary-50 transition-all hover:bg-primary-100" title="Print Slip">
                                                    🖨️ Print Slip
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {paginatedReturns.length === 0 && (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-8 text-center text-gray-500">No returns found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="lg:hidden space-y-4">
                        {paginatedReturns.map((tx) => {
                            const entityName = tx.customer?.companyName || tx.customer?.name || tx.vendor?.companyName || tx.vendor?.name || 'Unknown';
                            const amount = (tx.quantity || 0) * (tx.rate || 0);

                            return (
                                <div key={tx._id} className="bg-white rounded-2xl border border-gray-100 shadow-md p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-gray-400 uppercase">{new Date(tx.createdAt).toLocaleDateString()}</span>
                                            <h3 className="font-extrabold text-gray-900 text-sm mt-0.5">{entityName}</h3>
                                        </div>
                                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${tx.returnType === 'customer' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                            {tx.returnType}
                                        </span>
                                    </div>
                                    <div className="text-sm font-medium text-gray-600 mb-3">{tx.item?.name} x {tx.quantity}</div>
                                    <div className="flex justify-between items-center pt-3 border-t border-gray-50">
                                        <div className="flex flex-col">
                                            <span className="font-black text-gray-900">₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                            <span className={`text-[9px] font-black uppercase mt-1 ${tx.settlementType === 'cash' ? 'text-green-600' : 'text-gray-500'}`}>
                                                {tx.settlementType === 'cash' ? '💵 Cash Refund' : '📒 Ledger Credit'}
                                            </span>
                                        </div>
                                        <button onClick={() => handlePrint(tx)} className="h-8 px-3 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded-lg text-xs font-bold border border-primary-200">
                                            🖨️ Print
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                            <span className="text-sm text-gray-600 font-medium">
                                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalFiltered)} of {totalFiltered}
                            </span>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Previous
                                </button>
                                <span className="px-4 py-2 text-sm font-bold text-gray-800 bg-gray-50 rounded-lg hidden sm:block">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button 
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
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

export default StockReturnsList;
