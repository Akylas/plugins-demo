import Node, { registerStaticNodeClass } from './Node';
import Scenario, { NodeDef } from './Scenario';

export interface Args {
    branch_name: string;
}
export default class ForkNode extends Node<Args> {
    static _instance: ForkNode;
    static instance() {
        if (!ForkNode._instance) {
            ForkNode._instance = new ForkNode();
            registerStaticNodeClass(ForkNode);
        }
        return ForkNode._instance;
    }
    override async handleRun(prevResult, options: NodeDef<Args, 'fork'>, scenario: Scenario) {
        // console.log('ForkNode', options);
        scenario.startBranch(options.primitive_kwargs.branch_name, options.next_nodes[1]);
        return 0;
    }
}
