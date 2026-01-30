import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    ActivityIndicator,
    Alert
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { shareAsync } from 'expo-sharing';
import { API_URL } from '../services/api';

export default function FileShare({ files, onUpload, onDeleteFile, isUploading, isConnected }) {
    const [downloadingId, setDownloadingId] = useState(null);

    const pickFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const file = result.assets[0];
                await onUpload(file);
            }
        } catch (error) {
            console.error('File picking error:', error);
            Alert.alert('Error', 'Failed to pick file');
        }
    };

    const handleDownload = async (file) => {
        try {
            setDownloadingId(file.id);
            console.log('Downloading file:', file.originalName);

            const fileUri = FileSystem.documentDirectory + file.originalName;
            const downloadUrl = `${API_URL}${file.downloadUrl}`;

            console.log('Download URL:', downloadUrl);
            console.log('Save to:', fileUri);

            const downloadResult = await FileSystem.downloadAsync(downloadUrl, fileUri);
            console.log('Download complete:', downloadResult);

            await shareAsync(downloadResult.uri);
        } catch (error) {
            console.error('Download error:', error);
            Alert.alert('Download Failed', `Could not download ${file.originalName}. ${error.message}`);
        } finally {
            setDownloadingId(null);
        }
    };

    const getFileIcon = (filename) => {
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
    };

    const formatBytes = (bytes) => {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
    };

    const renderFileItem = ({ item }) => (
        <View style={styles.fileItem}>
            <View style={styles.fileContent}>
                <Text style={styles.fileIcon}>{getFileIcon(item.originalName)}</Text>
                <View style={styles.fileInfo}>
                    <Text style={styles.fileName} numberOfLines={1}>{item.originalName}</Text>
                    <Text style={styles.fileDetails}>
                        {formatBytes(item.size)} • {new Date(item.uploadedAt).toLocaleTimeString()}
                    </Text>
                </View>
            </View>
            <View style={styles.fileActions}>
                <TouchableOpacity
                    onPress={() => handleDownload(item)}
                    style={[styles.downloadButton, downloadingId === item.id && styles.downloadButtonDisabled]}
                    disabled={downloadingId === item.id}
                >
                    {downloadingId === item.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text style={styles.downloadButtonText}>Download</Text>
                    )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onDeleteFile(item.id)} style={styles.deleteButton}>
                    <Text style={styles.deleteIcon}>🗑️</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Header - matching web design */}
            <View style={styles.header}>
                <View style={styles.iconContainer}>
                    <Text style={styles.headerIcon}>📁</Text>
                </View>
                <Text style={styles.headerTitle}>Files</Text>
            </View>

            {/* Upload Zone - matching web design */}
            <View style={styles.uploadSection}>
                <TouchableOpacity
                    style={[
                        styles.uploadZone,
                        (!isConnected || isUploading) && styles.uploadZoneDisabled
                    ]}
                    onPress={pickFile}
                    disabled={!isConnected || isUploading}
                    activeOpacity={0.7}
                >
                    {isUploading ? (
                        <View style={styles.uploadingContainer}>
                            <ActivityIndicator size="large" color="#111827" />
                            <Text style={styles.uploadingText}>Uploading...</Text>
                        </View>
                    ) : (
                        <View>
                            <Text style={styles.uploadIcon}>📎</Text>
                            <Text style={styles.uploadText}>
                                {!isConnected ? 'Not connected to server' : 'Tap to select a file'}
                            </Text>
                            <Text style={styles.uploadSubText}>Max file size: 100MB</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* Files List - matching web design */}
            <View style={styles.listSection}>
                <FlatList
                    data={[...files].reverse()}
                    renderItem={renderFileItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyIcon}>📁</Text>
                            <Text style={styles.emptyText}>No files shared yet.</Text>
                            <Text style={styles.emptySubText}>Upload a file to share with the room!</Text>
                        </View>
                    }
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: '#111827',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    headerIcon: {
        fontSize: 20,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
    },
    uploadSection: {
        padding: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    uploadZone: {
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: '#e5e7eb',
        borderRadius: 12,
        padding: 48,
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    uploadZoneDisabled: {
        opacity: 0.5,
    },
    uploadIcon: {
        fontSize: 48,
        textAlign: 'center',
        marginBottom: 16,
    },
    uploadText: {
        fontSize: 16,
        color: '#4b5563',
        textAlign: 'center',
    },
    uploadSubText: {
        fontSize: 12,
        color: '#9ca3af',
        textAlign: 'center',
        marginTop: 8,
    },
    uploadingContainer: {
        alignItems: 'center',
    },
    uploadingText: {
        fontSize: 16,
        color: '#111827',
        fontWeight: '500',
        marginTop: 16,
    },
    listSection: {
        flex: 1,
        padding: 24,
    },
    listContent: {
        paddingBottom: 16,
    },
    fileItem: {
        backgroundColor: '#f9fafb',
        padding: 16,
        borderRadius: 8,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#f3f4f6',
    },
    fileContent: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    fileIcon: {
        fontSize: 32,
        marginRight: 12,
    },
    fileInfo: {
        flex: 1,
    },
    fileName: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1f2937',
        marginBottom: 4,
    },
    fileDetails: {
        fontSize: 12,
        color: '#6b7280',
    },
    fileActions: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    downloadButton: {
        flex: 1,
        backgroundColor: '#111827',
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
        minHeight: 32,
        justifyContent: 'center',
    },
    downloadButtonDisabled: {
        opacity: 0.7,
    },
    downloadButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    deleteButton: {
        padding: 8,
        borderRadius: 8,
    },
    deleteIcon: {
        fontSize: 20,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyText: {
        fontSize: 16,
        color: '#9ca3af',
        fontWeight: '500',
        marginBottom: 4,
    },
    emptySubText: {
        fontSize: 12,
        color: '#9ca3af',
    },
});
