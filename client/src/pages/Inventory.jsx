import { useState, useEffect, useContext } from 'react';
import { InventoryContext } from '../context/InventoryContext';
import { formatCurrency, formatDate, getStockStatusColor, exportToCSV, debounce } from '../utils/helpers';
import toast from 'react-hot-toast';
import SearchableSelect from '../components/SearchableSelect';

const Inventory = () => {
    const {
        items, fetchItems, deleteItem, createItem, updateItem,
        categories, locations, fetchLocations, loading, confirmDelete,
        billingSettings, activePreset, hsnCodes, fetchHsnCodes, sizes, brands, finishes
    } = useContext(InventoryContext);
    const [filters, setFilters] = useState({
        search: '',
        category: '',
        status: '',
        location: '',
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
        purchasePrice: '',
        minStockThreshold: '',
        location: '',
        description: '',
        brand: '',
        partNumber: '',
        size: '',
        hsn: '',
        pcsPerBox: '',
        sqFtPerPc: '',
        unitType: 'box',
    });
    const [editCustomFields, setEditCustomFields] = useState([]);
    const [editLoading, setEditLoading] = useState(false);

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createFormData, setCreateFormData] = useState({
        name: '',
        barcode: '',
        category: '',
        price: '',
        purchasePrice: '',
        minStockThreshold: '',
        location: '',
        description: '',
        brand: '',
        partNumber: '',
        size: '',
        hsn: '',
        pcsPerBox: '',
        sqFtPerPc: '',
        unitType: 'box',
    });
    const [createCustomFields, setCreateCustomFields] = useState([]);
    const [createLoading, setCreateLoading] = useState(false);

    // Auto-calculate SqFt from Size text ONLY when no managed size selected
    // (Only applies to small numbers that are likely in feet, e.g. '2x4' = 8 sqft)
    // For mm/cm sizes like '2400X800', user should use managed sizes list or enter sqFtPerPc manually
    useEffect(() => {
        if (billingSettings?.industry === 'tiles' && createFormData.size) {
            // Skip auto-calc if a managed size matches (dropdown already handled it)
            if (sizes.find(s => s.name === createFormData.size)) return;
            const parts = createFormData.size.split(/[x*]/i);
            if (parts.length === 2) {
                const w = parseFloat(parts[0]);
                const h = parseFloat(parts[1]);
                // Only auto-calc for feet-range values (< 50), skip mm/cm values like 2400, 800
                if (!isNaN(w) && !isNaN(h) && w < 50 && h < 50) {
                    setCreateFormData(prev => ({ ...prev, sqFtPerPc: (w * h).toFixed(3) }));
                }
            }
        }
    }, [createFormData.size, billingSettings?.industry]);

    useEffect(() => {
        if (billingSettings?.industry === 'tiles' && editFormData.size) {
            // Skip auto-calc if a managed size matches (dropdown already handled it)
            if (sizes.find(s => s.name === editFormData.size)) return;
            const parts = editFormData.size.split(/[x*]/i);
            if (parts.length === 2) {
                const w = parseFloat(parts[0]);
                const h = parseFloat(parts[1]);
                // Only auto-calc for feet-range values (< 50), skip mm/cm values like 2400, 800
                if (!isNaN(w) && !isNaN(h) && w < 50 && h < 50) {
                    setEditFormData(prev => ({ ...prev, sqFtPerPc: (w * h).toFixed(3) }));
                }
            }
        }
    }, [editFormData.size, billingSettings?.industry]);

    useEffect(() => {
        loadItems();
        fetchLocations();
        fetchHsnCodes();
    }, [filters]);

    /**
     * Renders industry-specific fields dynamically
     */
    const renderDynamicFields = (formData, setFormData) => {
        if (!activePreset?.productFields?.length) return null;

        const handleChange = (name, value) => {
            setFormData(prev => ({ ...prev, [name]: value }));
        };

        return (
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <div className="md:col-span-2 text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>
                    {activePreset.name} Specific Fields
                </div>
                {activePreset.productFields.map((field) => (
                    <div key={field.name}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                        {field.name === 'size' && billingSettings?.industry === 'tiles' ? (
                            <div className="space-y-2">
                                <select
                                    value={sizes.find(s => s.name.replace(/[x*]/gi, 'x').toLowerCase() === (formData[field.name] || '').replace(/[x*]/gi, 'x').toLowerCase()) ? sizes.find(s => s.name.replace(/[x*]/gi, 'x').toLowerCase() === (formData[field.name] || '').replace(/[x*]/gi, 'x').toLowerCase())?.name : (formData[field.name] ? '__custom__' : '')}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '__custom__') {
                                            // Keep existing custom value, just switch to custom mode
                                            return;
                                        }
                                        handleChange(field.name, val);
                                        // Auto-calculate sqFtPerPc from managed size with unit conversion
                                        const selectedSize = sizes.find(s => s.name === val);
                                        if (selectedSize) {
                                            const w = Number(selectedSize.width);
                                            const h = Number(selectedSize.height);
                                            const unit = (selectedSize.unit || 'inches').toLowerCase();
                                            let sqft = 0;
                                            if (unit === 'feet') {
                                                sqft = w * h;
                                            } else if (unit === 'inches') {
                                                sqft = (w * h) / 144;
                                            } else if (unit === 'cm') {
                                                sqft = (w * h) / 929.03;
                                            } else if (unit === 'mm') {
                                                sqft = (w * h) / 92903;
                                            } else {
                                                sqft = w * h;
                                            }
                                            handleChange('sqFtPerPc', sqft.toFixed(3));
                                        }
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none font-bold"
                                >
                                    <option value="">Select Size</option>
                                    {sizes.map(s => <option key={s._id} value={s.name}>{s.name} ({s.width}×{s.height} {s.unit})</option>)}
                                    <option value="__custom__">✏️ Custom Size...</option>
                                </select>
                                {/* Show text input when no managed size matches (using normalized comparison) */}
                                {(!sizes.find(s => s.name.replace(/[x*]/gi, 'x').toLowerCase() === (formData[field.name] || '').replace(/[x*]/gi, 'x').toLowerCase())) && (
                                    <input
                                        type="text"
                                        value={formData[field.name] || ''}
                                        onChange={(e) => handleChange(field.name, e.target.value)}
                                        className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none text-sm"
                                        placeholder="Type custom size (e.g. 2400X800)"
                                    />
                                )}
                            </div>
                        ) : field.type === 'select' ? (
                            <select
                                value={formData[field.name] || ''}
                                onChange={(e) => handleChange(field.name, e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                            >
                                <option value="">Select {field.label}</option>
                                {field.name === 'finish'
                                    ? (finishes || []).map(f => <option key={f._id} value={f.name}>{f.name}</option>)
                                    : (field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)
                                }
                            </select>
                        ) : field.type === 'textarea' ? (
                            <textarea
                                value={formData[field.name] || ''}
                                onChange={(e) => handleChange(field.name, e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none h-20"
                                placeholder={field.placeholder}
                            />
                        ) : (
                            <input
                                type={field.type || 'text'}
                                value={formData[field.name] || ''}
                                onChange={(e) => handleChange(field.name, e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                placeholder={field.placeholder}
                                required={field.required}
                            />
                        )}
                    </div>
                ))}
            </div>
        );
    };


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
        await confirmDelete('Are you sure you want to delete this item?', async () => {
            await deleteItem(id);
            loadItems();
            toast.success('Item deleted successfully');
        });
    };

    const handleEdit = (item) => {
        setEditingItem(item);
        setEditFormData({
            name: item.name,
            barcode: item.barcode || '',
            category: item.category?._id || item.category || '',
            price: item.price || '',
            purchasePrice: item.purchasePrice || '',
            minStockThreshold: item.minStockThreshold || '',
            location: item.location || '',
            description: item.description || '',
            brand: item.brand || '',
            partNumber: item.partNumber || '',
            size: item.size || '',
            hsn: item.hsn || '',
            pcsPerBox: item.pcsPerBox || '',
            sqFtPerPc: item.sqFtPerPc || '',
            unitType: item.unitType || 'box',
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
        const updated = { ...editFormData, [e.target.name]: e.target.value };
        // Reset brand when category changes (brands are category-specific)
        if (e.target.name === 'category') updated.brand = '';
        setEditFormData(updated);
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        setEditLoading(true);

        try {
            const formData = new FormData();
            const standardFields = ['name', 'barcode', 'partNumber', 'category', 'price', 'purchasePrice', 'minStockThreshold', 'location', 'description', 'brand', 'size', 'hsn', 'pcsPerBox', 'sqFtPerPc'];
            
            const customFieldsObj = {};

            Object.entries(editFormData).forEach(([key, value]) => {
                if (standardFields.includes(key)) {
                    formData.append(key, value);
                } else if (value !== undefined && value !== '') {
                    customFieldsObj[key] = value;
                }
            });

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
                toast.success('Item updated successfully');
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
        const updated = { ...createFormData, [e.target.name]: e.target.value };
        // Reset brand when category changes (brands are category-specific)
        if (e.target.name === 'category') updated.brand = '';
        setCreateFormData(updated);
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
            const standardFields = ['name', 'barcode', 'partNumber', 'category', 'price', 'purchasePrice', 'minStockThreshold', 'location', 'description', 'brand', 'size', 'hsn', 'pcsPerBox', 'sqFtPerPc'];
            
            const customFieldsObj = {};
            
            // Add standard fields to FormData
            Object.entries(createFormData).forEach(([key, value]) => {
                if (standardFields.includes(key)) {
                    formData.append(key, value);
                } else if (value !== undefined && value !== '') {
                    // Move non-standard fields to customFields
                    customFieldsObj[key] = value;
                }
            });
            
            formData.append('quantity', 0);

            // Add manually added custom fields
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
                    minStockThreshold: '',
                    location: '',
                    description: '',
                    brand: '',
                    partNumber: '',
                    size: '',
                    hsn: '',
                    pcsPerBox: 1,
                    unitType: 'box',
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
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
                        <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                        <select
                            value={filters.location || ''}
                            onChange={(e) => setFilters({ ...filters, location: e.target.value, page: 1 })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="">All Locations</option>
                            <option value="empty_location">Empty (No Location)</option>
                            {locations.map(loc => (
                                <option key={loc._id} value={loc.name}>{loc.name}</option>
                            ))}
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

            {/* Inventory Table / Card View */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden relative min-h-[400px]">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table View */}
                        <div className="hidden lg:block overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Image</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Name & Details</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Stock</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Price (₹)</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {items.length > 0 ? (
                                        items.map((item) => (
                                            <tr 
                                                key={item._id} 
                                                className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                                                onClick={() => handleEdit(item)}
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {item.image ? (
                                                        <img src={item.image} alt={item.name} className="h-12 w-12 object-cover rounded-lg border border-gray-100 shadow-sm" />
                                                    ) : (
                                                        <div className="h-12 w-12 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 border border-gray-100 border-dashed">
                                                            📦
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-gray-900 leading-tight">{item.name}</div>
                                                    <div className="text-[10px] text-gray-400 font-mono mt-0.5">{item.unitType?.toUpperCase() || 'BOX'}</div>
                                                    {/* Show brand, size, hsn if present */}
                                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                                        {item.brand && (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-600 border border-blue-100 uppercase tracking-tighter">
                                                                {item.brand}
                                                            </span>
                                                        )}
                                                        {item.size && (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-50 text-purple-600 border border-purple-100 uppercase tracking-tighter">
                                                                {item.size}
                                                            </span>
                                                        )}
                                                        {item.hsn && (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-600 border border-amber-100 uppercase tracking-tighter">
                                                                HSN: {item.hsn}
                                                            </span>
                                                        )}
                                                        {item.customFields && Object.keys(item.customFields).length > 0 && (
                                                            Object.entries(item.customFields).slice(0, 2).map(([key, value]) => (
                                                                <span key={key} className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-tighter">
                                                                    {key}: {value}
                                                                </span>
                                                            ))
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] font-bold rounded-md border border-gray-200">
                                                        {item.category?.name || 'Uncategorized'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <div className="text-sm font-black text-gray-900">{item.quantity}</div>
                                                    <div className="text-[10px] text-gray-400 uppercase font-bold">{item.unitType?.toUpperCase() || 'BOX'}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-black text-rose-600">{formatCurrency(item.price)}</div>
                                                    {item.purchasePrice && <div className="text-[9px] text-gray-400 line-through">₹{item.purchasePrice}</div>}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider ${getStockStatusColor(item.stockStatus)}`}>
                                                        {item.stockStatus}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                    <div className="flex space-x-3">
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleEdit(item); }} 
                                                            className="text-slate-400 hover:text-blue-600 transition-colors" 
                                                            title="Edit"
                                                        >
                                                            <span className="text-lg">✏️</span>
                                                        </button>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(item._id); }} 
                                                            className="text-slate-400 hover:text-red-600 transition-colors" 
                                                            title="Delete"
                                                        >
                                                            <span className="text-lg">🗑️</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="7" className="px-6 py-12 text-center text-gray-400">
                                                <div className="text-3xl mb-2">🔍</div>
                                                <div className="font-bold uppercase text-xs tracking-widest">No items found</div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="lg:hidden grid grid-cols-1 gap-4 p-4 pb-24">
                            {items.length > 0 ? (
                                items.map((item) => (
                                    <div 
                                        key={item._id} 
                                        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden relative group cursor-pointer hover:border-gray-300 transition-colors"
                                        onClick={() => handleEdit(item)}
                                    >
                                        <div className="flex items-start p-4 gap-4">
                                            {/* Image/Icon Section */}
                                            <div className="flex-shrink-0">
                                                {item.image ? (
                                                    <img src={item.image} alt={item.name} className="h-20 w-20 object-cover rounded-xl shadow-sm border border-gray-50" />
                                                ) : (
                                                    <div className="h-20 w-20 bg-gray-50 rounded-xl flex items-center justify-center text-gray-300 border border-gray-100 border-dashed text-3xl">
                                                        📦
                                                    </div>
                                                )}
                                            </div>

                                            {/* Info Section */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-1">
                                                    <div className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[8px] font-black uppercase rounded tracking-widest border border-gray-200">
                                                        {item.category?.name || 'UNCAT'}
                                                    </div>
                                                    <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${
                                                        item.stockStatus === 'in-stock' ? 'bg-green-50 text-green-600 border-green-100' : 
                                                        item.stockStatus === 'low-stock' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                                                        'bg-red-50 text-red-600 border-red-100'
                                                    }`}>
                                                        {item.stockStatus}
                                                    </div>
                                                </div>
                                                
                                                <h4 className="text-sm font-black text-gray-900 leading-tight mb-1 truncate">{item.name}</h4>
                                                <div className="text-[10px] text-gray-400 font-mono mb-3">Unit: {item.unitType?.toUpperCase() || 'BOX'}</div>

                                                <div className="flex items-end justify-between">
                                                    <div>
                                                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Current Stock</div>
                                                        <div className="text-xl font-black text-gray-900">{item.quantity} <span className="text-[10px] font-bold text-gray-400">{item.unitType?.toUpperCase() || (billingSettings?.industry === 'tiles' ? 'BOX' : 'PCS')}</span></div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Price</div>
                                                        <div className="text-lg font-black text-rose-600">₹{item.price}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Bar */}
                                        <div className="mt-4 flex gap-2 border-t border-gray-50 pt-3 px-4 pb-4">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleEdit(item); }} 
                                                className="flex-1 py-1.5 flex justify-center items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-gray-100"
                                            >
                                                <span className="text-sm">✏️</span> Edit
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDelete(item._id); }} 
                                                className="flex-1 py-1.5 flex justify-center items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-gray-100"
                                            >
                                                <span className="text-sm">🗑️</span> Delete
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 m-4">
                                    <div className="text-4xl mb-4 opacity-20">🔍</div>
                                    <div className="font-black uppercase text-[10px] tracking-widest text-gray-400">No matching items found</div>
                                </div>
                            )}
                        </div>

                        {/* Pagination */}
                        {pagination.totalPages > 1 && (
                            <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-100">
                                <div className="hidden sm:block text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                    Page {pagination.currentPage} / {pagination.totalPages}
                                </div>
                                <div className="flex w-full sm:w-auto justify-between sm:justify-end gap-2">
                                    <button
                                        onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                                        disabled={filters.page === 1}
                                        className="flex-1 sm:flex-none px-4 py-1.5 border border-gray-200 rounded-lg text-[10px] font-bold text-gray-600 hover:bg-white disabled:opacity-30 transition-all uppercase tracking-widest"
                                    >
                                        Prev
                                    </button>
                                    <button
                                        onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                                        disabled={filters.page >= pagination.totalPages}
                                        className="flex-1 sm:flex-none px-4 py-1.5 border border-gray-200 rounded-lg text-[10px] font-bold text-gray-600 hover:bg-white disabled:opacity-30 transition-all uppercase tracking-widest"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Mobile Floating Action Button */}
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="lg:hidden fixed bottom-20 right-4 w-14 h-14 bg-rose-600 text-white rounded-full shadow-lg flex items-center justify-center text-2xl z-40 animate-bounce-slow"
                >
                    +
                </button>
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
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Part Number</label>
                                    <input
                                        type="text"
                                        name="partNumber"
                                        value={editFormData.partNumber}
                                        onChange={handleEditChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                    <SearchableSelect
                                        name="category"
                                        value={editFormData.category}
                                        onChange={handleEditChange}
                                        placeholder="Select Category"
                                        searchPlaceholder="Search categories..."
                                        options={categories.map(cat => ({ value: cat._id, label: cat.name }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price (₹) per {billingSettings?.unitConfig?.rateBasis?.replace('per_', '') || 'Unit'}</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        name="price"
                                        value={editFormData.price}
                                        onChange={handleEditChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price (₹)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        name="purchasePrice"
                                        value={editFormData.purchasePrice}
                                        onChange={handleEditChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Unit Type</label>
                                    <select
                                        name="unitType"
                                        value={['pieces', 'pcs'].includes(editFormData.unitType?.toLowerCase()) ? 'pieces' : editFormData.unitType?.toLowerCase() || 'box'}
                                        onChange={handleEditChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    >
                                        <option value="box">Box</option>
                                        <option value="bag">Bag</option>
                                        <option value="pieces">Pieces</option>
                                        <option value="kg">Kg</option>
                                        <option value="sqft">SqFt</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Min Stock Threshold</label>
                                    <input
                                        type="number"
                                        name="minStockThreshold"
                                        value={editFormData.minStockThreshold}
                                        onChange={handleEditChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                                    <SearchableSelect
                                        name="location"
                                        value={editFormData.location}
                                        onChange={handleEditChange}
                                        placeholder="Select Location"
                                        searchPlaceholder="Search locations..."
                                        options={locations.map(loc => ({ value: loc.name, label: loc.name }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                                    <SearchableSelect
                                        name="brand"
                                        value={editFormData.brand}
                                        onChange={handleEditChange}
                                        placeholder="Select Brand"
                                        searchPlaceholder="Search brands..."
                                        options={brands
                                            .filter(b => !editFormData.category || String(b.categoryId?._id || b.categoryId) === String(editFormData.category))
                                            .map(b => ({ value: b.name, label: b.name }))
                                        }
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">HSN Code</label>
                                    <SearchableSelect
                                        name="hsn"
                                        value={editFormData.hsn}
                                        onChange={handleEditChange}
                                        placeholder="Select HSN"
                                        searchPlaceholder="Search HSN code or description..."
                                        options={hsnCodes.map(hsn => ({ value: hsn.code, label: `${hsn.code}${hsn.description ? ' - ' + hsn.description : ''}` }))}
                                    />
                                </div>
                                {renderDynamicFields(editFormData, setEditFormData)}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    name="description"
                                    rows="3"
                                    value={editFormData.description}
                                    onChange={handleEditChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                ></textarea>
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
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Unit Type</label>
                                    <select
                                        name="unitType"
                                        value={['pieces', 'pcs'].includes(createFormData.unitType?.toLowerCase()) ? 'pieces' : createFormData.unitType?.toLowerCase() || 'box'}
                                        onChange={handleCreateChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    >
                                        <option value="box">Box</option>
                                        <option value="bag">Bag</option>
                                        <option value="pieces">Pieces</option>
                                        <option value="kg">Kg</option>
                                        <option value="sqft">SqFt</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Part Number</label>
                                    <input
                                        type="text"
                                        name="partNumber"
                                        value={createFormData.partNumber}
                                        onChange={handleCreateChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                    <SearchableSelect
                                        name="category"
                                        value={createFormData.category}
                                        onChange={handleCreateChange}
                                        placeholder="Select Category"
                                        searchPlaceholder="Search categories..."
                                        options={categories.map(cat => ({ value: cat._id, label: cat.name }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price (₹) per {billingSettings?.unitConfig?.rateBasis?.replace('per_', '') || 'Unit'}</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        name="price"
                                        value={createFormData.price}
                                        onChange={handleCreateChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price (₹)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        name="purchasePrice"
                                        value={createFormData.purchasePrice}
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
                                    <SearchableSelect
                                        name="location"
                                        value={createFormData.location}
                                        onChange={handleCreateChange}
                                        placeholder="Select Location"
                                        searchPlaceholder="Search locations..."
                                        options={locations.map(loc => ({ value: loc.name, label: loc.name }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                                    <SearchableSelect
                                        name="brand"
                                        value={createFormData.brand}
                                        onChange={handleCreateChange}
                                        placeholder="Select Brand"
                                        searchPlaceholder="Search brands..."
                                        options={brands
                                            .filter(b => !createFormData.category || String(b.categoryId?._id || b.categoryId) === String(createFormData.category))
                                            .map(b => ({ value: b.name, label: b.name }))
                                        }
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">HSN Code</label>
                                    <SearchableSelect
                                        name="hsn"
                                        value={createFormData.hsn}
                                        onChange={handleCreateChange}
                                        placeholder="Select HSN"
                                        searchPlaceholder="Search HSN code or description..."
                                        options={hsnCodes.map(hsn => ({ value: hsn.code, label: `${hsn.code}${hsn.description ? ' - ' + hsn.description : ''}` }))}
                                    />
                                </div>
                                {renderDynamicFields(createFormData, setCreateFormData)}
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
