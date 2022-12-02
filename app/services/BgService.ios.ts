import { BgServiceCommon, BgServiceLoadedEvent } from '~/services/BgService.common';
import { GeoHandler } from '~/handlers/GeoHandler';
import { BluetoothHandler } from '~/handlers/BluetoothHandler';
import ScenarioHandler from '~/handlers/ScenarioHandler';

export { BgServiceLoadedEvent };

export class BgService extends BgServiceCommon {
    // readonly geoHandler: GeoHandler;
    readonly bluetoothHandler: BluetoothHandler;
    readonly scenarioHandler: ScenarioHandler;
    constructor() {
        super();
        // this.geoHandler = new GeoHandler();
        this.bluetoothHandler = new BluetoothHandler(this);
        this.scenarioHandler = new ScenarioHandler(this);
        this._handlerLoaded();
    }
}
