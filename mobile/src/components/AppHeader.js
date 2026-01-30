import React from 'react';
import { View, Text, StyleSheet, Platform, StatusBar } from 'react-native';

export default function AppHeader() {
    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <View style={styles.logoContainer}>
                    <Text style={styles.logoIcon}>📡</Text>
                    <Text style={styles.logoText}>WiFi Share</Text>
                </View>
                <Text style={styles.tagline}>Seamless Local Sharing</Text>
            </View>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
        paddingTop: Platform.OS === 'ios' ? 0 : StatusBar.currentHeight,
        paddingBottom: 16,
        paddingHorizontal: 24,
        zIndex: 10,
    },
    content: {
        marginTop: 16,
        alignItems: 'flex-start',
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    logoIcon: {
        fontSize: 24,
        marginRight: 8,
    },
    logoText: {
        fontSize: 28,
        fontWeight: '800',
        color: '#111827',
        letterSpacing: -0.5,
    },
    tagline: {
        fontSize: 14,
        color: '#6b7280',
        fontWeight: '400',
        marginLeft: 36,
    },
});
