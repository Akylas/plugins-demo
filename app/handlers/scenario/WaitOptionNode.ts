import Node, { registerStaticNodeClass } from './Node';
import Scenario, { NodeDef } from './Scenario';

export interface Args {
    title?: string;
    msg: string;
    options: string[];
}
export default class WaitOptionNode extends Node<Args> {
    static _instance: WaitOptionNode;
    static instance() {
        if (!WaitOptionNode._instance) {
            WaitOptionNode._instance = new WaitOptionNode();
            registerStaticNodeClass(WaitOptionNode);
        }
        return WaitOptionNode._instance;
    }
    override async handleRun(prevResult, options: NodeDef<Args, 'wait_delay'>, scenario: Scenario) {
        const args = options.primitive_kwargs;
        // console.log('WaitOptionNode', options);
        return new Promise<number>((resolve, reject) => {
            scenario.notify({ eventName: 'waitOption', data: { args, resolve, reject } });
        });
    }
}
