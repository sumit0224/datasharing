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
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden fade-in">
            {/* Header with icon */}
            <div className="p-6 border-b border-gray-100">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center text-white" aria-hidden="true">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M3 4h14a1 1 0 011 1v2a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1zm0 6h14a1 1 0 011 1v2a1 1 0 01-1 1H3a1 1 0 01-1-1v-2a1 1 0 011-1zm0 6h14a1 1 0 011 1v2a1 1 0 01-1 1H3a1 1 0 01-1-1v-2a1 1 0 011-1z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Text</h2>
                </div>
            </div>

            {/* Input Form */}
            <div className="p-6 border-b border-gray-100">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <textarea
                        value={currentText}
                        onChange={handleChange}
                        placeholder="Type something..."
                        className="w-full h-40 p-4 rounded-lg border border-gray-200 text-gray-800 placeholder-gray-400 resize-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all"
                        disabled={!isConnected}
                        aria-label="Text message input"
                        maxLength={5000}
                    />
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">
                            {currentText.length} / 5000 characters
                        </span>
                        <button
                            type="submit"
                            disabled={!currentText.trim() || !isConnected}
                            className="px-8 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:border-purple-500 hover:text-purple-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label="Save text message"
                        >
                            Save
                        </button>
                    </div>
                </form>
            </div>

            {/* Shared Texts List */}
            <div className="p-6 max-h-96 overflow-y-auto custom-scrollbar">
                {texts.length > 0 ? (
                    <div className="space-y-3" role="list" aria-label="Shared text messages">
                        {texts.slice().reverse().map((text) => (
                            <div key={text.id} className="group p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all fade-in" role="listitem">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap break-words">
                                            {text.content}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-2" aria-label={`Shared at ${new Date(text.timestamp).toLocaleString()}`}>
                                            {new Date(text.timestamp).toLocaleTimeString()}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => onCopyText(text.content)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded transition-all text-gray-600 hover:text-gray-900 hover:bg-gray-200 flex-shrink-0"
                                            title="Copy text"
                                            aria-label="Copy text to clipboard"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => onDeleteText(text.id)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded transition-all text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
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
                    <div className="text-center py-12">
                        <div className="text-6xl mb-4" role="img" aria-label="Empty state">📝</div>
                        <p className="text-gray-400 font-medium">No shared texts yet.</p>
                        <p className="text-xs text-gray-400 mt-1">Type a message above to get started!</p>
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
