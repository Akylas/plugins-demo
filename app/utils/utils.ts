import { ActivityIndicator, Label, Progress, View } from '@nativescript/core';
import Vue, { NativeScriptVue } from 'nativescript-vue';
import { openUrl } from '@nativescript/core/utils';
import { InAppBrowser } from '@akylas/nativescript-inappbrowser';
import { accentColor, primaryColor } from '~/variables';
import { AlertDialog, alert } from '@nativescript-community/ui-material-dialogs';
import { ShowLoadingOptions } from '~/components/BaseVueComponent';

export async function openLink(url: string) {
    try {
        const available = await InAppBrowser.isAvailable();
        if (available) {
            await InAppBrowser.open(url, {
                // iOS Properties
                dismissButtonStyle: 'close',
                preferredBarTintColor: 'white',
                preferredControlTintColor: accentColor,
                readerMode: true,
                animated: true,
                // modalPresentationStyle: 'fullScreen',
                // modalTransitionStyle: 'partialCurl',
                modalEnabled: true,
                enableBarCollapsing: false,
                // Android Properties
                showTitle: true,
                toolbarColor: 'white',
                secondaryToolbarColor: accentColor,
                enableUrlBarHiding: true,
                enableDefaultShare: true,
                forceCloseOnRedirection: false
            });
        } else {
            openUrl(url);
        }
    } catch (error) {
        Vue.prototype.$crashReportService.showError(error);
        alert({
            title: 'Error',
            message: error.message,
            okButtonText: 'Ok'
        });
    }
}

function isObject(object) {
    return object != null && typeof object === 'object';
}
export function deepEqual(object1, object2) {
    const keys1 = Object.keys(object1);
    const keys2 = Object.keys(object2);
    if (keys1.length !== keys2.length) {
        return false;
    }

    for (const key of keys1) {
        const val1 = object1[key];
        const val2 = object2[key];
        const areObjects = isObject(val1) && isObject(val2);
        if ((areObjects && !deepEqual(val1, val2)) || (!areObjects && val1 !== val2)) {
            return false;
        }
    }

    return true;
}

type HandlerFunction = (error: Error, ctx: any) => void;

export const Catch =
    (handler: HandlerFunction = (err, ctx) => showError(err), errorType: any = Error): any =>
    (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
        // Save a reference to the original method
        const originalMethod = descriptor.value;

        // Rewrite original method with try/catch wrapper
        descriptor.value = function (...args: any[]) {
            try {
                const that = this;
                const result = originalMethod.apply(that, args);

                // Check if method is asynchronous
                if (result && result instanceof Promise) {
                    // Return promise
                    return result.catch((error: any) => {
                        _handleError(that, error, handler, errorType);
                    });
                }

                // Return actual result
                return result;
            } catch (error) {
                _handleError(this, error, handler, errorType);
            }
        };

        return descriptor;
    };

export const CatchAll = (handler: HandlerFunction): any => Catch(handler, Error);

function _handleError(ctx: any, error: Error, handler: HandlerFunction, errorType: any) {
    // Check if error is instance of given error type
    if (typeof handler === 'function' && error instanceof errorType) {
        // Run handler with error object and class context
        handler.call(ctx, error);
    }
    // } else {
    // Throw error further
    // Next decorator in chain can catch it
    throw error;
    // }
}
let showLoadingStartTime: number = null;
function getLoadingIndicator() {
    if (!loadingIndicator) {
        const instance = new (require('~/components/LoadingIndicator.vue').default)();
        instance.$mount();
        const view = instance.nativeView;
        loadingIndicator = new AlertDialog({
            view,
            cancelable: false
        });
        loadingIndicator.indicator = view.getChildAt(0) as ActivityIndicator;
        loadingIndicator.label = view.getChildAt(1) as Label;
        loadingIndicator.progress = view.getChildAt(2) as Progress;
    }
    return loadingIndicator;
}
export function showLoading(msg: string | ShowLoadingOptions) {
    const text = (msg as any).text || msg;
    const loadingIndicator = getLoadingIndicator();
    loadingIndicator.label.text = text + '...';
    if (typeof msg !== 'string' && msg.hasOwnProperty('progress')) {
        loadingIndicator.indicator.visibility = 'collapse';
        loadingIndicator.progress.visibility = 'visible';
        loadingIndicator.progress.value = msg.progress;
    } else {
        loadingIndicator.indicator.visibility = 'visible';
        loadingIndicator.progress.visibility = 'collapse';
    }
    if (showLoadingStartTime === null) {
        showLoadingStartTime = Date.now();
        loadingIndicator.show();
    }
}
export function showingLoading() {
    return showLoadingStartTime !== null;
}
let loadingIndicator: AlertDialog & { label?: Label; indicator?: ActivityIndicator; progress?: Progress };
export async function hideLoading() {
    // const delta = showLoadingStartTime ? Date.now() - showLoadingStartTime : -1;
    // if (delta >= 0 && delta < 1000) {
    //     setTimeout(() => hideLoading(), 1000 - delta);
    //     return;
    // }
    // if (DEV_LOG) {
    //     log('hideLoading', showLoadingStartTime, delta);
    // }
    showLoadingStartTime = null;
    if (loadingIndicator) {
        await loadingIndicator.hide();
    }
}

export function showError(err: Error | string, showAsSnack = false) {
    showErrorInternal(err, showAsSnack);
}
export function showErrorInternal(err: Error | string, showAsSnack = false) {
    if (!err) {
        return;
    }
    const delta = showLoadingStartTime ? Date.now() - showLoadingStartTime : -1;
    hideLoading();
    if (!showAsSnack && delta >= 0 && delta < 1000) {
        setTimeout(() => showErrorInternal(err, showAsSnack), 1000 - delta);
        return;
    }
    if (showingLoading()) {
        setTimeout(() => Vue.prototype.$crashReportService.showError(err, showAsSnack), 500);
    } else {
        Vue.prototype.$crashReportService.showError(err, showAsSnack);
    }
}
