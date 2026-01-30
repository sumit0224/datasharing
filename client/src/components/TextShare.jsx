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
        <div className="bg-[#0A0A0A] rounded-2xl shadow-2xl border border-white/5 overflow-hidden fade-in">
            {/* Header with icon */}
            <div className="p-6 border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#20B2AA] rounded-xl flex items-center justify-center text-black shadow-[0_0_15px_-3px_rgba(32,178,170,0.4)]" aria-hidden="true">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M3 4h14a1 1 0 011 1v2a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1zm0 6h14a1 1 0 011 1v2a1 1 0 01-1 1H3a1 1 0 01-1-1v-2a1 1 0 011-1zm0 6h14a1 1 0 011 1v2a1 1 0 01-1 1H3a1 1 0 01-1-1v-2a1 1 0 011-1z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Text Chat</h2>
                </div>
            </div>

            {/* Input Form */}
            <div className="p-6 border-b border-white/5 relative">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <textarea
                        value={currentText}
                        onChange={handleChange}
                        placeholder="Type something to share..."
                        className="w-full h-40 p-4 rounded-xl border border-white/10 bg-white/5 text-white placeholder-gray-500 resize-none focus:border-[#20B2AA] focus:ring-1 focus:ring-[#20B2AA] outline-none transition-all duration-300"
                        disabled={!isConnected}
                        aria-label="Text message input"
                        maxLength={5000}
                    />
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500 font-mono">
                            {currentText.length} / 5000 chars
                        </span>
                        <button
                            type="submit"
                            disabled={!currentText.trim() || !isConnected}
                            className="px-8 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl font-bold hover:bg-[#20B2AA] hover:text-black hover:border-[#20B2AA] transition-all disabled:opacity-30 disabled:cursor-not-allowed duration-300"
                            aria-label="Save text message"
                        >
                            Send
                        </button>
                    </div>
                </form>
            </div>

            {/* Shared Texts List */}
            <div className="p-6 max-h-[500px] overflow-y-auto custom-scrollbar">
                {texts.length > 0 ? (
                    <div className="space-y-4" role="list" aria-label="Shared text messages">
                        {texts.slice().reverse().map((text) => (
                            <div key={text.id} className="group p-5 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 hover:bg-white/[0.07] transition-all fade-in relative" role="listitem">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap break-words font-light tracking-wide">
                                            {text.content}
                                        </p>
                                        <p className="text-[10px] text-gray-500 mt-3 font-mono uppercase tracking-wider" aria-label={`Shared at ${new Date(text.timestamp).toLocaleString()}`}>
                                            {new Date(text.timestamp).toLocaleTimeString()}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute top-4 right-4 bg-black/50 backdrop-blur-md rounded-lg p-1 border border-white/10">
                                        <button
                                            onClick={() => onCopyText(text.content)}
                                            className="p-2 rounded-lg transition-all text-gray-400 hover:text-white hover:bg-white/10 flex-shrink-0"
                                            title="Copy text"
                                            aria-label="Copy text to clipboard"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => onDeleteText(text.id)}
                                            className="p-2 rounded-lg transition-all text-red-500 hover:text-red-400 hover:bg-red-500/10 flex-shrink-0"
                                            title="Delete text"
                                            aria-label="Delete text message"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 opacity-50">
                        <div className="text-6xl mb-4 grayscale" role="img" aria-label="Empty state">📝</div>
                        <p className="text-gray-500 font-medium">No shared texts yet.</p>
                        <p className="text-xs text-gray-600 mt-1">Type a message above to start sharing.</p>
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
