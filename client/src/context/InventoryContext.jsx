import { createContext, useState, useEffect, useContext } from 'react';
import api from '../utils/api';
import { AuthContext } from './AuthContext';
import toast from 'react-hot-toast';
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
            toast.success('Item created successfully');
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
            toast.success('Item updated successfully');
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
            toast.success('Item deleted successfully');
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
            toast.success(`Stock ${transactionData.type} recorded successfully`);
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
            toast.success('Billing settings updated');
            return { success: true, data: data.data };
        } catch (error) {
            toast.error('Failed to update settings');
            return { success: false };
        }
    };

    /**
     * Real-world calculation engine based on industry type
     */
    const calculateItemValues = (row, field, value, industry) => {
        if (!row) return row;
        const updatedRow = { ...row, [field]: value };
        
        // Ensure core numeric fields are valid numbers
        const pcsPerBox = Math.max(1, Number(updatedRow.pcsPerBox) || 1);
        const sqFtPerPc = Math.max(0, Number(updatedRow.sqFtPerPc) || 0);
        const price = Math.max(0, Number(updatedRow.price) || 0);
        const billingUnit = updatedRow.billingUnit || 'pieces';

        // Initialize variables to avoid undefined
        updatedRow.totalPcs = Number(updatedRow.totalPcs) || 0;
        updatedRow.totalSqFt = Number(updatedRow.totalSqFt) || 0;
        updatedRow.boxCount = Number(updatedRow.boxCount) || 0;
        updatedRow.quantity = Number(updatedRow.quantity) || 0;

        if (industry === 'tiles' && sqFtPerPc > 0) {
            // Tiles Logic: Conversion between Box, Pieces, and SqFt
            if (field === 'boxCount' || field === 'quantity' && billingUnit === 'boxes') {
                const boxes = Number(value || 0);
                updatedRow.boxCount = boxes;
                updatedRow.totalPcs = boxes * pcsPerBox;
                updatedRow.totalSqFt = Number((updatedRow.totalPcs * sqFtPerPc).toFixed(2));
                updatedRow.quantity = billingUnit === 'sqft' ? updatedRow.totalSqFt : boxes;
                updatedRow.stockQty = boxes;
                updatedRow.stockUnit = 'boxes';
            } else if (field === 'billingUnit') {
                updatedRow.quantity = value === 'sqft' ? (updatedRow.totalSqFt || 0) : (updatedRow.boxCount || 0);
            } else if (field === 'quantity') {
                const qty = Number(value || 0);
                if (billingUnit === 'sqft') {
                    updatedRow.totalSqFt = qty;
                    updatedRow.totalPcs = sqFtPerPc > 0 ? (qty / sqFtPerPc) : 0;
                    updatedRow.boxCount = pcsPerBox > 0 ? (updatedRow.totalPcs / pcsPerBox) : 0;
                    updatedRow.quantity = qty;
                } else {
                    updatedRow.boxCount = qty;
                    updatedRow.totalPcs = qty * pcsPerBox;
                    updatedRow.totalSqFt = Number((updatedRow.totalPcs * sqFtPerPc).toFixed(2));
                    updatedRow.quantity = qty;
                    updatedRow.stockQty = qty;
                    updatedRow.stockUnit = 'boxes';
                }
            } else if (field === 'item' || field === 'price') {
                // When item changes, recalculate based on existing boxes if available
                if (updatedRow.boxCount > 0) {
                    updatedRow.totalPcs = updatedRow.boxCount * pcsPerBox;
                    updatedRow.totalSqFt = Number((updatedRow.totalPcs * sqFtPerPc).toFixed(2));
                    updatedRow.quantity = billingUnit === 'sqft' ? updatedRow.totalSqFt : updatedRow.boxCount;
                    updatedRow.stockQty = updatedRow.boxCount;
                    updatedRow.stockUnit = 'boxes';
                }
            }
            updatedRow.total = Number((updatedRow.quantity * price).toFixed(2));
        } else {
            // Standard Logic: Qty * Price
            updatedRow.quantity = field === 'quantity' ? Number(value || 0) : Number(updatedRow.quantity || 0);
            updatedRow.stockQty = updatedRow.quantity;
            updatedRow.stockUnit = 'units';
            updatedRow.total = Number((updatedRow.quantity * price).toFixed(2));
        }

        return updatedRow;
    };

    // Fetch Sales Orders (for reporting or lists)
    const fetchSalesOrders = async (params = {}) => {
        try {
            const { data } = await api.get('/sales-orders', { params });
            return data;
        } catch (error) {
            toast.error('Failed to fetch sales orders');
        }
    };

    // Create category
    const addCategory = async (categoryData) => {
        try {
            const { data } = await api.post('/categories', categoryData);
            setCategories([...categories, data]);
            toast.success('Category created successfully');
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
            toast.success('Category updated successfully');
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
            toast.success('Category deleted successfully');
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
            toast.success('Location created successfully');
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
            toast.success('Location updated successfully');
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
            toast.success('Location removed successfully');
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
    const importExcelData = async (itemsData) => {
        try {
            const { data } = await api.post('/excel/import', { items: itemsData });
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
    const importMappedData = async (file, mapping) => {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('mapping', JSON.stringify(mapping));
            
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
        if (window.confirm(message)) {
            if (callback && typeof callback === 'function') {
                await callback();
            }
            return true;
        }
        return false;
    };

    useEffect(() => {
        if (user) {
            fetchCategories();
            fetchLocations();
            fetchAssetLocations();
            fetchBillingSettings();
            fetchHsnCodes();
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
                fetchBillingSettings,
                updateBillingSettings,
                fetchSalesOrders,
                confirmDelete,
                calculateItemValues,
                purchaseOrders,
                fetchPurchaseOrders,
            }}
        >
            {children}
        </InventoryContext.Provider>
    );
};
