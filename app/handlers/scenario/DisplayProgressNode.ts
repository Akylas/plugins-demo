import Node, { registerStaticNodeClass } from './Node';
import Scenario, { NodeDef } from './Scenario';

export interface Args {
    text?: string;
    value: number;
    count: number;
}

export default class DisplayProgressNode extends Node<Args> {
    static _instance: DisplayProgressNode;
    static instance() {
        if (!DisplayProgressNode._instance) {
            DisplayProgressNode._instance = new DisplayProgressNode();
            registerStaticNodeClass(DisplayProgressNode);
        }
        return DisplayProgressNode._instance;
    }
    override async handleRun(prevResult, options: NodeDef<Args, 'display_progress'>, scenario: Scenario) {
        const args = options.primitive_kwargs;
        // console.log('DisplayProgressNode', args);
        scenario.notify({ eventName: 'displayProgress', data: options });
        return 0;
    }
}
