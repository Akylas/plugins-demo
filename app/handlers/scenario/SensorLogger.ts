import { File, Folder, path } from '@nativescript/core';
import { pointsFromBuffer } from '@nativescript-community/arraybuffers';
import Scenario from './Scenario';

const BUFFER_COUNT = 10;

export interface LoggerOptions {
    name: string;
    paused?: boolean;
    bufferMaxCount?: number;
}

// enum MobileSensorIds {
//     ID_ACC = 0,
//     ID_GYR = 1,
//     ID_UNCAL_ACC = 2,
//     ID_UNCAL_GYR = 3
// }
// interface MobileSensorDescriptor {
//     sensor: { id: string; name: string; driver_version: string }[];
//     frame_desc: { id: string; timestamp_datatype: string; axis: { name: string; datatype: string }[] }[];
// }

// function createMobileSensorDescriptor(sensors: string[]) {
//     return ['SENSOR']
//         .concat(
//             sensors
//                 .map((s) => {
//                     let sensorID = MobileSensorIds.ID_ACC;
//                     let sensorName = 'generic.acc';
//                     switch (s) {
//                         case 'gyroscope':
//                             sensorID = MobileSensorIds.ID_GYR;
//                             sensorName = 'generic.gyr';
//                             break;
//                         case 'accelerometer':
//                         default:
//                             sensorID = MobileSensorIds.ID_ACC;
//                             sensorName = 'generic.acc';
//                             break;
//                     }
//                     return [`ID=${sensorID}`, `SENSOR_NAME=${sensorName}`, 'DRIVER_VERSION=0.0.0'];
//                 })
//                 .flat()
//         )
//         .concat(['FRAME_DESC'])
//         .concat();
// }

export default class SensorLogger {
    name: string;
    native; // NSFileHandle || java.io.BufferedOutputStream
    outputStream: java.io.FileOutputStream;
    bufferCount = 0;
    bufferMaxCount = BUFFER_COUNT; // iOS only
    buffer: NSMutableData; // iOS only
    path: string;
    paused: boolean = false;
    constructor(options: LoggerOptions, private scenario: Scenario) {
        this.name = options.name;
        this.paused = options.paused;
        this.bufferMaxCount = options.bufferMaxCount || BUFFER_COUNT;
        this.create();
    }

    create() {
        if (!this.native) {
            try {
                let name = this.name;
                if (!name.match(/.*\.\w{3}$/)) {
                    name += '.bin';
                }
                const logPath = (this.path = path.join(this.scenario.dataPath, name));
                let native;
                // DEV_LOG && console.log('SensorLogger', 'create', Folder.exists(this.scenario.dataPath), logPath);
                if (__ANDROID__) {
                    this.outputStream = new java.io.FileOutputStream(logPath, true);
                    native = new java.io.BufferedOutputStream(this.outputStream);
                } else {
                    NSFileManager.defaultManager.createFileAtPathContentsAttributes(logPath, null, null);
                    native = NSFileHandle.fileHandleForWritingAtPath(logPath);
                    (native as NSFileHandle).seekToEndOfFile();
                }
                // console.log('SensorLogger', 'created', Folder.exists(this.scenario.dataPath), logPath);
                this.native = native;
            } catch (error) {
                console.error('error creating SensorLogger', error);
                throw error;
            }
        }
    }

    close() {
        const native = this.native;
        if (native) {
            if (__ANDROID__) {
                // console.log('close', native, native.count);
                (native as java.io.BufferedOutputStream).flush();
                this.outputStream.close();
            } else {
                if (this.buffer) {
                    (native as NSFileHandle).writeData(this.buffer);
                }
                (native as NSFileHandle).closeFile();
            }
            this.native = null;
            this.outputStream = null;
            this.buffer = null;
            this.bufferCount = 0;

            // to test we read the content of the logPath
            // console.log('Logger', 'close', this.path);
        }
    }
    // writeRawData(sensorData) {
    //     console.log('Logger', 'writeRawData', this.name, message);
    //     const native = this.native;
    //     if (native && !this.paused) {
    //         if (__ANDROID__) {
    //             (native as java.io.BufferedOutputStream).write(new java.lang.String(JSON.stringify(sensorData) + '\n').getBytes('ASCII'));
    //             this.bufferCount++;
    //             if (this.bufferCount === BUFFER_COUNT) {
    //                 (native as java.io.BufferedOutputStream).flush();
    //                 this.bufferCount = 0;
    //             }
    //         } else {
    //             if (!this.buffer) {
    //                 this.buffer = NSString.stringWithString(JSON.stringify(sensorData) + '\n')
    //                     .dataUsingEncoding(NSUTF8StringEncoding)
    //                     .mutableCopyWithZone(null);
    //             } else {
    //                 this.buffer.appendData(NSString.stringWithString(JSON.stringify(sensorData) + '\n').dataUsingEncoding(NSUTF8StringEncoding));
    //             }
    //             if (this.buffer.length >= BUFFER_COUNT) {
    //                 (native as NSFileHandle).writeData(this.buffer);
    //                 this.buffer = null;
    //             }
    //         }
    //     }
    // }
    write(data: Uint8Array | ArrayBuffer) {
        let realdata: Uint8Array;
        if (data instanceof ArrayBuffer) {
            realdata = new Uint8Array(data);
        } else {
            realdata = data;
        }
        const native = this.native;
        if (native && !this.paused) {
            if (__ANDROID__) {
                const bytes = pointsFromBuffer(realdata, true, false);
                (native as java.io.BufferedOutputStream).write(bytes);
                this.bufferCount++;
                if (this.bufferCount === BUFFER_COUNT) {
                    (native as java.io.BufferedOutputStream).flush();
                    this.bufferCount = 0;
                }
            } else {
                const ndata = NSData.dataWithData(realdata.buffer as any);
                if (!this.buffer) {
                    this.buffer = NSMutableData.alloc().initWithData(ndata);
                } else {
                    this.buffer.appendData(ndata);
                }
                if (this.buffer.length >= BUFFER_COUNT) {
                    (native as NSFileHandle).writeData(this.buffer);
                    this.buffer = null;
                }
            }
        }
    }
}
