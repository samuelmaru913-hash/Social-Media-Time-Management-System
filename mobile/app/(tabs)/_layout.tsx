import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { createContext, useContext } from 'react';
import { COLORS, FONTS } from '../../src/constants';
import { useEnforcement } from '../../src/hooks/useEnforcement';

// ── Enforcement Context ────────────────────────────────────────────────────────
// Any screen inside (tabs) can call useEnforcementContext().checkApp(pkg, name)
// to instantly test + enforce a restriction.

interface EnforcementCtx {
    checkApp: (packageName: string, appName: string) => boolean;
    syncNow: () => void;
}

const EnforcementContext = createContext<EnforcementCtx>({
    checkApp: () => false,
    syncNow: () => undefined,
});

export function useEnforcementContext() {
    return useContext(EnforcementContext);
}

// ── Tab Icon ───────────────────────────────────────────────────────────────────
function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
    return (
        <View style={styles.tabItem}>
            <Text style={[styles.tabEmoji, focused && { opacity: 1 }]}>{emoji}</Text>
            <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
            {focused && <View style={styles.tabActiveBar} />}
        </View>
    );
}

// ── Layout ─────────────────────────────────────────────────────────────────────
function TabsLayoutInner() {
    const { checkApp, syncNow } = useEnforcement();   // ← mounts enforcement engine

    return (
        <EnforcementContext.Provider value={{ checkApp, syncNow }}>
            <Tabs
                screenOptions={{
                    headerShown: false,
                    tabBarStyle: styles.tabBar,
                    tabBarShowLabel: false,
                }}
            >
                <Tabs.Screen
                    name="index"
                    options={{
                        tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label="Home" focused={focused} />,
                    }}
                />
                <Tabs.Screen
                    name="applications"
                    options={{
                        tabBarIcon: ({ focused }) => <TabIcon emoji="📱" label="Apps" focused={focused} />,
                    }}
                />
                <Tabs.Screen
                    name="study"
                    options={{
                        tabBarIcon: ({ focused }) => <TabIcon emoji="⚡" label="Modes" focused={focused} />,
                    }}
                />
                <Tabs.Screen
                    name="reports"
                    options={{
                        tabBarIcon: ({ focused }) => <TabIcon emoji="📊" label="Analytics" focused={focused} />,
                    }}
                />
                <Tabs.Screen
                    name="settings"
                    options={{
                        tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label="Account" focused={focused} />,
                    }}
                />
            </Tabs>
        </EnforcementContext.Provider>
    );
}

export default function TabsLayout() {
    return <TabsLayoutInner />;
}

const styles = StyleSheet.create({
    tabBar: {
        backgroundColor: '#0F1D44',
        borderTopColor: '#1E3A6B',
        borderTopWidth: 1,
        height: 72,
        paddingBottom: 8,
        paddingTop: 6,
        elevation: 8,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowOffset: { width: 0, height: -3 },
        shadowRadius: 8,
    },
    tabItem: { alignItems: 'center', justifyContent: 'center', gap: 2, minWidth: 56 },
    tabEmoji: { fontSize: 21, opacity: 0.5 },
    tabLabel: { fontSize: 10, color: COLORS.textFaint, fontWeight: '500' },
    tabLabelActive: { color: COLORS.primary, fontWeight: '700' },
    tabActiveBar: {
        position: 'absolute', bottom: -8, left: 8, right: 8,
        height: 2, backgroundColor: COLORS.primary, borderRadius: 2,
    },
});
