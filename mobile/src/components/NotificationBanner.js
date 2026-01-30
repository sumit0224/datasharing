import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

export default function NotificationBanner({ message, visible, onHide }) {
    const slideAnim = useRef(new Animated.Value(-100)).current;

    useEffect(() => {
        if (visible) {
            // Slide in
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 50,
                friction: 7,
            }).start();

            // Auto hide after 2 seconds
            const timer = setTimeout(() => {
                Animated.timing(slideAnim, {
                    toValue: -100,
                    duration: 200,
                    useNativeDriver: true,
                }).start(() => {
                    if (onHide) onHide();
                });
            }, 2000);

            return () => clearTimeout(timer);
        }
    }, [visible, slideAnim, onHide]);

    if (!message) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                { transform: [{ translateY: slideAnim }] },
            ]}
        >
            <View style={styles.content}>
                <Text style={styles.icon}>{message.icon}</Text>
                <Text style={styles.text}>{message.text}</Text>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 16,
        right: 16,
        zIndex: 9999,
        backgroundColor: '#1f2937',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    icon: {
        fontSize: 20,
        marginRight: 12,
    },
    text: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
    },
});
