module.exports = {
    ignoredNativeDependencies: ['@nativescript-community/sentry'],
    id: 'com.akylas.nativescript.plugins',
    appResourcesPath: 'App_Resources',
    android: {
        markingMode: 'none',
        codeCache: true
    },
    cssParser: 'rework',
    appPath: 'app',
    webpackConfigPath: './app.webpack.config.js',
    hooks: [
        {
            type: 'after-prepareNativeApp',
            script: 'scripts/after-prepareNativeApp.js'
        }
    ]
};
