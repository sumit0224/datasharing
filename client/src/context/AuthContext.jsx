import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext();

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Axios instance with credentials for httpOnly cookies
const api = axios.create({
    baseURL: API_URL,
    withCredentials: true
});

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const checkAuth = useCallback(async () => {
        try {
            const { data } = await api.get('/api/auth/me');
            setUser(data.user);
        } catch (err) {
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        checkAuth();

        // Cross-tab logout sync
        const channel = new BroadcastChannel('auth_channel');
        channel.onmessage = (event) => {
            if (event.data === 'logout') {
                setUser(null);
                // Optional: toast.info("Logged out from another tab");
            }
        };

        return () => channel.close();
    }, [checkAuth]);

    // Interceptor to handle automatic token refresh
    useEffect(() => {
        const interceptor = api.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;
                if (error.response?.status === 401 && !originalRequest._retry) {
                    originalRequest._retry = true;
                    try {
                        await api.post('/api/auth/refresh');
                        return api(originalRequest);
                    } catch (refreshError) {
                        setUser(null);
                        return Promise.reject(refreshError);
                    }
                }
                return Promise.reject(error);
            }
        );
        return () => api.interceptors.response.eject(interceptor);
    }, []);

    const login = async (email, password) => {
        const { data } = await api.post('/api/auth/login', { email, password });
        setUser(data.user);
        return data;
    };

    const register = async (email, password) => {
        const { data } = await api.post('/api/auth/register', { email, password });
        // Registration doesn't automatically log in for phase-1 security
        return data;
    };

    const logout = async () => {
        await api.post('/api/auth/logout');
        setUser(null);
        new BroadcastChannel('auth_channel').postMessage('logout');
    };

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            isAuthenticated: !!user,
            login,
            register,
            logout,
            api
        }}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
export default api;
