import { foregroundEvent } from '@akylas/nativescript/application';
import * as https from '@nativescript-community/https';
import { request } from '@nativescript-community/perms';
import { Application, ApplicationEventData, EventData, Observable, knownFolders } from '@nativescript/core';
import * as connectivity from '@nativescript/core/connectivity';
import { $tc } from '~/helpers/locale';
import { HTTPError, NoNetworkError, TimeoutError } from './CrashReportService';

export interface CacheOptions {
    diskLocation: string;
    diskSize: number;
    memorySize?: number;
}
export type HTTPOptions = https.HttpsRequestOptions;

export const NetworkConnectionStateEvent = 'NetworkConnectionStateEvent';
export interface NetworkConnectionStateEventData extends EventData {
    data: {
        connected: boolean;
        connectionType: connectivity.connectionType;
    };
}

export interface HttpRequestOptions extends HTTPOptions {
    body?;
    cachePolicy?: https.CachePolicy;
    queryParams?: {};
    apiPath?: string;
    multipartParams?;
    canRetry?;
    noToken?: boolean;
}

function evalTemplateString(resource: string, obj: {}) {
    if (!obj) {
        return resource;
    }
    const names = Object.keys(obj);
    const vals = Object.keys(obj).map((key) => obj[key]);
    return new Function(...names, `return \`${resource}\`;`)(...vals);
}
function fixedEncodeURIComponent(str) {
    return encodeURIComponent(str).replace(/[!'()*]/g, function (c) {
        return '%' + c.charCodeAt(0).toString(16);
    });
}
export function queryString(params, location) {
    const obj = {};
    let i, len, key, value;

    if (typeof params === 'string') {
        value = location.match(new RegExp('[?&]' + params + '=?([^&]*)[&#$]?'));
        return value ? value[1] : undefined;
    }

    const locSplit = location.split(/[?&]/);

    const parts = [];
    for (i = 0, len = locSplit.length; i < len; i++) {
        const theParts = locSplit[i].split('=');
        if (!theParts[0]) {
            continue;
        }
        if (theParts[1]) {
            parts.push(theParts[0] + '=' + theParts[1]);
        } else {
            parts.push(theParts[0]);
        }
    }
    if (Array.isArray(params)) {
        let data;

        for (i = 0, len = params.length; i < len; i++) {
            data = params[i];
            if (typeof data === 'string') {
                parts.push(data);
            } else if (Array.isArray(data)) {
                parts.push(data[0] + '=' + data[1]);
            }
        }
    } else if (typeof params === 'object') {
        for (key in params) {
            value = params[key];
            if (typeof value === 'undefined') {
                delete obj[key];
            } else {
                if (typeof value === 'object') {
                    obj[key] = fixedEncodeURIComponent(JSON.stringify(value));
                } else {
                    obj[key] = fixedEncodeURIComponent(value);
                }
            }
        }
        for (key in obj) {
            parts.push(key + (obj[key] === true ? '' : '=' + obj[key]));
        }
    }

    return parts.splice(0, 2).join('?') + (parts.length > 0 ? '&' + parts.join('&') : '');
}

export class NetworkService extends Observable {
    apiUrl: string;
    _connectionType: connectivity.connectionType = connectivity.connectionType.none;
    _connected = false;
    get connected() {
        return this._connected;
    }
    set connected(value: boolean) {
        if (this._connected !== value) {
            DEV_LOG && console.log('NetworkService', 'set connected', value);
            this._connected = value;
            this.onConnectionChanged(value);
        }
    }

    onConnectionChanged(value: boolean) {
        this.notify({
            eventName: NetworkConnectionStateEvent,
            object: this,
            data: {
                connected: value,
                connectionType: this._connectionType
            }
        } as NetworkConnectionStateEventData);
    }
    get connectionType() {
        return this._connectionType;
    }
    set connectionType(value: connectivity.connectionType) {
        DEV_LOG && console.log('NetworkService', 'set connectionType', value, this._connectionType);
        if (this._connectionType !== value) {
            DEV_LOG && console.log('NetworkService', 'set connectionType', value, this._connectionType);
            this._connectionType = value;
            this.connected = value !== connectivity.connectionType.none;
        }
    }
    constructor() {
        super();
    }
    monitoring = false;
    async start() {
        if (this.monitoring) {
            return;
        }
        this.monitoring = true;
        this.connectionType = connectivity.getConnectionType();
        connectivity.startMonitoring(this.onConnectionStateChange.bind(this));
        Application.on(foregroundEvent, this.onAppResume, this);
        const folder = knownFolders.temp().getFolder('cache');
        const diskLocation = folder.path;
        const cacheSize = 10 * 1024 * 1024;
        DEV_LOG && console.log('NetworkService start', diskLocation, cacheSize);
        https.setCache({
            forceCache: !PRODUCTION,
            diskLocation,
            diskSize: cacheSize,
            memorySize: cacheSize
        });
    }
    stop() {
        if (!this.monitoring) {
            return;
        }
        this.monitoring = false;
        Application.off(foregroundEvent, this.onAppResume, this);
        connectivity.stopMonitoring();
    }
    onAppResume(args: ApplicationEventData) {
        this.connectionType = connectivity.getConnectionType();
    }
    onConnectionStateChange(newConnectionType: connectivity.connectionType) {
        this.connectionType = newConnectionType;
    }

    async handleRequestRetry(requestParams: HttpRequestOptions, retry = 0) {
        throw new HTTPError({
            statusCode: 401,
            message: 'HTTP error',
            requestParams
        });
    }

    async getRequestHeaders(requestParams?: HttpRequestOptions) {
        const headers = requestParams?.headers || {};
        if (!headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }
        // if (!appVersion) {
        //     const versionName = await getVersionName();
        //     const buildNumber = await getBuildNumber();
        //     appVersion = `${versionName}.${buildNumber}`;
        // }
        // if (!headers['referer']) {
        // headers['referer'] = `${NS_PLATFORM}-outdoor-${appVersion}`;
        // }
        // if (!headers['Cache-Control']) {
        //     headers['Cache-Control'] = 'public, no-cache';
        // }
        return headers;
    }

    async request<T = any>(requestParams: Partial<HttpRequestOptions>, retry = 0) {
        if (!this.connected) {
            throw new NoNetworkError();
        }
        if (requestParams.apiPath) {
            requestParams.url = this.apiUrl + requestParams.apiPath;
        }
        if (!requestParams.method) {
            requestParams.method = 'GET';
        }
        requestParams.headers = await this.getRequestHeaders(requestParams as HttpRequestOptions);
        if (requestParams.queryParams) {
            requestParams.url = queryString(requestParams.queryParams, requestParams.url);
            delete requestParams.queryParams;
        }
        requestParams.method = requestParams.method || 'GET';
        if (!requestParams.hasOwnProperty('timeout')) {
            requestParams.timeout = 30;
        }
        const requestStartTime = Date.now();
        DEV_LOG && console.log('request ', JSON.stringify(requestParams));

        // log for VSCode http plugin
        // requestParams.headers && Object.keys(requestParams.headers).forEach(k => console.log(k + ':', requestParams.headers[k]));
        // console.log(requestParams.body);
        try {
            const response = await https.request<T>(requestParams as HttpRequestOptions);
            return this.handleRequestResponse(response, requestParams as HttpRequestOptions, requestStartTime, retry) as Promise<T>;
        } catch (err) {
            console.error('request error', err);
            if (/timeout|timed out/i.test(err.toString())) {
                throw new TimeoutError();
            } else {
                throw err;
            }
        }
    }

    async handleRequestResponse<T>(response: https.HttpsResponse<https.HttpsResponseLegacy<T>>, requestParams: HttpRequestOptions, requestStartTime, retry) {
        const statusCode = response.statusCode;
        let resultContent: T | { response: T; meta: { code: boolean } } | string;
        try {
            resultContent = await response.content.toJSONAsync();
        } catch (err) {
            console.error('error parsing json response', err);
        }
        if (resultContent === undefined) {
            resultContent = await response.content.toStringAsync();
        } else if (resultContent !== null && resultContent['response']) {
            resultContent = resultContent['response'];
        }
        const isString = typeof resultContent === 'string';
        DEV_LOG && console.log('handleRequestResponse response', requestParams.url, statusCode, response.reason, response.headers, isString, typeof resultContent, JSON.stringify(resultContent));
        if (Math.round(statusCode / 100) !== 2 || (!isString && resultContent?.['status'] === false) || !!resultContent?.['error']) {
            let jsonReturn: T & {
                status: boolean;
                message?: string;
                result?: string;
                error?: { code: number; message: string; data: { message: string; errors?: { error: string }[] } } | string;
                details?: string;
                detail?: {
                    msg?: string;
                }[];
                errors?: {
                    [k: string]: string;
                };
                // violations?: {
                //     [k: string]: string;
                //     message: string;
                // }[];
                // code: string;
                // hint: string;
                // message: string;
            };
            if (!isString) {
                jsonReturn = resultContent as any;
            } else {
                const responseStr = resultContent as string;
                try {
                    jsonReturn = JSON.parse(responseStr);
                } catch (err) {
                    // error result might html
                    const match = /<title>(.*)\n*<\/title>/.exec(responseStr);
                    return Promise.reject(
                        new HTTPError({
                            statusCode,
                            responseHeaders: response.headers,
                            message: match ? match[1] : 'HTTP error',
                            requestParams
                        })
                    );
                }
            }
            // if (jsonReturn) {
            if (Array.isArray(jsonReturn)) {
                jsonReturn = jsonReturn[0];
            }
            let message;
            // const errors = jsonReturn.details || jsonReturn.errors || jsonReturn.violations;
            if (jsonReturn?.errors) {
                message = Object.values(jsonReturn.errors)[0][0];
            } else if (jsonReturn?.error) {
                if (typeof jsonReturn.error === 'object') {
                    if (jsonReturn.error.data?.errors) {
                        message = jsonReturn.error.data.errors[0].error;
                    } else {
                        message = jsonReturn.error.data?.message || jsonReturn.error.message;
                    }
                } else {
                    message = jsonReturn.error;
                }
            }
            if (!message) {
                message = jsonReturn?.message || jsonReturn?.details || jsonReturn?.detail?.[0]?.msg || response.reason;
            }
            if (!message && statusCode === 400) {
                message = $tc('invalid_grand');
            }
            // token expired handle
            DEV_LOG && console.log('throwing http error ', statusCode, requestParams.url, message, jsonReturn);
            if (
                statusCode === 401
                // &&  (jsonReturn.code === 'expired_token' || (jsonReturn.hint && (jsonReturn.hint.indexOf('revoked') !== -1 || jsonReturn.hint.indexOf('expired') !== -1)))
            ) {
                return this.handleRequestRetry(requestParams, retry);
            }
            throw new HTTPError({
                statusCode,
                responseHeaders: response.headers,
                title: requestParams.body?.method ? requestParams.body?.method : $tc('error'),
                message: message ? message : $tc('error'),
                requestParams
            });
            // } else {
            //     DEV_LOG && console.log('throwing http error ', statusCode, requestParams.url);
            //     throw new HTTPError({
            //         statusCode,
            //         responseHeaders: response.headers,
            //         title: $tc('error'),
            //         message: response.reason,
            //         requestParams
            //     });
            // }
        }
        if (resultContent === null) {
            return resultContent;
        }
        if (!isString) {
            return resultContent;
        }
        try {
            // we should never go there anymore
            return JSON.parse(resultContent as string);
        } catch (e) {
            console.error('failed to parse result to JSON', e);
            return undefined;
        }
    }
}
