import { createContext, useState, useEffect, useContext } from 'react';
import api from '../utils/api';
import { AuthContext } from './AuthContext';
import toast from 'react-hot-toast';
import { confirmDelete as customConfirmDelete } from '../utils/confirmHelper.jsx';
import { getIndustryPreset } from '../config/industryPresets';

export const InventoryContext = createContext();

export const InventoryProvider = ({ children }) => {
    const { user } = useContext(AuthContext);
    const [items, setItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [locations, setLocations] = useState([]);
    const [assetLocations, setAssetLocations] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [hsnCodes, setHsnCodes] = useState([]);
    const [sizes, setSizes] = useState([]);
    const [brands, setBrands] = useState([]);
    const [purchaseOrders, setPurchaseOrders] = useState([]);
    const [billingSettings, setBillingSettings] = useState(null);
    const [activePreset, setActivePreset] = useState(getIndustryPreset('generic'));
    const [loading, setLoading] = useState(false);

    // Sync activePreset when billingSettings change
    useEffect(() => {
        if (billingSettings?.industry) {
            setActivePreset(getIndustryPreset(billingSettings.industry));
        }
    }, [billingSettings]);

    // Fetch categories
    const fetchCategories = async () => {
        try {
            const { data } = await api.get('/categories');
            setCategories(data);
        } catch (error) {
            toast.error('Failed to fetch categories');
        }
    };

    // Fetch items
    const fetchItems = async (params = {}) => {
        setLoading(true);
        try {
            const { data } = await api.get('/items', { params });
            setItems(data.items);
            return data;
        } catch (error) {
            toast.error('Failed to fetch items');
        } finally {
            setLoading(false);
        }
    };

    // Create item
    const createItem = async (formData) => {
        try {
            const { data } = await api.post('/items', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setItems([data, ...items]);
            return { success: true, data };
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create item');
            return { success: false };
        }
    };

    // Update item
    const updateItem = async (id, formData) => {
        try {
            const { data } = await api.put(`/items/${id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setItems(items.map(item => item._id === id ? data : item));
            return { success: true, data };
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update item');
            return { success: false };
        }
    };

    // Delete item
    const deleteItem = async (id) => {
        try {
            await api.delete(`/items/${id}`);
            setItems(items.filter(item => item._id !== id));
            return { success: true };
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete item');
            return { success: false };
        }
    };

    // Create transaction
    const createTransaction = async (transactionData) => {
        try {
            const endpoint = `/transactions/${transactionData.type}`;
            const { data } = await api.post(endpoint, transactionData);
            return { success: true, data };
        } catch (error) {
            toast.error(error.response?.data?.message || 'Transaction failed');
            return { success: false };
        }
    };

    // Fetch transactions
    const fetchTransactions = async (params = {}) => {
        try {
            const { data } = await api.get('/transactions', { params });
            setTransactions(data.transactions);
            return data;
        } catch (error) {
            toast.error('Failed to fetch transactions');
        }
    };

    // Billing Settings functions
    const fetchBillingSettings = async () => {
        try {
            const { data } = await api.get('/settings/billing');
            setBillingSettings(data.data);
            return data.data;
        } catch (error) {
            console.error('Failed to fetch billing settings');
        }
    };

    const updateBillingSettings = async (settingsData) => {
        try {
            const { data } = await api.patch('/settings/billing', settingsData);
            setBillingSettings(data.data);
            return { success: true, data: data.data };
        } catch (error) {
            toast.error('Failed to update settings');
            return { success: false };
        }
    };

    /**
     * Real-world calculation engine based on industry type
     * For tiles: rate is ALWAYS per SqFt, total = totalSqFt × price
     * billingUnit: 'boxes' | 'qty' (pieces) | 'sqft'
     */
    const calculateItemValues = (row, field, value, industry) => {
        if (!row) return row;
        const updatedRow = { ...row, [field]: value };

        const pcsPerBox = Math.max(1, Number(updatedRow.pcsPerBox) || 1);
        const sqFtPerPc = Math.max(0, Number(updatedRow.sqFtPerPc) || 0);
        // Preserve raw value for display, convert for math
        const price = Math.max(0, Number(updatedRow.price) || 0);
        const billingUnit = updatedRow.billingUnit || 'boxes';

        if (industry === 'tiles' && sqFtPerPc > 0) {
            if (field === 'quantity') {
                updatedRow.quantity = value === '' ? '' : value;
                const qty = Number(value || 0);
                if (billingUnit === 'sqft') {
                    updatedRow.totalSqFt = qty;
                    updatedRow.totalPcs = sqFtPerPc > 0 ? qty / sqFtPerPc : 0;
                    updatedRow.boxCount = pcsPerBox > 0 ? updatedRow.totalPcs / pcsPerBox : 0;
                    updatedRow.stockQty = updatedRow.boxCount;
                    updatedRow.stockUnit = 'boxes';
                } else if (billingUnit === 'boxes') {
                    updatedRow.boxCount = qty;
                    updatedRow.totalPcs = qty * pcsPerBox;
                    updatedRow.totalSqFt = Number((updatedRow.totalPcs * sqFtPerPc).toFixed(4));
                    updatedRow.stockQty = qty;
                    updatedRow.stockUnit = 'boxes';
                } else {
                    // 'qty' mode = pieces
                    updatedRow.totalPcs = qty;
                    updatedRow.boxCount = pcsPerBox > 0 ? qty / pcsPerBox : 0;
                    updatedRow.totalSqFt = Number((qty * sqFtPerPc).toFixed(4));
                    updatedRow.stockQty = qty;
                    updatedRow.stockUnit = 'pieces';
                }
            } else if (field === 'boxCount') {
                updatedRow.boxCount = value === '' ? '' : value;
                const boxes = Number(value || 0);
                updatedRow.totalPcs = boxes * pcsPerBox;
                updatedRow.totalSqFt = Number((updatedRow.totalPcs * sqFtPerPc).toFixed(4));
                
                if (billingUnit === 'sqft') {
                    updatedRow.quantity = updatedRow.totalSqFt;
                    updatedRow.stockQty = boxes;
                    updatedRow.stockUnit = 'boxes';
                } else if (billingUnit === 'boxes') {
                    updatedRow.quantity = boxes;
                    updatedRow.stockQty = boxes;
                    updatedRow.stockUnit = 'boxes';
                } else {
                    updatedRow.quantity = updatedRow.totalPcs;
                    updatedRow.stockQty = updatedRow.totalPcs;
                    updatedRow.stockUnit = 'pieces';
                }
            } else if (field === 'billingUnit') {
                // Adjust quantity display when user switches mode
                if (value === 'sqft') {
                    updatedRow.quantity = updatedRow.totalSqFt || 0;
                    updatedRow.stockQty = updatedRow.boxCount || 0;
                    updatedRow.stockUnit = 'boxes';
                } else if (value === 'boxes') {
                    updatedRow.quantity = updatedRow.boxCount || 0;
                } else {
                    updatedRow.quantity = updatedRow.totalPcs || 0;
                }
            } else if (field === 'item' || field === 'price' || field === 'batchId') {
                // Recalculate totals when item or price changes
                // For 'item' field, do NOT auto-fill quantity — keep as 0 (empty) so user must enter
                if (field === 'item') {
                    updatedRow.boxCount = 0;
                    updatedRow.totalPcs = 0;
                    updatedRow.totalSqFt = 0;
                    updatedRow.quantity = 0;
                    updatedRow.stockQty = 0;
                } else if (billingUnit === 'boxes') {
                    const boxes = updatedRow.boxCount > 0 ? updatedRow.boxCount : updatedRow.quantity;
                    updatedRow.boxCount = boxes;
                    updatedRow.totalPcs = boxes * pcsPerBox;
                    updatedRow.totalSqFt = Number((updatedRow.totalPcs * sqFtPerPc).toFixed(4));
                    updatedRow.quantity = boxes;
                    updatedRow.stockQty = boxes;
                    updatedRow.stockUnit = 'boxes';
                } else if (billingUnit === 'qty') {
                    const pcs = updatedRow.totalPcs > 0 ? updatedRow.totalPcs : updatedRow.quantity;
                    updatedRow.totalPcs = pcs;
                    updatedRow.totalSqFt = Number((pcs * sqFtPerPc).toFixed(4));
                    updatedRow.boxCount = pcsPerBox > 0 ? pcs / pcsPerBox : 0;
                    updatedRow.quantity = pcs;
                    updatedRow.stockQty = pcs;
                    updatedRow.stockUnit = 'pieces';
                } else if (billingUnit === 'sqft') {
                    const sqft = updatedRow.totalSqFt > 0 ? updatedRow.totalSqFt : updatedRow.quantity;
                    updatedRow.totalSqFt = sqft;
                    updatedRow.totalPcs = sqFtPerPc > 0 ? sqft / sqFtPerPc : 0;
                    updatedRow.boxCount = pcsPerBox > 0 ? updatedRow.totalPcs / pcsPerBox : 0;
                    updatedRow.quantity = sqft;
                    updatedRow.stockQty = updatedRow.boxCount;
                    updatedRow.stockUnit = 'boxes';
                }
            }
            // CRITICAL: For tiles, total is ALWAYS totalSqFt × ratePerSqft
            updatedRow.total = Number((updatedRow.totalSqFt * price).toFixed(2));
        } else {
            // Standard Logic: Qty * Price
            if (field === 'quantity') {
                updatedRow.quantity = value === '' ? '' : value;
            }
            const qtyNum = Number(updatedRow.quantity) || 0;
            updatedRow.stockQty = qtyNum;
            updatedRow.stockUnit = 'units';
            updatedRow.total = Number((qtyNum * price).toFixed(2));
        }

        return updatedRow;
    };

    // Fetch Sales Orders (for reporting or lists)
    const fetchSalesOrders = async (params = {}) => {
        try {
            const { data } = await api.get('/sales-orders', { params });
            return data.data || data;
        } catch (error) {
            toast.error('Failed to fetch sales orders');
        }
    };

    // Create category
    const addCategory = async (categoryData) => {
        try {
            const { data } = await api.post('/categories', categoryData);
            setCategories([...categories, data]);
            return { success: true, data };
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create category');
            return { success: false };
        }
    };

    // Update category
    const editCategory = async (id, categoryData) => {
        try {
            const { data } = await api.put(`/categories/${id}`, categoryData);
            setCategories(categories.map(cat => cat._id === id ? data : cat));
            return { success: true, data };
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update category');
            return { success: false };
        }
    };

    // Delete category
    const removeCategory = async (id) => {
        try {
            await api.delete(`/categories/${id}`);
            setCategories(categories.filter(cat => cat._id !== id));
            return { success: true };
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete category');
            return { success: false };
        }
    };

    // Fetch locations
    const fetchLocations = async (type = 'inventory') => {
        try {
            const { data } = await api.get(`/locations?type=${type}`);
            if (type === 'asset') {
                setAssetLocations(data);
            } else {
                setLocations(data);
            }
        } catch (error) {
            toast.error(`Failed to fetch ${type} locations`);
        }
    };

    const fetchAssetLocations = () => fetchLocations('asset');

    // Add location
    const addLocation = async (locationData) => {
        try {
            const { data } = await api.post('/locations', locationData);
            setLocations([...locations, data]);
            return { success: true, data };
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create location');
            return { success: false };
        }
    };

    // Update location
    const editLocation = async (id, locationData) => {
        try {
            const { data } = await api.put(`/locations/${id}`, locationData);
            setLocations(locations.map(loc => loc._id === id ? data : loc));
            return { success: true, data };
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update location');
            return { success: false };
        }
    };

    // Delete location
    const removeLocation = async (id) => {
        try {
            await api.delete(`/locations/${id}`);
            setLocations(locations.filter(loc => loc._id !== id));
            return { success: true };
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to remove location');
            return { success: false };
        }
    };

    // Fetch HSN Codes
    const fetchHsnCodes = async () => {
        try {
            const { data } = await api.get('/hsn');
            setHsnCodes(data.data || []);
        } catch (error) {
            console.error('Failed to fetch HSN codes');
        }
    };

    // Size CRUD functions
    const fetchSizes = async () => {
        try {
            const { data } = await api.get('/sizes');
            setSizes(data || []);
            return data;
        } catch (error) {
            console.error('Failed to fetch sizes');
        }
    };

    const addSize = async (sizeData) => {
        try {
            const { data } = await api.post('/sizes', sizeData);
            setSizes([...sizes, data]);
            return { success: true, data };
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create size');
            return { success: false };
        }
    };

    const editSize = async (id, sizeData) => {
        try {
            const { data } = await api.put(`/sizes/${id}`, sizeData);
            setSizes(sizes.map(s => s._id === id ? data : s));
            return { success: true, data };
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update size');
            return { success: false };
        }
    };

    const removeSize = async (id) => {
        try {
            await api.delete(`/sizes/${id}`);
            setSizes(sizes.filter(s => s._id !== id));
            return { success: true };
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete size');
            return { success: false };
        }
    };

    // Brand CRUD functions
    const fetchBrands = async () => {
        try {
            const { data } = await api.get('/brands');
            setBrands(data.data || []);
            return data.data || [];
        } catch (error) {
            console.error('Failed to fetch brands');
        }
    };

    const addBrand = async (brandData) => {
        try {
            const { data } = await api.post('/brands', brandData);
            setBrands([...brands, data.data]);
            return { success: true, data: data.data };
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create brand');
            return { success: false };
        }
    };

    const editBrand = async (id, brandData) => {
        try {
            const { data } = await api.put(`/brands/${id}`, brandData);
            setBrands(brands.map(b => b._id === id ? data.data : b));
            return { success: true, data: data.data };
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update brand');
            return { success: false };
        }
    };

    const removeBrand = async (id) => {
        try {
            await api.delete(`/brands/${id}`);
            setBrands(brands.filter(b => b._id !== id));
            return { success: true };
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete brand');
            return { success: false };
        }
    };

    // Fetch Purchase Orders
    const fetchPurchaseOrders = async (params = {}) => {
        try {
            const { data } = await api.get('/purchase-orders', { params });
            setPurchaseOrders(data.data?.purchaseOrders || []);
            return data.data?.purchaseOrders || [];
        } catch (error) {
            console.error('Failed to fetch purchase orders');
        }
    };

    // Parse Excel file
    const parseExcelFile = async (file) => {
        try {
            const formData = new FormData();
            formData.append('file', file);
            const { data } = await api.post('/excel/parse', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return { success: true, data };
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to parse Excel file');
            return { success: false };
        }
    };

    // Import Excel data
    const importExcelData = async (itemsData, options = {}) => {
        try {
            const { data } = await api.post('/excel/import', { items: itemsData, options });
            toast.success(data.message || 'Import completed successfully');
            fetchItems(); // Refresh items after import
            return { success: true, data };
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to import data');
            return { success: false };
        }
    };

    // Download Template
    const downloadTemplate = async () => {
        try {
            const response = await api.get('/excel/template', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'stock_inward_template.xlsx');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            toast.error('Failed to download template');
        }
    };

    // Get Excel headers for bulk mapping (Additive)
    const getExcelHeadersBulk = async (file) => {
        try {
            const formData = new FormData();
            formData.append('file', file);
            const { data } = await api.post('/excel/headers', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return { success: true, data };
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to extract headers');
            return { success: false };
        }
    };

    // Import mapped data (Additive)
    const importMappedData = async (file, mapping, options = {}, headerRowIdx = 0) => {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('mapping', JSON.stringify(mapping));
            formData.append('options', JSON.stringify(options));
            formData.append('headerRowIdx', String(headerRowIdx));
            
            const { data } = await api.post('/excel/import-mapped', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            toast.success(data.message || 'Import completed');
            fetchItems();
            return { success: true, data };
        } catch (error) {
            toast.error(error.response?.data?.message || 'Import failed');
            return { success: false };
        }
    };

    const confirmDelete = async (message, callback) => {
        return await customConfirmDelete(message, callback);
    };

    useEffect(() => {
        if (user) {
            fetchCategories();
            fetchLocations();
            fetchAssetLocations();
            fetchBillingSettings();
            fetchHsnCodes();
            fetchSizes();
            fetchBrands();
            fetchPurchaseOrders({ status: 'issued' });
        }
    }, [user]);

    return (
        <InventoryContext.Provider
            value={{
                items,
                categories,
                transactions,
                loading,
                fetchItems,
                createItem,
                updateItem,
                deleteItem,
                createTransaction,
                fetchTransactions,
                fetchCategories,
                addCategory,
                editCategory,
                removeCategory,
                locations,
                fetchLocations,
                addLocation,
                editLocation,
                removeLocation,
                assetLocations,
                fetchAssetLocations,
                parseExcelFile,
                importExcelData,
                downloadTemplate,
                getExcelHeadersBulk,
                importMappedData,
                billingSettings,
                activePreset,
                hsnCodes,
                fetchHsnCodes,
                sizes,
                fetchSizes,
                addSize,
                editSize,
                removeSize,
                fetchBillingSettings,
                updateBillingSettings,
                fetchSalesOrders,
                confirmDelete,
                calculateItemValues,
                purchaseOrders,
                fetchPurchaseOrders,
                brands,
                fetchBrands,
                addBrand,
                editBrand,
                removeBrand,
            }}
        >
            {children}
        </InventoryContext.Provider>
    );
};
