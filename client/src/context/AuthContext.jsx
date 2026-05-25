import { createContext, useState, useEffect, useRef, useCallback } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

export const AuthContext = createContext();

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    // Active branch selected by the user (stored in localStorage for persistence)
    const [activeBranchId, setActiveBranchIdState] = useState(
        () => localStorage.getItem('activeBranchId') || null
    );
    const inactivityTimer = useRef(null);

    const clearSession = useCallback(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('activeBranchId');
        setUser(null);
        setActiveBranchIdState(null);
    }, []);

    const resetInactivityTimer = useCallback(() => {
        if (inactivityTimer.current) {
            clearTimeout(inactivityTimer.current);
        }
        inactivityTimer.current = setTimeout(() => {
            clearSession();
            toast.error('Session expired due to inactivity. Please log in again.', { duration: 5000 });
        }, INACTIVITY_TIMEOUT_MS);
    }, [clearSession]);

    // Attach activity listeners when user is logged in
    useEffect(() => {
        if (!user) {
            if (inactivityTimer.current) {
                clearTimeout(inactivityTimer.current);
                inactivityTimer.current = null;
            }
            return;
        }

        const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
        resetInactivityTimer();

        activityEvents.forEach(event => window.addEventListener(event, resetInactivityTimer));

        return () => {
            activityEvents.forEach(event => window.removeEventListener(event, resetInactivityTimer));
            if (inactivityTimer.current) {
                clearTimeout(inactivityTimer.current);
            }
        };
    }, [user, resetInactivityTimer]);

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

    const register = async (name, email, password, companyName, phone, termsAccepted) => {
        try {
            const { data } = await api.post('/auth/register', { name, email, password, companyName, phone, termsAccepted });
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
        clearSession();
    };

    // Set the active branch (called from branch selector or login page)
    const setActiveBranch = (branchId) => {
        if (branchId) {
            localStorage.setItem('activeBranchId', branchId);
        } else {
            localStorage.removeItem('activeBranchId');
        }
        setActiveBranchIdState(branchId || null);
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

    const fetchUsers = async (branchId = null) => {
        try {
            const url = branchId ? `/auth/users?branchId=${branchId}` : '/auth/users';
            const { data } = await api.get(url);
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

    const confirmDelete = async (message, callback) => {
        if (window.confirm(message)) {
            if (callback && typeof callback === 'function') {
                await callback();
            }
            return true;
        }
        return false;
    };

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            activeBranchId,
            setActiveBranch,
            login,
            register,
            logout,
            addUser,
            fetchUsers,
            updateUserDetails,
            changeUserStatus,
            removeUser,
            confirmDelete
        }}>
            {children}
        </AuthContext.Provider>
    );
};
