const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

if (!configuredApiUrl) {
    throw new Error(
        'EXPO_PUBLIC_API_URL is not configured. Set it to the Focus No API base URL ending in /api/v1.'
    );
}

let parsedApiUrl: URL;
try {
    parsedApiUrl = new URL(configuredApiUrl);
} catch {
    throw new Error('EXPO_PUBLIC_API_URL must be a valid absolute HTTP(S) URL.');
}

if (parsedApiUrl.protocol !== 'https:' && parsedApiUrl.protocol !== 'http:') {
    throw new Error('EXPO_PUBLIC_API_URL must use HTTP or HTTPS.');
}

if (!parsedApiUrl.pathname.replace(/\/+$/, '').endsWith('/api/v1')) {
    throw new Error('EXPO_PUBLIC_API_URL must end in /api/v1.');
}

if (!__DEV__ && parsedApiUrl.protocol !== 'https:') {
    throw new Error('Production builds require EXPO_PUBLIC_API_URL to use HTTPS.');
}

if (!__DEV__ && ['localhost', '127.0.0.1', '10.0.2.2'].includes(parsedApiUrl.hostname)) {
    throw new Error('Production EXPO_PUBLIC_API_URL cannot point to a local development host.');
}

export const API_BASE_URL = configuredApiUrl.replace(/\/+$/, '');
