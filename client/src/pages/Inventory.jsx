import { useState, useEffect, useContext } from 'react';
import { InventoryContext } from '../context/InventoryContext';
import { formatCurrency, formatDate, getStockStatusColor, exportToCSV, debounce } from '../utils/helpers';
import toast from 'react-hot-toast';

const Inventory = () => {
    const { 
        items, fetchItems, deleteItem, createItem, updateItem, 
        categories, locations, fetchLocations, loading, confirmDelete
    } = useContext(InventoryContext);
    const [filters, setFilters] = useState({
        search: '',
        category: '',
        status: '',
        page: 1,
        limit: 10,
    });
    const [pagination, setPagination] = useState({ totalPages: 1, currentPage: 1, totalItems: 0 });
    const [editingItem, setEditingItem] = useState(null);
    const [editFormData, setEditFormData] = useState({
        name: '',
        barcode: '',
        category: '',
        price: '',
        minStockThreshold: '',
        location: '',
        description: ''
    });
    const [editCustomFields, setEditCustomFields] = useState([]);
    const [editLoading, setEditLoading] = useState(false);

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createFormData, setCreateFormData] = useState({
        name: '',
        barcode: '',
        category: '',
        price: '',
        minStockThreshold: '10',
        location: '',
        description: ''
    });
    const [createCustomFields, setCreateCustomFields] = useState([]);
    const [createLoading, setCreateLoading] = useState(false);

    useEffect(() => {
        loadItems();
        fetchLocations();
    }, [filters]);

    const loadItems = async () => {
        const data = await fetchItems(filters);
        if (data) {
            setPagination({
                totalPages: data.totalPages,
                currentPage: data.currentPage,
                totalItems: data.totalItems,
            });
        }
    };

    const handleSearch = debounce((value) => {
        setFilters({ ...filters, search: value, page: 1 });
    }, 500);

    const handleDelete = async (id) => {
        confirmDelete('Are you sure you want to delete this item?', async () => {
            await deleteItem(id);
            loadItems();
        });
    };

    const handleEdit = (item) => {
        setEditingItem(item);
        setEditFormData({
            name: item.name,
            barcode: item.barcode || '',
            category: item.category?._id || item.category || '',
            price: item.price,
            minStockThreshold: item.minStockThreshold,
            location: item.location || '',
            description: item.description || ''
        });

        // Convert customFields Map to array
        const fields = [];
        if (item.customFields) {
            Object.entries(item.customFields).forEach(([key, value]) => {
                fields.push({ key, value });
            });
        }
        setEditCustomFields(fields);
    };

    const handleEditChange = (e) => {
        setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        setEditLoading(true);

        try {
            const formData = new FormData();
            Object.entries(editFormData).forEach(([key, value]) => {
                formData.append(key, value);
            });

            const customFieldsObj = {};
            editCustomFields.forEach(field => {
                if (field.key.trim()) {
                    customFieldsObj[field.key.trim()] = field.value;
                }
            });
            formData.append('customFields', JSON.stringify(customFieldsObj));

            const result = await updateItem(editingItem._id, formData);
            if (result.success) {
                setEditingItem(null);
                loadItems();
            }
        } catch (error) {
            toast.error('Failed to update item');
        } finally {
            setEditLoading(false);
        }
    };

    const addEditCustomField = () => {
        setEditCustomFields([...editCustomFields, { key: '', value: '' }]);
    };

    const removeEditCustomField = (index) => {
        setEditCustomFields(editCustomFields.filter((_, i) => i !== index));
    };

    const handleEditCustomFieldChange = (index, field, value) => {
        const newFields = [...editCustomFields];
        newFields[index][field] = value;
        setEditCustomFields(newFields);
    };

    const handleCreateChange = (e) => {
        setCreateFormData({ ...createFormData, [e.target.name]: e.target.value });
    };

    const addCreateCustomField = () => {
        setCreateCustomFields([...createCustomFields, { key: '', value: '' }]);
    };

    const removeCreateCustomField = (index) => {
        setCreateCustomFields(createCustomFields.filter((_, i) => i !== index));
    };

    const handleCreateCustomFieldChange = (index, field, value) => {
        const newFields = [...createCustomFields];
        newFields[index][field] = value;
        setCreateCustomFields(newFields);
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        setCreateLoading(true);

        try {
            const formData = new FormData();
            Object.entries(createFormData).forEach(([key, value]) => {
                formData.append(key, value);
            });
            formData.append('quantity', 0);

            const customFieldsObj = {};
            createCustomFields.forEach(field => {
                if (field.key.trim()) {
                    customFieldsObj[field.key.trim()] = field.value;
                }
            });
            formData.append('customFields', JSON.stringify(customFieldsObj));

            const result = await createItem(formData);
            if (result.success) {
                setIsCreateModalOpen(false);
                setCreateFormData({
                    name: '',
                    barcode: '',
                    category: '',
                    price: '',
                    minStockThreshold: '10',
                    location: '',
                    description: ''
                });
                setCreateCustomFields([]);
                loadItems();
                toast.success('Item created successfully');
            }
        } catch (error) {
            toast.error('Failed to create item');
        } finally {
            setCreateLoading(false);
        }
    };

    const handleExport = () => {
        const exportData = items.map(item => ({
            Name: item.name,
            Barcode: item.barcode || 'N/A',
            Category: item.category?.name || 'N/A',
            Quantity: item.quantity,
            Price: item.price,
            'Min Stock': item.minStockThreshold,
            Location: item.location,
            Status: item.stockStatus,
        }));
        exportToCSV(exportData, `inventory-${new Date().toISOString().split('T')[0]}`);
        toast.success('Inventory exported successfully');
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
                <div className="flex space-x-2">
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm font-semibold"
                    >
                        ➕ Add New Item
                    </button>
                    <button
                        onClick={handleExport}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm font-semibold"
                    >
                        📊 Export CSV
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                        <input
                            type="text"
                            placeholder="Search by name or barcode..."
                            onChange={(e) => handleSearch(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                        <select
                            value={filters.category}
                            onChange={(e) => setFilters({ ...filters, category: e.target.value, page: 1 })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="">All Categories</option>
                            {categories.map(cat => (
                                <option key={cat._id} value={cat._id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Stock Status</label>
                        <select
                            value={filters.status}
                            onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="">All Status</option>
                            <option value="in-stock">In Stock</option>
                            <option value="low-stock">Low Stock</option>
                            <option value="out-of-stock">Out of Stock</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Items per page</label>
                        <select
                            value={filters.limit}
                            onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value), page: 1 })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="10">10</option>
                            <option value="25">25</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Inventory Table */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Barcode</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price (₹)</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {items.length > 0 ? (
                                        items.map((item) => (
                                            <tr key={item._id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {item.image ? (
                                                        <img src={item.image} alt={item.name} className="h-12 w-12 object-cover rounded" />
                                                    ) : (
                                                        <div className="h-12 w-12 bg-gray-200 rounded flex items-center justify-center text-gray-400">
                                                            📦
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    <div>{item.name}</div>
                                                    {item.customFields && Object.keys(item.customFields).length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {Object.entries(item.customFields).map(([key, value]) => (
                                                                <span key={key} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                                                    {key}: {value}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                    {item.barcode || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                    {item.category?.name}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                                    {item.quantity}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {formatCurrency(item.price)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStockStatusColor(item.stockStatus)}`}>
                                                        {item.stockStatus}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                                    <div className="flex space-x-2">
                                                        <button
                                                            onClick={() => handleEdit(item)}
                                                            className="text-primary-600 hover:text-primary-900"
                                                        >
                                                            ✏️ Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(item._id)}
                                                            className="text-red-600 hover:text-red-900"
                                                        >
                                                            🗑️ Delete
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="8" className="px-6 py-4 text-center text-gray-500">
                                                No items found
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {pagination.totalPages > 1 && (
                            <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                                <div className="text-sm text-gray-700">
                                    Showing page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalItems} total items)
                                </div>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                                        disabled={filters.page === 1}
                                        className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Previous
                                    </button>
                                    <button
                                        onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                                        disabled={filters.page >= pagination.totalPages}
                                        className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Edit Modal */}
            {editingItem && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-900">Edit Item</h2>
                            <button onClick={() => setEditingItem(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <form onSubmit={handleUpdate} className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                                    <input
                                        type="text"
                                        name="name"
                                        required
                                        value={editFormData.name}
                                        onChange={handleEditChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
                                    <input
                                        type="text"
                                        name="barcode"
                                        value={editFormData.barcode}
                                        onChange={handleEditChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                    <select
                                        name="category"
                                        required
                                        value={editFormData.category}
                                        onChange={handleEditChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    >
                                        <option value="">Select Category</option>
                                        {categories.map(cat => (
                                            <option key={cat._id} value={cat._id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹)</label>
                                    <input
                                        type="number"
                                        name="price"
                                        required
                                        value={editFormData.price}
                                        onChange={handleEditChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                                    <select
                                        name="location"
                                        value={editFormData.location}
                                        onChange={handleEditChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    >
                                        <option value="">Select Location</option>
                                        {locations.map(loc => (
                                            <option key={loc._id} value={loc.name}>{loc.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-sm font-semibold text-gray-700">Custom Fields</h3>
                                    <button
                                        type="button"
                                        onClick={addEditCustomField}
                                        className="text-xs px-2 py-1 bg-primary-50 text-primary-600 rounded border border-primary-200"
                                    >
                                        + Add Field
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {editCustomFields.map((field, index) => (
                                        <div key={index} className="flex space-x-2">
                                            <input
                                                type="text"
                                                placeholder="Key"
                                                value={field.key}
                                                onChange={(e) => handleEditCustomFieldChange(index, 'key', e.target.value)}
                                                className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-primary-500"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Value"
                                                value={field.value}
                                                onChange={(e) => handleEditCustomFieldChange(index, 'value', e.target.value)}
                                                className="flex-[1.5] px-3 py-1.5 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-primary-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeEditCustomField(index)}
                                                className="p-1 text-red-500"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex space-x-3 pt-4 border-t border-gray-100">
                                <button
                                    type="submit"
                                    disabled={editLoading}
                                    className="flex-1 bg-primary-600 text-white py-2 rounded-lg font-bold hover:bg-primary-700 disabled:opacity-50"
                                >
                                    {editLoading ? 'Updating...' : 'Save Changes'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEditingItem(null)}
                                    className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-bold"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Create Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-900">Add New Item</h2>
                            <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <form onSubmit={handleCreateSubmit} className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                                    <input
                                        type="text"
                                        name="name"
                                        required
                                        value={createFormData.name}
                                        onChange={handleCreateChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
                                    <input
                                        type="text"
                                        name="barcode"
                                        value={createFormData.barcode}
                                        onChange={handleCreateChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                    <select
                                        name="category"
                                        required
                                        value={createFormData.category}
                                        onChange={handleCreateChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    >
                                        <option value="">Select Category</option>
                                        {categories.map(cat => (
                                            <option key={cat._id} value={cat._id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹)</label>
                                    <input
                                        type="number"
                                        name="price"
                                        required
                                        value={createFormData.price}
                                        onChange={handleCreateChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Min Stock Threshold</label>
                                    <input
                                        type="number"
                                        name="minStockThreshold"
                                        value={createFormData.minStockThreshold}
                                        onChange={handleCreateChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                                    <select
                                        name="location"
                                        value={createFormData.location}
                                        onChange={handleCreateChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    >
                                        <option value="">Select Location</option>
                                        {locations.map(loc => (
                                            <option key={loc._id} value={loc.name}>{loc.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    name="description"
                                    rows="3"
                                    value={createFormData.description}
                                    onChange={handleCreateChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                ></textarea>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-sm font-semibold text-gray-700">Custom Fields</h3>
                                    <button
                                        type="button"
                                        onClick={addCreateCustomField}
                                        className="text-xs px-2 py-1 bg-primary-50 text-primary-600 rounded border border-primary-200"
                                    >
                                        + Add Field
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {createCustomFields.map((field, index) => (
                                        <div key={index} className="flex space-x-2">
                                            <input
                                                type="text"
                                                placeholder="Key"
                                                value={field.key}
                                                onChange={(e) => handleCreateCustomFieldChange(index, 'key', e.target.value)}
                                                className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-primary-500"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Value"
                                                value={field.value}
                                                onChange={(e) => handleCreateCustomFieldChange(index, 'value', e.target.value)}
                                                className="flex-[1.5] px-3 py-1.5 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-primary-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeCreateCustomField(index)}
                                                className="p-1 text-red-500"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex space-x-3 pt-4 border-t border-gray-100">
                                <button
                                    type="submit"
                                    disabled={createLoading}
                                    className="flex-1 bg-primary-600 text-white py-2 rounded-lg font-bold hover:bg-primary-700 disabled:opacity-50"
                                >
                                    {createLoading ? 'Creating...' : 'Create Item'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-bold"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventory;
