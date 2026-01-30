import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function RoomInfo({ roomId, userCount, onCopyRoom }) {
    return (
        <View style={styles.container}>
            <View style={styles.infoRow}>
                <Text style={styles.label}>Room:</Text>
                <TouchableOpacity onPress={() => onCopyRoom(roomId)}>
                    <Text style={styles.roomId}>{roomId || 'Loading...'}</Text>
                </TouchableOpacity>
            </View>
            <View style={styles.infoRow}>
                <View style={styles.userBadge}>
                    <Text style={styles.userIcon}>👥</Text>
                    <Text style={styles.userCount}>{userCount} {userCount === 1 ? 'user' : 'users'}</Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    label: {
        fontSize: 14,
        color: '#6b7280',
        marginRight: 8,
        fontWeight: '500',
    },
    roomId: {
        fontSize: 14,
        color: '#667eea',
        fontWeight: '700',
    },
    userBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    userIcon: {
        fontSize: 14,
        marginRight: 6,
    },
    userCount: {
        fontSize: 13,
        color: '#374151',
        fontWeight: '600',
    },
});
