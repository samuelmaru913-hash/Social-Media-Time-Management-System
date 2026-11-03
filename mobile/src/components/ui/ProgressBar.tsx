import { View, Text, StyleSheet } from 'react-native';
import { COLORS, BORDER_RADIUS } from '../../constants';

interface Props {
    value: number;      // 0–100
    color?: string;
    height?: number;
    showLabel?: boolean;
}

export function ProgressBar({ value, color = COLORS.primary, height = 8, showLabel = false }: Props) {
    const clamped = Math.min(100, Math.max(0, value));
    return (
        <View>
            <View style={[styles.track, { height }]}>
                <View
                    style={[
                        styles.fill,
                        { width: `${clamped}%`, backgroundColor: color, height },
                    ]}
                />
            </View>
            {showLabel && (
                <Text style={styles.label}>{Math.round(clamped)}%</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    track: {
        backgroundColor: COLORS.bgCardLight,
        borderRadius: BORDER_RADIUS.full,
        overflow: 'hidden',
        width: '100%',
    },
    fill: {
        borderRadius: BORDER_RADIUS.full,
    },
    label: {
        color: COLORS.textMuted,
        fontSize: 11,
        marginTop: 2,
        textAlign: 'right',
    },
});
