import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ConnectionStatus({ isConnected }) {
    return (
        <View style={[styles.container, isConnected ? styles.connected : styles.disconnected]}>
            <View style={[styles.dot, isConnected ? styles.dotConnected : styles.dotDisconnected]} />
            <Text style={styles.text}>
                {isConnected ? 'Connected' : 'Disconnected'}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    connected: {
        backgroundColor: '#f0fdf4',
    },
    disconnected: {
        backgroundColor: '#fef2f2',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    dotConnected: {
        backgroundColor: '#22c55e',
    },
    dotDisconnected: {
        backgroundColor: '#ef4444',
    },
    text: {
        fontSize: 12,
        fontWeight: '500',
        color: '#374151',
    },
});
