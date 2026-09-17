import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchableSelect from '../components/SearchableSelect';
import { InventoryContext } from '../context/InventoryContext';
import toast from 'react-hot-toast';
import api from '../utils/api';
import Drawer from '../components/ui/Drawer';
import FormField, { FormSection } from '../components/ui/FormField';
import EmptyState from '../components/ui/EmptyState';
const StockInward = () => {
    const { 
        items, fetchItems, categories, locations, 
        createItem, createTransaction, billingSettings, 
        activePreset, hsnCodes, fetchHsnCodes,
        purchaseOrders, fetchPurchaseOrders
    } = useContext(InventoryContext);
    const navigate = useNavigate();
    const [isNewItem, setIsNewItem] = useState(true);
    const [isOpeningStock, setIsOpeningStock] = useState(false);
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
        hsn: '',
        vendor: '',
        billNumber: '',
    });
    const [customFields, setCustomFields] = useState([]);
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [selectedItem, setSelectedItem] = useState('');
    const [selectedPO, setSelectedPO] = useState(null);
    const [poItems, setPoItems] = useState([]);
    const [receivingPo, setReceivingPo] = useState(false);
    const [vendors, setVendors] = useState([]);

    useEffect(() => {
        fetchItems({ limit: 1000 });
        fetchHsnCodes();
        const fetchVendors = async () => {
            try {
                const res = await api.get('/vendors?limit=1000');
                setVendors(res.data.data?.vendors || []);
            } catch (error) {
                console.error('Failed to fetch vendors:', error);
            }
        };
        fetchVendors();
        if (billingSettings?.workflowConfig?.enforcePO) {
            fetchPurchaseOrders({ status: 'issued' });
        }
    }, [billingSettings?.workflowConfig?.enforcePO]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleItemSelect = (e) => {
        const itemId = e.target ? e.target.value : e;
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
                    hsn: item.hsn || '',
                    brand: item.brand || '',
                    size: item.size || '',
                    pcsPerBox: item.pcsPerBox || 1,
                    sqFtPerPc: item.sqFtPerPc || 0,
                });
            }
        }
    };

    const handlePOSelect = (poId) => {
        const po = purchaseOrders.find(p => p._id === poId);
        setSelectedPO(po);
        if (po) {
            setPoItems(po.items.map(item => ({
                ...item,
                receivedQuantity: item.quantity,
                damagedQuantity: 0,
                location: ''
            })));
        } else {
            setPoItems([]);
        }
    };

    const handleReceivePO = async () => {
        if (!selectedPO) return;
        setReceivingPo(true);
        try {
            // Use the single server endpoint to receive the PO
            const payload = {
                receivedItems: poItems.map(item => ({
                    item: item.item._id || item.item,
                    receivedQuantity: item.receivedQuantity,
                    damagedQuantity: item.damagedQuantity || 0,
                    location: item.location || formData.location,
                    price: item.price,
                    batchNumber: formData.batchNumber || `PO-${selectedPO.orderNumber}`
                }))
            };

            await api.post(`/purchase-orders/${selectedPO._id}/receive`, payload);
            
            toast.success(`Purchase Order ${selectedPO.orderNumber} received successfully!`);
            navigate('/inventory');
        } catch (error) {
            console.error('Receive PO error:', error);
            toast.error(error.response?.data?.message || 'Failed to receive Purchase Order');
        } finally {
            setReceivingPo(false);
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
            // Calculate actual submission quantity (e.g. for tiles, convert boxes to sqft)
            let actualQuantity = parseFloat(formData.quantity) || 0;
            let actualDamaged = parseFloat(formData.damagedQuantity) || 0;
            const isTile = activePreset?.id === 'tiles' && !['pieces', 'pcs', 'nos', 'piece'].includes((item.unitType || '').toLowerCase());
            
            if (isTile) {
                const pcsPerBox = parseFloat(formData.pcsPerBox) || 1;
                const sqFtPerPc = parseFloat(formData.sqFtPerPc) || 0;
                if (sqFtPerPc > 0) {
                    actualQuantity = actualQuantity * pcsPerBox * sqFtPerPc;
                    actualDamaged = actualDamaged * pcsPerBox * sqFtPerPc;
                }
            }

            if (isNewItem) {
                // Create new item logic
                const itemFormData = new FormData();
                
                // Standard fields
                const standardFields = ['name', 'barcode', 'sku', 'category', 'price', 'minStockThreshold', 'location', 'brand', 'size', 'pcsPerBox', 'sqFtPerPc', 'hsn'];
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
                    const standardFields = ['name', 'barcode', 'sku', 'category', 'price', 'minStockThreshold', 'location', 'brand', 'size', 'pcsPerBox', 'sqFtPerPc', 'hsn'];
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
                        quantity: actualQuantity,
                        damagedQuantity: actualDamaged,
                        reason: isOpeningStock ? 'Opening Stock' : (formData.reason || 'Initial stock'),
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
                    quantity: actualQuantity,
                    damagedQuantity: actualDamaged,
                    reason: isOpeningStock ? 'Opening Stock' : (formData.reason || 'Restocking'),
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
        <div className="animate-in space-y-5">
            {/* Page Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Stock Inward</h1>
                    <p className="page-subtitle">Add new inventory, process purchase orders, or add opening stock</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Mode Selector */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-2">
                    <button 
                        type="button"
                        onClick={() => { setIsOpeningStock(false); setIsNewItem(true); setFormData({...formData, billNumber: '', vendor: ''}); }}
                        className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all ${!isOpeningStock ? 'bg-primary-50 text-primary-700 border-2 border-primary-200' : 'bg-gray-50 text-gray-500 border-2 border-transparent hover:bg-gray-100'}`}
                    >
                        🏢 Receive from Vendor
                    </button>
                    <button 
                        type="button"
                        onClick={() => { setIsOpeningStock(true); setIsNewItem(true); setFormData({...formData, billNumber: '', vendor: ''}); }}
                        className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all ${isOpeningStock ? 'bg-primary-50 text-primary-700 border-2 border-primary-200' : 'bg-gray-50 text-gray-500 border-2 border-transparent hover:bg-gray-100'}`}
                    >
                        📦 Opening Stock / Adjustment
                    </button>
                </div>

                {/* Item Type Selector */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-2">
                    <button 
                        type="button"
                        onClick={() => setIsNewItem(true)}
                        className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all ${isNewItem ? 'bg-purple-50 text-purple-700 border-2 border-purple-200' : 'bg-gray-50 text-gray-500 border-2 border-transparent hover:bg-gray-100'}`}
                    >
                        ✨ Add New Item
                    </button>
                    <button 
                        type="button"
                        onClick={() => setIsNewItem(false)}
                        className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all ${!isNewItem ? 'bg-purple-50 text-purple-700 border-2 border-purple-200' : 'bg-gray-50 text-gray-500 border-2 border-transparent hover:bg-gray-100'}`}
                    >
                        🔄 Update Existing
                    </button>
                </div>
            </div>

            {/* Form Area */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    
                    {/* Header Info (Vendor/Bill for regular inward, none for opening stock) */}
                    {!isOpeningStock && (
                        <FormSection icon="🏢" title="Vendor Information" color="#eff6ff">
                            <div className="form-grid-2">
                                <FormField label="Vendor" required>
                                    <SearchableSelect
                                        options={vendors}
                                        value={formData.vendor}
                                        onChange={(val) => setFormData({ ...formData, vendor: val })}
                                        placeholder="Select Vendor..."
                                        displayKey="companyName"
                                        valueKey="_id"
                                    />
                                </FormField>
                                <FormField label="Bill / Invoice Number">
                                    <input 
                                        type="text" 
                                        value={formData.billNumber} 
                                        onChange={(e) => setFormData({ ...formData, billNumber: e.target.value })} 
                                        placeholder="e.g. INV-2023-001"
                                    />
                                </FormField>
                            </div>
                        </FormSection>
                    )}

                    {/* Item Selection (if updating existing) */}
                    {!isNewItem && (
                        <FormSection icon="🔍" title="Select Existing Item" color="#faf5ff">
                            <FormField label="Search Item" required>
                                <SearchableSelect
                                    options={items}
                                    value={selectedItem}
                                    onChange={(val) => {
                                        setSelectedItem(val);
                                        const item = items.find(i => i._id === val);
                                        if (item) {
                                            setFormData(prev => ({
                                                ...prev,
                                                price: item.price || '',
                                                category: item.category?._id || '',
                                                location: item.location?._id || ''
                                            }));
                                        }
                                    }}
                                    placeholder="Search by name or barcode..."
                                    displayKey="name"
                                    valueKey="_id"
                                />
                            </FormField>
                        </FormSection>
                    )}

                    {/* Basic Info (if new item) */}
                    {isNewItem && (
                        <FormSection icon="✨" title="New Item Details" color="#faf5ff">
                            <div className="form-grid-2">
                                <FormField label="Item Name" required>
                                    <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Premium Floor Tile" required />
                                </FormField>
                                <FormField label="Barcode">
                                    <input type="text" value={formData.barcode} onChange={(e) => setFormData({ ...formData, barcode: e.target.value })} placeholder="Scan or type barcode" />
                                </FormField>
                                <FormField label="Category" required>
                                    <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} required>
                                        <option value="">Select Category</option>
                                        {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                                    </select>
                                </FormField>
                                <FormField label="HSN Code">
                                    <input type="text" value={formData.hsn} onChange={(e) => setFormData({ ...formData, hsn: e.target.value })} placeholder="e.g. 6907" />
                                </FormField>
                            </div>
                            <div className="mt-4">
                                {renderDynamicFields(formData, setFormData)}
                            </div>
                        </FormSection>
                    )}

                    {/* Quantity & Pricing */}
                    <FormSection icon="⚖️" title="Quantity & Pricing" color="#f0fdf4">
                        <div className="form-grid-3">
                            <FormField label="Inward Quantity" required>
                                <input type="number" step="0.01" min="0.01" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} placeholder="e.g. 100" required />
                            </FormField>
                            <FormField label="Damaged/Defective Qty">
                                <input type="number" step="0.01" min="0" value={formData.damagedQuantity} onChange={(e) => setFormData({ ...formData, damagedQuantity: e.target.value })} placeholder="e.g. 2" />
                            </FormField>
                            <FormField label={isOpeningStock ? "Stock Value/Unit (₹)" : "Purchase Price/Unit (₹)"} required>
                                <input type="number" step="0.01" min="0" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} placeholder="0.00" required />
                            </FormField>
                            
                            <FormField label="Location" required={isOpeningStock}>
                                <select value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} required={isOpeningStock}>
                                    <option value="">Select Location</option>
                                    {locations.map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}
                                </select>
                            </FormField>
                            <FormField label="Batch/Lot Number">
                                <input type="text" value={formData.batchNumber} onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })} placeholder="e.g. LOT-A-101" />
                            </FormField>
                        </div>
                    </FormSection>

                    {/* Notes */}
                    <FormSection icon="📝" title="Additional Details" color="#fef9c3">
                        <div className="form-grid-2">
                            <FormField label="Reason/Source" className="form-full">
                                <input type="text" value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} placeholder={isOpeningStock ? "e.g. Initial Stock Entry" : "e.g. Received from primary vendor"} />
                            </FormField>
                            <FormField label="Notes" className="form-full">
                                <textarea rows="2" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Any internal notes or condition remarks..." />
                            </FormField>
                        </div>
                    </FormSection>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button type="button" onClick={() => navigate('/inventory')} className="btn-secondary">
                            Cancel
                        </button>
                        <button type="submit" disabled={loading} className="btn-primary" style={{background:'#10b981'}}>
                            {loading ? 'Processing...' : '✓ Confirm & Save'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};

export default StockInward;
