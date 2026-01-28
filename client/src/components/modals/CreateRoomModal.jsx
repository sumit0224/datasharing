import React, { useState } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';

const CreateRoomModal = ({ isOpen, onClose, onRoomCreated, apiUrl }) => {
    const [isPrivate, setIsPrivate] = useState(false);
    const [password, setPassword] = useState('');
    const [expiresIn, setExpiresIn] = useState(30);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const payload = {
                type: isPrivate ? 'private' : 'public'
            };

            if (isPrivate) {
                if (password.length < 6) {
                    toast.error('Password must be at least 6 characters');
                    setIsSubmitting(false);
                    return;
                }
                payload.password = password;
                payload.expiresIn = expiresIn;
            }

            const { data } = await axios.post(`${apiUrl}/api/room/create`, payload);
            toast.success(`Room created! ID: ${data.roomId}`);
            onRoomCreated(data.roomId, isPrivate ? password : null);
            onClose();
            // Reset form
            setPassword('');
            setIsPrivate(false);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to create room');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">Create New Room</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Room Type Toggle */}
                        <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <div>
                                <span className="block text-sm font-semibold text-gray-700">Private Room</span>
                                <span className="text-xs text-gray-500">Require password to join</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsPrivate(!isPrivate)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#667eea] focus:ring-offset-2 ${isPrivate ? 'bg-[#667eea]' : 'bg-gray-200'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isPrivate ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        {/* Private Room Fields */}
                        {isPrivate && (
                            <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Room Password</label>
                                    <input
                                        type="text"
                                        required={isPrivate}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#667eea] focus:border-transparent outline-none transition-all"
                                        placeholder="Min 6 characters"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Expires In</label>
                                    <select
                                        value={expiresIn}
                                        onChange={(e) => setExpiresIn(Number(e.target.value))}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#667eea] focus:border-transparent outline-none transition-all"
                                    >
                                        <option value={10}>10 Minutes</option>
                                        <option value={30}>30 Minutes</option>
                                        <option value={60}>1 Hour</option>
                                        <option value={1440}>24 Hours</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-4 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white rounded-xl font-bold shadow-lg shadow-[#667eea]/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:hover:scale-100"
                        >
                            {isSubmitting ? 'Creating...' : 'Create Room'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CreateRoomModal;
