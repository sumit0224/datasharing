import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    Clipboard
} from 'react-native';

export default function TextShare({ texts, onSendText, onCopyText, onDeleteText, isConnected }) {
    const [message, setMessage] = useState('');

    const handleSend = () => {
        if (message.trim() && isConnected) {
            onSendText(message.trim());
            setMessage('');
        }
    };

    const renderTextItem = ({ item }) => (
        <View style={styles.textItem}>
            <View style={styles.textContent}>
                <Text style={styles.textMessage}>{item.content}</Text>
                <Text style={styles.timestamp}>
                    {new Date(item.timestamp).toLocaleTimeString()}
                </Text>
            </View>
            <View style={styles.textActions}>
                <TouchableOpacity onPress={() => onCopyText(item.content)} style={styles.iconButton}>
                    <Text style={styles.copyIcon}>📋</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onDeleteText(item.id)} style={styles.deleteButton}>
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
                    <Text style={styles.headerIcon}>📝</Text>
                </View>
                <Text style={styles.headerTitle}>Text</Text>
            </View>

            {/* Input Form - matching web design */}
            <View style={styles.inputSection}>
                <TextInput
                    style={styles.textArea}
                    value={message}
                    onChangeText={setMessage}
                    placeholder="Type something..."
                    placeholderTextColor="#9ca3af"
                    multiline
                    textAlignVertical="top"
                    editable={isConnected}
                    maxLength={5000}
                />
                <View style={styles.inputFooter}>
                    <Text style={styles.charCount}>{message.length} / 5000 characters</Text>
                    <TouchableOpacity
                        style={[
                            styles.saveButton,
                            (!message.trim() || !isConnected) && styles.saveButtonDisabled
                        ]}
                        onPress={handleSend}
                        disabled={!message.trim() || !isConnected}
                    >
                        <Text style={styles.saveButtonText}>Save</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Message List - matching web design */}
            <View style={styles.listSection}>
                <FlatList
                    data={[...texts].reverse()}
                    renderItem={renderTextItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyIcon}>📝</Text>
                            <Text style={styles.emptyText}>No shared texts yet.</Text>
                            <Text style={styles.emptySubText}>Type a message above to get started!</Text>
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
    inputSection: {
        padding: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    textArea: {
        height: 160,
        padding: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        fontSize: 14,
        color: '#1f2937',
        marginBottom: 16,
    },
    inputFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    charCount: {
        fontSize: 12,
        color: '#9ca3af',
    },
    saveButton: {
        paddingHorizontal: 32,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#d1d5db',
        backgroundColor: '#fff',
    },
    saveButtonDisabled: {
        opacity: 0.4,
    },
    saveButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
    },
    listSection: {
        flex: 1,
        padding: 24,
    },
    listContent: {
        paddingBottom: 16,
    },
    textItem: {
        flexDirection: 'row',
        backgroundColor: '#f9fafb',
        padding: 16,
        borderRadius: 8,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#f3f4f6',
    },
    textContent: {
        flex: 1,
        marginRight: 12,
    },
    textMessage: {
        fontSize: 14,
        color: '#1f2937',
        lineHeight: 20,
        marginBottom: 8,
    },
    timestamp: {
        fontSize: 12,
        color: '#9ca3af',
    },
    textActions: {
        flexDirection: 'row',
        gap: 4,
    },
    iconButton: {
        padding: 8,
        borderRadius: 4,
    },
    deleteButton: {
        padding: 8,
        borderRadius: 4,
    },
    copyIcon: {
        fontSize: 16,
    },
    deleteIcon: {
        fontSize: 16,
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
