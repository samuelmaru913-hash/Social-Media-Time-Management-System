import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../../constants';

interface Props {
    size?: number;
    percentage: number;        // 0–100
    centerLabel?: string;
    centerSub?: string;
    trackColor?: string;
    progressColor?: string;
    strokeWidth?: number;
}

/**
 * A pure-JS circular ring progress indicator.
 * Uses border-radius technique for broad compatibility.
 */
export function CircularProgress({
    size = 120,
    percentage,
    centerLabel,
    centerSub,
    trackColor = COLORS.bgCardLight,
    progressColor = COLORS.primary,
    strokeWidth = 10,
}: Props) {
    const clipped = Math.min(100, Math.max(0, percentage));
    const innerSize = size - strokeWidth * 2;

    // We'll use a CSS-like approach with two half-circle clips
    // For simplicity, use a segmented approach
    const deg = (clipped / 100) * 360;

    return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            {/* Track */}
            <View
                style={{
                    position: 'absolute',
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderWidth: strokeWidth,
                    borderColor: trackColor,
                }}
            />
            {/* Progress using clip-based approach */}
            {clipped > 0 && (
                <View
                    style={{
                        position: 'absolute',
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        borderWidth: strokeWidth,
                        borderColor: progressColor,
                        borderRightColor: clipped >= 25 ? progressColor : trackColor,
                        borderBottomColor: clipped >= 50 ? progressColor : trackColor,
                        borderLeftColor: clipped >= 75 ? progressColor : trackColor,
                        transform: [{ rotate: '-90deg' }],
                    }}
                />
            )}
            {/* Center text */}
            <View style={{ alignItems: 'center' }}>
                {centerLabel && (
                    <Text style={{ color: COLORS.textWhite, fontSize: FONTS.sizes.xl, fontWeight: '800' }}>
                        {centerLabel}
                    </Text>
                )}
                {centerSub && (
                    <Text style={{ color: COLORS.textMuted, fontSize: FONTS.sizes.xs }}>
                        {centerSub}
                    </Text>
                )}
            </View>
        </View>
    );
}

/**
 * Better circular progress using multiple border segments.
 * Shows a smooth-ish arc.
 */
export function RingProgress({
    size = 140,
    percentage,
    centerLabel,
    centerSub,
    progressColor = COLORS.primary,
    strokeWidth = 12,
}: Props) {
    const clipped = Math.min(100, Math.max(0, percentage));

    return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            {/* Background ring */}
            <View
                style={{
                    position: 'absolute',
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderWidth: strokeWidth,
                    borderColor: COLORS.bgCardLight,
                }}
            />
            {/* Colored ring — approximated with 4-border technique */}
            <View
                style={{
                    position: 'absolute',
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderWidth: strokeWidth,
                    borderTopColor: progressColor,
                    borderRightColor: clipped > 25 ? progressColor : 'transparent',
                    borderBottomColor: clipped > 50 ? progressColor : 'transparent',
                    borderLeftColor: clipped > 75 ? progressColor : 'transparent',
                    transform: [{ rotate: '-90deg' }],
                }}
            />
            <View style={{ alignItems: 'center', gap: 2 }}>
                {centerLabel && (
                    <Text style={{ color: COLORS.textWhite, fontSize: FONTS.sizes.xl, fontWeight: '700', letterSpacing: -0.5 }}>
                        {centerLabel}
                    </Text>
                )}
                {centerSub && (
                    <Text style={{ color: COLORS.textMuted, fontSize: FONTS.sizes.xs }}>
                        {centerSub}
                    </Text>
                )}
            </View>
        </View>
    );
}
