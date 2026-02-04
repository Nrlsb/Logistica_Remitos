import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [sessionExpired, setSessionExpired] = useState(false);
    const [sessionError, setSessionError] = useState('');

    const checkLoggedIn = async () => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                // Verify token with backend
                const res = await api.get('/api/auth/user');
                setUser(res.data);
                setIsAuthenticated(true);
            } catch (error) {
                // If token is invalid or session expired (401), clear it
                console.log('Session check failed:', error.response?.data?.message);
                localStorage.removeItem('token');
                setUser(null);
                setIsAuthenticated(false);
            }
        }
        setLoading(false);
    };

    // Polling to validate session while authenticated
    useEffect(() => {
        let intervalId;

        const validateSession = async () => {
            if (!isAuthenticated) return;
            try {
                // We use the same endpoint but primarily to check if 401 occurs
                await api.get('/api/auth/user');
            } catch (error) {
                // 401s are handled by the interceptor mostly, but if it fails silently we catch here
                // Note: The interceptor will fire 'auth:session-expired' which handles the UI
            }
        };

        if (isAuthenticated) {
            intervalId = setInterval(validateSession, 30000); // Poll every 30 seconds
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [isAuthenticated]);

    useEffect(() => {
        checkLoggedIn();

        // Listen for session expiration event from api interceptor
        const handleSessionExpired = (event) => {
            const message = event.detail || 'Tu sesión ha expirado.';
            setSessionError(message);
            setSessionExpired(true);
        };

        window.addEventListener('auth:session-expired', handleSessionExpired);

        return () => {
            window.removeEventListener('auth:session-expired', handleSessionExpired);
        };
    }, []);

    const login = async (username, password, force = false) => {
        try {
            const res = await api.post('/api/auth/login', { username, password, force });
            localStorage.setItem('token', res.data.token);
            setUser(res.data.user);
            setIsAuthenticated(true);
            setSessionExpired(false);
            setSessionError('');
            return { success: true };
        } catch (error) {
            if (error.response && error.response.status === 409) {
                return {
                    success: false,
                    requiresConfirmation: true,
                    message: error.response.data.message
                };
            }
            return {
                success: false,
                message: error.response?.data?.message || 'Error al iniciar sesión'
            };
        }
    };

    const register = async (username, password) => {
        try {
            const res = await api.post('/api/auth/register', { username, password });
            localStorage.setItem('token', res.data.token);
            setUser(res.data.user);
            setIsAuthenticated(true);
            setSessionExpired(false);
            setSessionError('');
            return { success: true };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Error al registrarse'
            };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
        setIsAuthenticated(false);
        setSessionExpired(false);
        setSessionError('');
    };

    const closeSessionExpiredModal = () => {
        setSessionExpired(false);
        logout(); // Ensure we are logged out when closing the modal
    };

    return (
        <AuthContext.Provider value={{ user, loading, isAuthenticated, login, register, logout, sessionExpired, sessionError, closeSessionExpiredModal }}>
            {children}
        </AuthContext.Provider>
    );
};
