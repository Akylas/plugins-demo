const NsVueTemplateCompiler = require('nativescript-vue-template-compiler');
const webpackConfig = require('./webpack.config.js');
const webpack = require('webpack');
const { readdirSync, readFileSync } = require('fs');
const { dirname, join, relative, resolve, sep } = require('path');
const nsWebpack = require('@nativescript/webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const SentryCliPlugin = require('@sentry/webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const Fontmin = require('@akylas/fontmin');
const IgnoreNotFoundExportPlugin = require('./scripts/IgnoreNotFoundExportPlugin');

function fixedFromCharCode(codePt) {
    if (codePt > 0xffff) {
        codePt -= 0x10000;
        return String.fromCharCode(0xd800 + (codePt >> 10), 0xdc00 + (codePt & 0x3ff));
    } else {
        return String.fromCharCode(codePt);
    }
}

module.exports = (env, params = {}) => {
    if (env.adhoc) {
        env = Object.assign(
            {},
            {
                production: true,
                sentry: false,
                uploadSentry: false,
                noconsole: true,
                sourceMap: true,
                uglify: true
            },
            env
        );
    } else if (env.timeline) {
        env = Object.assign(
            {},
            {
                production: true,
                sentry: false,
                noconsole: false,
                uploadSentry: false,
                sourceMap: false,
                uglify: true
            },
            env
        );
    } else if (env.devbuild === undefined) {
        env.devbuild = false;
    }
    const nconfig = require('./nativescript.config');
    const {
        appPath = nconfig.appPath,
        appResourcesPath = nconfig.appResourcesPath,
        hmr, // --env.hmr
        production, // --env.production
        sourceMap, // --env.sourceMap
        hiddenSourceMap, // --env.hiddenSourceMap
        inlineSourceMap, // --env.inlineSourceMap
        sentry, // --env.sentry
        uploadSentry = true,
        testscenario = false,
        testupload,
        profile, // --env.profile
        timeline, // --env.profile
        uglify, // --env.uglify
        noconsole, // --env.noconsole
        devlog, // --env.devlog
        reportall, // --env.reportall
        devbuild, // --env.devbuild
        adhoc, // --env.adhoc
        logins // --env.logins
    } = env;
    env.appPath = appPath;
    env.appResourcesPath = appResourcesPath;
    env.appComponents = env.appComponents || [];
    // env.appComponents.push('~/services/android/BgService', '~/services/android/BgServiceBinder');
    const config = webpackConfig(env, params);
    const mode = production ? 'production' : 'development';
    const platform = env && ((env.android && 'android') || (env.ios && 'ios'));
    const projectRoot = params.projectRoot || __dirname;
    const dist = nsWebpack.Utils.platform.getDistPath();
    const appResourcesFullPath = resolve(projectRoot, appResourcesPath);

    if (profile) {
        config.profile = true;
        config.stats = { preset: 'minimal', chunkModules: true, modules: true };
    }

    config.experiments = {
        topLevelAwait: true
    };

    config.externals.push('~/licenses.json');
    config.externals.push(function ({ context, request }, cb) {
        if (/i18n$/i.test(context)) {
            return cb(null, './i18n/' + request);
        }
        cb();
    });

    const coreModulesPackageName = '@akylas/nativescript';
    config.resolve.modules = [resolve(__dirname, `node_modules/${coreModulesPackageName}`), resolve(__dirname, 'node_modules')];

    // config.resolve.symlinks = false;
    Object.assign(config.resolve.alias, {
        '@nativescript/core': `${coreModulesPackageName}`,
        'tns-core-modules': `${coreModulesPackageName}`
    });
    let appVersion;
    let buildNumber;
    if (platform === 'android') {
        const gradlePath = resolve(projectRoot, appResourcesPath, 'Android/app.gradle');
        const gradleData = readFileSync(gradlePath, 'utf8');
        appVersion = gradleData.match(/versionName "((?:[0-9]+\.?)+)"/)[1];
        buildNumber = gradleData.match(/versionCode ([0-9]+)/)[1];
    } else if (platform === 'ios') {
        const plistPath = resolve(projectRoot, appResourcesPath, 'iOS/Info.plist');
        const plistData = readFileSync(plistPath, 'utf8');
        appVersion = plistData.match(/<key>CFBundleShortVersionString<\/key>[\s\n]*<string>(.*?)<\/string>/)[1];
        buildNumber = plistData.match(/<key>CFBundleVersion<\/key>[\s\n]*<string>([0-9]*)<\/string>/)[1];
    }
    const isAndroid = platform === 'android';
    const isIOS = platform === 'ios';
    const APP_STORE_ID = process.env.IOS_APP_ID;
    const supportedLocales = readdirSync(join(projectRoot, appPath, 'i18n'))
        .filter((s) => s.endsWith('.json'))
        .map((s) => s.replace('.json', ''));

    const defines = {
        SUPPORTED_LOCALES: JSON.stringify(supportedLocales),
        PRODUCTION: !!production,
        process: 'global.process',
        'global.TNS_WEBPACK': 'true',
        'global.isIOS': isIOS,
        'global.isAndroid': isAndroid,
        'global.autoLoadPolyfills': false,
        __UI_USE_EXTERNAL_RENDERER__: true,
        __UI_USE_XML_PARSER__: false,
        'global.__AUTO_REGISTER_UI_MODULES__': false,
        TNS_ENV: JSON.stringify(mode),
        'gVars.sentry': !!sentry,
        'gVars.platform': `"${platform}"`,
        LOGINS: !!logins,
        TEST_SCENARIO: !!testscenario,
        TEST_UPLOAD_PATH: testupload ? '"/storage/15F0-3D16/upload_test"' : 'null',
        SENTRY_DSN: `"${process.env.SENTRY_DSN}"`,
        SENTRY_PREFIX: `"${!!sentry ? process.env.SENTRY_PREFIX : ''}"`,
        NO_CONSOLE: noconsole,
        DEV_LOG: !!devlog,
        __FORCE_BUG_REPORT__: !!reportall,
        TEST_LOGS: !!adhoc || !production,
        __APP_ID__: `"${nconfig.id}"`,
        __APP_VERSION__: `"${appVersion}"`,
        __APP_BUILD_NUMBER__: `"${buildNumber}"`,
        ANDROID_STORE_LINK: `"https://play.google.com/store/apps/details?id=${nconfig.id}"`,
        IOS_STORE_LINK: `"https://itunes.apple.com/app/id${APP_STORE_ID}"`,
        STORE_LINK: `"${isAndroid ? `https://play.google.com/store/apps/details?id=${nconfig.id}` : `https://itunes.apple.com/app/id${APP_STORE_ID}`}"`,
        STORE_REVIEW_LINK: `"${
            isIOS
                ? ` itms-apps://itunes.apple.com/WebObjects/MZStore.woa/wa/viewContentsUserReviews?id=${APP_STORE_ID}&onlyLatestVersion=true&pageNumber=0&sortOrdering=1&type=Purple+Software`
                : `https://play.google.com/store/apps/details?id=${nconfig.id}`
        }"`
    };

    const symbolsParser = require('scss-symbols-parser');
    // const mdiSymbols = symbolsParser.parseSymbols(readFileSync(resolve(projectRoot, 'node_modules/@mdi/font/scss/_variables.scss')).toString());
    // const mdiIcons = JSON.parse(`{${mdiSymbols.variables[mdiSymbols.variables.length - 1].value.replace(/" (F|0)(.*?)([,\n]|$)/g, '": "$1$2"$3')}}`);
    // const scssPrepend = `
    // $mdi-fontFamily: ${platform === 'android' ? 'materialdesignicons-webfont' : 'Material Design Icons'};
    // `;
    const scssPrepend = '';
    const scssLoaderRuleIndex = config.module.rules.findIndex((r) => r.test && r.test.toString().indexOf('scss') !== -1);
    config.module.rules.splice(
        scssLoaderRuleIndex,
        1,
        {
            test: /app\.scss$/,
            use: [
                { loader: 'apply-css-loader' },
                {
                    loader: 'css2json-loader',
                    options: { useForImports: true }
                },
                {
                    loader: 'sass-loader',
                    options: {
                        sourceMap: false,
                        additionalData: scssPrepend
                    }
                }
            ]
        },
        {
            test: /\.module\.scss$/,
            use: [
                { loader: 'css-loader', options: { url: false } },
                {
                    loader: 'sass-loader',
                    options: {
                        sourceMap: false,
                        additionalData: scssPrepend
                    }
                }
            ]
        }
    );

    // const usedMDIICons = [];
    config.module.rules.push({
        // rules to replace mdi icons and not use nativescript-font-icon
        test: /\.(ts|js|scss|css|vue)$/,
        exclude: /node_modules/,
        use: [
            {
                loader: 'string-replace-loader',
                options: {
                    search: '__PACKAGE_NAME__',
                    replace: nconfig.id
                }
            },
            // {
            //     loader: 'string-replace-loader',
            //     options: {
            //         search: 'mdi-([a-z-]+)',
            //         replace: (match, p1, offset, str) => {
            //             if (mdiIcons[p1]) {
            //                 const unicodeHex = mdiIcons[p1];
            //                 const numericValue = parseInt(unicodeHex, 16);
            //                 const character = fixedFromCharCode(numericValue);
            //                 usedMDIICons.push(numericValue);
            //                 return character;
            //             }
            //             return match;
            //         },
            //         flags: 'g'
            //     }
            // }
        ]
    });

    // we remove default rules
    config.plugins = config.plugins.filter((p) => ['CopyPlugin', 'ForkTsCheckerWebpackPlugin'].indexOf(p.constructor.name) === -1);

    config.externalsPresets = { node: false };
    config.resolve.fallback = config.resolve.fallback || {};

    const globOptions = { dot: false, ignore: [`**/${relative(appPath, appResourcesFullPath)}/**`] };
    const context = nsWebpack.Utils.platform.getEntryDirPath();
    const copyPatterns = [
        { context, from: 'fonts/!(ios|android)/**/*', to: 'fonts/[name][ext]', noErrorOnMissing: true, globOptions },
        { context, from: 'fonts/*', to: 'fonts/[name][ext]', noErrorOnMissing: true, globOptions },
        { context, from: `fonts/${platform}/**/*`, to: 'fonts/[name][ext]', noErrorOnMissing: true, globOptions },
        { context, from: '**/*.jpg', noErrorOnMissing: true, globOptions },
        { context, from: '**/*.png', noErrorOnMissing: true, globOptions },
        { context, from: 'assets/**/*', noErrorOnMissing: true, globOptions },
        { context, from: 'i18n/**/*', globOptions },
        // {
        //     from: 'node_modules/@mdi/font/fonts/materialdesignicons-webfont.ttf',
        //     to: 'fonts',
        //     globOptions,
        //     transform: !!production
        //         ? {
        //               transformer(content, path) {
        //                   return new Promise((resolve, reject) => {
        //                       new Fontmin()
        //                           .src(content)
        //                           .use(Fontmin.glyph({ subset: usedMDIICons }))
        //                           .run(function (err, files) {
        //                               if (err) {
        //                                   reject(err);
        //                               } else {
        //                                   resolve(files[0].contents);
        //                               }
        //                           });
        //                   });
        //               }
        //           }
        //         : undefined
        // }
    ];

    Object.assign(config.plugins.find((p) => p.constructor.name === 'DefinePlugin').definitions, defines);

    config.plugins.unshift(new CopyWebpackPlugin({ patterns: copyPatterns }));

    config.plugins.unshift(
        new webpack.ProvidePlugin({
            setTimeout: [require.resolve(coreModulesPackageName + '/timer/index.' + platform), 'setTimeout'],
            clearTimeout: [require.resolve(coreModulesPackageName + '/timer/index.' + platform), 'clearTimeout'],
            setImmediate: [require.resolve(coreModulesPackageName + '/timer/index.' + platform), 'setImmediate'],
            setInterval: [require.resolve(coreModulesPackageName + '/timer/index.' + platform), 'setInterval'],
            clearInterval: [require.resolve(coreModulesPackageName + '/timer/index.' + platform), 'clearInterval'],
            FormData: [require.resolve(coreModulesPackageName + '/polyfills/formdata'), 'FormData'],
            requestAnimationFrame: [require.resolve(coreModulesPackageName + '/animation-frame'), 'requestAnimationFrame'],
            cancelAnimationFrame: [require.resolve(coreModulesPackageName + '/animation-frame'), 'cancelAnimationFrame']
        })
    );
    config.plugins.push(new webpack.ContextReplacementPlugin(/dayjs[\/\\]locale$/, new RegExp(`(${supportedLocales.join('|')}).\js`)));
    config.plugins.push(new IgnoreNotFoundExportPlugin());
    const nativescriptReplace = '(NativeScript[\\/]dist[\\/]packages[\\/]core|@nativescript/core)';
    // config.plugins.push(
    //     new webpack.NormalModuleReplacementPlugin(/http$/, (resource) => {
    //         if (resource.context.match(nativescriptReplace)) {
    //             resource.request = '@nativescript-community/https';
    //         }
    //     })
    // );
    // config.plugins.push(
    //     new webpack.NormalModuleReplacementPlugin(/accessibility$/, (resource) => {
    //         if (resource.context.match(nativescriptReplace)) {
    //             resource.request = '~/shims/accessibility';
    //         }
    //     })
    // );
    // config.plugins.push(
    //     new webpack.NormalModuleReplacementPlugin(/action-bar$/, (resource) => {
    //         if (resource.context.match(nativescriptReplace)) {
    //             resource.request = '~/shims/action-bar';
    //         }
    //     })
    // );
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /reduce-css-calc$/ }));
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /punnycode$/ }));
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /^url$/ }));
    if (!!production && !timeline) {
        console.log('removing N profiling');
        config.plugins.push(
            new webpack.NormalModuleReplacementPlugin(/profiling$/, (resource) => {
                if (resource.context.match(nativescriptReplace)) {
                    resource.request = '~/shims/profile';
                }
            }),
            new webpack.NormalModuleReplacementPlugin(/trace$/, (resource) => {
                if (resource.context.match(nativescriptReplace)) {
                    resource.request = '~/shims/trace';
                }
            })
        );
        config.module.rules.push(
            {
                // rules to replace mdi icons and not use nativescript-font-icon
                test: /\.(js)$/,
                use: [
                    {
                        loader: 'string-replace-loader',
                        options: {
                            search: /__decorate\(\[((\s|\t|\n)*?)([a-zA-Z]+\.)?profile((\s|\t|\n)*?)\],.*?,.*?,.*?\);?/gm,
                            replace: (match, p1, offset, str) => '',
                            flags: 'gm'
                        }
                    }
                ]
            },
            {
                // rules to replace mdi icons and not use nativescript-font-icon
                test: /\.(ts)$/,
                use: [
                    {
                        loader: 'string-replace-loader',
                        options: {
                            search: '@profile',
                            replace: (match, p1, offset, str) => '',
                            flags: ''
                        }
                    }
                ]
            },
            // rules to clean up all Trace in production
            // we must run it for all files even node_modules
            {
                test: /\.(ts|js)$/,
                use: [
                    {
                        loader: 'string-replace-loader',
                        options: {
                            search: /if\s*\(\s*Trace.isEnabled\(\)\s*\)/gm,
                            replace: (match, p1, offset, str) => 'if (false)',
                            flags: 'g'
                        }
                    }
                ]
            }
        );
    }

    if (hiddenSourceMap || sourceMap) {
        if (!!sentry && !!uploadSentry) {
            console.log('enabling source maps');
            config.devtool = false;
            config.plugins.push(
                new webpack.SourceMapDevToolPlugin({
                    append: `\n//# sourceMappingURL=${process.env.SENTRY_PREFIX}[file].map`,
                    filename: join(process.env.SOURCEMAP_REL_DIR, '[file].map')
                })
            );
            config.plugins.push(
                new SentryCliPlugin({
                    release: appVersion,
                    urlPrefix: process.env.SENTRY_PREFIX,
                    rewrite: true,
                    cleanArtifacts: true,
                    release: `${nconfig.id}@${appVersion}+${buildNumber}`,
                    dist: `${buildNumber}.${platform}`,
                    ignoreFile: '.sentrycliignore',
                    include: [dist, join(dist, process.env.SOURCEMAP_REL_DIR)]
                })
            );
        } else {
            config.devtool = 'inline-nosources-cheap-module-source-map';
        }
    } else {
        config.devtool = false;
    }

    // if (!!production) {
    //     config.plugins.push(
    //         new ForkTsCheckerWebpackPlugin({
    //             async: false,
    //             typescript: {
    //                 configFile: resolve(tsconfig)
    //             }
    //         })
    //     );
    // }
    config.optimization.splitChunks.cacheGroups.defaultVendor.test = /[\\/](node_modules|nativescript-carto|NativeScript[\\/]dist[\\/]packages[\\/]core)[\\/]/;
    config.optimization.minimize = uglify !== undefined ? !!uglify : production;
    const isAnySourceMapEnabled = !!sourceMap || !!hiddenSourceMap || !!inlineSourceMap;
    config.optimization.minimizer = [
        new TerserPlugin({
            parallel: true,
            // sourceMap: isAnySourceMapEnabled,
            terserOptions: {
                ecma: isAndroid ? 2020 : 2017,
                module: true,
                toplevel: false,
                keep_classnames: platform !== 'android',
                keep_fnames: platform !== 'android',
                output: {
                    comments: false,
                    semicolons: !isAnySourceMapEnabled
                },
                mangle: {
                    properties: {
                        reserved: ['__metadata'],
                        regex: /^(m[A-Z])/
                    }
                },
                compress: {
                    booleans_as_integers: false,
                    // The Android SBG has problems parsing the output
                    // when these options are enabled
                    collapse_vars: platform !== 'android',
                    sequences: platform !== 'android',
                    passes: 3,
                    drop_console: production && !sentry && noconsole
                }
            }
        })
    ];
    return config;
};
