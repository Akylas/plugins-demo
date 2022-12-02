import { timeout } from '~/utils';
import Node, { registerStaticNodeClass } from './Node';
import Scenario, { NodeDef } from './Scenario';

export interface Args {
    event_name?: string;
    event_names?: string[];
    timeout?: number;
}

interface EventData {
    promise: Promise<number>;
    resolve: Function;
    resolved: boolean;
}
export default class EventNode extends Node<Args> {
    static _instance: EventNode;
    static instance() {
        if (!EventNode._instance) {
            EventNode._instance = new EventNode();
            registerStaticNodeClass(EventNode);
        }
        return EventNode._instance;
    }
    static events: { [k: string]: EventData } = {};
    static clearStaticData() {
        EventNode.events = {};
    }
    override async handleRun(prevResult, options: NodeDef<Args, 'event_create' | 'event_set' | 'event_reset' | 'event_wait' | 'event_wait_all'>, scenario: Scenario) {
        const args = options.primitive_kwargs;
        switch (options.primitive_name) {
            case 'event_create': {
                if (!EventNode.events[args.event_name]) {
                    const eventData: EventData = { resolved: false } as any;
                    eventData.promise = new Promise((resolve) => {
                        eventData.resolve = (arg) => {
                            EventNode.events[args.event_name].resolved = true;
                            resolve(arg);
                        };
                    });
                    EventNode.events[args.event_name] = eventData;
                }
                break;
            }
            case 'event_set': {
                if (EventNode.events[args.event_name]) {
                    EventNode.events[args.event_name].resolve(0);
                }
                break;
            }
            case 'event_reset': {
                if (EventNode.events[args.event_name]) {
                    const eventData: EventData = { resolved: false } as any;
                    eventData.promise = new Promise((resolve) => {
                        eventData.resolve = (arg) => {
                            if (!EventNode.events[args.event_name].resolved) {
                                EventNode.events[args.event_name].resolved = true;
                                resolve(arg);
                            }
                        };
                    });
                    EventNode.events[args.event_name] = eventData;
                }
                break;
            }
            case 'event_wait': {
                const events = (args.event_name ? [args.event_name] : args.event_names).map((e) => EventNode.events[e]).filter((e) => !!e);
                if (args.timeout === 0) {
                    if (events.every((s) => s.resolved === true)) {
                        return 0;
                    }
                    return 1;
                }
                const promises = events.map((e) => e.promise);
                if (args.timeout > 0) {
                    promises.push(timeout(args.timeout * 1000, 1));
                }
                return Promise.any(promises);
            }
            case 'event_wait_all': {
                const promises = (args.event_name ? [args.event_name] : args.event_names)
                    .map((e) => EventNode.events[e])
                    .filter((e) => !!e)
                    .map((e) => e.promise);
                if (args.timeout > 0) {
                    return Promise.any([Promise.all(promises).then((r) => 0), timeout(args.timeout * 1000, 1)]);
                } else {
                    return Promise.all(promises).then((r) => 0);
                }
            }
        }
        return 0;
    }
}
