import Node, { registerStaticNodeClass } from './Node';
import Scenario, { NodeDef } from './Scenario';

export interface Args {
    delay: number;
}
export default class WaitNode extends Node<Args> {
    static _instance: WaitNode;
    static instance() {
        if (!WaitNode._instance) {
            WaitNode._instance = new WaitNode();
            registerStaticNodeClass(WaitNode);
        }
        return WaitNode._instance;
    }
    override async handleRun(prevResult, options: NodeDef<Args, 'wait_delay'>, scenario: Scenario) {
        const args = options.primitive_kwargs;
        await new Promise<number>((resolve) => setTimeout(resolve, args.delay * 1000));
        return 0;
    }
}
