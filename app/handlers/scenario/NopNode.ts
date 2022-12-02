import Node, { registerStaticNodeClass } from './Node';
import Scenario, { NodeDef } from './Scenario';

export interface Args {}
export default class NopNode extends Node<Args> {
    static _instance: NopNode;
    static instance() {
        if (!NopNode._instance) {
            NopNode._instance = new NopNode();
            registerStaticNodeClass(NopNode);
        }
        return NopNode._instance;
    }
    override async handleRun(prevResult, options: NodeDef<Args, 'nop'>, scenario: Scenario) {
        // console.log('NopNode');
        return 0;
    }
}
