import { on as applicationOn, launchEvent } from '@nativescript/core/application';
import Vue from 'nativescript-vue';
import CrashReportService, { getCrashReportInstance } from './services/CrashReportService';
// importing filters
import FiltersPlugin from './vue.filters';
import MixinsPlugin from './vue.mixins';
// adding to Vue prototype
import PrototypePlugin from './vue.prototype';
import ViewsPlugin from './vue.views';
import Menu from './components/Menu.vue';

const crashReportService = getCrashReportInstance();
applicationOn(launchEvent, () => {
    crashReportService.start();
});

Vue.prototype.$crashReportService = crashReportService;

Vue.use(MixinsPlugin);
Vue.use(ViewsPlugin);
Vue.use(FiltersPlugin);
Vue.use(PrototypePlugin);

// Prints Vue logs when --env.production is *NO T* set while building
Vue.config.silent = true;
Vue.config['debug'] = false;

function throwVueError(err) {
    crashReportService.showError(err);
}

Vue.config.errorHandler = (e, vm, info) => {
    if (e) {
        console.error('[Vue][Error]', `[${info}]`, e, e.stack);
        setTimeout(() => throwVueError(e), 0);
    }
};

Vue.config.warnHandler = function (msg, vm, trace) {
    console.warn('[Vue][Warn]', `[${msg}]`);
    // cwarn(msg, trace);
};

try {
    new Vue({
        render: (h) => h('frame', [h(Menu)])
    }).$start();
} catch (error) {
    console.error(error, error.stack);
}
