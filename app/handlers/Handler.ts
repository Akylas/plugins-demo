import { Observable } from '@nativescript/core/data/observable';
import { getAPIInstance } from '~/services/APIService';
import { BgServiceCommon } from '~/services/BgService.common';
export abstract class Handler extends Observable {
    constructor(protected service: BgServiceCommon) {
        super();
    }
    // get geoHandler() {
    //     return this.service.geoHandler;
    // }
    get bluetoothHandler() {
        return this.service.bluetoothHandler;
    }
    get scenarioHandler() {
        return this.service.scenarioHandler;
    }
    get apiService() {
        return getAPIInstance();
    }
}
