import { Label as HTMLLabel, Label } from '@nativescript-community/ui-label';
import { Color } from '@nativescript/core/color';
import { Observable } from '@nativescript/core/data/observable';
import { $t, $tc } from '~/helpers/locale';
import { booleanProperty } from './BackendService';
import { HttpRequestOptions } from './NetworkService';
import { Headers } from '@nativescript/core/http';
import { Device, alert } from '@nativescript/core';
import * as Sentry from '@nativescript-community/sentry';
import { install } from '~/utils/logging';
import { getRootView } from '@nativescript/core/application';

function evalTemplateString(resource: string, obj: {}) {
    if (!obj) {
        return resource;
    }
    const names = Object.keys(obj);
    const vals = Object.keys(obj).map((key) => obj[key]);
    return new Function(...names, `return \`${resource}\`;`)(...vals);
}

export default class CrashReportService extends Observable {
    @booleanProperty({ default: true }) sentryEnabled: boolean;
    sentry: typeof Sentry;
    async start() {
        if (gVars.sentry && this.sentryEnabled) {
            try {
                install();
                const Sentry = await import('@nativescript-community/sentry');
                this.sentry = Sentry;
                Sentry.init({
                    dsn: SENTRY_DSN,
                    appPrefix: SENTRY_PREFIX,
                    release: `${__APP_ID__}@${__APP_VERSION__}+${__APP_BUILD_NUMBER__}`,
                    dist: `${__APP_BUILD_NUMBER__}.${__ANDROID__ ? 'android' : 'ios'}`
                });
                Sentry.setTag('locale', Device.language);
            } catch (err) {
                console.error('CrashReportService start', err, err.stack);
            }
        } else {
            this.sentry = null;
        }
    }
    async enable() {
        this.sentryEnabled = true;
        if (!this.sentry) {
            await this.start();
        }
    }
    async disable() {
        this.sentryEnabled = false;
    }

    captureException(err: Error) {
        if (this.sentryEnabled && !!this.sentry) {
            // if (err instanceof CustomError) {
            //     this.withScope((scope) => {
            //         scope.setExtra('errorData', JSON.stringify(err.assignedLocalData));
            //         this.sentry.captureException(err);
            //     });
            // } else {
            return this.sentry.captureException(err);
            // }
        }
    }
    captureMessage(message: string, level?) {
        if (this.sentryEnabled && this.sentry) {
            return this.sentry.captureMessage(message, level);
        }
    }
    setExtra(key: string, value: any) {
        if (this.sentryEnabled && this.sentry) {
            return this.sentry.setExtra(key, value);
        }
    }

    withScope(callback: (scope: Sentry.Scope) => void) {
        if (this.sentryEnabled && this.sentry) {
            return this.sentry.withScope(callback);
        }
    }

    showError(err: Error | string, showAsSnack = false) {
        if (!err) {
            return;
        }
        const realError = typeof err === 'string' ? null : err;

        const isString = realError === null || realError === undefined;
        const message = isString ? (err as string) : realError.message || realError.toString();
        const reporterEnabled = this.sentryEnabled;
        // if (showAsSnack || realError instanceof MessageError || realError instanceof NoNetworkError || realError instanceof TimeoutError) {
        //     showSnack({ message, view: getRootView() });
        //     return;
        // }
        const showSendBugReport = __FORCE_BUG_REPORT__ || (reporterEnabled && !isString && !!realError.stack);
        // const showSendBugReport = __FORCE_BUG_REPORT__ || (reporterEnabled && !isString && !(realError instanceof MessageError) && !(realError instanceof HTTPError) && !!realError.stack);
        // const title = realError instanceof HTTPError ? realError.title : showSendBugReport ? $tc('error') : ' ';
        const title = showSendBugReport ? $tc('error') : ' ';

        console.error('showError', err, err['stack']);
        if (reporterEnabled && showSendBugReport) {
            this.captureException(realError);
        }
        return alert({
            title,
            message: message.trim(),
            okButtonText: $tc('OKButton')
        });
    }
}
let crashReportService: CrashReportService;
export function getCrashReportInstance() {
    if (!crashReportService) {
        crashReportService = new CrashReportService();
    }
    return crashReportService;
}
