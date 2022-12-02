import Node, { registerStaticNodeClass } from './Node';
import Scenario, { NodeDef } from './Scenario';

export interface Args {
    enable: boolean;
}
export default class ScreenSleepNode extends Node<Args> {
    static _instance: ScreenSleepNode;
    static instance() {
        if (!ScreenSleepNode._instance) {
            ScreenSleepNode._instance = new ScreenSleepNode();
            registerStaticNodeClass(ScreenSleepNode);
        }
        return ScreenSleepNode._instance;
    }
    override async handleRun(prevResult, options: NodeDef<Args, 'disable_screen_sleep'>, scenario: Scenario) {
        const args = options.primitive_kwargs;
        return new Promise<number>((resolve, reject) => {
            scenario.notify({ eventName: 'screenSleep', data: { args, resolve, reject } });
        }).then((r) => 0);
    }
}
