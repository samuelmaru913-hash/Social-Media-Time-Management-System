import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { getNativeAppIcon, getNativeAppIcons } from '../native/blocker';

const iconCache = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();

/**
 * Warms the icon cache for a batch of packages with a single native call.
 * Call this right after scanning so the app drawer paints real icons fast.
 */
export async function prefetchAppIcons(packageNames: string[]): Promise<void> {
    const missing = packageNames.filter((pkg) => !iconCache.has(pkg));
    if (missing.length === 0) return;

    const icons = await getNativeAppIcons(missing);
    for (const pkg of missing) {
        if (!iconCache.has(pkg)) iconCache.set(pkg, icons[pkg] ?? null);
    }
}

function loadIcon(packageName: string): Promise<string | null> {
    if (iconCache.has(packageName)) {
        return Promise.resolve(iconCache.get(packageName) ?? null);
    }
    const existing = pending.get(packageName);
    if (existing) return existing;

    const request = getNativeAppIcon(packageName)
        .then((icon) => {
            iconCache.set(packageName, icon);
            pending.delete(packageName);
            return icon;
        })
        .catch(() => {
            iconCache.set(packageName, null);
            pending.delete(packageName);
            return null;
        });

    pending.set(packageName, request);
    return request;
}

interface AppIconProps {
    packageName: string;
    label?: string;
    size?: number;
    color?: string;
    borderRadius?: number;
}

/**
 * Shows the real Android launcher icon for a package. Falls back to a
 * letter avatar only while the icon is loading or if it cannot be read.
 */
export function AppIcon({
    packageName,
    label,
    size = 44,
    color = '#4C6FFF',
    borderRadius,
}: AppIconProps) {
    const [uri, setUri] = useState<string | null>(() => iconCache.get(packageName) ?? null);

    useEffect(() => {
        let active = true;
        loadIcon(packageName).then((icon) => {
            if (active) setUri(icon);
        });
        return () => {
            active = false;
        };
    }, [packageName]);

    const radius = borderRadius ?? Math.round(size * 0.28);

    if (uri) {
        return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: radius }} />;
    }

    const letter = (label?.trim()?.[0] ?? packageName[0] ?? '?').toUpperCase();
    return (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: radius,
                backgroundColor: color,
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <Text style={{ fontSize: Math.round(size * 0.45), color: '#fff', fontWeight: '700' }}>
                {letter}
            </Text>
        </View>
    );
}
