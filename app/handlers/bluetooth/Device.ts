import { BluetoothHandler, DEFAULT_MTU, Peripheral, bluetooth } from '../BluetoothHandler';
import { Characteristic } from './Characteristic';
import Observable from '@nativescript-community/observable';
import { throttle } from 'helpful-decorators';

export class Device extends Observable {
    connected = true;
    mtu = DEFAULT_MTU;

    constructor(public peripheral: Peripheral, protected bluetoothHandler: BluetoothHandler) {
        super();
    }
    readDescriptor(serviceUUID: string, characteristicUUID: string): Promise<Uint8Array> {
        // console.log('readDescriptor', this.peripheral.UUID, serviceUUID, characteristicUUID);
        return Characteristic.read(this.peripheral.UUID, serviceUUID, characteristicUUID);
    }
    get UUID() {
        return this.peripheral.UUID;
    }
    get connectionId() {
        return this.peripheral.connectionId;
    }
    onDisconnected() {
        this.connected = false;
    }
    get name() {
        return this.peripheral.localName || this.peripheral.name;
    }
    set name(newName: string) {
        this.peripheral.localName = newName;
    }
    get localName() {
        return (this.peripheral.localName || this.peripheral.name || '').replace(/�/g, '');
    }
    setMtu(value: number) {
        this.mtu = value;
    }
    requestMtu(value: number) {
        // console.log('requestMtu', value);
        return bluetooth
            .requestMtu({
                peripheralUUID: this.peripheral.UUID,
                value
            })
            .then((result) => {
                // console.log('result requestMtu', value, result);
                if (result > 0) {
                    this.setMtu(result);
                }
                return this.mtu;
            });
    }
    rssiLow = false;

    @throttle(1000)
    async checkRSSI() {
        if (!this.connected) {
            return;
        }
        const rssi = await bluetooth.readRssi({
            peripheralUUID: this.peripheral.UUID
        });
        if (rssi < -90 && !this.rssiLow) {
            this.rssiLow = true;
            this.notify({ eventName: 'rssiLow', data: { value: this.rssiLow, rssi } });
        } else if (rssi >= -90 && this.rssiLow) {
            this.rssiLow = false;
            this.notify({ eventName: 'rssiLow', data: { value: this.rssiLow, rssi } });
        }
    }
}
