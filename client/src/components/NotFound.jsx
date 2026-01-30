import React from 'react';
import { useNavigate } from 'react-router-dom';

const NotFound = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 relative overflow-hidden selection:bg-[#20B2AA]/30">
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#20B2AA]/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="relative z-10 text-center max-w-lg">
                <div className="text-[#20B2AA] text-6xl md:text-8xl font-bold mb-4 animate-pulse">
                    404
                </div>

                <h1 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight">
                    Page Under Construction
                </h1>

                <p className="text-gray-400 text-lg mb-10 leading-relaxed">
                    We are developing this page soon! The feature you are looking for is currently in the works.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                        onClick={() => navigate('/')}
                        className="px-8 py-3 bg-[#20B2AA] text-black rounded-xl font-bold hover:bg-[#1C9D96] transition-all shadow-lg shadow-[#20B2AA]/20 hover:scale-105 active:scale-95"
                    >
                        Go Home
                    </button>
                    <button
                        onClick={() => navigate('/app')}
                        className="px-8 py-3 bg-white/5 border border-white/10 text-white rounded-xl font-bold hover:bg-white/10 transition-all hover:scale-105 active:scale-95"
                    >
                        Launch App
                    </button>
                </div>
            </div>

            {/* Footer */}
            <div className="absolute bottom-8 text-xs text-gray-600 font-mono">
                P2P_LOCAL_DEV_BUILD
            </div>
        </div>
    );
};

export default NotFound;
