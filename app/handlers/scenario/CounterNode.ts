import Node, { registerStaticNodeClass } from './Node';
import { NodeDef } from './Scenario';

export interface Args {
    name: string;
    value?: number;
}
export default class CounterNode extends Node<Args> {
    static _instance: CounterNode;
    static instance() {
        if (!CounterNode._instance) {
            CounterNode._instance = new CounterNode();
            registerStaticNodeClass(CounterNode);
        }
        return CounterNode._instance;
    }
    static counters = {};
    static clearStaticData() {
        CounterNode.counters = {};
    }
    override async handleRun(prevResult, options: NodeDef<Args, 'counter_cmp' | 'counter_dec' | 'counter_equ' | 'counter_inc' | 'counter_set'>, scenario) {
        const args = options.primitive_kwargs;
        // console.log('CounterNode', options, CounterNode.counters);
        switch (options.primitive_name) {
            case 'counter_set':
                CounterNode.counters[args.name] = args.value;
                break;
            case 'counter_inc':
                CounterNode.counters[args.name] = (CounterNode.counters[args.name] || 0) + 1;
                break;
            case 'counter_dec':
                CounterNode.counters[args.name] = (CounterNode.counters[args.name] || 0) - 1;
                break;
            case 'counter_equ': {
                const current = CounterNode.counters[args.name];
                const expected = args.value;
                return current === expected ? 0 : 1;
            }
            case 'counter_cmp': {
                const current = CounterNode.counters[args.name];
                const expected = args.value;
                return current === expected ? 0 : current < expected ? 1 : 2;
            }
        }
        return 0;
    }
}
