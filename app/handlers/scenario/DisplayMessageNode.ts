import { timeout } from '~/utils';
import Node, { registerStaticNodeClass } from './Node';
import Scenario, { NodeDef } from './Scenario';

export interface Args {
    msg?: string;
    title?: string;
    text?: string;
    section?: 'top' | 'middle' | 'bottom';
    countdown?: number;
    pause?: number;
    delay?: number;
    wait_next?: boolean;
}

export default class DisplayMessageNode extends Node<Args> {
    static _instance: DisplayMessageNode;
    static instance() {
        if (!DisplayMessageNode._instance) {
            DisplayMessageNode._instance = new DisplayMessageNode();
            registerStaticNodeClass(DisplayMessageNode);
        }
        return DisplayMessageNode._instance;
    }
    override async handleRun(prevResult, options: NodeDef<Args, 'display_msg' | 'display_clear' | 'display_page'>, scenario: Scenario) {
        const args = options.primitive_kwargs;
        // console.log('DisplayMessage', args);
        scenario.notify({ eventName: 'displayMessage', data: options });

        if (args.pause) {
            await timeout(args.pause * 1000);
        }
        if (args.countdown) {
            await new Promise<number>((resolve, reject) => {
                // console.log('waitNext');
                scenario.notify({ eventName: 'waitCountdown', data: { resolve, reject, countdown: args.countdown } });
            });
        }
        if (args.delay) {
            await timeout(args.delay * 1000);
        }
        if (args.wait_next === true || options.primitive_name === 'display_page') {
            await new Promise<number>((resolve, reject) => {
                // console.log('waitNext');
                scenario.notify({ eventName: 'waitNext', data: { resolve, reject } });
            });
        }
        return 0;
    }
}
