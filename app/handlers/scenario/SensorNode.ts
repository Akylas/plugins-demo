import { ANDROID_ENCODER_PCM_16, TNSRecorder } from '@nativescript-community/audio';
import { startListeningForSensor, stopListeningForSensor } from '@nativescript-community/sensors';
import { path } from '@nativescript/core';
import { ESPDevice, MobileSensorDevice, Sensor, SensorDeviceTypes, getAPIInstance } from '~/services/APIService';
import Node, { registerStaticNodeClass } from './Node';
import RecordNode from './RecordNode';
import Scenario, { DeviceData, NodeDef } from './Scenario';

export interface Args {
    sensors: string[];
    sensor_device_type?: SensorDeviceTypes;
    required_sensors?: string[];
    required_properties?: Partial<MobileSensorDevice | ESPDevice>[];
    required_sensor_properties?: Partial<Sensor>[];
    device_name?: string;
    prompt?: string;
    devices?: string[];
    config: ([string, any] | string)[];
}

export function filterDevices(availableDevices: (MobileSensorDevice | ESPDevice)[], args: Args) {
    // console.log('filterDevices', JSON.stringify(args), JSON.stringify(availableDevices));
    return availableDevices.filter((d) => {
        if (args.sensor_device_type && d.sensor_device_type !== args.sensor_device_type) {
            return false;
        }
        if (args.required_sensors) {
            if (typeof args.required_sensors === 'string') {
                args.required_sensors = [args.required_sensors];
            }
            const sensors = d.sensors_list.map((s) => s.type);
            if (!args.required_sensors.every((s) => sensors.includes(s))) {
                return false;
            }
        }
        if (args.required_properties) {
            if (
                !Object.keys(args.required_properties).every((k) => {
                    const values = args.required_properties[k];
                    if (Array.isArray(values)) {
                        return values.indexOf(d[k]) !== -1;
                    } else {
                        return d[k] === values;
                    }
                })
            ) {
                return false;
            }
        }
        if (args.required_sensor_properties) {
            d.sensors_list.forEach((sensor) => {
                const requiredProps = args.required_sensor_properties[sensor.type];
                if (requiredProps) {
                    if (
                        !Object.keys(requiredProps).every((k) => {
                            const values = requiredProps[k];
                            if (Array.isArray(values)) {
                                return values.indexOf(sensor[k]) !== -1;
                            } else {
                                return sensor[k] === values;
                            }
                        })
                    ) {
                        return false;
                    }
                }
            });
        }
        return true;
    });
}

function getNSensorKey(sensor: string) {
    switch (sensor) {
        case 'generic.acc':
        case 'generic.uncalc_acc':
            return 'accelerometer';
        case 'generic.gyr':
        case 'generic.uncalc_gyr':
            return 'gyroscope';
    }
}
export default class SensorNode extends Node<Args> {
    static _instance: SensorNode;
    static instance() {
        if (!SensorNode._instance) {
            SensorNode._instance = new SensorNode();
            registerStaticNodeClass(SensorNode);
        }
        return SensorNode._instance;
    }
    static runningSensors: Map<string, Function> = new Map();
    static runningMicRecords: Map<string, TNSRecorder> = new Map();
    static clearStaticData() {
        SensorNode.stopAllSensors();
        SensorNode.runningSensors.clear();
        SensorNode.stopAllMicRecords();
        SensorNode.runningMicRecords.clear();
    }

    static setSensorsConfig(args: { sensors?: string[]; devices?: string[]; config: [string, any][] }, scenario: Scenario) {
        const devices = args.devices
            ? Object.keys(scenario.selectedDevices)
                  .filter((s) => args.devices.indexOf(s) !== -1)
                  .map((s) => scenario.selectedDevices[s])
            : Object.values(scenario.selectedDevices);
        let sensor;
        const paramsObject = {};
        args.config.forEach((p) => {
            if (p[0].indexOf('.') !== -1) {
                const split = p[0].split('.');
                const sensorId = split.slice(0, -1).join('.');
                const sensorProp = split[split.length - 1];
                paramsObject[sensorId] = paramsObject[sensorId] || {};
                paramsObject[sensorId][sensorProp] = p[1];
            } else {
                paramsObject[p[0]] = p[1];
            }
        });
        devices.forEach((d) => {
            // DEV_LOG && console.log('setSensorsConfig', d.name, paramsObject);
            Object.assign(d.config, paramsObject);
            scenario.metadata.sensor_device_config[d.name] = scenario.metadata.sensor_device_config[d.name] || {};
            Object.assign(scenario.metadata.sensor_device_config[d.name], paramsObject);
        });
        scenario.saveMetadata();
    }

    onSensor(data, device: DeviceData, sensor: string, nSensor: string) {
        try {
            const names = RecordNode.sensorsLoggers[sensor];
            DEV_LOG && console.log(nSensor, sensor, names, JSON.stringify(data));
            if (names) {
                names.forEach((name) => RecordNode.writeSensorLog(sensor, name, device, data));
            }
        } catch (error) {
            console.error('onSensor', error, error.stack);
        }
    }

    static stopAllSensors() {
        DEV_LOG && console.log('stopAllSensors', SensorNode.runningSensors.size, Object.keys(SensorNode.runningSensors));
        SensorNode.runningSensors.forEach((value, k) => {
            const sensor = k.split('_').pop();
            // console.log('stopping sensor', k, sensor);
            stopListeningForSensor(sensor as any, value);
        });
    }

    static stopAllMicRecords() {
        DEV_LOG && console.log('stopAllMicRecords', SensorNode.runningMicRecords.size);
        SensorNode.runningMicRecords.forEach((value, k) => {
            value.stop();
        });
    }

    getDevicesFromArgs(args: Args, scenario: Scenario) {
        return args.devices
            ? Object.keys(scenario.selectedDevices)
                  .filter((s) => args.devices.indexOf(s) !== -1)
                  .map((s) => scenario.selectedDevices[s])
            : Object.values(scenario.selectedDevices);
    }
    override async handleRun(
        prevResult,
        options: NodeDef<
            Args,
            | 'sensor_device_pause_sensor'
            | 'sensor_device_select'
            | 'sensor_device_set_config'
            | 'sensor_device_dump_config'
            | 'sensor_device_start_sensor'
            | 'sensor_device_stop_sensor'
            | 'sensor_device_unpause_sensor'
            | 'sensor_device_start_record'
            | 'sensor_device_stop_record'
            | 'sensor_device_tag_record'
            | 'sensor_device_download_record'
        >,
        scenario: Scenario
    ) {
        const args = options.primitive_kwargs;
        // DEV_LOG && console.log('SensorNode', options);
        switch (options.primitive_name) {
            case 'sensor_device_set_config': {
                SensorNode.setSensorsConfig(args as any, scenario);
                break;
            }
            case 'sensor_device_dump_config': {
                const devices = this.getDevicesFromArgs(args, scenario);
                const configs = scenario.metadata.sensor_device_config;
                devices.forEach((d) => {
                    configs[d.name] = configs[d.name] || {};
                    (args.config as string[]).forEach((s) => {
                        configs[d.name][s] = d.config[s];
                    });
                });
                scenario.saveMetadata();
                break;
            }
            case 'sensor_device_start_sensor': {
                let result;
                const devices = this.getDevicesFromArgs(args, scenario);
                for (let index = 0; index < devices.length; index++) {
                    const device = devices[index];
                    if (device.device.sensor_device_type === 'mobile_phone') {
                        for (let index = 0; index < args.sensors.length; index++) {
                            const sensor = args.sensors[index];
                            const config = (device.config[sensor] as Record<string, any>) || {};
                            const nSensor = getNSensorKey(sensor);
                            switch (sensor) {
                                case 'generic.acc':
                                case 'generic.gyr':
                                case 'generic.uncalc_acc':
                                case 'generic.uncalc_gyr': {
                                    const key = device.name + '_' + nSensor;
                                    const listener = (data) => this.onSensor(data, device, sensor, nSensor);
                                    const reportInterval = config.report_interval || 100;
                                    result = await startListeningForSensor(nSensor, listener, reportInterval, 0, config);
                                    DEV_LOG && console.log('startListeningForSensor', sensor, nSensor, key, config, result);
                                    if (result[0]) {
                                        SensorNode.runningSensors.set(key, listener);
                                    } else {
                                        return 1;
                                    }
                                    break;
                                }
                                case 'generic.mic': {
                                    if (!TNSRecorder.CAN_RECORD()) {
                                        return 1;
                                    }
                                    const filename = config.filename;
                                    DEV_LOG && console.log('start record', sensor, config);
                                    const recorder = new TNSRecorder();
                                    const key = device.name + '_' + sensor;
                                    if (SensorNode.runningMicRecords[key]) {
                                        throw new Error('mic already running: ' + key);
                                    }
                                    await recorder.start({
                                        //@ts-ignore
                                        format: __IOS__ ? kAudioFormatLinearPCM : undefined, //iOS only
                                        encoder: ANDROID_ENCODER_PCM_16, // Android only
                                        filename: path.join(scenario.dataPath, filename),
                                        sampleRate: 16000,
                                        channels: 2
                                    });
                                    scenario.notify({ eventName: 'mic.recording', state: true });
                                    SensorNode.runningMicRecords.set(key, recorder);
                                    break;
                                }
                            }
                        }
                    }
                }
                break;
            }
            case 'sensor_device_stop_sensor': {
                let result, sensor;
                const devices = this.getDevicesFromArgs(args, scenario);

                for (let index = 0; index < devices.length; index++) {
                    const device = devices[index];
                    if (device.device.sensor_device_type === 'mobile_phone') {
                        for (let index = 0; index < args.sensors.length; index++) {
                            sensor = args.sensors[index];
                            const config = (device.config[sensor] as Record<string, any>) || {};
                            const nSensor = getNSensorKey(sensor);
                            switch (sensor) {
                                case 'generic.acc':
                                case 'generic.gyr':
                                case 'generic.uncalc_acc':
                                case 'generic.uncalc_gyr': {
                                    const key = device.name + '_' + nSensor;
                                    const listener = SensorNode.runningSensors.get(key);
                                    // DEV_LOG && console.log('stopListeningForSensor', sensor, nSensor, config, key, !!listener);
                                    if (listener) {
                                        result = await stopListeningForSensor(nSensor, listener);
                                        DEV_LOG && console.log('stopListeningForSensor done', sensor, config, key, result);
                                        if (result) {
                                            SensorNode.runningSensors.delete(key);
                                        } else {
                                            return 1;
                                        }
                                    }
                                    break;
                                }
                                case 'generic.mic': {
                                    const key = device.name + '_' + sensor;
                                    const recorder = SensorNode.runningMicRecords.get(key);
                                    DEV_LOG && console.log('stop record', sensor, config, !!recorder);
                                    if (recorder) {
                                        await recorder.stop();
                                        scenario.notify({ eventName: 'mic.recording', state: false });
                                        recorder.dispose();
                                        SensorNode.runningMicRecords.delete(key);
                                    }

                                    break;
                                }
                            }
                        }
                    }
                }
                break;
            }
            case 'sensor_device_pause_sensor':
                SensorNode.setSensorsConfig({ ...args, config: [['paused', true]] }, scenario);
                break;
            case 'sensor_device_unpause_sensor':
                SensorNode.setSensorsConfig({ ...args, config: [['paused', false]] }, scenario);
                break;
            case 'sensor_device_select':
                const possibleDevices = filterDevices(scenario.availableDevices, args);
                if (possibleDevices.length) {
                    DEV_LOG && console.log('possibleDevices', possibleDevices);
                    let device: MobileSensorDevice | ESPDevice;
                    const name = args.device_name || 'main';
                    if (possibleDevices.length === 1) {
                        device = possibleDevices[0];
                    } else {
                        const selectedDeviceIndex = await new Promise<number>((resolve, reject) => {
                            scenario.notify({
                                eventName: 'waitOption',
                                data: {
                                    args: {
                                        msg: args.prompt,
                                        options: possibleDevices.map((s) => s.sensor_device_type)
                                    },
                                    resolve,
                                    reject
                                }
                            });
                            device = possibleDevices[selectedDeviceIndex];
                        });
                    }
                    scenario.selectedDevices[name] = { name, device, config: {} };
                    if (device.sensor_device_type === 'mobile_phone') {
                        scenario.metadata.sensor_device_info[name] = await getAPIInstance().getDeviceSensor();
                    } else {
                        //TODO: handle ESPDevice
                    }
                    scenario.saveMetadata();
                    return 0;
                } else {
                    return 1;
                }

            case 'sensor_device_start_record':
            case 'sensor_device_stop_record':
            case 'sensor_device_tag_record':
            case 'sensor_device_download_record':
            //TODO:TO IMPLEMENT
        }
        return 0;
    }
}
