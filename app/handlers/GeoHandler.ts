import { backgroundEvent, foregroundEvent } from '@akylas/nativescript/application';
import { GPS, GenericGeoLocation, Options as GeolocationOptions, Options, setGeoLocationKeys, setMockEnabled } from '@nativescript-community/gps';
import * as perms from '@nativescript-community/perms';
import { alert, confirm } from '@nativescript-community/ui-material-dialogs';
import { Device } from '@nativescript/core';
import { AndroidActivityResultEventData, AndroidApplication, ApplicationEventData, android as androidApp, off as applicationOff, on as applicationOn } from '@nativescript/core/application';
import * as appSettings from '@nativescript/core/application-settings';
import { EventData } from '@nativescript/core/data/observable';
import { CoreTypes } from '@nativescript/core/ui/enums/enums';
import { bind, throttle } from 'helpful-decorators';
import { $t, $tc } from '~/helpers/locale';
import { BgServiceCommon } from '~/services/BgService.common';
import { permResultCheck } from '~/utils';
import { StatusChangedEvent } from './BluetoothHandler';
import { Handler } from './Handler';

setGeoLocationKeys('lat', 'lon', 'altitude');
setMockEnabled(!PRODUCTION);
const sdkInt = parseInt(Device.sdkVersion, 10);

export type GeoLocation = GenericGeoLocation<LatLonKeys> & {
    computedBearing?: number;
};

let geolocation: GPS;

//@ts-ignore
export const desiredAccuracy = __ANDROID__ ? CoreTypes.Accuracy.high : kCLLocationAccuracyBestForNavigation;
export const timeout = 20000;
export const minimumUpdateTime = 5000; // Should update every 1 second according ;

export enum SessionState {
    STOPPED = 'stopped',
    RUNNING = 'running',
    PAUSED = 'paused'
}

export function getDistance(loc1, loc2) {
    return Math.round(geolocation.distance(loc1, loc2) * 1000) / 1000;
}

export const SessionStateEvent = 'sessionState';
export const SessionUpdatedEvent = 'sessionUpdated';
export const SessionChronoEvent = 'sessionChrono';
export const SessionFirstPositionEvent = 'sessionFirstPosition';
export { StatusChangedEvent };
export const UserLocationEvent = 'userLocation';
export const UserRawLocationEvent = 'userRawLocation';

const TAG = '[Geo]';

interface GPSEvent extends EventData {
    data?: any;
}

export interface SessionEventData extends GPSEvent {}

export interface UserLocationdEventData extends GPSEvent {
    location?: GeoLocation;
    error?: Error;
}

export interface SessionChronoEventData extends GPSEvent {
    data: number; // chrono
}
export interface RunningSession {
    id: number;
    startTime: Date;
    endTime?: Date;
    lastLoc?: GeoLocation;
    sensors: { [k: string]: { value: number; timestamp: number; maxTimeDiff: number; UUID: string } };
    state: SessionState;
    positions: GeoLocation[];
}
export class MockGeoHandler extends Handler {
    currentSession: RunningSession;
    sessionState: SessionState = SessionState.STOPPED;
    lastLocation?: GeoLocation;
    _devMode = false;
    get devMode() {
        return this._devMode;
    }
    set devMode(value: boolean) {
        this._devMode = value;
    }

    isSessionRunning() {
        return !!this.currentSession && this.sessionState !== SessionState.STOPPED;
    }
    getCurrentSession() {
        return this.currentSession;
    }

    isSessionPaused() {
        return this.currentSession && this.sessionState === SessionState.PAUSED;
    }

    async onLocation(loc: GeoLocation, manager?: any) {
        const currentSession = this.currentSession;

        this.lastLocation = loc;
        this.notify({
            eventName: UserRawLocationEvent,
            object: this,
            location: loc
        } as UserLocationdEventData);

        DEV_LOG && console.log(TAG, 'onLocation', JSON.stringify(loc));

        if (!currentSession) {
            return;
        }
        // currentSession.logGpsEntry(loc);
        this.notify({
            eventName: SessionUpdatedEvent,
            object: this,
            data: this.currentSession
        } as SessionEventData);

        return true;
    }

    setSessionState(state: SessionState) {
        this.sessionState = state;
        this.notify({
            eventName: SessionStateEvent,
            object: this,
            data: this.currentSession
        } as SessionEventData);
    }
    actualSessionStart(createSession = false) {
        console.log('actualSessionStart', this.sessionState);
        this.setSessionState(SessionState.RUNNING);
    }
    actualSessionStop(finish = false) {
        this.setSessionState(finish ? SessionState.STOPPED : SessionState.PAUSED);
    }

    // getSavedSession() {
    //     DEV_LOG && console.log('getSavedSession');
    //     if (ApplicationSettings.hasKey('currentSession')) {
    //         const currentSession = JSON.parse(ApplicationSettings.getString('currentSession')) as SavedSession;
    //         ApplicationSettings.remove('currentSession');
    //         const sessionMaxAge = 2 * 60 * 60 * 1000;
    //         const now = Date.now();
    //         DEV_LOG &&
    //             console.log(
    //                 'getSavedSession',
    //                 'currentSession',
    //                 now,
    //                 currentSession.savedTime && now - currentSession.savedTime > sessionMaxAge,
    //                 currentSession.startTime && now - currentSession.startTime > sessionMaxAge,
    //                 currentSession
    //             );
    //         if (currentSession && !(currentSession.savedTime && now - currentSession.savedTime > sessionMaxAge) && !(currentSession.startTime && now - currentSession.startTime > sessionMaxAge)) {
    //             return currentSession;
    //         }
    //     }
    // }

    @bind
    @throttle(1000)
    onSensor(data, sensor: string) {
        // if (sensor === 'barometer') {
        //     this.lastPressure = data.pressure;
        //     this.lastPressureTimestamp = data.timestamp;
        // }
    }
}

export class GeoHandler extends MockGeoHandler {
    currentWatcher: Function;
    watchId;
    _isIOSBackgroundMode = false;
    _deferringUpdates = false;
    gpsEnabled = true;

    launched = false;
    backgrounded: boolean = false;
    constructor(service: BgServiceCommon) {
        super(service);
        DEV_LOG && console.log(TAG, 'creating GPS Handler', !!geolocation, DEV_LOG);
        if (!geolocation) {
            geolocation = new GPS();
        }
        DEV_LOG && console.log(TAG, 'created GPS Handler', !!geolocation, DEV_LOG);
    }

    isSessionPaused() {
        return this.sessionState === SessionState.PAUSED;
    }

    async checkIfEnabled() {
        if (!this.gpsEnabled) {
            const r = await confirm({
                title: $tc('gps_off'),
                okButtonText: $tc('settings'),
                cancelButtonText: $tc('close')
            });
            if (__ANDROID__ && r) {
                await this.openGPSSettings();
            }
        }
    }

    setSessionState(state: SessionState) {
        if (this.sessionState === state) {
            return;
        }
        this.sessionState = state;
        this.notify({
            eventName: SessionStateEvent,
            object: this,
            data: {
                state
            }
        } as SessionEventData);
    }
    async actualSessionStart(createSession = false) {
        appSettings.remove('currentSession');
        super.actualSessionStart(createSession);
        // const usedLayouts = this.bluetoothHandler.usedLayouts;
        // if (this.hasBarometer && (usedLayouts.indexOf(Layouts.pressure) || usedLayouts.indexOf(Layouts.elevation))) {
        //     await this.startBarometer();
        // }
        this.startWatch();
        // this.startChronoTimer();
        const lastLoc = this.getLastKnownLocation();
        if (lastLoc) {
            await this.onLocation(lastLoc);
        }
        return this.currentSession;
    }
    async askForSystemOverlayPermission() {
        if (__ANDROID__) {
            const activity = androidApp.startActivity as androidx.appcompat.app.AppCompatActivity;
            if (sdkInt < 23 || android.provider.Settings.canDrawOverlays(activity)) {
                return true;
            }
            //If the draw over permission is not available open the settings screen
            //to grant the permission.
            return new Promise<boolean>((resolve, reject) => {
                const REQUEST_CODE = 6646;
                const onActivityResultHandler = (data: AndroidActivityResultEventData) => {
                    if (data.requestCode === REQUEST_CODE) {
                        androidApp.off(AndroidApplication.activityResultEvent, onActivityResultHandler);
                        resolve(android.provider.Settings.canDrawOverlays(activity));
                    }
                };
                androidApp.on(AndroidApplication.activityResultEvent, onActivityResultHandler);
                const intent = new android.content.Intent(android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION, android.net.Uri.parse('package:' + __APP_ID__));
                activity.startActivityForResult(intent, REQUEST_CODE);
            });
        }
        return false;
    }
    async actualSessionStop(finish = false) {
        super.actualSessionStop(finish);
        this.stopWatch();
        // if (finish) {
        //     this.stopChronoTimer();
        // }
    }
    // getCurrentSessionChrono() {
    //     if (this.currentSession) {
    //         if (this.sessionState === SessionState.PAUSED) {
    //             return this.currentSession.lastPauseTime - this.currentSession.startTime;
    //         }
    //         return Date.now() - this.currentSession.startTime;
    //     }
    //     return 0;
    // }
    // onUpdateSessionChrono() {
    //     this.notify({
    //         eventName: SessionChronoEvent,
    //         object: this,
    //         data: this.getCurrentSessionChrono()
    //     } as SessionChronoEventData);
    // }
    // private sessionChronoTimer;
    // public startChronoTimer() {
    //     if (!this.sessionChronoTimer) {
    //         this.sessionChronoTimer = setInterval(() => {
    //             this.onUpdateSessionChrono();
    //         }, 60000);
    //         this.onUpdateSessionChrono();
    //     }
    // }
    // public stopChronoTimer() {
    //     if (this.sessionChronoTimer) {
    //         clearInterval(this.sessionChronoTimer);
    //         this.sessionChronoTimer = null;
    //     }
    // }

    async start() {
        DEV_LOG && console.log(TAG, 'start');

        this.launched = true;
        geolocation.on(GPS.gps_status_event, this.onGPSStateChange, this);

        const gpsEnabled = await this.checkLocationPerm();
        // set to true if not allowed yet for the UI
        this.gpsEnabled = !gpsEnabled || geolocation.isEnabled();
        applicationOn(backgroundEvent, this.onAppPause, this);
        applicationOn(foregroundEvent, this.onAppResume, this);
    }
    onNoRR() {
        // if (this.sessionState === SessionState.RUNNING) {
        // this.pauseSession();
        // }
    }
    async stop() {
        this.stopSession();
        this.launched = false;
        geolocation.off(GPS.gps_status_event, this.onGPSStateChange, this);
        applicationOff(backgroundEvent, this.onAppPause, this);
        applicationOff(foregroundEvent, this.onAppResume, this);
    }

    onAppResume(args: ApplicationEventData) {
        this.backgrounded = false;
        // DEV_LOG && console.log('onAppResume');
        if (args.ios) {
            this._isIOSBackgroundMode = false;
            // For iOS applications, args.ios is UIApplication.
            // if (DEV_LOG) {
            //     console.log(TAG,'UIApplication: foregroundEvent', this.isWatching());
            // }
            // if (this.isWatching()) {
            //     const watcher = this.currentWatcher;
            //     this.stopWatch();
            //     this.startWatch(watcher);
            // }
        }
    }
    onAppPause(args: ApplicationEventData) {
        this.backgrounded = true;
        // DEV_LOG && console.log('onAppPause');
        if (args.ios) {
            this._isIOSBackgroundMode = true;
            // For iOS applications, args.ios is UIApplication.
            // if (DEV_LOG) {
            //     console.log(TAG,'UIApplication: backgroundEvent', this.isWatching());
            // }
            // if (this.isWatching()) {
            //     const watcher = this.currentWatcher;
            //     this.stopWatch();
            //     this.startWatch(watcher);
            // }
        }
    }

    onGPSStateChange(e: GPSEvent) {
        const enabled = (this.gpsEnabled = e.data.enabled);
        DEV_LOG && console.log(TAG, 'GPS state change', enabled);
        if (!enabled) {
            this.stopSession();
        }
        // if (this.currentSession) {
        //     this.currentSession.onGPSStateChange(enabled);
        // }
        this.notify({
            eventName: StatusChangedEvent,
            object: this,
            data: enabled
        });
    }

    askToEnableIfNotEnabled() {
        if (geolocation.isEnabled()) {
            return Promise.resolve(true);
        } else {
            // return confirm({
            //     message: $tc('gps_not_enabled'),
            //     okButtonText: $t('settings'),
            //     cancelButtonText: $t('cancel')
            // }).then((result) => {
            //     if (!!result) {
            //         return geolocation.openGPSSettings();
            //     }
            return Promise.reject();
            // });
        }
    }
    async checkLocationPerm(always = false) {
        const r = await perms.check('location', { type: always ? 'always' : undefined });
        return permResultCheck(r);
    }
    async authorizeLocation(always = false) {
        const r = await perms.request('location', { type: always ? 'always' : undefined });
        if (!permResultCheck(r)) {
            throw new Error('gps_denied');
        }
        this.gpsEnabled = geolocation.isEnabled();
        return r;
    }

    async checkAndAuthorize(always = false) {
        const r = await this.checkLocationPerm();
        if (!r) {
            return this.authorizeLocation(always);
        }
    }
    async openGPSSettings() {
        return geolocation.openGPSSettings();
    }
    async checkEnabledAndAuthorized(always = false) {
        try {
            await this.checkAndAuthorize(always);
            return this.askToEnableIfNotEnabled();
        } catch (err) {
            if (err && /denied/i.test(err.message)) {
                alert({
                    title: $tc('permissionRequestTitle'),
                    message: $tc('permissionRequest'),
                    okButtonText: $t('OKButton')
                }).then(() => {
                    perms.openSettings().catch((err) => {
                        console.error(err);
                    });
                });
                return Promise.reject();
            } else {
                return Promise.reject(err);
            }
        }
    }

    enableLocation() {
        return this.checkAndAuthorize();
    }

    isBatteryOptimized(context: android.content.Context) {
        const pwrm = context.getSystemService(android.content.Context.POWER_SERVICE) as android.os.PowerManager;
        const name = context.getPackageName();
        if (sdkInt >= 23) {
            return !pwrm.isIgnoringBatteryOptimizations(name);
        }
        return false;
    }
    async checkBattery() {
        if (__ANDROID__) {
            const activity = androidApp.foregroundActivity || androidApp.startActivity;
            if (this.isBatteryOptimized(activity) && sdkInt >= 22) {
                return new Promise<void>((resolve, reject) => {
                    const REQUEST_CODE = 6645;
                    const onActivityResultHandler = (data: AndroidActivityResultEventData) => {
                        if (data.requestCode === REQUEST_CODE) {
                            androidApp.off(AndroidApplication.activityResultEvent, onActivityResultHandler);
                            resolve();
                            // wait a bit for the setting to actually be updated
                            // setTimeout(() => {
                            //     if (!this.isBatteryOptimized(activity)) {
                            //         showSnack({ message: $tc('battery_not_optimized') });
                            //     }
                            // }, 1000);
                        }
                    };
                    androidApp.on(AndroidApplication.activityResultEvent, onActivityResultHandler);
                    const intent = new android.content.Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(android.net.Uri.parse('package:' + activity.getPackageName()));
                    activity.startActivityForResult(intent, REQUEST_CODE);
                });
            }
        }
    }
    getLastKnownLocation(): GeoLocation {
        return geolocation.getLastKnownLocation<LatLonKeys>();
    }
    getCurrentLocation(options?: Options) {
        return geolocation
            .getCurrentLocation<LatLonKeys>(options || { desiredAccuracy, timeout, onDeferred: this.onDeferred, skipPermissionCheck: true })
            .then((r) => {
                DEV_LOG && console.log(TAG, 'getLocation', r);
                if (r) {
                    this.notify({
                        eventName: UserRawLocationEvent,
                        object: this,
                        location: r
                    } as UserLocationdEventData);
                }

                return r;
            })
            .catch((err) => {
                this.notify({
                    eventName: UserRawLocationEvent,
                    object: this,
                    error: err
                } as UserLocationdEventData);
                return Promise.reject(err);
            });
    }

    @bind
    onDeferred() {
        this._deferringUpdates = false;
    }

    @bind
    async onLocation(loc: GeoLocation, manager?: any) {
        const result = await super.onLocation(loc, manager);
        this.currentWatcher && this.currentWatcher(null, loc);
        if (manager && this._isIOSBackgroundMode && !this._deferringUpdates) {
            this._deferringUpdates = true;
            manager.allowDeferredLocationUpdatesUntilTraveledTimeout(0, 10);
        }
        return result;
    }
    @bind
    onLocationError(err: Error) {
        DEV_LOG && console.log(TAG, ' location error: ', err);
        this.notify({
            eventName: UserRawLocationEvent,
            object: this,
            error: err
        } as UserLocationdEventData);
        this.currentWatcher && this.currentWatcher(err);
    }
    async startWatch(onLoc?: Function) {
        await this.checkIfEnabled();
        if (!this.gpsEnabled) {
            return Promise.reject(undefined);
        }
        this.currentWatcher = onLoc;
        const options: GeolocationOptions = { minimumUpdateTime, desiredAccuracy, onDeferred: this.onDeferred, nmeaAltitude: true, skipPermissionCheck: true };
        if (__IOS__) {
            geolocation.iosChangeLocManager.showsBackgroundLocationIndicator = true;
            options.pausesLocationUpdatesAutomatically = false;
            options.allowsBackgroundLocationUpdates = true;
            //@ts-ignore
            options.activityType = CLActivityType.Other;
            // }
        } else {
            options.provider = 'gps';
        }
        DEV_LOG && console.log(TAG, 'startWatch', options);
        this.watchId = await geolocation.watchLocation<LatLonKeys>(this.onLocation, this.onLocationError, options);
    }

    stopWatch() {
        DEV_LOG && console.log(TAG, 'stopWatch', this.watchId);
        if (this.watchId) {
            geolocation.clearWatch(this.watchId);
            this.watchId = null;
            this.currentWatcher = null;
        }
    }

    isWatching() {
        return !!this.watchId;
    }

    async stopSession() {
        DEV_LOG && console.log(TAG, 'stopSession', !!this.currentSession);

        if (this.currentSession) {
            const session = this.currentSession;
            this.currentSession = null;

            this.actualSessionStop(true);
            let result;
            // try {
            //     result = await session.stop();
            // } catch (err) {
            //     console.error(TAG, 'failed to stop realTime session', err);
            // }
            appSettings.remove('currentSession');

            // Dont clear the lastRealTimeEvent or we break floating button
            // this.lastRealTimeEvent = null;
            return result;
            // const resultSession = session.toJSON(Date.now(), vote);
            // const jsonValue = JSON.parse(ApplicationSettings.getString('@itineraries', '[]'));
            // jsonValue.push(resultSession);
            //we save the sessions until uploaded
            // ApplicationSettings.setString('@itineraries', JSON.stringify(jsonValue));
            // return resultSession;
        }
    }
    async pauseSession() {
        DEV_LOG && console.log(TAG, 'pauseSession', !!this.currentSession);
        if (this.currentSession && this.sessionState !== SessionState.PAUSED) {
            // this.currentSession.lastPauseTime = Date.now();
            await this.actualSessionStop();
        }
    }
    async askForSessionPerms() {
        await this.enableLocation();
        await this.checkBattery();
        await this.askForSystemOverlayPermission();
    }

    showProgressTimeout = null;

    async askAndStartSession() {
        await this.askForSessionPerms();
        await this.checkIfEnabled();
        if (!this.gpsEnabled) {
            return Promise.reject(undefined);
        }
        return this.startSession();
    }
    async startSession() {
        // await this.bluetoothHandler.setHRDevice(peripheral);
        return this.actualSessionStart();
    }

    async resumeSession() {
        if (this.sessionState === SessionState.PAUSED) {
            await this.enableLocation();
            this.actualSessionStart();
        }
    }
}
