import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';

const AuthModal = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { login, register } = useAuth();

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (activeTab === 'login') {
                await login(email, password);
                toast.success('Logged in successfully!');
                onClose();
            } else {
                await register(email, password);
                toast.success('Account created! You can now login.');
                setActiveTab('login');
                setPassword('');
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Authentication failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="flex bg-gray-50 border-b">
                    <button
                        onClick={() => setActiveTab('login')}
                        className={`flex-1 py-4 text-sm font-semibold transition-all ${activeTab === 'login' ? 'text-[#667eea] border-b-2 border-[#667eea] bg-white' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Login
                    </button>
                    <button
                        onClick={() => setActiveTab('register')}
                        className={`flex-1 py-4 text-sm font-semibold transition-all ${activeTab === 'register' ? 'text-[#667eea] border-b-2 border-[#667eea] bg-white' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Register
                    </button>
                </div>

                <div className="p-8">
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold text-gray-800">
                            {activeTab === 'login' ? 'Welcome Back!' : 'Create Account'}
                        </h2>
                        <p className="text-gray-500 mt-2 text-sm">
                            {activeTab === 'login'
                                ? 'Login to sync your anonymous identity across devices.'
                                : 'Join Matchingo to keep your anonymous profile permanent.'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Email Address</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#667eea] focus:border-transparent outline-none transition-all"
                                placeholder="name@example.com"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Password</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#667eea] focus:border-transparent outline-none transition-all"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-4 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white rounded-xl font-bold shadow-lg shadow-[#667eea]/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:hover:scale-100"
                        >
                            {isSubmitting ? 'Processing...' : (activeTab === 'login' ? 'Login' : 'Register')}
                        </button>
                    </form>

                    <button
                        onClick={onClose}
                        className="w-full mt-6 text-sm text-gray-400 hover:text-gray-600 font-medium transition-colors"
                    >
                        Continue as Guest
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
