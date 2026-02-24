import { createContext, useState, useEffect, useContext } from 'react';
import api from '../utils/api';
import { AuthContext } from './AuthContext';
import toast from 'react-hot-toast';

export const InventoryContext = createContext();

export const InventoryProvider = ({ children }) => {
    const { user } = useContext(AuthContext);
    const [items, setItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);

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

    useEffect(() => {
        if (user) {
            fetchCategories();
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
                parseExcelFile,
                importExcelData,
                downloadTemplate,
            }}
        >
            {children}
        </InventoryContext.Provider>
    );
};
