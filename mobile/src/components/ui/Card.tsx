import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, BORDER_RADIUS, SPACING } from '../../constants';

interface Props {
    children: React.ReactNode;
    style?: ViewStyle;
    padding?: number;
}

export function Card({ children, style, padding = SPACING.md }: Props) {
    return (
        <View style={[styles.card, { padding }, style]}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.bgCard,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
});
