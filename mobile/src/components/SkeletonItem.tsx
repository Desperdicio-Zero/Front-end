import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';

export const SkeletonItem = () => {
    const { theme } = useTheme();
    const fadeAnim = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(fadeAnim, {
                    toValue: 0.7,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 0.3,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [fadeAnim]);

    return (
        <Animated.View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, opacity: fadeAnim }]}>
            <View style={styles.content}>
                <View style={[styles.avatar, { backgroundColor: theme.bgSecondary }]} />
                <View style={styles.textContainer}>
                    <View style={[styles.title, { backgroundColor: theme.bgSecondary }]} />
                    <View style={[styles.subtitle, { backgroundColor: theme.bgSecondary }]} />
                </View>
                <View style={[styles.tag, { backgroundColor: theme.bgSecondary }]} />
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        overflow: 'hidden',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 12,
        marginRight: 16,
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    title: {
        height: 14,
        width: '60%',
        borderRadius: 7,
        marginBottom: 8,
    },
    subtitle: {
        height: 10,
        width: '40%',
        borderRadius: 5,
    },
    tag: {
        width: 40,
        height: 24,
        borderRadius: 12,
    },
});
