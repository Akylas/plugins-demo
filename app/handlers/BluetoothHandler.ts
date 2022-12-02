import { AdvertismentData, Bluetooth, ConnectOptions, Peripheral as IPeripheral, StartScanningOptions as IStartScanningOptions, StartNotifyingOptions } from '@nativescript-community/ble';
import { isSimulator } from '@nativescript-community/extendedinfo';
import { request } from '@nativescript-community/perms';
import { alert, confirm } from '@nativescript-community/ui-material-dialogs';
import { EventData } from '@nativescript/core/data/observable';
import { $t, $tc } from '~/helpers/locale';
import { BgServiceCommon } from '~/services/BgService.common';
import { MessageError } from '~/services/CrashReportService';
import { permResultCheck } from '~/utils';
import HRDevice from './bluetooth/HRDevice';
import { Handler } from './Handler';

export const BATTERY_UUID = '180f';
export const SERIAL_UUID = '180a';
export const BATTERY_DESC_UUID = '2a19';
export const SERIA_DESC_UUID = '2a25';

export const DEFAULT_MTU = 20;
export const DEFAULT_WRITE_TIMEOUT = 50;

export const FinishSendingEvent = 'finishSending';
export const StatusChangedEvent = 'status';
export const HRDeviceConnectedEvent = 'hrDeviceConnected';
export const BLEConnectedEvent = 'connected';
export const HRDeviceDisconnectedEvent = 'hrDeviceDisconnected';
export const HRDeviceReconnectingEvent = 'HRDeviceReconnecting';
export const HRDeviceReconnectingFailedEvent = 'HRDeviceReconnectingFailed';
export const BLEDisconnectedEvent = 'disconnected';
export const HRDeviceBatteryEvent = 'hrDeviceBattery';
export const VersionEvent = 'version';
export const SerialEvent = 'serial';
export const DevLogMessageEvent = 'devlogmessage';

export const HR_SERVICE_UUID = '180d';

export enum Manufacturers {
    Decathlon = 0x0b18,
    ' ' = -1, // broken Decathlon
    Garmin = 0x0087,
    Scosche = 0x0791,
    Polar = 0x6b
}
export const ALLOWED_MANUFACTURER_IDS = Object.values(Manufacturers);

export function isGarminPeripheral(peripheral: Partial<Peripheral>) {
    return peripheral.advertismentData.manufacturerId === Manufacturers.Garmin;
}

export function timeout(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export function hexToBytes(hex) {
    const bytes = [];
    for (let c = 0; c < hex.length; c += 2) bytes.push(parseInt(hex.substr(c, 2), 16));
    return bytes;
}

export interface Peripheral extends IPeripheral {
    distance?: number;
    txPowerLevel?: number;
    manufacturer?: string;
    serialNumber?: string;
    advertismentData?: AdvertismentData;
    localName?: string;
    connectionId?: string;
    deviceId?: string;
    type?: string;
    connecting?: boolean;
}

export let bluetooth: Bluetooth;

export interface StartScanningOptions extends IStartScanningOptions {
    hrDevice?: boolean;
}

export interface BLEEventData extends EventData {
    data: any;
}
export interface BLEBatteryEventData extends BLEEventData {
    data: number;
}

export interface BLEConnectionEventData extends BLEEventData {
    data: Peripheral;
    manualDisconnect?: boolean;
}
export interface BLEStatusEventData extends BLEEventData {
    data: { state: 'on' | 'off' | 'unsupported' };
}

export interface HRDeviceConnectionEventData extends BLEEventData {
    data: HRDevice;
    manualDisconnect?: boolean;
}

export interface ProgressListener {
    total: number;
    current: number;
    onProgress(err: Error, progress: number, total: number);
}

export type ProgressCallback = (error: Error, progress: number, total: number) => void;

interface BluetoothEvent extends EventData {
    data: any;
}
interface BluetoothDeviceEvent extends BluetoothEvent {
    data: Peripheral;
}
const TAG = '[Bluetooth]';

export class BluetoothHandler extends Handler {
    // async setHRDevice(peripheral: Peripheral) {
    //     const manufacturerId = peripheral?.manufacturerId || peripheral?.advertismentData?.manufacturerId;
    //     this.hrDevice = peripheral ? new HRDevice(peripheral, this) : null;
    //     this.savedDeviceUUID = peripheral?.UUID;
    //     this.savedDeviceManufacturerId = manufacturerId;
    //     this.savedDeviceConnectionId = peripheral?.connectionId;
    //     DEV_LOG && console.log('setHRDevice', peripheral);
    //     if (this.hrDevice) {
    //         this.hrDevice.on('value', (event: any) => {
    //             // DEV_LOG && console.log('on hr value', event.data);
    //             const currentSession = this.geoHandler?.currentSession;
    //             const isPaused = this.geoHandler?.isSessionPaused();
    //             if (currentSession && !isPaused && event.data.rr?.length) {
    //                 event.data.rr.forEach((value) => {
    //                     // currentSession.logRawReadingEntry(event.data.timestamp, value);
    //                 });
    //             }
    //         });
    //         if (this.geoHandler?.isSessionRunning()) {
    //             await this.hrDevice.start();
    //         }
    //         this.notify({
    //             eventName: HRDeviceConnectedEvent,
    //             object: this,
    //             data: this.hrDevice
    //         } as BLEEventData);
    //     }
    // }
    savedDeviceUUID = null;
    savedDeviceManufacturerId = null;
    savedDeviceConnectionId = null;
    // reconnectingToHR = false;
    // hrDevice: HRDevice;
    // hrBattery = -1;
    connectingDevicesUUIDs: { [k: string]: Partial<ConnectOptions> } = {};
    manualDisconnect: { [k: string]: boolean } = {};
    _devMode = false;

    devLog: string[];

    get devMode() {
        return this._devMode;
    }
    set devMode(value: boolean) {
        this._devMode = value;
        if (this._devMode) {
            this.devLog = [];
        }
    }
    constructor(service: BgServiceCommon) {
        super(service);
        if (!bluetooth) {
            bluetooth = new Bluetooth('myCentralManagerIdentifier');
        }
        DEV_LOG && console.log(TAG, 'created BLE Handler');
    }
    async stop() {
        DEV_LOG && console.log(TAG, 'stop');
        this.started = false;
        // this.geoHandler.on(SessionStateEvent, this.onSessionStateEvent, this);
        this.stopScanning();
        // await this.disconnectHr(true);

        this.savedDeviceUUID = null;
        this.savedDeviceManufacturerId = null;
        this.savedDeviceConnectionId = null;

        bluetooth.off(Bluetooth.bluetooth_status_event, this.onBLEStatusChange, this);
        bluetooth.off(Bluetooth.device_connected_event, this.onDeviceConnected, this);
        bluetooth.off(Bluetooth.device_disconnected_event, this.onDeviceDisconnected, this);

        // we clear the bluetooth module on stop or it will be in a bad state on restart (not forced kill) on android.
        DEV_LOG && console.log(TAG, 'stopped BLE Handler');
        bluetooth = null;
        this._emit('stopped');
    }
    started = false;
    async start() {
        DEV_LOG && console.log(TAG, 'start');
        // this.geoHandler.on(SessionStateEvent, this.onSessionStateEvent, this);
        bluetooth.on(Bluetooth.bluetooth_status_event, this.onBLEStatusChange, this);
        bluetooth.on(Bluetooth.device_connected_event, this.onDeviceConnected, this);
        bluetooth.on(Bluetooth.device_disconnected_event, this.onDeviceDisconnected, this);

        this.bluetoothEnabled = await this.isEnabled();

        this.started = true;
        this._emit('started');
    }
    async waitForStarted() {
        if (this.started) {
            return;
        }
        return new Promise((resolve) => {
            this.once('started', resolve);
        });
    }
    bluetoothEnabled = true;
    onBLEStatusChange(e: BluetoothEvent) {
        const state = e.data.state;
        const newEnabled = state === 'on';
        DEV_LOG && console.log('onBLEStatusChange state=', state, 'savedDeviceUUID=', this.savedDeviceUUID);
        if (newEnabled !== state) {
            this.bluetoothEnabled = newEnabled;
            if (!newEnabled) {
                // say manual disconnect not to try and connect again
                this.cancelConnections();
                // if (this.hrDevice) {
                //     const hrDevice = this.hrDevice;
                //     this.disconnectHr(true);
                //     this.onDeviceDisconnected({ data: hrDevice } as any);
                // }
            } else {
                // if (this.savedDeviceUUID) {
                //     this.connectToSaved();
                // }
            }
            // if (this.geoHandler?.currentSession) {
            //     this.geoHandler?.currentSession.onBLEStatusChange(newEnabled);
            // }
            this.notify({
                eventName: StatusChangedEvent,
                object: this,
                data: newEnabled
            });
        }
    }
    // hasSavedHRDevice() {
    //     return !this.hrDevice && !!this.savedDeviceUUID;
    // }
    isConnectingToDeviceUUID(UUID: string) {
        return this.connectingDevicesUUIDs[UUID] !== undefined;
    }
    // get connectingToHRDevice() {
    //     return this.isConnectingToDeviceUUID(this.savedDeviceUUID);
    // }
    // connectToSavedHRDevice(): Promise<boolean> {
    //     let foundHRDevice = false;
    //     return new Promise((resolve, reject) => {
    //         this.startScanning({
    //             seconds: 10,
    //             onDiscovered: (data) => {
    //                 if (this.connectingToHRDevice || !data.advertismentData || !data.localName) {
    //                     return;
    //                 }
    //                 if (data.UUID === this.savedDeviceUUID && !this.isConnectingToDeviceUUID(data.UUID)) {
    //                     this.stopScanning();
    //                     this.connect(
    //                         { UUID: this.savedDeviceUUID },
    //                         {
    //                             serviceUUIDs: [HR_SERVICE_UUID, BATTERY_UUID, SERIAL_UUID]
    //                         }
    //                     )
    //                         .then(() => {
    //                             this.reconnectingToHR = false;

    //                             foundHRDevice = true;
    //                             resolve(foundHRDevice);
    //                         })
    //                         .catch(reject);
    //                 }
    //             }
    //         }).then(() => {
    //             // if (!foundHRDevice) {
    //             //     reject();
    //             // }
    //             if (!this.connectingToHRDevice) {
    //                 resolve(foundHRDevice);
    //             }
    //         });
    //     });
    // }

    cancelConnections() {
        DEV_LOG && console.log(TAG, 'cancelConnections');
        // if (this.connectingToHRDevice || this.reconnectingToHR) {
        //     this.stopScanning();
        // }
        // this.reconnectingToHR = false; // to stop reconnecting
        Object.keys(this.connectingDevicesUUIDs).forEach((k) => this.disconnect({ UUID: k }, true));
    }
    // async connectToSaved() {
    //     if (!this.connectingToHRDevice && !this.hrDevice && !!this.savedDeviceUUID) {
    //         DEV_LOG && console.log(TAG, 'connectToSaved', 'start', this.savedDeviceUUID);
    //         try {
    //             if (__ANDROID__) {
    //                 await this.geoHandler.enableLocation();
    //             }
    //             if (!this.hrDevice && !!this.savedDeviceUUID) {
    //                 const found = await this.connectToSavedHRDevice();
    //             }
    //             return this.connectingToHRDevice || !!this.hrDevice;
    //         } catch (err) {
    //             return Promise.reject(err);
    //         }
    //     } else {
    //         return this.connectingToHRDevice || !!this.hrDevice;
    //     }
    // }

    // stopClearScreenTimer;
    // private onSessionStateEvent(e: SessionEventData) {
    //     DEV_LOG && console.log('onSessionStateEvent', e.data.state, !!this.hrDevice);
    //     if (e.data.state === SessionState.STOPPED) {
    //         if (this.hrDevice) {
    //             this.hrDevice.stop();
    //             this.disconnectHr(true);
    //             this.savedDeviceUUID = null;
    //             this.savedDeviceManufacturerId = null;
    //         }
    //     } else if (e.data.state === SessionState.RUNNING) {
    //         if (this.hrDevice) {
    //             this.hrDevice.start();
    //         }
    //     }
    // }

    isEnabled() {
        if (isSimulator()) {
            return Promise.resolve(false);
        }
        return bluetooth.isBluetoothEnabled();
    }

    async enable() {
        if (isSimulator()) {
            // return Promise.resolve();
            throw new MessageError({ message: 'running in simulator' });
        }
        const enabled = await bluetooth.enable();
        if (!enabled) {
            if (__IOS__) {
                alert({
                    title: $tc('bluetooth_not_enabled'),
                    okButtonText: $t('ok')
                });
            } else {
                const result = await confirm({
                    message: $tc('bluetooth_not_enabled'),
                    okButtonText: $t('cancel'), // inversed buttons
                    cancelButtonText: $t('settings')
                });
                if (!result) {
                    await bluetooth.openBluetoothSettings();
                }
            }
        }
        return enabled;
    }

    async authorizeBluetoothScan() {
        if (__ANDROID__) {
            const r = await request(['bluetoothScan', 'bluetoothConnect']);
            if (!permResultCheck(r)) {
                throw new Error('gps_denied');
            }
            return r;
        }
    }
    async enableForScan() {
        let enabled = await this.isEnabled();
        if (!enabled) {
            const r = await confirm({
                cancelable: false,
                title: $tc('bluetooth_off'),
                message: $tc('please_turn_on_bluetooth'),
                okButtonText: __ANDROID__ ? $tc('activate') : $tc('close'),
                cancelButtonText: __ANDROID__ ? $tc('close') : undefined
            });
            if (__ANDROID__ && r) {
                try {
                    await this.enable();
                } catch (err) {}
                enabled = await this.isEnabled();
            }
        }
        // await this.geoHandler.checkIfEnabled();
        // if (!this.geoHandler.gpsEnabled || !enabled) {
        //     return Promise.reject(undefined);
        // }
        await this.authorizeBluetoothScan();
        // await this.geoHandler.checkEnabledAndAuthorized();
    }

    async onDeviceConnected<T>(e: { data: Peripheral } & T) {
        const data = e.data;
        DEV_LOG && console.log('onDeviceConnected (data, savedDeviceUUID)', data, this.savedDeviceUUID);
        // const options = this.connectingDevicesUUIDs[data.UUID];
        try {
            // const result = await bluetooth.discoverAll({ peripheralUUID: data.UUID });
            // we do the discovery ourself so copy it
            // data.services = result.services;
            // console.log(
            //     TAG,
            //     'onDeviceConnected',
            //     data,
            //     this.savedDeviceUUID
            //     // data.services.map((s) => s.UUID)
            // );
            if (data.UUID === this.savedDeviceUUID) {
                data.connectionId = this.savedDeviceConnectionId;
                if (this.savedDeviceManufacturerId === Manufacturers.Garmin) {
                    DEV_LOG && console.log('reconnecting to garmin device');
                }
                // this.setHRDevice(data);
            }
            // const index = data.services.findIndex((s) => s.UUID.toLowerCase() === SERVER_SERVICE_UUID);
            // if (index !== -1) {
            //     this.savedDeviceUUID = data.UUID;
            //     // if the session is paused it must have been an unwanted disconnection
            //     // dont change the user page

            //     const hrDevice = (this.hrDevice = new Device(data, this));

            //     this.savedHRDeviceName = this.hrDevice.localName;
            //     appSettings.setString('savedDeviceUUID', this.savedDeviceUUID);
            //     appSettings.setString('savedHRDeviceName', this.savedHRDeviceName);

            //     await this.requestMtu();
            //     await Characteristic.startNotifying(hrDevice.UUID, BATTERY_UUID, BATTERY_DESC_UUID, this.onBatteryReading.bind(this));
            //     await this.readFirmwareVersion();
            //     await this.readSerialNumber();
            //     await this.readBattery();
            // if (this.hrDevice) {
            //     // ensure we are still connected here
            //     this.notify({
            //         eventName: HRDeviceConnectedEvent,
            //         object: this,
            //         data: hrDevice
            //     } as BLEEventData);
            // } else {
            //     return;
            // }
            // }
            this.removeConnectingDeviceUUID(data.UUID);
            this.notify({
                eventName: BLEConnectedEvent,
                object: this,
                data
            } as BLEEventData);
        } catch (e) {
            console.error(e.toString());
            this.disconnect(data, false);

            // make sure the error is shown in the UI
            // setTimeout(() => {
            //     throw e;
            // }, 0);
        }
    }

    // tryToReconnectToHRDevice(UUID: string) {
    //     DEV_LOG && console.log('tryToReconnectToHRDevice', UUID);
    //     if (!this.reconnectingToHR && this.geoHandler.isSessionRunning()) {
    //         this.notify({
    //             eventName: HRDeviceReconnectingEvent,
    //             object: this
    //         });
    //         this.reconnectingToHR = true;

    //         const handleTimer = (result) => {
    //             if (!result && this.reconnectingToHR && this.bluetoothEnabled && this.geoHandler.isSessionRunning()) {
    //                 return timeout(1000).then(() => this.connectToSaved());
    //             }
    //             return result;
    //         };
    //         // wait a bit to try and reconnect
    //         timeout(3000)
    //             .then(() => this.connectToSaved())
    //             .then(handleTimer)
    //             .then(handleTimer)
    //             .then(handleTimer)
    //             .then((result) => {
    //                 this.reconnectingToHR = false;
    //                 DEV_LOG && console.log('tryToReconnectToHRDevice finished', UUID, result, this.bluetoothEnabled && this.geoHandler.isSessionRunning());
    //                 // we try 3 times to find the HR (for 10s).
    //                 // if it does not work we check if the session is still running and start over
    //                 if (!result) {
    //                     if (this.bluetoothEnabled && this.geoHandler.isSessionRunning()) {
    //                         setTimeout(() => this.tryToReconnectToHRDevice(UUID), 0);
    //                     } else {
    //                         this.notify({
    //                             eventName: HRDeviceReconnectingFailedEvent,
    //                             object: this
    //                         });
    //                     }
    //                 }
    //             });
    //     }
    // }

    onDeviceDisconnected<T>(e: { data: { UUID: string } } & T) {
        const data = e.data;
        DEV_LOG && console.log('onDeviceDisconnected', data);
        this.removeConnectingDeviceUUID(data.UUID);

        // if (this.hrDevice && data.UUID === this.hrDevice.UUID) {
        //     const device = this.hrDevice;
        //     device.onDisconnected();
        //     this.hrDevice = null;
        //     bluetooth.isBluetoothEnabled().then((enabled) => {
        //         const manualDisconnect = !!this.manualDisconnect[data.UUID] || !enabled;
        //         DEV_LOG && console.log('manualDisconnect', !!this.manualDisconnect[data.UUID], !enabled);
        //         this.notify({
        //             eventName: HRDeviceDisconnectedEvent,
        //             object: this,
        //             manualDisconnect,
        //             data: device
        //         } as BLEConnectionEventData);
        //         if (!manualDisconnect) {
        //             const text = $tc('disconnected_sensor');
        //             // speakText({ text });
        //             showNotification(text, null, false);
        //         }
        //         if (!manualDisconnect) {
        //             this.tryToReconnectToHRDevice(data.UUID);
        //         } else {
        //             delete this.manualDisconnect[data.UUID];
        //         }
        //     });
        // }

        this.notify({
            eventName: BLEDisconnectedEvent,
            object: this,
            data
        } as BLEEventData);
    }
    removeConnectingDeviceUUID(UUID: string) {
        const options = this.connectingDevicesUUIDs[UUID];
        delete this.connectingDevicesUUIDs[UUID];
        return options;
    }
    async isDeviceConnected(peripheral: Partial<Peripheral> & { UUID: string }) {
        return bluetooth.isConnected(peripheral);
    }
    async connect(peripheral: Partial<Peripheral> & { UUID: string }, options: Partial<ConnectOptions> = {}) {
        const UUID = peripheral.UUID;
        DEV_LOG && console.log('connect', UUID);
        try {
            this.connectingDevicesUUIDs[UUID] = options;

            await bluetooth.connect({
                UUID,
                autoDiscoverAll: false,
                ...options
            });
            return peripheral;
        } catch (err) {
            this.removeConnectingDeviceUUID(UUID);
            console.error(`Failed to  connect to device ${UUID}: ${err}`);
            throw err || new MessageError({ message: 'device_connection_failed', UUID });
        }
    }
    disconnect(peripheral: Partial<Peripheral> & { UUID: string }, manualDisconnect = true) {
        const UUID = peripheral.UUID;
        DEV_LOG && console.log(TAG, 'disconnect', UUID, manualDisconnect);
        this.manualDisconnect[UUID] = manualDisconnect;
        return bluetooth.disconnect({
            UUID
        });
    }

    // async disconnectHr(manualDisconnect?: boolean) {
    //     DEV_LOG && console.log('disconnectHr', manualDisconnect, !!this.hrDevice);
    //     if (this.hrDevice) {
    //         const hrDevice = this.hrDevice;
    //         this.hrDevice = null;
    //         return new Promise<void>((resolve) => {
    //             this.once(HRDeviceDisconnectedEvent, () => resolve());
    //             return this.disconnect(hrDevice.peripheral, manualDisconnect);
    //         });
    //     }
    // }

    async startScanning(options: StartScanningOptions) {
        if (!this.started) {
            await this.waitForStarted();
        }
        DEV_LOG && console.log('startScanning', options);
        const enabled = this.isEnabled();
        if (enabled) {
            const scanningOptions = {
                skipPermissionCheck: false,
                seconds: 4,
                ...options
            } as any;
            return bluetooth.startScanning(scanningOptions);
        } else {
            throw new MessageError({ message: $tc('please_turn_on_bluetooth') });
        }
    }

    stopScanning() {
        return bluetooth.stopScanning();
    }
    startNotifying(params: StartNotifyingOptions) {
        return bluetooth.startNotifying(params);
    }

    addDevLogMessage(message: string) {
        if (DEV_LOG && this.devMode) {
            this.devLog.push(message);
            if (this.devLog.length > 500) {
                this.devLog.shift();
            }
            this.notify({
                eventName: DevLogMessageEvent,
                object: this,
                data: message
            });
        }
    }

    // requestMtu() {
    //     if (!this.hrDevice) {
    //         return;
    //     }
    //     // hrDevice are supposed to support max 512 but the buffer size on the hrDevice is of size 256
    //     return this.hrDevice.requestMtu(128);
    // }
    // async readFirmwareVersion() {
    //     if (!this.hrDevice) {
    //         return;
    //     }
    //     try {
    //         const r = await this.hrDevice.readDescriptor('180a', '2a26');
    //         const str = String.fromCharCode.apply(null, r);
    //         this.notify({
    //             eventName: VersionEvent,
    //             object: this,
    //             data: str
    //         });
    //         return str;
    //     } catch (error) {
    //         console.error(error);
    //     }
    // }

    async getSerialNumber(peripheral: Peripheral, stayConnected = false) {
        DEV_LOG && console.log('getSerialNumber', peripheral);
        if (peripheral.serialNumber) {
            return peripheral.serialNumber;
        } else if (peripheral.manufacturerId === -1) {
            // when device data seems broken like decathlon belts we use the UUID
            return peripheral.UUID;
        }
        let needsToDisconnect = false;
        let isConnected = true;
        try {
            isConnected = await bluetooth.isConnected(peripheral);
        } catch (error) {}
        if (!isConnected) {
            await bluetooth.connect({ ...peripheral, serviceUUIDs: [SERIAL_UUID] });
            needsToDisconnect = true;
        }
        const r = await bluetooth.read({ peripheralUUID: peripheral.UUID, serviceUUID: SERIAL_UUID, characteristicUUID: SERIA_DESC_UUID });
        DEV_LOG && console.log('gotSerialNumber', peripheral.UUID, isConnected, needsToDisconnect, r);
        if (!stayConnected && needsToDisconnect) {
            bluetooth.disconnect(peripheral);
        }
        const arr = new Uint8Array(r.value);
        return String.fromCharCode.apply(String, arr);
    }
    // async readSerialNumber() {
    //     if (!this.hrDevice) {
    //         return;
    //     }
    //     try {
    //         const r = await this.hrDevice.readDescriptor('180a', '2a25');
    //         const str = String.fromCharCode.apply(null, r);
    //         this.notify({
    //             eventName: SerialEvent,
    //             object: this,
    //             data: str
    //         });
    //         return str;
    //     } catch (error) {
    //         console.error(error);
    //     }
    // }

    // onBatteryReading(event: ReadResult) {
    //     this.hrBattery = new Uint8Array(event.value)[0];
    //     this.notify({
    //         eventName: HRDeviceBatteryEvent,
    //         object: this,
    //         data: this.hrBattery
    //     });
    //     return this.hrBattery;
    // }
    // async readBattery() {
    //     if (!this.hrDevice) {
    //         return;
    //     }
    //     try {
    //         const data = await this.hrDevice.readDescriptor(BATTERY_UUID, BATTERY_DESC_UUID);
    //         this.onBatteryReading({ value: data.buffer } as any);
    //     } catch (error) {
    //         console.error(error);
    //     }
    // }
}
