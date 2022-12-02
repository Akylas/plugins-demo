import Node, { registerStaticNodeClass } from './Node';
import { NodesType } from './NodeFactory';
import Scenario, { NodeDef } from './Scenario';

export interface Args {
    subbranch?: string;
    branch_name?: string;
}
export default class JoinNode extends Node<Args> {
    static _instance: JoinNode;
    static instance() {
        if (!JoinNode._instance) {
            JoinNode._instance = new JoinNode();
            registerStaticNodeClass(JoinNode);
        }
        return JoinNode._instance;
    }
    override async handleRun(prevResult, options: NodeDef<Args, 'join'>, scenario: Scenario, branch: string) {
        const branch_name = options.primitive_kwargs.subbranch || options.primitive_kwargs.branch_name;
        if (scenario.branches[branch_name]) {
            await scenario.branches[branch_name];
        }
        return 0;
    }
    onSuccess(result: number, options: NodeDef<Args, 'join'>, scenario: Scenario, branch: string) {
        const branch_name = options.primitive_kwargs.subbranch || options.primitive_kwargs.branch_name;
        if (branch === branch_name) {
            // we can stop to branch now
            return;
        }
        super.onSuccess(result, options, scenario, branch);
    }
}
