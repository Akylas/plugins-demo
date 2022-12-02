import { path } from '@nativescript/core';
import Logger from './Logger';
import Node, { registerStaticNodeClass } from './Node';
import Scenario, { DeviceData, NodeDef } from './Scenario';
import { EspLoggerRecordWriter, MobilePhoneSensorDescriptor } from './SensorDescriptors';
import SensorLogger from './SensorLogger';
import SensorNode from './SensorNode';

export interface Args {
    name: string;
    label?: string;
    sensors?: string[];
    devices?: string[];
    paused: true;
}

export default class RecordNode extends Node<Args> {
    static _instance: RecordNode;
    static instance() {
        if (!RecordNode._instance) {
            RecordNode._instance = new RecordNode();
            registerStaticNodeClass(RecordNode);
        }
        return RecordNode._instance;
    }
    native; // NSFileHandle || java.io.BufferedWriter

    // static loggers: {
    //     [k: string]: SensorLogger;
    // } = {};

    static sensorsLoggers: {
        [k: string]: string[];
    } = {};
    static loggers: {
        [k: string]: EspLoggerRecordWriter;
    } = {};
    static clearStaticData() {
        // RecordNode.loggers = {};
        Object.values(RecordNode.loggers).forEach((logger) => {
            logger.close();
        });
        RecordNode.loggers = {};
        RecordNode.sensorsLoggers = {};
    }

    static getDevicesFromArgs(args: Args, scenario: Scenario) {
        return args.devices
            ? Object.keys(scenario.selectedDevices)
                  .filter((s) => args.devices.indexOf(s) !== -1)
                  .map((s) => scenario.selectedDevices[s])
            : Object.values(scenario.selectedDevices);
    }

    static createLogFile(args: Args, scenario: Scenario) {
        const devices = RecordNode.getDevicesFromArgs(args, scenario);
        const device = devices[0];
        const name = args.name;
        if (args.sensors) {
            if (args.sensors[0] !== 'generic.mic') {
                if (!RecordNode.sensorsLoggers[name]) {
                    const logger = new EspLoggerRecordWriter(new SensorLogger(args, scenario), new MobilePhoneSensorDescriptor(true, true));
                    RecordNode.loggers[name] = logger;
                    if (args.sensors) {
                        args.sensors.forEach((s) => {
                            RecordNode.sensorsLoggers[s] = RecordNode.sensorsLoggers[s] || [];
                            RecordNode.sensorsLoggers[s].push(name);
                        });
                    }
                }
                const filename = !name.match(/.*\.\w{3}$/) ? name + '.bin' : name;
                scenario.metadata.record_info[name] = {
                    filename,
                    create_timestamp: Date.now()
                };
            } else {
                const filename = !name.match(/.*\.\w{3}$/) ? name + '.wav' : name;
                scenario.metadata.record_info[name] = {
                    filename,
                    create_timestamp: Date.now()
                };
                SensorNode.setSensorsConfig({ ...args, config: [['generic.mic.filename', name + '.wav']] }, scenario);
            }
        }
        // console.log('createLogFile done', name);
    }

    static closeLogFile(args: Args, scenario: Scenario) {
        const devices = RecordNode.getDevicesFromArgs(args, scenario);
        const device = devices[0];
        const name = args.name;
        const logger = RecordNode.loggers[name];
        // console.log('closeLogFile', name, !!logger);
        if (logger) {
            logger.close();
            delete RecordNode.loggers[name];
            // delete device.loggers[name];
            Object.values(RecordNode.sensorsLoggers).forEach((values) => {
                const index = values.indexOf(name);
                if (index) {
                    values.splice(index, 1);
                }
            });
        }
        // console.log('closeLogFile done', name);
    }
    static writeLog(args: Args, scenario: Scenario, data) {
        const devices = RecordNode.getDevicesFromArgs(args, scenario);
        const device = devices[0];
        const name = args.name;
        const logger = RecordNode.loggers[name];
        if (logger) {
            // logger.writeRawData(data);
        }
    }

    static internalWriteLog(name: string, device: DeviceData, data: number[]) {
        if (device.config?.paused !== true) {
            const logger = RecordNode.loggers[name];
            if (logger) {
                logger.write.apply(logger, data);
            }
        }
    }
    static writeSensorLog(sensor: string, name: string, device: DeviceData, data) {
        switch (sensor) {
            case 'generic.gyr': {
                RecordNode.internalWriteLog(name, device, [MobilePhoneSensorDescriptor.ID_GYR, Math.round(data.timestamp), data.x, data.y, data.z]);
                break;
            }
            case 'generic.acc': {
                RecordNode.internalWriteLog(name, device, [MobilePhoneSensorDescriptor.ID_ACC, Math.round(data.timestamp), data.x, data.y, data.z]);
                break;
            }
        }
    }
    override async handleRun(
        prevResult,
        options: NodeDef<Args, 'record_annotate' | 'record_close' | 'record_create' | 'record_pause' | 'record_unpause' | 'log_annotate' | 'log_close' | 'log_create' | 'log_pause' | 'log_unpause'>,
        scenario: Scenario
    ) {
        const args = options.primitive_kwargs;
        // console.log('RecordNode', options);

        if (/create|close|pause|unpause/.test(options.primitive_name)) {
            scenario.metadata.record_events.push({
                event: options.primitive_name.split('_')[1], // type of event (create, close, pause, unpause)
                record_name: args.name, // record concerned by the event
                timestamp: Date.now()
            });
        }
        switch (options.primitive_name) {
            case 'log_create':
            case 'record_create':
                RecordNode.createLogFile(args, scenario);
                break;
            case 'log_close':
            case 'record_close':
                RecordNode.closeLogFile(args, scenario);

                scenario.metadata.record_events.push({
                    event: 'close', // type of event (create, close, pause, unpause)
                    record_name: args.name, // record concerned by the event
                    timestamp: Date.now()
                });
                break;
            case 'record_annotate':
            case 'log_annotate':
                RecordNode.writeLog(args, scenario, args.label);
                break;
            case 'record_pause':
            case 'log_pause': {
                const devices = RecordNode.getDevicesFromArgs(args, scenario);
                const name = args.name;
                devices.forEach((device) => {
                    if (RecordNode.loggers[name]) {
                        RecordNode.loggers[name].paused = true;
                    }
                });
                break;
            }
            case 'record_unpause':
            case 'log_unpause': {
                const devices = RecordNode.getDevicesFromArgs(args, scenario);
                const name = args.name;
                devices.forEach((device) => {
                    if (RecordNode.loggers[name]) {
                        RecordNode.loggers[name].paused = false;
                    }
                });
                break;
            }
        }
        return 0;
    }
}
