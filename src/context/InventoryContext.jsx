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
            }}
        >
            {children}
        </InventoryContext.Provider>
    );
};
