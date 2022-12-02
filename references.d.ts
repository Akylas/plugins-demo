/// <reference path="./node_modules/@nativescript/types-android/lib/android-31.d.ts" />
// <reference path="./node_modules/@nativescript/types-ios/lib/ios.d.ts" />
/// <reference path="./node_modules/@nativescript/types-ios/lib/ios/objc-x86_64/objc!Foundation.d.ts" />
/// <reference path="./node_modules/@nativescript/types-ios/lib/ios/objc-x86_64/objc!UIKit.d.ts" />
/// <reference path="./node_modules/@nativescript/core/global-types.d.ts" />
/// <reference path="./typings/uploadservice.android.d.ts" />
/// <reference path="./vue.shim.d.ts" />
declare let global: NodeJS.Global & typeof globalThis;

declare module '*.vue' {
    import Vue from 'vue';
    export default Vue;
}
declare module '*.scss';

declare const TNS_ENV: string;
declare const DEV_LOG: boolean;
declare const TEST_UPLOAD_PATH: string;
declare const TEST_LOGS: boolean;
declare const PRODUCTION: boolean;
declare const NO_CONSOLE: boolean;
declare const SUPPORTED_LOCALES: string[];
declare const LOGINS: string;
declare const CONTACT_EMAIL: string;
declare const WEBSITE_URL: string;
declare const API_URL: string;
declare const API_DEV_URL: string;
declare const STORE_LINK: string;
declare const STORE_REVIEW_LINK: string;
declare const DEV_USER_EMAIL: string;
declare const DEV_USER_PASSWORD: string;
declare const SENTRY_DSN: string;
declare const SENTRY_PREFIX: string;
declare const TEST_SCENARIO: boolean;
declare const __FORCE_BUG_REPORT__: boolean;
declare const WITH_PUSH_NOTIFICATIONS: boolean;

declare const gVars: {
    sentry: boolean;
    platform: string;
};

declare const __APP_ID__: string;
declare const __APP_VERSION__: string;
declare const __APP_BUILD_NUMBER__: string;

declare namespace com {
    export namespace tdk {
        export namespace cdc {
            class BgService extends globalAndroid.app.Service {}
            class BgServiceBinder extends globalAndroid.os.Binder {}
        }
    }
}

interface LatLonKeys {
    lat: number;
    lon: number;
    altitude?: number;
}
