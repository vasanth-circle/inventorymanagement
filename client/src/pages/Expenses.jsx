import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import SearchableSelect from '../components/SearchableSelect';

const Expenses = () => {
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);
    const [summary, setSummary] = useState({ totalAmount: 0 });
    
    // Filters
    const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
    const [categoryFilter, setCategoryFilter] = useState('');

    const [categories, setCategories] = useState([
        'Salary', 'Rent', 'Maintenance', 'Utilities', 
        'Office Supplies', 'Marketing', 'Transport', 'Meals', 'Miscellaneous'
    ]);

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        voucherNumber: '',
        category: 'Miscellaneous',
        amount: '',
        paymentMethod: 'Cash',
        description: ''
    });

    useEffect(() => {
        fetchExpenses();
    }, [dateRange, categoryFilter]);

    const fetchExpenses = async () => {
        try {
            setLoading(true);
            const params = { ...dateRange };
            if (categoryFilter) params.category = categoryFilter;

            const res = await axios.get('/api/expenses', {
                params,
                headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
            });
            const fetchedExpenses = res.data.data.expenses;
            setExpenses(fetchedExpenses);
            setSummary({ totalAmount: res.data.data.totalAmount });

            // Extract unique categories from expenses and merge with existing default categories
            const fetchedCategories = [...new Set(fetchedExpenses.map(exp => exp.category).filter(Boolean))];
            setCategories(prev => [...new Set([...prev, ...fetchedCategories])].sort());
        } catch (error) {
            toast.error('Failed to fetch expenses');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (expense = null) => {
        if (expense) {
            setEditingExpense(expense);
            setFormData({
                date: new Date(expense.date).toISOString().split('T')[0],
                voucherNumber: expense.voucherNumber,
                category: expense.category,
                amount: expense.amount,
                paymentMethod: expense.paymentMethod,
                description: expense.description || ''
            });
        } else {
            setEditingExpense(null);
            setFormData({
                date: new Date().toISOString().split('T')[0],
                voucherNumber: '',
                category: 'Miscellaneous',
                amount: '',
                paymentMethod: 'Cash',
                description: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingExpense) {
                await axios.put(`/api/expenses/${editingExpense._id}`, formData, {
                    headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
                });
                toast.success('Expense updated successfully');
            } else {
                await axios.post('/api/expenses', formData, {
                    headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
                });
                toast.success('Expense added successfully');
            }
            setIsModalOpen(false);
            fetchExpenses();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error saving expense');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this expense voucher?')) return;
        try {
            await axios.delete(`/api/expenses/${id}`, {
                headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
            });
            toast.success('Expense deleted successfully');
            fetchExpenses();
        } catch (error) {
            toast.error('Failed to delete expense');
        }
    };

    const getPaymentBadgeColor = (method) => {
        switch (method) {
            case 'Cash': return 'bg-green-100 text-green-800 border-green-200';
            case 'Bank': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'UPI': return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'Credit Card': return 'bg-orange-100 text-orange-800 border-orange-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Expense Tracking (Daily Ledger)</h1>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm font-semibold"
                >
                    <PlusIcon className="w-5 h-5" /> Add Expense
                </button>
            </div>

            {/* Summary & Filters Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-wrap gap-6 items-center justify-between">
                <div className="flex gap-4 items-center w-full lg:w-auto">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">From Date</label>
                        <input
                            type="date"
                            value={dateRange.startDate}
                            onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">To Date</label>
                        <input
                            type="date"
                            value={dateRange.endDate}
                            onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Category</label>
                        <SearchableSelect
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            options={categories.map(c => ({value: c, label: c}))}
                            placeholder="All Categories"
                            className="w-48"
                        />
                    </div>
                    <div className="pt-5">
                        <button onClick={() => { setDateRange({startDate:'', endDate:''}); setCategoryFilter(''); }} className="px-3 py-2 text-gray-500 hover:text-gray-700 text-sm font-medium">Clear Filters</button>
                    </div>
                </div>

                <div className="bg-rose-50 border border-rose-100 rounded-xl px-6 py-3 flex flex-col items-end">
                    <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">Total Expenses (Filtered)</span>
                    <span className="text-2xl font-black text-rose-700">₹{summary.totalAmount?.toLocaleString(undefined, {minimumFractionDigits: 2}) || '0.00'}</span>
                </div>
            </div>

            {/* Expenses List */}
            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
                </div>
            ) : expenses.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                    <div className="text-gray-400 mb-2">💸</div>
                    <h3 className="text-lg font-semibold text-gray-700">No expenses found</h3>
                    <p className="text-sm text-gray-500 mt-1">Try adjusting your filters or click 'Add Expense' to create one.</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date & Voucher</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Description</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Payment</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Amount</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {expenses.map(expense => (
                                    <tr key={expense._id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-gray-900">{new Date(expense.date).toLocaleDateString()}</div>
                                            <div className="text-xs text-gray-500 mt-0.5">{expense.voucherNumber}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                                                {expense.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate" title={expense.description}>
                                            {expense.description || '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border ${getPaymentBadgeColor(expense.paymentMethod)}`}>
                                                {expense.paymentMethod}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="font-bold text-rose-600">₹{expense.amount?.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleOpenModal(expense)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                                                    <PencilIcon className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(expense._id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h2 className="text-xl font-bold text-gray-800">{editingExpense ? 'Edit Expense' : 'Add Expense Voucher'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Date *</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.date}
                                        onChange={(e) => setFormData({...formData, date: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition-shadow"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Voucher No.</label>
                                    <input
                                        type="text"
                                        placeholder="Auto-generated"
                                        value={formData.voucherNumber}
                                        onChange={(e) => setFormData({...formData, voucherNumber: e.target.value})}
                                        disabled={!!editingExpense}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 outline-none text-gray-500 text-sm"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Category *</label>
                                <SearchableSelect
                                    name="category"
                                    value={formData.category}
                                    onChange={(e) => {
                                        const newCategory = e.target.value;
                                        setFormData({...formData, category: newCategory});
                                        if (newCategory && !categories.includes(newCategory)) {
                                            setCategories(prev => [...prev, newCategory].sort());
                                        }
                                    }}
                                    options={categories.map(c => ({value: c, label: c}))}
                                    placeholder="Select or add category..."
                                    allowCreate={true}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Amount (₹) *</label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="0.01"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({...formData, amount: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none font-semibold text-rose-600 transition-shadow"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Payment Method *</label>
                                    <select
                                        required
                                        value={formData.paymentMethod}
                                        onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition-shadow"
                                    >
                                        <option value="Cash">Cash</option>
                                        <option value="Bank">Bank Transfer</option>
                                        <option value="UPI">UPI</option>
                                        <option value="Credit Card">Credit Card</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Description / Notes</label>
                                <textarea
                                    rows="2"
                                    value={formData.description}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition-shadow resize-none"
                                    placeholder="Brief details about the expense..."
                                ></textarea>
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-5 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold shadow-md transition-colors"
                                >
                                    {editingExpense ? 'Update Expense' : 'Save Expense'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Expenses;
