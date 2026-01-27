import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';

const TextShare = React.memo(({ texts, onSendText, onCopyText, isConnected }) => {
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
        <div className="card fade-in">
            {/* Header with icon */}
            <div className="card-header">
                <div className="flex items-center gap-3">
                    <div className="icon-gradient" aria-hidden="true">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M3 4h14a1 1 0 011 1v2a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1zm0 6h14a1 1 0 011 1v2a1 1 0 01-1 1H3a1 1 0 01-1-1v-2a1 1 0 011-1zm0 6h14a1 1 0 011 1v2a1 1 0 01-1 1H3a1 1 0 01-1-1v-2a1 1 0 011-1z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Text</h2>
                </div>
            </div>

            {/* Input Form */}
            <div className="card-body border-b border-gray-100">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <textarea
                        value={currentText}
                        onChange={handleChange}
                        placeholder="Type something..."
                        className="textarea-base w-full h-40"
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
                            className="btn-outline"
                            aria-label="Save text message"
                        >
                            Save
                        </button>
                    </div>
                </form>
            </div>

            {/* Shared Texts List */}
            <div className="card-body max-h-96 overflow-y-auto custom-scrollbar">
                {texts.length > 0 ? (
                    <div className="space-y-3" role="list" aria-label="Shared text messages">
                        {texts.slice().reverse().map((text) => (
                            <div key={text.id} className="item-card fade-in" role="listitem">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap break-words">
                                            {text.content}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-2" aria-label={`Shared at ${new Date(text.timestamp).toLocaleString()}`}>
                                            {new Date(text.timestamp).toLocaleTimeString()}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => onCopyText(text.content)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity btn-icon flex-shrink-0"
                                        title="Copy text"
                                        aria-label="Copy text to clipboard"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                    </button>
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
    isConnected: PropTypes.bool.isRequired
};

TextShare.displayName = 'TextShare';

export default TextShare;
