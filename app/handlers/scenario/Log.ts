export type LogType = 'memory' | 'file';
export default class Log {
    constructor(public id: string, public type = 'memory') {}

    logs: any[] = [];
    annotations: [number, string][] = [];

    needsFlushing = false;

    write(...args) {
        switch (this.type) {
            case 'memory':
                this.logs.push(args);
                break;
            case 'file':
            case 'memory':
                if (this.needsFlushing) {
                    this.flushLogToFile();
                }
        }
    }

    flushLogToFile() {
        this.logs = [];
    }
}
