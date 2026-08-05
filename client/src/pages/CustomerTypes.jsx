import { useState, useContext, useEffect } from 'react';
import { InventoryContext } from '../context/InventoryContext';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import FullScreenModal from '../components/FullScreenModal';

const CustomerTypes = () => {
    const { customerTypes, addCustomerType, updateCustomerType, deleteCustomerType, fetchCustomerTypes } = useContext(InventoryContext);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ name: '', description: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchCustomerTypes();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            let success;
            if (editingId) {
                success = await updateCustomerType(editingId, formData);
            } else {
                success = await addCustomerType(formData);
            }
            if (success) {
                setIsModalOpen(false);
                setFormData({ name: '', description: '' });
                setEditingId(null);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (type) => {
        setFormData({ name: type.name, description: type.description || '' });
        setEditingId(type._id);
        setIsModalOpen(true);
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 lg:space-y-8 animate-fade-in pb-24">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">Customer Types</h1>
                    <p className="text-sm text-gray-500 mt-1 font-medium">Manage customer classifications</p>
                </div>
                <button
                    onClick={() => {
                        setEditingId(null);
                        setFormData({ name: '', description: '' });
                        setIsModalOpen(true);
                    }}
                    className="bg-gray-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-gray-900/20 hover:shadow-gray-900/30 hover:-translate-y-0.5 transition-all w-full sm:w-auto active:translate-y-0"
                >
                    + Add Customer Type
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-black text-gray-400 uppercase tracking-wider">Name</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-gray-400 uppercase tracking-wider">Description</th>
                                <th className="px-6 py-4 text-right text-xs font-black text-gray-400 uppercase tracking-wider w-24">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                                {customerTypes.map((type) => (
                                    <tr 
                                        key={type._id}
                                        className="hover:bg-gray-50/50 transition-colors group"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                            {type.name}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 font-medium">
                                            {type.description || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleEdit(type)}
                                                    className="p-2 text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                                                    title="Edit"
                                                >
                                                    <PencilSquareIcon className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => deleteCustomerType(type._id)}
                                                    className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                                                    title="Delete"
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            {customerTypes.length === 0 && (
                                <tr>
                                    <td colSpan="3" className="px-6 py-12 text-center text-gray-500 font-medium">
                                        No customer types found. Add your first customer type to get started.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <FullScreenModal 
                isOpen={isModalOpen} 
                onClose={() => !isSubmitting && setIsModalOpen(false)}
                title={editingId ? 'Edit Customer Type' : 'Add Customer Type'}
            >
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="space-y-1">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Name <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none transition-all font-semibold text-sm"
                            placeholder="e.g. Wholesale, Retail"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none transition-all font-medium text-sm min-h-[100px]"
                            placeholder="Optional description"
                        />
                    </div>
                    <div className="flex gap-3 pt-6 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            disabled={isSubmitting}
                            className="flex-1 px-6 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-bold transition-colors disabled:opacity-50 text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 font-bold shadow-lg shadow-gray-900/20 transition-all disabled:opacity-50 text-sm"
                        >
                            {isSubmitting ? 'Saving...' : (editingId ? 'Save Changes' : 'Add Type')}
                        </button>
                    </div>
                </form>
            </FullScreenModal>
        </div>
    );
};

export default CustomerTypes;
