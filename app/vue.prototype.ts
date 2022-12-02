import { Device, Screen } from '@nativescript/core/platform';
import VueType from 'nativescript-vue';
import { $t, $tc, $tt, $tu } from '~/helpers/locale';

const filters = (VueType.prototype.$filters = VueType['options'].filters);

const Plugin = {
    install(Vue: typeof VueType) {
        // const apiService = getAPIInstance();
        // applicationOn(exitEvent, () => apiService.stop(), this);
        // apiService.start();
        // Vue.prototype.$apiService = apiService;
        // const bgService = new BgService();
        // Vue.prototype.$bgService = bgService;

        Vue.prototype.$t = $t;
        Vue.prototype.$tc = $tc;
        Vue.prototype.$tt = $tt;
        Vue.prototype.$tu = $tu;

        if (!PRODUCTION) {
            console.log('model', Device.model);
            console.log('os', Device.os);
            console.log('osVersion', Device.osVersion);
            console.log('manufacturer', Device.manufacturer);
            console.log('deviceType', Device.deviceType);
            console.log('widthPixels', Screen.mainScreen.widthPixels);
            console.log('heightPixels', Screen.mainScreen.heightPixels);
            console.log('widthDIPs', Screen.mainScreen.widthDIPs);
            console.log('heightDIPs', Screen.mainScreen.heightDIPs);
            console.log('scale', Screen.mainScreen.scale);
            console.log('ratio', Screen.mainScreen.heightDIPs / Screen.mainScreen.widthDIPs);
        }
    }
};

export default Plugin;
