import { NodesType } from './NodeFactory';
import Scenario, { NodeDef, ScenarioState } from './Scenario';

const STATIC_NODE_CLASSES = [];
export function registerStaticNodeClass(claz) {
    STATIC_NODE_CLASSES.push(claz);
}
export function clearStaticNodeData() {
    STATIC_NODE_CLASSES.forEach((claz) => claz.clearStaticData?.());
}

export default abstract class Node<T = Record<string, any>, U extends NodesType = NodesType, V = number> {
    abstract handleRun(prevResult: { data?; error? } | undefined, options: NodeDef<T, U>, scenario: Scenario, branch: string): Promise<number>;

    // constructor() {}

    // get id() {
    //     return this.options[0];
    // }
    // get args() {
    //     return this.options[1];
    // }
    // get nextSuccess() {
    //     return this.options?.[2]?.[0];
    // }
    // get nextError() {
    //     return this.options?.[2]?.[1];
    // }

    async run(prevResult: { data?; error? } | undefined, options: NodeDef<T, U>, scenario: Scenario, branch: string) {
        try {
            scenario.current = { node: this, options, prevResult };

            if (scenario.state !== ScenarioState.RUNNING) {
                DEV_LOG && console.log('stopping node execution as scenario is stopped');
                return;
            }
            const data = await this.handleRun(prevResult, options, scenario, branch);
            this.onSuccess(data, options, scenario, branch);
        } catch (error) {
            // console.error('run error', error, error.stack);
            this.onError(error, options, scenario, branch);
        }
    }

    createNode(node_id: string, scenario: Scenario) {
        return scenario.createNode(node_id);
    }

    onSuccess(result: number, options: NodeDef<T, U>, scenario: Scenario, branch: string) {
        const node_id = options.next_nodes[result];
        // console.log('Node', 'onSuccess', node_id, result);
        if (node_id) {
            const node = this.createNode(node_id, scenario);
            const options = scenario.getNodeData(node_id);
            node?.run({ data: result }, options, scenario, branch);
        } else {
            // console.log('Node', 'onSuccess', 'about to stop scenario', !!scenario, !!scenario?.scenarioHandler);
            scenario.scenarioHandler.stopScenario();
        }
    }
    onError(error: Error, options: NodeDef<T, U>, scenario: Scenario, branch: string) {
        console.error(options.primitive_name, error, error.stack);
        scenario.scenarioHandler.stopScenario(error, false);
    }
}
