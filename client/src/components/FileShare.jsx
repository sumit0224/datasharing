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
        <div className="bg-[#0A0A0A] rounded-2xl shadow-2xl border border-white/5 overflow-hidden fade-in">
            {/* Header with icon */}
            <div className="p-6 border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#20B2AA] rounded-xl flex items-center justify-center text-black shadow-[0_0_15px_-3px_rgba(32,178,170,0.4)]" aria-hidden="true">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Files</h2>
                </div>
            </div>

            {/* Upload Zone */}
            <div className="p-6 border-b border-white/5">
                <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-300
                        ${!isConnected || isUploading ? 'opacity-50 cursor-not-allowed' : ''}
                        ${isDragActive
                            ? 'border-[#20B2AA] bg-[#20B2AA]/10 scale-[1.02] shadow-[0_0_20px_-5px_rgba(32,178,170,0.3)]'
                            : 'border-white/10 hover:border-[#20B2AA]/50 hover:bg-white/5'}`}
                    role="button"
                    aria-label="File upload zone"
                    tabIndex={isConnected && !isUploading ? 0 : -1}
                >
                    <input {...getInputProps()} aria-label="File input" />

                    {isUploading ? (
                        <div className="space-y-4">
                            <div className="text-[#20B2AA] font-bold animate-pulse" role="status" aria-live="polite">
                                Uploading... {uploadProgress}%
                            </div>
                            <div className="max-w-xs mx-auto">
                                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                                    <div
                                        className="bg-[#20B2AA] h-2 rounded-full transition-all duration-300 shadow-[0_0_10px_#20B2AA]"
                                        style={{ width: `${uploadProgress}%` }}
                                        role="progressbar"
                                        aria-valuenow={uploadProgress}
                                        aria-valuemin="0"
                                        aria-valuemax="100"
                                    ></div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="text-5xl mb-4 grayscale hover:grayscale-0 transition-all duration-300" role="img" aria-label="Upload icon">📎</div>
                            <p className="text-gray-400 font-medium">
                                {!isConnected ? "Not connected to server" :
                                    isDragActive ? "Drop the file here..." :
                                        "Drag & drop a file here, or click to select"}
                            </p>
                            <p className="text-xs text-gray-600 font-mono mt-2">Max file size: 100MB</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Files List */}
            <div className="p-6 max-h-[500px] overflow-y-auto custom-scrollbar">
                {files.length > 0 ? (
                    <div className="space-y-4" role="list" aria-label="Shared files">
                        {files.slice().reverse().map((file) => (
                            <div key={file.id} className="group p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 hover:bg-white/[0.07] transition-all fade-in relative" role="listitem">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        <div className="text-3xl flex-shrink-0" role="img" aria-label={`${file.originalName} file`}>
                                            {getFileIcon(file.originalName)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-gray-200 truncate tracking-wide" title={file.originalName}>
                                                {file.originalName}
                                            </p>
                                            <p className="text-[10px] text-gray-500 font-mono mt-1 uppercase tracking-wider">
                                                {formatBytes(file.size)} • {new Date(file.uploadedAt).toLocaleTimeString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <a
                                            href={`${downloadUrl}${file.downloadUrl}`}
                                            download
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-shrink-0 px-5 py-2 bg-[#20B2AA] text-black rounded-lg font-bold hover:bg-[#1C9D96] transition-all shadow-lg shadow-[#20B2AA]/20 disabled:opacity-40 disabled:cursor-not-allowed text-xs uppercase tracking-wider"
                                            aria-label={`Download ${file.originalName}`}
                                        >
                                            Download
                                        </a>
                                        <button
                                            onClick={() => onDeleteFile(file.id)}
                                            className="p-2 rounded-lg text-red-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                            title="Delete file"
                                            aria-label={`Delete ${file.originalName}`}
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                        <div className="text-6xl mb-4 grayscale" role="img" aria-label="Empty state">📁</div>
                        <p className="text-gray-500 font-medium">No files shared yet.</p>
                        <p className="text-xs text-gray-600 mt-1">Upload a file to share with the room!</p>
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
