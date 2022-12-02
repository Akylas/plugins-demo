import { Observable } from '@akylas/nativescript/data/observable';
import { Device, File, Folder, path } from '@nativescript/core';
import dayjs from 'dayjs';
import { ESPDevice, MobileSensorDevice, ProfileData, SensorDevice, SensorDeviceTypes } from '~/services/APIService';
import ScenarioHandler from '../ScenarioHandler';
import Log from './Log';
import Node from './Node';
import { IFactory, NodesType } from './NodeFactory';
import { EspLoggerRecordWriter } from './SensorDescriptors';
import SensorLogger from './SensorLogger';

const TEXT_REG = /\${txt:(.*?)}/g;
const SRC_REG = /\${rsr:(.*?)}/g;

interface TargetedProfile {
    gender: string[];
    handedness: any[];
    age_min: number;
    age_max: number;
    height_min: number;
    height_max: number;
    spoken_languages: string[];
}
export interface IScenario {
    data_collection_id: number;
    scenario_id: number;
    scenario_info: ScenarioInfo;
    scenario_content: ScenarioContent;
}

export interface ScenarioInfo {
    creation_datetime: string;
    end_valid_date: string;
    title: string;
    description: string;
    status: string;
    priority: number;
    required_diskspace: number;
    targeted_profile: TargetedProfile;
    required_sensor_devices: { sensor_device_type: SensorDeviceTypes; required_sensors: string[] }[];
    exclusive_scenario_set: number[];
}
interface ScenarioContent {
    version: number;
    nodes: { [k: string]: NodeDef };
    entry_node: string;
    texts: Texts;
    resources: Resources;
    steps: Steps;
}

interface Steps {
    [k: string]: Introduction;
}

interface Introduction {
    title: string;
}

interface Resources {
    [k: string]: string;
}

interface Texts {
    scenario_into: string;
    device_setup: string;
}

export interface NodeDef<T = NodeArgs, U extends NodesType = NodesType> {
    primitive_name: U;
    primitive_kwargs: T;
    next_nodes: string[];
    step: string;
}

export interface NodeArgs {
    [k: string]: any;
}

export type NodeArgsData<T = Record<string, any>, U = NodesType> = [U, T, string[]];

export enum ScenarioState {
    STOPPED,
    PAUSED,
    RUNNING
}

interface ScenarioMetadata {
    version: number;
    acquisition_start_datetime: string;
    acquisition_end_datetime: string;
    acquisition_start_timestamp: number;
    acquisition_end_timestamp: number;
    scenario_id: number;
    data_collection_id: number;
    profile_id: number;
    system_info: Systeminfo;
    app_info: Appinfo;
    sensor_device_info: { [k: string]: SensorDevice };
    sensor_device_config: { [k: string]: Record<string, any> };
    record_info: { [k: string]: Recordname };
    record_events: Recordevent[];
    annotations: Annotation[];
    extra_metadata: { [k: string]: string };
    abort: Abort;
}

interface Abort {
    reason: string;
    message: string;
}

interface Annotation {
    timestamp: number;
    record_name: string;
    label: string;
}

interface Recordevent {
    event: string;
    record_name: string;
    timestamp: number;
}

interface Recordname {
    filename: string;
    create_timestamp: number;
}

interface Appinfo {
    app_type: string;
    app_version: string;
}

interface Systeminfo {
    os_type: string;
    os_version: string;
    device_model: string;
    device_manufacturer: string;
    device_family: string;
}

export interface DeviceData {
    name: string;
    device: MobileSensorDevice | ESPDevice;
    config: { paused?: boolean; [k: string]: Record<string, any> | string | number | boolean };
    // loggers: { [k: string]: EspLoggerRecordWriter };
}

const TAG = '[Scenario]';
export default class Scenario extends Observable {
    current?: { node?: Node<any, any>; options: NodeDef<any, any>; prevResult?: any };
    dataPath: string;
    entry_node: NodesType;
    startTime: number;
    endTime: number;
    nodes: {
        [k: string]: NodeDef;
    };
    _state: ScenarioState = ScenarioState.STOPPED;
    logs: { [k: string]: Log };
    content: ScenarioContent;
    info: ScenarioInfo;

    branches: { [k: string]: Promise<any> } = {};

    metadata: ScenarioMetadata;

    availableDevices: (MobileSensorDevice | ESPDevice)[] = [];
    selectedDevices: { [k: string]: DeviceData } = {};

    aborted?: { reason?: string; message?: string };

    get state() {
        return this._state;
    }
    set state(value) {
        if (this._state !== value) {
            this._state = value;
            this.notify({ eventName: 'state', state: value });
        }
    }

    constructor(
        data: IScenario,
        profile: ProfileData,
        dataFolder: Folder,
        availableDevices: (MobileSensorDevice | ESPDevice)[],
        selectedDevices: (MobileSensorDevice | ESPDevice)[],
        public scenarioHandler: ScenarioHandler,
        protected factory: typeof IFactory
    ) {
        super();
        this.availableDevices = availableDevices;
        selectedDevices.forEach((device) => {
            const name = device.sensor_device_type;
            this.selectedDevices[name] = {
                name,
                device,
                config: {}
                // loggers: {}
            };
        });
        this.dataPath = dataFolder.getFolder(Date.now() + '').path;
        if (!Folder.exists(this.dataPath)) {
            throw new Error('failed  to create scenario data folder ' + this.dataPath);
        }
        this.content = data.scenario_content;
        this.info = data.scenario_info;
        this.entry_node = data.scenario_content.entry_node as NodesType;
        this.nodes = data.scenario_content.nodes;
        this.metadata = {
            abort: null,
            annotations: [],
            app_info: {
                app_type: 'cdc-mobile-app',
                app_version: __APP_VERSION__ + '.' + __APP_BUILD_NUMBER__
            },
            data_collection_id: data.data_collection_id,
            scenario_id: data.scenario_id,
            profile_id: profile.profile_id,
            // ...profile,
            // ...data,
            extra_metadata: {},
            record_events: [],
            record_info: {},
            sensor_device_config: {},
            sensor_device_info: {},
            version: 1,
            system_info: {
                os_type: gVars.platform,
                os_version: Device.osVersion,
                device_model: Device.model,
                device_manufacturer: Device.manufacturer
            }
        } as Partial<ScenarioMetadata> as any;
    }
    start() {
        if (this.state !== ScenarioState.STOPPED) {
            return;
        }
        this.startTime = Date.now();
        DEV_LOG && console.log(TAG, 'start', this.entry_node);
        this.metadata.acquisition_start_timestamp = this.startTime;
        this.metadata.acquisition_start_datetime = dayjs(this.startTime).toISOString();
        this.saveMetadata();
        this.saveScenarioInfo();
        this.state = ScenarioState.RUNNING;
        this.startBranch('main', this.entry_node);
    }

    startBranch(name: string, entry_node: string) {
        const node = this.createNode(entry_node);
        this.branches[name] = node?.run(null, this.getNodeData(entry_node), this, name);
    }
    pause() {
        if (this.state !== ScenarioState.RUNNING) {
            return;
        }
        DEV_LOG && console.log('pause');
        this.saveMetadata();
        this.state = ScenarioState.PAUSED;
    }
    resume() {
        if (this.state !== ScenarioState.PAUSED) {
            return;
        }
        this.state = ScenarioState.RUNNING;
        const current = this.current;
        DEV_LOG && console.log('resume', current);
        if (current) {
            (current.node || this.createNode(current.options.primitive_name)).run(current.prevResult, current.options, this, 'main');
        }
    }
    stop(error?) {
        if (this.state === ScenarioState.STOPPED) {
            return;
        }
        this.endTime = Date.now();
        this.metadata.acquisition_end_timestamp = this.endTime;
        this.metadata.acquisition_end_datetime = dayjs(this.endTime).toISOString();
        this.saveMetadata();
        this.state = ScenarioState.STOPPED;
        DEV_LOG && console.log(TAG, 'stop', error, error?.stack);
        this.notify({ error, eventName: 'finished' });
    }

    async writeFile(filePath: string, content: string) {
        // DEV_LOG && console.log('writeFile', filePath, content);
        return File.fromPath(filePath).writeText(content);
    }
    async saveMetadata() {
        return this.writeFile(path.join(this.dataPath, 'metadata.json'), JSON.stringify(this.metadata));
    }
    async saveScenarioInfo() {
        return this.writeFile(
            path.join(this.dataPath, 'scenario.json'),
            JSON.stringify({
                id: this.metadata.scenario_id,
                content: this.content,
                info: this.info
            })
        );
    }

    getNodeData(node_id: string) {
        return this.nodes[node_id];
    }

    createNode(node_id: string) {
        return this.factory.createNode(node_id, this.getNodeData(node_id), this);
    }

    getFormattedText(text: string) {
        if (text) {
            const texts = this.content.texts;
            const resources = this.content.resources;

            const result = text.replace(TEXT_REG, (...args) => texts[args[1]] || args[0]).replace(SRC_REG, (...args) => resources[args[1]] || args[0]);
            return result;
        }
    }
}
