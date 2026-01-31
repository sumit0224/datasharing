import React, { useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import PropTypes from 'prop-types';

const FileShare = React.memo(({ files, onUpload, onDeleteFile, isUploading, uploadProgress, isConnected }) => {
    const onDrop = useCallback((acceptedFiles) => {
        if (acceptedFiles?.length > 0 && isConnected) {
            onUpload(acceptedFiles[0]);
        }
    }, [onUpload, isConnected]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        disabled: !isConnected || isUploading,
        maxSize: 100 * 1024 * 1024, // 100MB
        multiple: false
    });

    // Memoize file type icon function
    const getFileIcon = useCallback((filename) => {
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        const iconMap = {
            image: ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'],
            pdf: ['pdf'],
            document: ['doc', 'docx'],
            spreadsheet: ['xls', 'xlsx', 'csv'],
            archive: ['zip', 'rar', '7z'],
            audio: ['mp3', 'wav', 'ogg'],
            video: ['mp4', 'avi', 'mov']
        };

        if (iconMap.image.includes(ext)) return '🖼️';
        if (iconMap.pdf.includes(ext)) return '📄';
        if (iconMap.document.includes(ext)) return '📝';
        if (iconMap.spreadsheet.includes(ext)) return '📊';
        if (iconMap.archive.includes(ext)) return '📦';
        if (iconMap.audio.includes(ext)) return '🎵';
        if (iconMap.video.includes(ext)) return '🎬';
        return '📁';
    }, []);

    // Memoize file size formatting
    const formatBytes = useCallback((bytes, decimals = 2) => {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }, []);

    const downloadUrl = useMemo(() =>
        import.meta.env.VITE_API_URL || 'http://localhost:3000'
        , []);

    return (
        <div className="flex flex-col gap-6 fade-in h-full">
            {/* Upload Zone - Massive Glass Panel */}
            <div
                {...getRootProps()}
                className={`
                    relative group transition-all duration-300 rounded-3xl overflow-hidden
                    ${isDragActive ? 'scale-[1.02] shadow-[0_0_50px_-10px_rgba(32,178,170,0.3)]' : ''}
                `}
                role="button"
                aria-label="File upload zone"
                tabIndex={isConnected && !isUploading ? 0 : -1}
            >
                <input {...getInputProps()} aria-label="File input" />

                {/* Background Glow */}
                <div className={`absolute inset-0 transition-opacity duration-300 ${isDragActive ? 'bg-[#20B2AA]/20 opacity-100' : 'bg-white/5 opacity-50 group-hover:opacity-100'
                    }`} />

                {/* Animated Border */}
                <div className={`absolute inset-0 border-2 border-dashed rounded-3xl transition-colors duration-300 ${isDragActive ? 'border-[#20B2AA] animate-pulse' : 'border-white/10 group-hover:border-[#20B2AA]/50'
                    }`} />

                <div className="relative z-10 p-8 md:p-14 flex flex-col items-center justify-center text-center min-h-[260px]">
                    {isUploading ? (
                        <div className="w-full max-w-xs space-y-4">
                            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                                <svg className="w-full h-full text-[#20B2AA] animate-spin" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span className="absolute text-xs font-bold">{uploadProgress}%</span>
                            </div>
                            <div className="text-lg font-bold text-white animate-pulse">Uploading...</div>
                        </div>
                    ) : (
                        <div className="space-y-4 group-hover:-translate-y-2 transition-transform duration-300">
                            <div className={`w-20 h-20 mx-auto bg-black/40 rounded-full flex items-center justify-center border border-white/10 transition-all duration-300 ${isDragActive ? 'scale-110 border-[#20B2AA] text-[#20B2AA] shadow-[0_0_20px_rgba(32,178,170,0.3)]' : 'text-gray-400 group-hover:text-white group-hover:border-white/30'
                                }`}>
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-xl md:text-2xl font-bold text-white mb-2">
                                    {isDragActive ? 'Drop to Upload!' : 'Upload Files'}
                                </h3>
                                <p className="text-gray-500 text-sm md:text-base max-w-[200px] mx-auto">
                                    Drag & drop or click to browse
                                </p>
                            </div>
                            <span className="inline-block px-3 py-1 bg-white/5 rounded-lg text-[10px] text-gray-500 font-mono border border-white/5">
                                Max 100MB
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Files Grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 -mr-1">
                {files.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-24 md:pb-0">
                        {files.slice().reverse().map((file) => (
                            <div key={file.id} className="glass-panel p-4 rounded-2xl group relative hover:bg-white/[0.07] transition-all duration-300 hover:-translate-y-1">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-black/40 flex items-center justify-center text-2xl border border-white/10 group-hover:border-white/20 transition-colors">
                                        {getFileIcon(file.originalName)}
                                    </div>
                                    <div className="flex-1 min-w-0 py-0.5">
                                        <h4 className="font-bold text-gray-200 truncate pr-8" title={file.originalName}>
                                            {file.originalName}
                                        </h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] font-bold text-[#20B2AA] bg-[#20B2AA]/10 px-1.5 py-0.5 rounded">
                                                {formatBytes(file.size)}
                                            </span>
                                            <span className="text-[10px] text-gray-600 font-mono uppercase">
                                                {new Date(file.uploadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/5">
                                    <a
                                        href={`${downloadUrl}${file.downloadUrl}`}
                                        download
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 py-2 bg-gradient-to-r from-white/5 to-white/10 hover:from-[#20B2AA] hover:to-[#1C9D96] hover:text-black rounded-xl text-xs font-bold uppercase tracking-wider text-center transition-all flex items-center justify-center gap-2 group/btn border border-white/5 hover:border-transparent"
                                    >
                                        <span>Download</span>
                                        <svg className="w-3.5 h-3.5 group-hover/btn:translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                    </a>
                                    <button
                                        onClick={() => onDeleteFile(file.id)}
                                        className="p-2 rounded-xl text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                        title="Delete"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center opacity-40 min-h-[300px]">
                        <div className="text-6xl mb-4 grayscale" role="img" aria-label="Empty state">📂</div>
                        <p className="text-gray-400 font-medium">No files shared yet</p>
                    </div>
                )}
            </div>
        </div>
    );
});

FileShare.propTypes = {
    files: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string.isRequired,
        originalName: PropTypes.string.isRequired,
        size: PropTypes.number.isRequired,
        uploadedAt: PropTypes.string.isRequired,
        downloadUrl: PropTypes.string.isRequired
    })).isRequired,
    onUpload: PropTypes.func.isRequired,
    onDeleteFile: PropTypes.func.isRequired,
    isUploading: PropTypes.bool.isRequired,
    uploadProgress: PropTypes.number.isRequired,
    isConnected: PropTypes.bool.isRequired
};

FileShare.displayName = 'FileShare';

export default FileShare;
