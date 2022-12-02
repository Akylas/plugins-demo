import { GeoHandler } from '~/handlers/GeoHandler';
import { Observable } from '@nativescript/core/data/observable';
import { ApplicationEventData, off as applicationOff, on as applicationOn, exitEvent, launchEvent } from '@nativescript/core/application';
import { BluetoothHandler } from '~/handlers/BluetoothHandler';
import ScenarioHandler from '~/handlers/ScenarioHandler';

export const BgServiceLoadedEvent = 'BgServiceLoadedEvent';
export const BgServiceStartedEvent = 'BgServiceStartedEvent';
export const BgServiceErrorEvent = 'BgServiceErrorEvent';

const TAG = '[BgServiceCommon]';

let INSTANCE_ID = 0;

export abstract class BgServiceCommon extends Observable {
    // abstract get geoHandler(): GeoHandler;
    abstract get bluetoothHandler(): BluetoothHandler;
    abstract get scenarioHandler(): ScenarioHandler;
    protected _loaded = false;
    protected _started = false;
    id: number;
    constructor() {
        super();
        this.id = INSTANCE_ID++;
        applicationOn(exitEvent, this.onAppExit, this);
        applicationOn(launchEvent, this.onAppLaunch, this);
    }
    get loaded() {
        return this._loaded;
    }
    get started() {
        return this._started;
    }
    protected _handlerLoaded() {
        // this.geoHandler.bluetoothHandler = this.bluetoothHandler;
        // this.bluetoothHandler.geoHandler = this.geoHandler;
        if (!this._loaded) {
            this._loaded = true;
            this.notify({
                eventName: BgServiceLoadedEvent,
                object: this
            });
        }
    }

    async stop() {
        this._started = false;
        DEV_LOG && console.log(TAG, 'stop');
        await Promise.all([/* this.geoHandler.stop(),  */ this.bluetoothHandler.stop(), this.scenarioHandler.stop()]);
        DEV_LOG && console.log(TAG, 'stopped');
    }
    async start() {
        DEV_LOG && console.log(TAG, 'start');
        await Promise.all([/* this.geoHandler.start(), */ this.bluetoothHandler.start(), this.scenarioHandler.start()]);
        this._started = true;
        DEV_LOG && console.log(TAG, 'started');
        this.notify({
            eventName: BgServiceStartedEvent,
            object: this
        });
    }
    async onAppLaunch(args: ApplicationEventData) {
        DEV_LOG && console.log(TAG, 'onAppLaunch');
        try {
            this.start();
        } catch (error) {
            console.error('error starting BGService', error);
            this.notify({
                eventName: BgServiceErrorEvent,
                object: this,
                error
            });
        }
    }
    async onAppExit(args: ApplicationEventData) {
        try {
            this.stop();
        } catch (error) {
            this.notify({
                eventName: BgServiceErrorEvent,
                object: this,
                error
            });
        }
    }
}
