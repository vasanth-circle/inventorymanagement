import { useState, useContext, useEffect } from 'react';
import { InventoryContext } from '../context/InventoryContext';
import { formatCurrency, formatDateTime, exportToCSV } from '../utils/helpers';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { printTallyLedger, printTallyReceivables } from '../utils/printTemplates';
import FullScreenModal from '../components/FullScreenModal';

const Reports = () => {
    const { fetchTransactions, fetchSalesOrders, fetchItems } = useContext(InventoryContext);
    const [reportType, setReportType] = useState('stock');
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
    });
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [summary, setSummary] = useState(null); // For detailed ledger summary
    const [selectedUser, setSelectedUser] = useState(null); // For Sales by User details

    useEffect(() => {
        api.get('/customers?limit=1000').then(res => setCustomers(res.data.data.customers)).catch(() => {});
    }, []);

    const handleGenerateReport = async () => {
        setLoading(true);
        try {
            if (reportType === 'stock') {
                const data = await fetchItems({ limit: 5000 });
                if (data && data.items) {
                    setReportData(data.items);
                    toast.success('Current Stock report generated');
                }
            } else if (reportType === 'inward') {
                const data = await fetchTransactions({ ...filters, type: 'inward', limit: 5000 });
                if (data && data.transactions) {
                    setReportData(data.transactions);
                    toast.success('Inward Flow report generated');
                }
            } else if (reportType === 'sales') {
                const data = await fetchSalesOrders({ ...filters, limit: 5000 });
                if (data && data.orders) {
                    setReportData(data.orders);
                    toast.success('Sales report generated');
                }
            } else if (reportType === 'performance') {
                const data = await fetchSalesOrders({ ...filters, limit: 5000 });
                if (data && data.orders) {
                    // Aggregate by user
                    const userMap = {};
                    data.orders.forEach(order => {
                        const userName = order.user?.name || 'Unknown';
                        if (!userMap[userName]) {
                            userMap[userName] = { 
                                name: userName, 
                                invoiceAmount: 0, 
                                invoiceCount: 0,
                                quotationAmount: 0,
                                quotationCount: 0,
                                orders: [] 
                            };
                        }

                        // True sale value = totalAmount − oldBalance + advanceAmount
                        const trueSaleValue = (order.totalAmount || 0) - (order.oldBalance || 0) + (order.advanceAmount || 0);
                        if (order.isEstimation || order.orderNumber?.startsWith('E-')) {
                            userMap[userName].quotationAmount += trueSaleValue;
                            userMap[userName].quotationCount += 1;
                        } else if (order.status !== 'void' && order.status !== 'cancelled') {
                            userMap[userName].invoiceAmount += trueSaleValue;
                            userMap[userName].invoiceCount += 1;
                        }

                        userMap[userName].orders.push(order);
                    });
                    setReportData(Object.values(userMap).sort((a, b) => b.invoiceAmount - a.invoiceAmount));
                    toast.success('Sales Performance report generated');
                }
            } else if (reportType === 'daywise_receivables') {
                const params = {};
                if (filters.startDate) params.from = filters.startDate;
                if (filters.endDate) params.to = filters.endDate;
                if (selectedCustomer) params.customer = selectedCustomer;
                const response = await api.get('/customers/reports/receivables', { params });
                if (response.data && response.data.data) {
                    setReportData(response.data.data);
                    toast.success('Receivables report generated');
                }
            } else if (reportType === 'damaged_goods') {
                const data = await fetchItems({ limit: 5000 });
                if (data && data.items) {
                    const damagedItems = data.items.filter(item => item.damagedQuantity > 0);
                    setReportData(damagedItems);
                    toast.success('Damaged Goods report generated');
                }
            } else if (reportType === 'detailed_ledger') {
                if (!selectedCustomer) {
                    toast.error('Please select a customer first');
                    return;
                }
                const params = {};
                if (filters.startDate) params.from = filters.startDate;
                if (filters.endDate) params.to = filters.endDate;
                
                const response = await api.get(`/customers/${selectedCustomer}/statement`, { params });
                if (response.data && response.data.data) {
                    setReportData(response.data.data.entries);
                    setSummary(response.data.data); // Stores customer, summary info
                    toast.success('Detailed Ledger generated');
                }
            } else if (reportType === 'returns') {
                const data = await fetchTransactions({ ...filters, type: 'return', limit: 5000 });
                if (data && data.transactions) {
                    setReportData(data.transactions);
                    toast.success('Stock Returns report generated');
                }
            }
        } catch (error) {
            toast.error('Failed to generate report');
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        if (reportData.length === 0) {
            toast.error('No data to export');
            return;
        }

        let exportData = [];
        if (reportType === 'stock') {
            exportData = reportData.map(item => ({
                'Item Name': item.name,
                'Category': item.category?.name || 'N/A',
                'Stock Quantity': item.quantity,
                'Total SqFt': item.totalSqFt || 0,
                'Purchase Price': formatCurrency(item.purchasePrice || 0),
                'Selling Price': formatCurrency(item.price || 0),
                'Total Value (Purchase)': formatCurrency((item.quantity || 0) * (item.purchasePrice || 0))
            }));
        } else if (reportType === 'inward') {
            exportData = reportData.map(transaction => ({
                'Date': formatDateTime(transaction.createdAt),
                'Item': transaction.item?.name || 'N/A',
                'Quantity': transaction.quantity,
                'Reason / Supplier': transaction.reason || 'N/A',
                'Received By': transaction.user?.name || 'N/A',
            }));
        } else if (reportType === 'sales') {
            exportData = reportData.map(order => ({
                'Date': formatDateTime(order.orderDate),
                'Order No': order.orderNumber,
                'Customer': order.customer?.companyName || order.customer?.name || 'N/A',
                'Net Amount': formatCurrency(order.totalAmount),
                'Status': order.status,
                'Sales Rep': order.user?.name || 'System'
            }));
        } else if (reportType === 'performance') {
            exportData = reportData.map(user => ({
                'Sales Person': user.name,
                'Total Bills Created': user.orderCount,
                'Total Sales Amount': formatCurrency(user.totalAmount)
            }));
        } else if (reportType === 'daywise_receivables') {
            reportData.forEach(cust => {
                cust.pendingBills.forEach(bill => {
                    exportData.push({
                        'Customer': cust.name,
                        'Ref No': bill.refNumber,
                        'Pending Amount': bill.pendingAmount,
                        'Due Date': new Date(bill.date).toLocaleDateString(),
                        'OS Days': bill.osDays
                    });
                });
            });
        } else if (reportType === 'detailed_ledger') {
            exportData = reportData.map(entry => ({
                'Date': new Date(entry.date).toLocaleDateString(),
                'Ref No': entry.refNumber || '',
                'Type': entry.type,
                'Particulars': entry.description,
                'Debit': entry.debit || 0,
                'Credit': entry.credit || 0,
                'Balance': entry.balance
            }));
        } else if (reportType === 'damaged_goods') {
            exportData = reportData.map(item => ({
                'Item Name': item.name,
                'Category': item.category?.name || 'N/A',
                'Damaged Quantity': item.damagedQuantity,
                'Purchase Price': formatCurrency(item.purchasePrice || 0),
                'Total Damaged Value': formatCurrency((item.damagedQuantity || 0) * (item.purchasePrice || item.price || 0))
            }));
        } else if (reportType === 'returns') {
            exportData = reportData.map(tx => ({
                'Date': formatDateTime(tx.createdAt),
                'Entity': tx.customer?.companyName || tx.customer?.name || tx.vendor?.companyName || tx.vendor?.name || 'Unknown',
                'Type': tx.returnType,
                'Item': tx.item?.name || 'N/A',
                'Quantity': tx.quantity,
                'Rate': formatCurrency(tx.rate || 0),
                'Amount': formatCurrency((tx.quantity || 0) * (tx.rate || 0)),
                'Reason': tx.reason || 'N/A'
            }));
        }

        exportToCSV(exportData, `report-${reportType}-${new Date().toISOString().split('T')[0]}`);
        toast.success(`${reportType} report exported`);
    };

    const handlePrintTally = () => {
        if (reportData.length === 0) {
            toast.error('No data to print');
            return;
        }
        if (reportType === 'daywise_receivables') {
            printTallyReceivables(reportData);
        } else if (reportType === 'detailed_ledger' && summary) {
            printTallyLedger(summary.customer, reportData, summary.summary);
        }
    };

    const renderTable = () => {
        if (reportType === 'stock') {
            return (
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-white border-b border-gray-100">
                            <tr>
                                <th className="px-3 py-2 sm:px-6 sm:py-4 text-left text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Item</th>
                                <th className="px-3 py-2 sm:px-6 sm:py-4 text-center text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Qty</th>
                                <th className="px-3 py-2 sm:px-6 sm:py-4 text-right text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Total Value</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 font-medium">
                            {reportData.map((item) => (
                                <tr key={item._id} className="hover:bg-gray-50/50">
                                    <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-[11px] sm:text-xs font-bold text-gray-900">{item.name}<br/><span className="text-[9px] sm:text-[10px] font-normal text-gray-400">{item.category?.name || 'N/A'}</span></td>
                                    <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-center text-[11px] sm:text-xs font-black text-gray-900">{item.quantity} <span className="text-[8px] sm:text-[9px] font-bold text-gray-400">{item.unit || ''}</span></td>
                                    <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-right text-[11px] sm:text-xs text-gray-900 font-bold">{formatCurrency((item.quantity || 0) * (item.purchasePrice || item.price || 0))}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        } else if (reportType === 'inward') {
            return (
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-white border-b border-gray-100">
                            <tr>
                                <th className="px-3 py-2 sm:px-6 sm:py-4 text-left text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Date</th>
                                <th className="px-3 py-2 sm:px-6 sm:py-4 text-left text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Item</th>
                                <th className="px-3 py-2 sm:px-6 sm:py-4 text-left text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Qty</th>
                                <th className="px-3 py-2 sm:px-6 sm:py-4 text-left text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Supplier/Reason</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 font-medium">
                            {reportData.map((t) => (
                                <tr key={t._id} className="hover:bg-gray-50/50">
                                    <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-[11px] sm:text-xs text-gray-900">{formatDateTime(t.createdAt)}</td>
                                    <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-[11px] sm:text-xs font-bold text-gray-900">{t.item?.name || 'N/A'}</td>
                                    <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-[11px] sm:text-xs font-black text-green-600">+{t.quantity}</td>
                                    <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-[11px] sm:text-xs text-gray-600">{t.reason || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        } else if (reportType === 'sales') {
            return (
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-white border-b border-gray-100">
                            <tr>
                                <th className="px-3 py-2 sm:px-6 sm:py-4 text-left text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Date</th>
                                <th className="px-3 py-2 sm:px-6 sm:py-4 text-left text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Order #</th>
                                <th className="px-3 py-2 sm:px-6 sm:py-4 text-left text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Customer</th>
                                <th className="px-3 py-2 sm:px-6 sm:py-4 text-right text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Net Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 font-medium">
                            {reportData.map((order) => (
                                <tr key={order._id} className="hover:bg-gray-50/50">
                                    <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-[11px] sm:text-xs text-gray-900">{new Date(order.orderDate).toLocaleDateString()}</td>
                                    <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-[11px] sm:text-xs font-bold text-primary-600">{order.orderNumber}</td>
                                    <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-[11px] sm:text-xs text-gray-800">{order.customer?.companyName || order.customer?.name || '-'}</td>
                                    <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-[11px] sm:text-xs font-black text-gray-900 text-right">{formatCurrency(order.totalAmount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        } else if (reportType === 'performance') {
            return (
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {reportData.map((user, idx) => (
                        <div key={idx} onClick={() => setSelectedUser(user)} className="cursor-pointer bg-gray-50/50 border border-gray-100 p-6 rounded-2xl space-y-3 relative overflow-hidden group hover:border-primary-300 transition-all hover:shadow-md">
                            <div className="absolute top-0 right-0 w-16 h-16 bg-primary-600/5 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-150"></div>
                            <div className="flex justify-between items-start relative">
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Representative</p>
                                    <p className="text-xl font-black text-gray-800">{user.name}</p>
                                </div>
                                <span className="text-2xl">🎖️</span>
                            </div>
                            <div className="grid grid-cols-2 gap-y-4 gap-x-2 relative">
                                <div>
                                    <p className="text-[9px] font-black text-gray-400 uppercase">Invoices ({user.invoiceCount})</p>
                                    <p className="text-base font-black text-emerald-600">{formatCurrency(user.invoiceAmount)}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-gray-400 uppercase">Quotations ({user.quotationCount})</p>
                                    <p className="text-base font-black text-orange-500">{formatCurrency(user.quotationAmount)}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            );
        } else if (reportType === 'daywise_receivables') {
            return (
                <div className="p-6 space-y-8">
                    {reportData.map(cust => (
                        <div key={cust.customerId} className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                            <div className="bg-gray-50 px-4 py-3 flex justify-between items-center border-b border-gray-200">
                                <div>
                                    <h3 className="font-black text-gray-800 uppercase text-xs tracking-wider">{cust.name}</h3>
                                    <p className="text-[10px] text-gray-500 mt-1">{cust.contact || ''}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Total Pending</p>
                                    <p className="font-black text-red-600 text-sm">{formatCurrency(cust.totalPending)}</p>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full">
                                    <thead className="bg-white border-b border-gray-100">
                                        <tr>
                                            <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Ref No</th>
                                            <th className="px-3 py-2 sm:px-6 sm:py-3 text-right text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Pending Amt</th>
                                            <th className="px-3 py-2 sm:px-6 sm:py-3 text-center text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Due Date</th>
                                            <th className="px-3 py-2 sm:px-6 sm:py-3 text-center text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">OS Days</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 bg-white">
                                        {cust.pendingBills.map((bill, i) => (
                                            <tr key={i} className="hover:bg-gray-50/50">
                                                <td className="px-3 py-2 sm:px-6 sm:py-2 text-[11px] sm:text-xs font-bold text-gray-700 whitespace-nowrap">{bill.refNumber}</td>
                                                <td className="px-3 py-2 sm:px-6 sm:py-2 text-right text-[11px] sm:text-xs font-black text-red-600 whitespace-nowrap">{formatCurrency(bill.pendingAmount)}</td>
                                                <td className="px-3 py-2 sm:px-6 sm:py-2 text-center text-[11px] sm:text-xs text-gray-600 whitespace-nowrap">{new Date(bill.date).toLocaleDateString()}</td>
                                                <td className="px-3 py-2 sm:px-6 sm:py-2 text-center text-[11px] sm:text-xs font-bold text-gray-800 whitespace-nowrap">{bill.osDays}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            );
        } else if (reportType === 'detailed_ledger') {
            return (
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-white border-b border-gray-100">
                            <tr>
                                <th className="px-3 py-2 sm:px-6 sm:py-4 text-left text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Date</th>
                                <th className="px-3 py-2 sm:px-6 sm:py-4 text-left text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Particulars</th>
                                <th className="px-3 py-2 sm:px-6 sm:py-4 text-left text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Ref No</th>
                                <th className="px-3 py-2 sm:px-6 sm:py-4 text-right text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Debit</th>
                                <th className="px-3 py-2 sm:px-6 sm:py-4 text-right text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Credit</th>
                                <th className="px-3 py-2 sm:px-6 sm:py-4 text-right text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Balance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 font-medium">
                            {reportData.map((entry, idx) => (
                                <tr key={idx} className="hover:bg-gray-50/50">
                                    <td className="px-3 py-2 sm:px-6 sm:py-3 whitespace-nowrap text-[11px] sm:text-xs text-gray-900">{new Date(entry.date).toLocaleDateString()}</td>
                                    <td className="px-3 py-2 sm:px-6 sm:py-3 text-[11px] sm:text-xs text-gray-800">{entry.description}</td>
                                    <td className="px-3 py-2 sm:px-6 sm:py-3 whitespace-nowrap text-[11px] sm:text-xs font-mono text-gray-600">{entry.refNumber || '-'}</td>
                                    <td className="px-3 py-2 sm:px-6 sm:py-3 whitespace-nowrap text-[11px] sm:text-xs font-bold text-red-600 text-right">{entry.debit ? formatCurrency(entry.debit) : ''}</td>
                                    <td className="px-3 py-2 sm:px-6 sm:py-3 whitespace-nowrap text-[11px] sm:text-xs font-bold text-emerald-600 text-right">{entry.credit ? formatCurrency(entry.credit) : ''}</td>
                                    <td className="px-3 py-2 sm:px-6 sm:py-3 whitespace-nowrap text-[11px] sm:text-xs font-black text-gray-900 text-right">{formatCurrency(Math.abs(entry.balance))} {entry.balance >= 0 ? 'Dr' : 'Cr'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        } else if (reportType === 'damaged_goods') {
            return (
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-white border-b border-gray-100">
                            <tr>
                                <th className="px-3 py-2 sm:px-6 sm:py-4 text-left text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Item</th>
                                <th className="px-3 py-2 sm:px-6 sm:py-4 text-center text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Damaged Qty</th>
                                <th className="px-3 py-2 sm:px-6 sm:py-4 text-right text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Damaged Value</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 font-medium">
                            {reportData.map((item) => (
                                <tr key={item._id} className="hover:bg-red-50/50">
                                    <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-[11px] sm:text-xs font-bold text-gray-900">{item.name}<br/><span className="text-[9px] sm:text-[10px] font-normal text-gray-400">{item.category?.name || 'N/A'}</span></td>
                                    <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-center text-[11px] sm:text-xs font-black text-red-600">{item.damagedQuantity} <span className="text-[8px] sm:text-[9px] font-bold text-gray-400">{item.unit || ''}</span></td>
                                    <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-right text-[11px] sm:text-xs text-red-700 font-bold">{formatCurrency((item.damagedQuantity || 0) * (item.purchasePrice || item.price || 0))}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        } else if (reportType === 'returns') {
            return (
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-white border-b border-gray-100">
                            <tr>
                                <th className="px-3 py-2 sm:px-6 sm:py-4 text-left text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Date</th>
                                <th className="px-3 py-2 sm:px-6 sm:py-4 text-left text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Entity</th>
                                <th className="px-3 py-2 sm:px-6 sm:py-4 text-left text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Item</th>
                                <th className="px-3 py-2 sm:px-6 sm:py-4 text-center text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Qty</th>
                                <th className="px-3 py-2 sm:px-6 sm:py-4 text-right text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Rate</th>
                                <th className="px-3 py-2 sm:px-6 sm:py-4 text-right text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 font-medium">
                            {reportData.map((t) => (
                                <tr key={t._id} className="hover:bg-gray-50/50">
                                    <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-[11px] sm:text-xs text-gray-900">{formatDateTime(t.createdAt)}</td>
                                    <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-[11px] sm:text-xs font-bold text-gray-900">{t.customer?.companyName || t.customer?.name || t.vendor?.companyName || t.vendor?.name || 'Unknown'}</td>
                                    <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-[11px] sm:text-xs font-bold text-gray-900">{t.item?.name || 'N/A'}</td>
                                    <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-center text-[11px] sm:text-xs font-black text-purple-600">{t.quantity}</td>
                                    <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-right text-[11px] sm:text-xs text-gray-900">{formatCurrency(t.rate || 0)}</td>
                                    <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-right text-[11px] sm:text-xs font-bold text-gray-900">{formatCurrency((t.quantity || 0) * (t.rate || 0))}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }
    };

    const navButtons = [
        { id: 'stock', label: '📦 Current Stock' },
        { id: 'inward', label: '📥 Inward / Purchases' },
        { id: 'sales', label: '📤 Outward / Sales' },
        { id: 'performance', label: '👤 Sales by User' },
        { id: 'daywise_receivables', label: '💸 Daywise Receivables' },
        { id: 'detailed_ledger', label: '📒 Detailed Ledger' },
        { id: 'damaged_goods', label: '❌ Damaged Goods' },
        { id: 'returns', label: '↩️ Stock Returns' },
    ];

    return (
        <div className="space-y-4 pb-24 lg:pb-8">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-white shadow-sm border border-gray-100 rounded flex items-center justify-center text-lg">📊</div>
                    <div>
                        <h1 className="text-lg font-bold text-gray-800 leading-tight">Intelligence & Analytics</h1>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Comprehensive Business Reports</p>
                    </div>
                </div>
            </div>

            {/* Report Selection Tabs */}
            <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
                <div className="flex space-x-2 min-w-max">
                    {navButtons.map(btn => (
                        <button
                            key={btn.id}
                            onClick={() => { setReportType(btn.id); setReportData([]); }}
                            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-lg transition-all ${reportType === btn.id ? 'bg-primary-50 text-primary-700 shadow-sm ring-1 ring-primary-200' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}
                        >
                            {btn.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Filters & Actions Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 justify-between items-center">
                
                {/* Left Side: Parameters */}
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-1 rounded">Parameters</span>
                    
                    {(reportType === 'detailed_ledger' || reportType === 'daywise_receivables') && (
                        <select
                            value={selectedCustomer}
                            onChange={(e) => setSelectedCustomer(e.target.value)}
                            className="text-xs bg-white border border-gray-200 font-bold text-gray-700 focus:ring-2 focus:ring-primary-100 focus:border-primary-300 outline-none px-3 py-2 rounded-lg min-w-[200px]"
                        >
                            <option value="">-- All Customers --</option>
                            {customers.map(c => (
                                <option key={c._id} value={c._id}>{c.companyName || c.name}</option>
                            ))}
                        </select>
                    )}
                    
                    {reportType !== 'stock' && (
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
                            <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="text-xs bg-transparent font-bold text-gray-700 outline-none" />
                            <span className="text-[10px] text-gray-300 font-black uppercase mx-1">TO</span>
                            <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="text-xs bg-transparent font-bold text-gray-700 outline-none" />
                        </div>
                    )}
                </div>

                {/* Right Side: Actions */}
                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    <button onClick={handleGenerateReport} disabled={loading} className="whitespace-nowrap bg-gray-900 text-white px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-black transition-all disabled:opacity-50 shadow-sm">
                        {loading ? 'Processing...' : 'Generate Analysis'}
                    </button>
                    
                    <button onClick={handleExport} disabled={reportData.length === 0} className="whitespace-nowrap bg-emerald-50 text-emerald-600 border border-emerald-200 px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-emerald-100 transition-all disabled:opacity-50 disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-200 shadow-sm">
                        Export CSV
                    </button>
                    
                    {(reportType === 'daywise_receivables' || reportType === 'detailed_ledger') && (
                        <button onClick={handlePrintTally} disabled={reportData.length === 0} className="whitespace-nowrap bg-indigo-50 text-indigo-600 border border-indigo-200 px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-indigo-100 transition-all disabled:opacity-50 shadow-sm flex items-center gap-2">
                            <span>🖨️</span> Print Tally Format
                        </button>
                    )}
                </div>
            </div>

            {/* Results Area */}
            <div>
                {reportData.length > 0 ? (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                            <h2 className="text-xs font-black text-gray-700 uppercase tracking-wider">
                                {navButtons.find(b => b.id === reportType)?.label} Data
                            </h2>
                            <span className="text-[10px] font-bold bg-white px-2 py-1 rounded text-gray-500 border border-gray-200">
                                {reportData.length} records found
                            </span>
                        </div>
                        <div className="overflow-x-auto w-full">
                            {renderTable()}
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-lg border border-dashed border-gray-300 flex flex-col items-center justify-center p-12 text-center h-[50vh]">
                        <div className="text-4xl mb-4 grayscale opacity-20">📊</div>
                        <h3 className="text-sm font-black text-gray-600 uppercase tracking-widest">No Intelligence Generated</h3>
                        <p className="text-xs text-gray-400 max-w-xs mt-2">Select your report type and click generate to view data.</p>
                    </div>
                )}
            </div>

            {selectedUser && (
                <FullScreenModal isOpen={true} onClose={() => setSelectedUser(null)}>
                    <div className="p-4 bg-gray-50 h-full overflow-y-auto">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden max-w-5xl mx-auto">
                            <div className="px-4 py-3 sm:px-6 sm:py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                                <div>
                                    <h3 className="text-[11px] sm:text-sm font-black text-gray-800 uppercase tracking-widest">Documents Generated by {selectedUser.name}</h3>
                                    <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 uppercase mt-1">
                                        Invoices: {selectedUser.invoiceCount} ({formatCurrency(selectedUser.invoiceAmount)}) | Quotations: {selectedUser.quotationCount} ({formatCurrency(selectedUser.quotationAmount)})
                                    </p>
                                </div>
                                <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-gray-700 font-bold text-xl px-2">✕</button>
                            </div>
                            <div className="overflow-x-auto w-full">
                                <table className="min-w-full">
                                    <thead className="bg-white border-b border-gray-100">
                                        <tr>
                                            <th className="px-3 py-2 sm:px-6 sm:py-4 text-left text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Date</th>
                                            <th className="px-3 py-2 sm:px-6 sm:py-4 text-left text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Document #</th>
                                            <th className="px-3 py-2 sm:px-6 sm:py-4 text-left text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Customer</th>
                                            <th className="px-3 py-2 sm:px-6 sm:py-4 text-left text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Type / Status</th>
                                            <th className="px-3 py-2 sm:px-6 sm:py-4 text-right text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {selectedUser.orders?.map(order => (
                                            <tr key={order._id} className="hover:bg-gray-50/50">
                                                <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-[11px] sm:text-xs text-gray-600 font-medium">{new Date(order.orderDate).toLocaleDateString()}</td>
                                                <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-[11px] sm:text-xs font-bold text-indigo-600">{order.orderNumber}</td>
                                                <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-[11px] sm:text-xs font-bold text-gray-800">{order.customer?.companyName || order.customer?.name || 'Unknown'}</td>
                                                <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-gray-500">
                                                    {(order.isEstimation || order.orderNumber?.startsWith('E-')) ? (
                                                        <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded mr-2">QUOTATION</span>
                                                    ) : (
                                                        <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded mr-2">INVOICE</span>
                                                    )}
                                                    {order.status}
                                                </td>
                                                <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-[11px] sm:text-xs font-black text-gray-900 text-right">{formatCurrency(order.totalAmount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </FullScreenModal>
            )}
        </div>
    );
};

export default Reports;
