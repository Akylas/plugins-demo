import Node, { registerStaticNodeClass } from './Node';
import Scenario, { NodeDef } from './Scenario';

export interface Args {}
export default class WaitNextNode extends Node<Args> {
    static _instance: WaitNextNode;
    static instance() {
        if (!WaitNextNode._instance) {
            WaitNextNode._instance = new WaitNextNode();
            registerStaticNodeClass(WaitNextNode);
        }
        return WaitNextNode._instance;
    }
    override async handleRun(prevResult, options: NodeDef<Args, 'wait_delay'>, scenario: Scenario) {
        const args = options.primitive_kwargs;
        // console.log('WaitNextNode', options);
        return new Promise<number>((resolve, reject) => {
            scenario.notify({ eventName: 'waitNext', data: { resolve, reject } });
        }).then((r) => 0);
    }
}
