const fs = require('fs');
const path = require('path');
const {
    withAndroidManifest,
    withDangerousMod,
    withMainApplication,
    withStringsXml,
} = require('@expo/config-plugins');

const SERVICE_CLASS = '.blocker.AppBlockerAccessibilityService';
const SERVICE_LABEL = 'FocusNo App Blocker';
const SERVICE_DESCRIPTION =
    'FocusNo uses this service to detect when a blocked or time-limited app is opened and show a blocking screen. It never reads the content of your screen or collects personal data.';

function withBlockerManifest(config) {
    return withAndroidManifest(config, (config) => {
        const manifest = config.modResults.manifest;
        const application = manifest.application && manifest.application[0];
        if (!application) return config;

        application.service = application.service || [];
        const hasService = application.service.some(
            (service) => service.$ && service.$['android:name'] === SERVICE_CLASS
        );
        if (!hasService) {
            application.service.push({
                $: {
                    'android:name': SERVICE_CLASS,
                    'android:exported': 'true',
                    'android:label': '@string/app_blocker_service_label',
                    'android:permission': 'android.permission.BIND_ACCESSIBILITY_SERVICE',
                },
                'intent-filter': [
                    {
                        action: [
                            { $: { 'android:name': 'android.accessibilityservice.AccessibilityService' } },
                        ],
                    },
                ],
                'meta-data': [
                    {
                        $: {
                            'android:name': 'android.accessibilityservice',
                            'android:resource': '@xml/accessibility_service_config',
                        },
                    },
                ],
            });
        }

        manifest['uses-permission'] = manifest['uses-permission'] || [];
        for (const permission of [
            'android.permission.PACKAGE_USAGE_STATS',
            'android.permission.QUERY_ALL_PACKAGES',
            'android.permission.REQUEST_INSTALL_PACKAGES',
        ]) {
            const exists = manifest['uses-permission'].some(
                (item) => item.$ && item.$['android:name'] === permission
            );
            if (!exists) {
                manifest['uses-permission'].push({ $: { 'android:name': permission } });
            }
        }

        return config;
    });
}

function withBlockerStrings(config) {
    return withStringsXml(config, (config) => {
        const resources = config.modResults.resources;
        resources.string = resources.string || [];

        const addString = (name, value) => {
            const exists = resources.string.some((item) => item.$ && item.$.name === name);
            if (!exists) {
                resources.string.push({ _: value, $: { name } });
            }
        };

        addString('app_blocker_service_label', SERVICE_LABEL);
        addString('accessibility_service_description', SERVICE_DESCRIPTION);

        return config;
    });
}

function withBlockerFiles(config) {
    return withDangerousMod(config, [
        'android',
        async (config) => {
            const projectRoot = config.modRequest.projectRoot;
            const androidRoot = config.modRequest.platformProjectRoot;
            const packageName = (config.android && config.android.package) || 'com.focusno.app';
            const packagePath = packageName.split('.').join(path.sep);

            const sourceRoot = path.join(projectRoot, 'plugins', 'app-blocker');
            const javaDestination = path.join(
                androidRoot,
                'app',
                'src',
                'main',
                'java',
                packagePath,
                'blocker'
            );
            const xmlDestination = path.join(androidRoot, 'app', 'src', 'main', 'res', 'xml');

            fs.mkdirSync(javaDestination, { recursive: true });
            fs.mkdirSync(xmlDestination, { recursive: true });

            const kotlinSource = path.join(sourceRoot, 'kotlin');
            for (const file of fs.readdirSync(kotlinSource)) {
                if (!file.endsWith('.kt')) continue;
                const content = fs
                    .readFileSync(path.join(kotlinSource, file), 'utf8')
                    .replace(/com\.dikiaa\.mobile/g, packageName);
                fs.writeFileSync(path.join(javaDestination, file), content);
            }

            fs.copyFileSync(
                path.join(sourceRoot, 'accessibility_service_config.xml'),
                path.join(xmlDestination, 'accessibility_service_config.xml')
            );

            return config;
        },
    ]);
}

function withBlockerMainApplication(config) {
    return withMainApplication(config, (config) => {
        const packageName = (config.android && config.android.package) || 'com.focusno.app';
        let contents = config.modResults.contents;

        if (!contents.includes('BlockerPackage')) {
            const importLine = `import ${packageName}.blocker.BlockerPackage`;

            if (contents.includes('import expo.modules.ApplicationLifecycleDispatcher')) {
                contents = contents.replace(
                    'import expo.modules.ApplicationLifecycleDispatcher',
                    `${importLine}\n\nimport expo.modules.ApplicationLifecycleDispatcher`
                );
            } else {
                contents = contents.replace(/(package [^\n]+\n)/, `$1\n${importLine}\n`);
            }

            if (contents.includes('// add(MyReactNativePackage())')) {
                contents = contents.replace(
                    '// add(MyReactNativePackage())',
                    'add(BlockerPackage())'
                );
            } else {
                contents = contents.replace(
                    /PackageList\(this\)\.packages\.apply \{/,
                    'PackageList(this).packages.apply {\n              add(BlockerPackage())'
                );
            }
        }

        config.modResults.contents = contents;
        return config;
    });
}

module.exports = function withAppBlocker(config) {
    config = withBlockerManifest(config);
    config = withBlockerStrings(config);
    config = withBlockerFiles(config);
    config = withBlockerMainApplication(config);
    return config;
};
