import { backgroundEvent, foregroundEvent } from '@akylas/nativescript/application';
import { knownFolders } from '@akylas/nativescript';
import { EventData, Observable } from '@nativescript/core/data/observable';
import NodeFactory from './scenario/NodeFactory';
import Scenario, { IScenario, ScenarioState } from './scenario/Scenario';
import { request } from '@nativescript-community/perms';
import { Folder, path } from '@nativescript/core';
import { ESPDevice, MobileSensorDevice, ProfileData, SensorDeviceTypes, getAPIInstance, getUploaderInstance } from '~/services/APIService';
import { clearStaticNodeData } from './scenario/Node';
import { $tc } from '~/helpers/locale';
import SensorNode from './scenario/SensorNode';
import { Handler } from './Handler';

const TAG = '[ScenarioHandler]';

export function filterDevices(
    availableDevices: (MobileSensorDevice | ESPDevice)[],
    args: {
        sensor_device_type: SensorDeviceTypes;
        required_sensors: string[];
    }[]
) {
    return availableDevices.filter((device) => {
        const data = args.find((d) => d.sensor_device_type === device.sensor_device_type);
        if (data) {
            if (data.required_sensors) {
                const sensors = device.sensors_list.map((s) => s.type);
                if (data.required_sensors.every((s) => sensors.includes(s))) {
                    return true;
                }
            }
        }
        return false;
    });
}

export default class ScenarioHandler extends Handler {
    currentScenario: Scenario;
    dataFolder: Folder;

    async start() {
        await request('storage');
        this.dataFolder = knownFolders.externalDocuments().getFolder('scenarios');
        DEV_LOG && console.log(TAG, 'start', this.dataFolder.path);
    }

    async stop() {
        DEV_LOG && console.log(TAG, 'stop', this.dataFolder.path);
    }

    forwardEvent(event) {
        // console.log(TAG, 'forwardEvent', event.eventName);
        this.notify(event);
    }

    onScenarioState(e) {
        console.log(TAG, 'onScenarioState', e.state);
        this.notify(e);
        // switch( e.state as ScenarioState)  {
        //     case ScenarioState.RUNNING:
        // }
    }
    async startScenario(scenarioContent: IScenario, profile: ProfileData) {
        DEV_LOG && console.log(TAG, 'startScenario', JSON.stringify(scenarioContent));
        if (this.currentScenario) {
            this.stopScenario();
        }

        const availableDevices = [await getAPIInstance().getDeviceSensor()];
        const requiredDevices = scenarioContent.scenario_info.required_sensor_devices;
        const possibleDevices = requiredDevices.length ? filterDevices(availableDevices, requiredDevices) : availableDevices;
        if (!possibleDevices.length) {
            throw new Error($tc('missing_required_sensors'));
        }
        const requiredSensors = [...new Set(requiredDevices.map((d) => d.required_sensors).flat())];
        DEV_LOG && console.log('requiredSensors', requiredSensors);
        if (requiredSensors.indexOf('generic.mic') !== -1) {
            const permission = await request('microphone');
            DEV_LOG && console.log('requested mic permission', permission);
            if (permission[0] !== 'authorized') {
                throw new Error($tc('missing_mic_permission'));
            }
        }
        if (requiredSensors.indexOf('generic.acc') !== -1 || requiredSensors.indexOf('generic.byr') !== -1) {
            const permission = await request('motion');
            DEV_LOG && console.log('requested motion permission', permission);
            if (permission[0] !== 'authorized') {
                throw new Error($tc('missing_motion_permission'));
            }
        }

        const scenario = (this.currentScenario = new Scenario(scenarioContent, profile, this.dataFolder, availableDevices, possibleDevices, this, NodeFactory));
        scenario.on('state', this.onScenarioState, this);
        scenario.on('displayMessage', this.forwardEvent, this);
        scenario.on('displayProgress', this.forwardEvent, this);
        scenario.on('waitNext', this.forwardEvent, this);
        scenario.on('waitCountdown', this.forwardEvent, this);
        scenario.on('waitOption', this.forwardEvent, this);
        scenario.on('screenSleep', this.forwardEvent, this);
        scenario.on('mic.recording', this.forwardEvent, this);
        scenario.on('finished', this.forwardEvent, this);
        // const nodes = [...new Set(Object.values(scenarioContent.scenario_content.nodes).map((s) => s.primitive_name))];
        // console.log(TAG, 'startScenario', nodes);
        scenario.start();
    }
    async stopScenario(error?, saveAcquisition = true) {
        const scenario = this.currentScenario;
        try {
            DEV_LOG && console.log(TAG, 'stopScenario', error, saveAcquisition);
            if (scenario) {
                scenario.stop(error);
                scenario.off('state', this.onScenarioState, this);
                scenario.off('displayMessage', this.forwardEvent, this);
                scenario.off('displayProgress', this.forwardEvent, this);
                scenario.off('waitNext', this.forwardEvent, this);
                scenario.off('waitCountdown', this.forwardEvent, this);
                scenario.off('waitOption', this.forwardEvent, this);
                scenario.off('screenSleep', this.forwardEvent, this);
                scenario.off('finished', this.forwardEvent, this);
                scenario.off('mic.recording', this.forwardEvent, this);
                this.currentScenario = null;
                DEV_LOG && console.log(TAG, 'stopScenario', 'about to save acquisiton', saveAcquisition);
                if (saveAcquisition && (!error || scenario.aborted)) {
                    getUploaderInstance().addScenarioAcquisition(scenario);
                }

                //TODO: move nodes data into the Scenario class to prevent
                // the need to clear static data which is not clean
                clearStaticNodeData();
            }
            return scenario;
        } catch (error) {
            this.notify({ error, eventName: 'error' });
            return scenario;
        }
    }
    async cancelScenario() {
        // in this case we dont store anything and simply stop/clear/remove data
        const scenario = await this.stopScenario(undefined, !PRODUCTION);
        if (PRODUCTION) {
            const dataFolder = scenario.dataPath;
            await Folder.fromPath(dataFolder).remove();
        }
    }
    pauseScenario() {
        DEV_LOG && console.log(TAG, 'pauseScenario');
        if (this.currentScenario) {
            this.currentScenario.pause();
        }
    }
    resumeScenario() {
        DEV_LOG && console.log(TAG, 'resumeScenario');
        if (this.currentScenario) {
            this.currentScenario.resume();
        }
    }
}
