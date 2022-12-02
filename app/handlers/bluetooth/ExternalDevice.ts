import { ReadResult } from '@nativescript-community/ble';
import { EventData } from '@nativescript/core';
import { throttle } from 'helpful-decorators';
import { BATTERY_DESC_UUID, BATTERY_UUID, BluetoothHandler, Peripheral, isGarminPeripheral } from '../BluetoothHandler';
import { Characteristic } from './Characteristic';
import { Device } from './Device';

export const BatteryEvent = 'battery';
export const DataEvent = 'data';

export interface DataEventData<T extends string> extends EventData {
    object: ExternalDevice<T>;
    data: Map<T, { value: Number; timestamp: number }>;
}

export abstract class ExternalDevice<T extends string> extends Device {
    currentValues: Map<T, { value: Number; timestamp: number }> = new Map();
    static type: string;
    static filterUUID: string;
    started: boolean;
    abstract start();
    abstract stop();
    batteryChar: Characteristic;
    battery = -1;

    garminBatteryInterval;
    constructor(public peripheral: Peripheral, protected bluetoothHandler: BluetoothHandler) {
        super(peripheral, bluetoothHandler);
    }

    async startListeningForBattery() {
        this.batteryChar = this.batteryChar || new Characteristic(this, BATTERY_UUID, BATTERY_DESC_UUID);
        return this.batteryChar.startNotifying(this.onBattery.bind(this));
    }
    stopListeningForBattery() {
        if (this.batteryChar) {
            return this.batteryChar.stopNotifying();
        }
        if (!this.garminBatteryInterval) {
            clearInterval(this.garminBatteryInterval);
            this.garminBatteryInterval = null;
        }
    }
    reset() {
        this.currentValues.clear();
    }
    onBattery(event: ReadResult) {
        this.battery = new Uint8Array(event.value)[0];
        this.notify({
            eventName: BatteryEvent,
            object: this,
            data: this.battery
        });
    }

    get type() {
        //@ts-ignore
        return (this.constructor as typeof ExternalDevice).type;
    }
    get filterUUID() {
        //@ts-ignore
        return (this.constructor as typeof ExternalDevice).filterUUID;
    }

    @throttle(10)
    sendDataEvent() {
        this.notify({ eventName: DataEvent, object: this, data: this.currentValues } as DataEventData<T>);
    }
}
