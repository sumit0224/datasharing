import React, { useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import PropTypes from 'prop-types';

const FileShare = React.memo(({ files, onUpload, isUploading, uploadProgress, isConnected }) => {
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
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden fade-in">
            {/* Header with icon */}
            <div className="p-6 border-b border-gray-100">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center text-white" aria-hidden="true">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Files</h2>
                </div>
            </div>

            {/* Upload Zone */}
            <div className="p-6 border-b border-gray-100">
                <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
                        ${!isConnected || isUploading ? 'opacity-50 cursor-not-allowed' : ''}
                        ${isDragActive ? 'border-purple-400 bg-purple-50 scale-[1.02]' : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'}`}
                    role="button"
                    aria-label="File upload zone"
                    tabIndex={isConnected && !isUploading ? 0 : -1}
                >
                    <input {...getInputProps()} aria-label="File input" />

                    {isUploading ? (
                        <div className="space-y-3">
                            <div className="text-purple-600 font-medium" role="status" aria-live="polite">
                                Uploading... {uploadProgress}%
                            </div>
                            <div className="max-w-xs mx-auto">
                                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-purple-500 to-indigo-600 h-2 rounded-full transition-all duration-300"
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
                        <div className="space-y-2">
                            <div className="text-5xl mb-4" role="img" aria-label="Upload icon">📎</div>
                            <p className="text-gray-600">
                                {!isConnected ? "Not connected to server" :
                                    isDragActive ? "Drop the file here..." :
                                        "Drag & drop a file here, or click to select"}
                            </p>
                            <p className="text-xs text-gray-400 mt-2">Max file size: 100MB</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Files List */}
            <div className="p-6 max-h-96 overflow-y-auto custom-scrollbar">
                {files.length > 0 ? (
                    <div className="space-y-3" role="list" aria-label="Shared files">
                        {files.slice().reverse().map((file) => (
                            <div key={file.id} className="group p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all fade-in" role="listitem">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className="text-3xl flex-shrink-0" role="img" aria-label={`${file.originalName} file`}>
                                            {getFileIcon(file.originalName)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-800 truncate" title={file.originalName}>
                                                {file.originalName}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {formatBytes(file.size)} • {new Date(file.uploadedAt).toLocaleTimeString()}
                                            </p>
                                        </div>
                                    </div>
                                    <a
                                        href={`${downloadUrl}${file.downloadUrl}`}
                                        download
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-shrink-0 ml-3 px-8 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg font-medium hover:from-purple-600 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed text-sm py-1.5 px-4"
                                        aria-label={`Download ${file.originalName}`}
                                    >
                                        Download
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <div className="text-6xl mb-4" role="img" aria-label="Empty state">📁</div>
                        <p className="text-gray-400 font-medium">No files shared yet.</p>
                        <p className="text-xs text-gray-400 mt-1">Upload a file to share with the room!</p>
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
        filename: PropTypes.string.isRequired,
        size: PropTypes.number.isRequired,
        uploadedAt: PropTypes.string.isRequired,
        downloadUrl: PropTypes.string.isRequired
    })).isRequired,
    onUpload: PropTypes.func.isRequired,
    isUploading: PropTypes.bool.isRequired,
    uploadProgress: PropTypes.number.isRequired,
    isConnected: PropTypes.bool.isRequired
};

FileShare.displayName = 'FileShare';

export default FileShare;
