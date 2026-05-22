import { useContext, useState, useEffect } from 'react';
import { InventoryContext } from '../context/InventoryContext';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';

const EMPTY_FORM = { name: '', code: '', address: '', phone: '', isHeadOffice: false };

const Branches = () => {
    const { branches, fetchBranches } = useContext(InventoryContext);
    const { user } = useContext(AuthContext);
    const [showModal, setShowModal] = useState(false);
    const [editBranch, setEditBranch] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    const isAdmin = ['admin', 'tenant_admin', 'tenant_owner', 'super_admin'].includes(user?.role);

    useEffect(() => { fetchBranches(); }, []);

    const autoCode = (name) => name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

    const openCreate = () => {
        setEditBranch(null);
        setForm(EMPTY_FORM);
        setShowModal(true);
    };

    const openEdit = (branch) => {
        setEditBranch(branch);
        setForm({ name: branch.name, code: branch.code, address: branch.address || '', phone: branch.phone || '', isHeadOffice: branch.isHeadOffice });
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.name || !form.code) return toast.error('Name and Code are required');
        setSaving(true);
        try {
            if (editBranch) {
                await api.put(`/branches/${editBranch._id}`, form);
                toast.success('Branch updated');
            } else {
                await api.post('/branches', form);
                toast.success('Branch created');
            }
            await fetchBranches();
            setShowModal(false);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save branch');
        } finally {
            setSaving(false);
        }
    };

    const handleDeactivate = async (branch) => {
        if (!window.confirm(`Deactivate "${branch.name}"?`)) return;
        try {
            await api.delete(`/branches/${branch._id}`);
            toast.success('Branch deactivated');
            fetchBranches();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to deactivate');
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Branches</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Manage your business locations and branches</p>
                </div>
                {isAdmin && (
                    <button
                        onClick={openCreate}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium text-sm transition-colors"
                    >
                        <span className="text-lg leading-none">+</span> New Branch
                    </button>
                )}
            </div>

            {/* Branch Cards */}
            {branches.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-600">
                    <div className="text-5xl mb-3">🏪</div>
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">No branches yet</h3>
                    <p className="text-sm text-gray-400 mt-1">Create your first branch to start managing multiple locations</p>
                    {isAdmin && (
                        <button onClick={openCreate} className="mt-4 px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
                            Create Branch
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {branches.map(branch => (
                        <div key={branch._id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl font-bold text-white ${branch.isHeadOffice ? 'bg-amber-500' : 'bg-primary-600'}`}>
                                        {branch.isHeadOffice ? '🏛️' : '🏪'}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-gray-900 dark:text-white">{branch.name}</h3>
                                            {branch.isHeadOffice && (
                                                <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Head Office</span>
                                            )}
                                        </div>
                                        <span className="inline-block mt-1 text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded">{branch.code}</span>
                                    </div>
                                </div>
                                {isAdmin && (
                                    <div className="flex gap-1">
                                        <button onClick={() => openEdit(branch)} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors text-sm">✏️</button>
                                        {!branch.isHeadOffice && (
                                            <button onClick={() => handleDeactivate(branch)} className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors text-sm">🗑️</button>
                                        )}
                                    </div>
                                )}
                            </div>
                            {(branch.address || branch.phone) && (
                                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-1">
                                    {branch.address && <p className="text-xs text-gray-500 flex items-center gap-1.5"><span>📍</span>{branch.address}</p>}
                                    {branch.phone && <p className="text-xs text-gray-500 flex items-center gap-1.5"><span>📞</span>{branch.phone}</p>}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{editBranch ? 'Edit Branch' : 'Create New Branch'}</h2>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Branch Name *</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value, code: f.code || autoCode(e.target.value) }))}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                    placeholder="e.g. Main Store"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Branch Code * <span className="text-xs text-gray-400 font-normal">(short unique code, auto-generated)</span></label>
                                <input
                                    type="text"
                                    value={form.code}
                                    onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-mono bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                    placeholder="e.g. MAIN"
                                    maxLength={10}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
                                <input
                                    type="text"
                                    value={form.address}
                                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                    placeholder="Branch address"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                                <input
                                    type="text"
                                    value={form.phone}
                                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                    placeholder="Phone number"
                                />
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.isHeadOffice}
                                    onChange={e => setForm(f => ({ ...f, isHeadOffice: e.target.checked }))}
                                    className="w-4 h-4 accent-amber-500"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">Mark as Head Office</span>
                            </label>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
                                    Cancel
                                </button>
                                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-60">
                                    {saving ? 'Saving...' : editBranch ? 'Update Branch' : 'Create Branch'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Branches;
