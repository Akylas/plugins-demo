import Node, { registerStaticNodeClass } from './Node';
import Scenario, { NodeDef } from './Scenario';

export interface Args {
    reason: string;
}
export default class AbortNode extends Node<Args> {
    static _instance: AbortNode;
    static instance() {
        if (!AbortNode._instance) {
            AbortNode._instance = new AbortNode();
            registerStaticNodeClass(AbortNode);
        }
        return AbortNode._instance;
    }
    override async handleRun(prevResult, options: NodeDef<Args, 'abort'>, scenario: Scenario) {
        const args = options.primitive_kwargs;
        // console.log('AbortNode', args.reason);
        scenario.aborted = args;
        scenario.scenarioHandler.stopScenario(new Error(args.reason));
        return 1;
    }
}
