import { Peripheral, ReadResult } from '@nativescript-community/ble';
import { BluetoothHandler } from '../BluetoothHandler';
import { Characteristic } from './Characteristic';
import { ExternalDevice } from './ExternalDevice';

export const HR_UUID = '180d';
export const HR_CHAR_UUID = '2a37';

export type HRLocationKeys = 'hr';

const HEART_RATE_MEASUREMENT_FLAG = {
    heartRateValueFormat: {
        firstBitPosition: 0,
        bitsSize: 0b001
    },
    sensorContactStatus: {
        firstBitPosition: 1,
        bitsSize: 0b011
    },
    energyExpendedStatus: {
        firstBitPosition: 3,
        bitsSize: 0b001
    },
    rrInterval: {
        firstBitPosition: 4,
        bitsSize: 0b001
    },
    reservedForFutureUse: {
        firstBitPosition: 5,
        bitsSize: 0b111
    }
};

const TAG = '[HRDevice]';
export default class HRDevice extends ExternalDevice<HRLocationKeys> {
    static type = 'hr';
    async start() {
        if (this.started) {
            return;
        }
        this.started = true;
        try {
            this.hrChar = this.hrChar || new Characteristic(this, HR_UUID, HR_CHAR_UUID);
            await this.hrChar.startNotifying(this.onHR.bind(this));
        } catch (error) {
            console.error(TAG, error);
            this.bluetoothHandler.notify({
                eventName: 'error',
                error
            });
            throw error;
        }
    }
    stop() {
        if (!this.started) {
            return;
        }
        this.started = false;
        this.reset();
        if (this.hrChar) {
            return this.hrChar.stopNotifying();
        }
    }
    hrChar: Characteristic;

    static filterUUID = HR_UUID;

    reset() {}
    onHR(e: ReadResult) {
        const view = new DataView(e.value);
        const flag = view.getUint8(0);
        const rrValues = [];
        let energy = -1;
        let offset = 1; // This depends on hear rate value format and if there is energy data
        let rr_count = 0;

        if ((flag & 0x01) !== 0) {
            offset = 3;
        } else {
            offset = 2;
        }
        if ((flag & 0x08) !== 0) {
            // calories present
            energy = view.getUint16(offset, true);
            offset += 2;
        }
        if ((flag & 0x16) !== 0) {
            // RR stuff.
            rr_count = (view.byteLength - offset) / 2;
            if (rr_count > 0) {
                for (let i = 0; i < rr_count; i++) {
                    rrValues[i] = view.getUint16(offset, true);
                    offset += 2;
                }
            }
        }

        this.notify({
            eventName: 'value',
            data: {
                hr: view.getUint8(1),
                timestamp: Date.now(),
                rr: rrValues
            }
        });
        this.checkRSSI();
    }
    static scanFilter() {
        return {
            serviceUUID: HR_UUID
        };
    }

    static fromPeripheral(data: Peripheral, bluetoothHandler: BluetoothHandler) {
        if (data.services.findIndex((s) => s.UUID.toLowerCase() === HR_UUID) !== -1) {
            return new HRDevice(data, bluetoothHandler);
        }
    }
    static typePeripheral(data: Peripheral) {
        if (data.advertismentData.serviceUUIDs.indexOf(HR_UUID) !== -1) {
            return HRDevice.type;
        }
    }
}
