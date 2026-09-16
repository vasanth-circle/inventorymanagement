import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { formatCurrency, exportToCSV } from '../utils/helpers';
import toast from 'react-hot-toast';

const LedgerReports = () => {
    const navigate = useNavigate();
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // We fetch from the unified parties statements endpoint
            // Wait, does /parties/statements/overall exist? Let's assume yes, or we fetch all parties.
            const response = await api.get('/parties?limit=1000');
            if (response.data && (response.data.data?.parties || response.data.parties)) {
                const parties = response.data.data?.parties || response.data.parties;
                
                // Map the parties into a ledger report format
                const mappedData = parties.map(p => ({
                    partyId: p._id,
                    name: p.companyName || p.name,
                    contact: p.phone,
                    currentBalance: p.currentBalance || 0,
                    openingBalance: p.openingBalance || 0,
                    status: p.isActive ? 'Active' : 'Inactive'
                }));
                
                setReportData(mappedData);
            }
        } catch (error) {
            console.error('Error fetching ledger reports:', error);
            toast.error('Failed to load ledger data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleExport = () => {
        if (reportData.length === 0) return toast.error('No data to export');
        const exportData = reportData.map(item => ({
            'Name': item.name,
            'Contact': item.contact || 'N/A',
            'Opening Balance': formatCurrency(item.openingBalance),
            'Current Balance': formatCurrency(Math.abs(item.currentBalance)),
            'Position': item.currentBalance >= 0 ? 'Party owes you (Dr)' : 'You owe party (Cr)',
            'Status': item.status
        }));
        exportToCSV(exportData, `ledger-report-${new Date().toISOString().split('T')[0]}`);
        toast.success('Ledger report exported');
    };

    return (
        <div className="p-6 max-w-7xl mx-auto animate-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Financial Ledgers</h1>
                    <p className="text-gray-500 mt-1">Overview of balances for all parties.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleExport} className="btn-secondary">
                        <span className="mr-2">📥</span> Export CSV
                    </button>
                    <button onClick={() => navigate('/ledger')} className="btn-primary">
                        View Detailed Ledger
                    </button>
                </div>
            </div>

            <div className="glass-panel overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <h3 className="font-semibold text-gray-800">Unified Party Balances</h3>
                    <span className="text-sm text-gray-500">{reportData.length} Parties</span>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="table-premium w-full">
                        <thead>
                            <tr>
                                <th>Party Name</th>
                                <th>Contact</th>
                                <th>Opening Bal (₹)</th>
                                <th>Current Bal (₹)</th>
                                <th>Position</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="text-center py-10">
                                        <div className="inline-block w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                                        <p className="mt-2 text-sm text-gray-500">Loading ledger data...</p>
                                    </td>
                                </tr>
                            ) : reportData.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="text-center py-10 text-gray-500">No data available</td>
                                </tr>
                            ) : (
                                reportData.map((row) => (
                                    <tr key={row.partyId} className="hover:bg-gray-50/50 cursor-pointer" onClick={() => navigate(`/ledger/${row.partyId}`)}>
                                        <td className="font-medium text-gray-900">{row.name}</td>
                                        <td className="text-gray-500">{row.contact || '-'}</td>
                                        <td className="text-gray-600">{formatCurrency(row.openingBalance)}</td>
                                        <td className={`font-bold ${row.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {formatCurrency(Math.abs(row.currentBalance))}
                                        </td>
                                        <td>
                                            {row.currentBalance > 0 ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-700">Receivable (Dr)</span>
                                            ) : row.currentBalance < 0 ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-red-100 text-red-700">Payable (Cr)</span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">Settled</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default LedgerReports;
