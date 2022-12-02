import { android as androidApp } from '@nativescript/core/application';
import { Device, EventData, View } from '@nativescript/core';
import Vue from 'nativescript-vue';
import Floating from '~/components/Floating.vue';
import FloatingProgress from '~/components/FloatingProgress.vue';
import { BluetoothHandler } from '~/handlers/BluetoothHandler';
import ScenarioHandler from '~/handlers/ScenarioHandler';
import { GeoHandler, SessionChronoEventData, SessionEventData, SessionState, SessionStateEvent } from '~/handlers/GeoHandler';
import { $tc } from '~/helpers/locale';
import { BgServiceBinder } from '~/services/android/BgServiceBinder';
import { ACTION_PAUSE, ACTION_RESUME, NOTIFICATION_CHANEL_ID_RECORDING_CHANNEL, NotificationHelper } from './NotifcationHelper';
import { ScenarioState } from '~/handlers/scenario/Scenario';
import { BgServiceCommon } from '../BgService.common';

const NOTIFICATION_ID = 3421824;

const sdkInt = parseInt(Device.sdkVersion, 10);

const TAG = '[BgServiceAndroid]';
let BGServiceId = 0;

@NativeClass
@JavaProxy('com.tdk.cdc.BgService')
export class BgService extends android.app.Service {
    currentNotifText: string;
    // geoHandler: GeoHandler;
    bluetoothHandler: BluetoothHandler;
    scenarioHandler: ScenarioHandler;
    bounded: boolean;
    inBackground: any;
    mNotificationBuilder: androidx.core.app.NotificationCompat.Builder;
    mNotification: globalAndroid.app.Notification;
    notificationManager: android.app.NotificationManager;
    recording: boolean;
    id: number;

    onStartCommand(intent: android.content.Intent, flags: number, startId: number) {
        this.onStartCommand(intent, flags, startId);
        const action = intent ? intent.getAction() : null;
        // if (action === ACTION_RESUME) {
        //     this.geoHandler.resumeSession();
        // } else if (action === ACTION_PAUSE) {
        //     this.geoHandler.pauseSession();
        // }
        return android.app.Service.START_STICKY;
    }
    onCreate() {
        this.id = BGServiceId++;
        DEV_LOG && console.log(TAG, 'onCreate', this.id);
        this.currentNotifText = $tc('tap_to_open');
        this.recording = false;
        this.inBackground = false;
        this.bounded = false;
        this.notificationManager = this.getSystemService(android.content.Context.NOTIFICATION_SERVICE);
        NotificationHelper.createNotificationChannel(this);
    }
    onDestroy() {
        DEV_LOG && console.log(TAG, 'onDestroy');
        // this.bluetoothHandler.off(HRDeviceDisconnectedEvent, this.onHRDeviceDisconnected, this);
        if (this.scenarioHandler) {
            this.scenarioHandler.off('state', this.onScenarioStateEvent, this);
        }
        // this.geoHandler = null;
        this.scenarioHandler = null;
        this.bluetoothHandler = null;
    }

    onBind(intent: android.content.Intent) {
        // a client is binding to the service with bindService()
        DEV_LOG && console.log(TAG, 'onBind');
        this.bounded = true;
        const result = new BgServiceBinder();
        result.setService(this);
        return result;
    }
    onUnbind(intent: android.content.Intent) {
        DEV_LOG && console.log(TAG, 'onUnbind');
        this.bounded = false;
        this.removeForeground();
        return true;
    }
    onRebind(intent: android.content.Intent) {
        // a client is binding to the service with bindService(), after onUnbind() has already been called
    }

    onBounded(commonService: BgServiceCommon) {
        try {
            // this.geoHandler = new GeoHandler();
            this.bluetoothHandler = new BluetoothHandler(commonService);
            this.scenarioHandler = new ScenarioHandler(commonService);
            DEV_LOG && console.log(TAG, 'onBounded', !!this.bluetoothHandler, !!this.scenarioHandler);
            this.showForeground();
            this.scenarioHandler.on('state', this.onScenarioStateEvent, this);
        } catch (error) {
            console.error('onBounded', error);
        }
    }

    displayNotification(sessionRunning) {
        this.mNotificationBuilder = new androidx.core.app.NotificationCompat.Builder(this, NOTIFICATION_CHANEL_ID_RECORDING_CHANNEL);

        this.mNotification = NotificationHelper.getNotification(this, this.mNotificationBuilder);
        this.notificationManager.notify(NOTIFICATION_ID, this.mNotification); // todo check if necessary in pre Android O
    }
    onScenarioStateEvent(e: EventData & { state: ScenarioState }) {
        switch (e.state) {
            case ScenarioState.RUNNING:
                this.recording = true;
                this.showForeground();
                break;
            case ScenarioState.STOPPED:
                this.recording = false;
                this.removeForeground();
                break;
        }
    }
    showForeground() {
        if (!this.bounded) {
            return;
        }
        if (this.recording) {
            try {
                if (!this.mNotification) {
                    this.displayNotification(this.recording);
                }
                DEV_LOG && console.log('showForeground');
                if (sdkInt >= 29) {
                    this.startForeground(NOTIFICATION_ID, this.mNotification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE);
                } else {
                    this.startForeground(NOTIFICATION_ID, this.mNotification);
                }
            } catch (err) {
                console.error('showForeground', err, err.stack);
            }
        }
    }

    removeForeground() {
        try {
            DEV_LOG && console.log('removeForeground', this.recording);
            if (!this.recording) {
                DEV_LOG && console.log('hiding notification', NOTIFICATION_ID);
                this.stopForeground(true);
                this.notificationManager.cancel(NOTIFICATION_ID);
                this.mNotification = null;
            }
        } catch (err) {
            console.error('removeForeground', err);
        }
    }

    // onHRDeviceDisconnected() {
    //     this.removeForeground();
    // }
    // onHRDeviceConnected() {
    //     this.showForeground();
    // }
}
