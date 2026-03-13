import { createContext, useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const verifyToken = async () => {
            const token = localStorage.getItem('token');
            const userData = localStorage.getItem('user');

            if (token && userData) {
                try {
                    const { data } = await api.get('/auth/me');
                    setUser(data);
                } catch (error) {
                    console.error('Token verification failed:', error);
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setUser(null);
                }
            }
            setLoading(false);
        };

        verifyToken();
    }, []);

    const login = async (email, password) => {
        try {
            const { data } = await api.post('/auth/login', { email, password });
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data));
            setUser(data);
            return { success: true, user: data };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Login failed',
            };
        }
    };

    const register = async (name, email, password, companyName) => {
        try {
            const { data } = await api.post('/auth/register', { name, email, password, companyName });
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data));
            setUser(data);
            return { success: true, user: data };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Registration failed',
            };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };

    // User Management (Admin only)
    const addUser = async (userData) => {
        try {
            const { data } = await api.post('/auth/users', userData);
            return { success: true, data };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Failed to add user',
            };
        }
    };

    const fetchUsers = async () => {
        try {
            const { data } = await api.get('/auth/users');
            return { success: true, data };
        } catch (error) {
            return { success: false, message: error.response?.data?.message || 'Failed to fetch users' };
        }
    };

    const updateUserDetails = async (id, userData) => {
        try {
            const { data } = await api.put(`/auth/users/${id}`, userData);
            return { success: true, data };
        } catch (error) {
            return { success: false, message: error.response?.data?.message || 'Failed to update user' };
        }
    };

    const changeUserStatus = async (id) => {
        try {
            const { data } = await api.patch(`/auth/users/${id}/status`);
            return { success: true, data };
        } catch (error) {
            return { success: false, message: error.response?.data?.message || 'Failed to change status' };
        }
    };

    const removeUser = async (id) => {
        try {
            await api.delete(`/auth/users/${id}`);
            return { success: true };
        } catch (error) {
            return { success: false, message: error.response?.data?.message || 'Failed to delete user' };
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            login,
            register,
            logout,
            addUser,
            fetchUsers,
            updateUserDetails,
            changeUserStatus,
            removeUser
        }}>
            {children}
        </AuthContext.Provider>
    );
};
