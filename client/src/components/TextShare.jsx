import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';

const TextShare = React.memo(({ texts, onSendText, onCopyText, onDeleteText, isConnected }) => {
    const [currentText, setCurrentText] = useState('');

    const handleSubmit = useCallback((e) => {
        e.preventDefault();
        if (currentText.trim() && isConnected) {
            onSendText(currentText);
            setCurrentText('');
        }
    }, [currentText, isConnected, onSendText]);

    const handleChange = useCallback((e) => {
        setCurrentText(e.target.value);
    }, []);

    return (
        <div className="flex flex-col gap-6 fade-in h-full">
            {/* Input Area - Floating Glass Panel */}
            <div className="glass-panel p-4 md:p-6 rounded-3xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#20B2AA]/10 rounded-full blur-[40px] pointer-events-none -mr-10 -mt-10 transition-opacity duration-500 opacity-50 group-hover:opacity-100" />

                <form onSubmit={handleSubmit} className="relative z-10">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-[#20B2AA]/10 rounded-xl text-[#20B2AA]">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h2 className="text-lg font-bold text-white tracking-wide">Share Text</h2>
                        </div>
                        <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded-md border ${currentText.length > 4000 ? 'text-red-400 border-red-500/20 bg-red-500/10' : 'text-gray-500 border-white/5 bg-white/5'
                            }`}>
                            {currentText.length}/5000
                        </span>
                    </div>

                    <div className="relative">
                        <textarea
                            value={currentText}
                            onChange={handleChange}
                            placeholder="Type or paste text here..."
                            className="w-full h-32 md:h-40 p-4 rounded-xl border border-white/10 bg-black/20 text-white placeholder-gray-600 resize-none focus:border-[#20B2AA]/50 focus:bg-black/40 focus:ring-0 outline-none transition-all duration-300 font-light leading-relaxed custom-scrollbar"
                            disabled={!isConnected}
                            maxLength={5000}
                        />
                        <button
                            type="submit"
                            disabled={!currentText.trim() || !isConnected}
                            className="absolute bottom-4 right-4 bg-[#20B2AA] text-black w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-[#20B2AA]/20 hover:scale-110 active:scale-95 transition-all disabled:opacity-0 disabled:scale-75"
                            title="Send"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </button>
                    </div>
                </form>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 -mr-1 space-y-3 min-h-[300px]">
                {texts.length > 0 ? (
                    texts.slice().reverse().map((text) => (
                        <div key={text.id} className="glass-panel p-5 rounded-2xl group relative hover:border-[#20B2AA]/30 transition-all duration-300 hover:-translate-y-1">
                            <p className="text-gray-200 text-sm md:text-base leading-relaxed whitespace-pre-wrap break-words font-light">
                                {text.content}
                            </p>

                            <div className="flex items-center justify-between mt-4 border-t border-white/5 pt-3">
                                <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">
                                    {new Date(text.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => onCopyText(text.content)}
                                        className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                        title="Copy"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => onDeleteText(text.id)}
                                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                        title="Delete"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center opacity-40">
                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4">
                            <span className="text-4xl">📝</span>
                        </div>
                        <p className="text-gray-400 font-medium">No messages yet</p>
                    </div>
                )}
            </div>
        </div>
    );
});

TextShare.propTypes = {
    texts: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string.isRequired,
        content: PropTypes.string.isRequired,
        timestamp: PropTypes.string.isRequired
    })).isRequired,
    onSendText: PropTypes.func.isRequired,
    onCopyText: PropTypes.func.isRequired,
    onDeleteText: PropTypes.func.isRequired,
    isConnected: PropTypes.bool.isRequired
};

TextShare.displayName = 'TextShare';

export default TextShare;
