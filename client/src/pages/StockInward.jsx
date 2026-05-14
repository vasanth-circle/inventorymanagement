import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { InventoryContext } from '../context/InventoryContext';
import toast from 'react-hot-toast';

const StockInward = () => {
    const { items, fetchItems, categories, locations, createItem, createTransaction, billingSettings, activePreset } = useContext(InventoryContext);
    const navigate = useNavigate();
    const [isNewItem, setIsNewItem] = useState(true);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        barcode: '',
        category: '',
        quantity: '',
        damagedQuantity: '',
        price: '',
        minStockThreshold: '10',
        location: '',
        reason: '',
        notes: '',
        batchNumber: '',
    });
    const [customFields, setCustomFields] = useState([]);
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [selectedItem, setSelectedItem] = useState('');

    useEffect(() => {
        fetchItems({ limit: 1000 });
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleItemSelect = (e) => {
        const itemId = e.target.value;
        setSelectedItem(itemId);
        if (itemId) {
            const item = items.find(i => i._id === itemId);
            if (item) {
                setFormData({
                    ...formData,
                    name: item.name,
                    barcode: item.barcode || '',
                    category: item.category?._id || item.category || '',
                    price: item.price,
                });
            }
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast.error('Image size should be less than 5MB');
                return;
            }
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    }

    const addCustomField = () => {
        setCustomFields([...customFields, { key: '', value: '' }]);
    };

    const removeCustomField = (index) => {
        const newFields = customFields.filter((_, i) => i !== index);
        setCustomFields(newFields);
    };

    const handleCustomFieldChange = (index, field, value) => {
        const newFields = [...customFields];
        newFields[index][field] = value;
        setCustomFields(newFields);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (isNewItem) {
                // Create new item logic
                const itemFormData = new FormData();
                
                // Standard fields
                const standardFields = ['name', 'barcode', 'sku', 'category', 'price', 'minStockThreshold', 'location', 'brand', 'size', 'pcsPerBox', 'sqFtPerPc'];
                standardFields.forEach(field => {
                    if (formData[field] !== undefined) {
                        itemFormData.append(field, formData[field]);
                    }
                });

                itemFormData.append('quantity', 0); // Start at 0, transaction will add the quantity

                if (imageFile) {
                    itemFormData.append('image', imageFile);
                }

                // Handle industry-specific and custom fields
                const customFieldsObj = {};
                
                // 1. Add fields from activePreset that are NOT in standardFields
                activePreset?.productFields?.forEach(field => {
                    const standardFields = ['name', 'barcode', 'sku', 'category', 'price', 'minStockThreshold', 'location', 'brand', 'size', 'pcsPerBox', 'sqFtPerPc'];
                    if (!standardFields.includes(field.name) && formData[field.name]) {
                        customFieldsObj[field.name] = formData[field.name];
                    }
                });

                // 2. Add manually added custom fields
                customFields.forEach(field => {
                    if (field.key.trim()) {
                        customFieldsObj[field.key.trim()] = field.value;
                    }
                });
                
                itemFormData.append('customFields', JSON.stringify(customFieldsObj));

                const result = await createItem(itemFormData);

                if (result.success) {
                    // Create transaction record
                    await createTransaction({
                        item: result.data._id,
                        type: 'inward',
                        quantity: parseFloat(formData.quantity),
                        damagedQuantity: parseFloat(formData.damagedQuantity) || 0,
                        reason: formData.reason || 'Initial stock',
                        notes: formData.notes,
                        expiryDate: formData.expiryDate,
                    });

                    toast.success('Item created and stock added successfully!');
                    navigate('/inventory');
                }
            } else {
                // Add stock to existing item
                if (!selectedItem) {
                    toast.error('Please select an item');
                    return;
                }

                const result = await createTransaction({
                    item: selectedItem,
                    type: 'inward',
                    quantity: parseFloat(formData.quantity),
                    damagedQuantity: parseFloat(formData.damagedQuantity) || 0,
                    reason: formData.reason || 'Restocking',
                    notes: formData.notes,
                    batchNumber: formData.batchNumber,
                    price: formData.price,
                    expiryDate: formData.expiryDate,
                });

                if (result.success) {
                    toast.success('Stock added successfully!');
                    navigate('/inventory');
                }
            }
        } catch (error) {
            toast.error('Failed to add stock');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-4 pb-24 lg:pb-8">
            <div className="flex items-center space-x-3 pb-2 border-b border-gray-100">
                <div className="w-10 h-10 bg-white shadow-sm border border-gray-100 rounded-lg flex items-center justify-center text-xl">📥</div>
                <div>
                    <h1 className="text-xl font-bold text-gray-900 leading-tight">Stock Inward</h1>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Add or Restock Items</p>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="mb-6">
                    <div className="flex space-x-4">
                        <button
                            onClick={() => setIsNewItem(true)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${isNewItem
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                        >
                            New Item
                        </button>
                        <button
                            onClick={() => setIsNewItem(false)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${!isNewItem
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                        >
                            Existing Item
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {isNewItem && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Item Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        required
                                        value={formData.name}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        placeholder="Enter item name"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Barcode
                                    </label>
                                    <input
                                        type="text"
                                        name="barcode"
                                        value={formData.barcode}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        placeholder="Enter barcode (optional)"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        SKU
                                    </label>
                                    <input
                                        type="text"
                                        name="sku"
                                        value={formData.sku || ''}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        placeholder="Enter SKU (optional)"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Category <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        name="category"
                                        required
                                        value={formData.category}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    >
                                        <option value="">Select category</option>
                                        {categories.map(cat => (
                                            <option key={cat._id} value={cat._id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Price (₹) <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        name="price"
                                        required
                                        min="0"
                                        step="0.01"
                                        value={formData.price}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        placeholder="Enter price in ₹"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Minimum Stock Threshold
                                    </label>
                                    <input
                                        type="number"
                                        name="minStockThreshold"
                                        min="0"
                                        value={formData.minStockThreshold}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        placeholder="Minimum stock level"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Location
                                    </label>
                                    <select
                                        name="location"
                                        value={formData.location}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    >
                                        <option value="">Select location</option>
                                        {locations.map(loc => (
                                            <option key={loc._id} value={loc.name}>{loc.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Dynamic Industry-Specific Fields */}
                                {activePreset?.productFields?.map((field) => (
                                    <div key={field.name}>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            {field.label} {field.required && <span className="text-red-500">*</span>}
                                        </label>
                                        {field.type === 'select' ? (
                                            <select
                                                name={field.name}
                                                required={field.required}
                                                value={formData[field.name] || field.default || ''}
                                                onChange={handleChange}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                            >
                                                <option value="">Select {field.label}</option>
                                                {field.options.map(opt => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        ) : field.type === 'textarea' ? (
                                            <textarea
                                                name={field.name}
                                                required={field.required}
                                                value={formData[field.name] || ''}
                                                onChange={handleChange}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                                placeholder={field.placeholder || `Enter ${field.label}`}
                                                rows="3"
                                            />
                                        ) : (
                                            <input
                                                type={field.type || 'text'}
                                                name={field.name}
                                                required={field.required}
                                                value={formData[field.name] || ''}
                                                onChange={handleChange}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                                placeholder={field.placeholder || `Enter ${field.label}`}
                                                step={field.precision ? `0.${'0'.repeat(field.precision - 1)}1` : undefined}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="border-t border-gray-100 pt-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-sm font-semibold text-gray-700">Dynamic Custom Fields</h3>
                                    <button
                                        type="button"
                                        onClick={addCustomField}
                                        className="text-xs px-3 py-1 bg-primary-50 text-primary-600 rounded-md hover:bg-primary-100 transition-colors font-medium border border-primary-200"
                                    >
                                        + Add Field
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {customFields.map((field, index) => (
                                        <div key={index} className="flex space-x-3 items-start animate-fade-in">
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    placeholder="Field Name (e.g. Color)"
                                                    value={field.key}
                                                    onChange={(e) => handleCustomFieldChange(index, 'key', e.target.value)}
                                                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                                />
                                            </div>
                                            <div className="flex-[1.5]">
                                                <input
                                                    type="text"
                                                    placeholder="Value (e.g. Blue)"
                                                    value={field.value}
                                                    onChange={(e) => handleCustomFieldChange(index, 'value', e.target.value)}
                                                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeCustomField(index)}
                                                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    ))}
                                    {customFields.length === 0 && (
                                        <p className="text-xs text-gray-400 italic">No custom fields added yet. Add fields for dynamic information like Color, Size, etc.</p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Item Image
                                </label>
                                <div className="flex items-center space-x-4">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageChange}
                                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                                    />
                                    {imagePreview && (
                                        <img src={imagePreview} alt="Preview" className="h-20 w-20 object-cover rounded-lg" />
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {!isNewItem && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Select Existing Item <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={selectedItem}
                                onChange={handleItemSelect}
                                required={!isNewItem}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                                <option value="">-- Choose an item --</option>
                                {items.map(item => (
                                    <option key={item._id} value={item._id}>
                                        {item.name} {item.barcode ? `(${item.barcode})` : ''} - Current: {item.quantity}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Good Quantity <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                name="quantity"
                                required
                                min="0.01"
                                step="0.01"
                                value={formData.quantity}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                placeholder={`Usable ${billingSettings?.unitConfig?.quantityLabel || 'stock'} quantity`}
                            />
                            {activePreset?.id === 'tiles' && selectedItem && (
                                <div className="mt-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
                                    <div className="flex justify-between items-center text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">
                                        <span>Tiles Smart Calc</span>
                                        <span>Auto-Conversion</span>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-xl font-black text-amber-700">
                                            {(() => {
                                                const item = items.find(i => i._id === selectedItem);
                                                if (!item) return '0.00';
                                                const qty = parseFloat(formData.quantity) || 0;
                                                const pcsPerBox = parseFloat(item.pcsPerBox) || 1;
                                                const sqFtPerPc = parseFloat(item.sqFtPerPc) || 0;
                                                
                                                // Assuming inward is done in BOXES for tiles
                                                const totalSqFt = qty * pcsPerBox * sqFtPerPc;
                                                return totalSqFt.toFixed(2);
                                            })()}
                                        </span>
                                        <span className="text-xs font-bold text-amber-500 uppercase">Total SqFt</span>
                                    </div>
                                    <p className="text-[9px] text-amber-500/70 mt-1 italic font-medium">
                                        Based on {items.find(i => i._id === selectedItem)?.pcsPerBox || 1} Pcs/Box and {items.find(i => i._id === selectedItem)?.sqFtPerPc || 0} SqFt/Pc
                                    </p>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Damaged Quantity
                            </label>
                            <input
                                type="number"
                                name="damagedQuantity"
                                min="0"
                                step="0.01"
                                value={formData.damagedQuantity}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-red-600"
                                placeholder={`Damaged ${billingSettings?.unitConfig?.quantityLabel || 'stock'} (optional)`}
                            />
                        </div>

                        <div className="md:col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Batch / Lot Number
                            </label>
                            <input
                                type="text"
                                name="batchNumber"
                                value={formData.batchNumber}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                placeholder="e.g. B-01 or Date"
                            />
                        </div>

                        {activePreset?.id === 'medical' && (
                            <div className="md:col-span-1">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Expiry Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    name="expiryDate"
                                    required
                                    value={formData.expiryDate || ''}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                            </div>
                        )}

                        {!isNewItem && (
                            <div className="md:col-span-1">
                                <label className="block text-sm font-medium text-gray-700 mb-2 font-bold text-primary-700">
                                    Inward Rate ({billingSettings?.unitConfig?.quantityLabel || 'Unit'})
                                </label>
                                <input
                                    type="number"
                                    name="price"
                                    step="0.01"
                                    value={formData.price}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border-2 border-primary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-bold"
                                    placeholder="Rate for this stock"
                                />
                            </div>
                        )}

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Reason
                            </label>
                            <input
                                type="text"
                                name="reason"
                                value={formData.reason}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                placeholder="Purchase, Return, etc."
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Notes
                        </label>
                        <textarea
                            name="notes"
                            value={formData.notes}
                            onChange={handleChange}
                            rows="3"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                            placeholder="Additional notes (optional)"
                        />
                    </div>

                    <div className="flex space-x-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                        >
                            {loading ? 'Processing...' : '📥 Add Stock'}
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/inventory')}
                            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default StockInward;
