import { File, path } from '@nativescript/core';
import Scenario from './Scenario';

const BUFFER_COUNT = 10;

export interface LoggerOptions {
    name: string;
    paused?: boolean;
    bufferMaxCount?: number;
}

export default class Logger {
    name: string;
    native; // NSFileHandle || java.io.BufferedWriter
    bufferCount = 0;
    bufferMaxCount = BUFFER_COUNT;
    buffer: string[] = [];
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
            let name = this.name;
            if (!name.match(/.*\.\w{3}$/)) {
                name += '.bin';
            }
            const logPath = (this.path = path.join(this.scenario.dataPath, name));
            let native;

            if (__ANDROID__) {
                native = new java.io.BufferedWriter(new java.io.FileWriter(logPath));
            } else {
                NSFileManager.defaultManager.createFileAtPathContentsAttributes(logPath, null, null);
                native = NSFileHandle.fileHandleForWritingAtPath(logPath);
                (native as NSFileHandle).seekToEndOfFile();
            }
            this.native = native;
        }
    }

    close() {
        const native = this.native;
        if (native) {
            if (__ANDROID__) {
                (native as java.io.BufferedWriter).flush();
                (native as java.io.BufferedWriter).close();
            } else {
                (native as NSFileHandle).closeFile();
            }
            this.native = null;
            this.buffer = [];
            this.bufferCount = 0;

            // to test we read the content of the logPath
            // console.log('Logger', 'close', this.path, File.fromPath(this.path).readTextSync());
        }
    }
    write(message: string) {
        // console.log('Logger', 'write', this.name, message);
        const native = this.native;
        if (native && !this.paused) {
            message += '\n';
            if (__ANDROID__) {
                (native as java.io.BufferedWriter).write(message);
                this.bufferCount++;
                if (this.bufferCount === BUFFER_COUNT) {
                    (native as java.io.BufferedWriter).flush();
                    this.bufferCount = 0;
                }
            } else {
                this.buffer.push(message);
                if (this.buffer.length === BUFFER_COUNT) {
                    (native as NSFileHandle).writeData(NSString.stringWithString(this.buffer.join('')).dataUsingEncoding(NSUTF8StringEncoding));
                    this.buffer = [];
                }
            }
        }
    }
}
