import { path } from '@nativescript/core';
import Logger from './Logger';
import Node, { registerStaticNodeClass } from './Node';
import Scenario, { NodeDef } from './Scenario';

export interface Args {
    message: string;
}

export default class LogInfoNode extends Node<Args> {
    static _instance: LogInfoNode;
    static instance() {
        if (!LogInfoNode._instance) {
            LogInfoNode._instance = new LogInfoNode();
            registerStaticNodeClass(LogInfoNode);
        }
        return LogInfoNode._instance;
    }

    static logger: Logger;
    static clearStaticData() {
        LogInfoNode.logger = null;
    }

    override async handleRun(prevResult, options: NodeDef<Args, 'log_info'>, scenario: Scenario) {
        const args = options.primitive_kwargs;
        // console.log('LogInfoNode', options);
        switch (options.primitive_name) {
            case 'log_info':
                if (!LogInfoNode.logger) {
                    LogInfoNode.logger = new Logger({ name: 'acquisition.log' }, scenario);
                }
                LogInfoNode.logger.write(args.message);
                break;
        }
        return 0;
    }
}
