import { GeoHandler } from '~/handlers/GeoHandler';
import Observable from '@nativescript-community/observable';
import { BluetoothHandler } from '~/handlers/BluetoothHandler';
import { RealtimeEvent } from './APIService';
import ScenarioHandler from '~/handlers/ScenarioHandler';

export const BgServiceLoadedEvent: string;

export class BgService extends Observable {
    readonly bluetoothHandler: BluetoothHandler;
    readonly scenarioHandler: ScenarioHandler;
    // readonly geoHandler: GeoHandler;
    readonly loaded: boolean;
    readonly started: boolean;
    readonly id: number;
    start();
    stop();
    showFloatingView(startEvent?: RealtimeEvent); // android only
    hideFloatingView(); // android only
    showFloatingProgressView(startEvent?: RealtimeEvent); // android only
    hideFloatingProgressView(); // android only
}
