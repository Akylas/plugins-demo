import { installMixins as installUIMixins } from '@nativescript-community/systemui';
installUIMixins();
import { Label as HTMLLabel } from '@nativescript-community/ui-label'; // require first to get Font res loading override
import { overrideSpanAndFormattedString } from '@nativescript-community/text'; // require first to get Font res loading override
overrideSpanAndFormattedString();
import CanvasPlugin from '@nativescript-community/ui-canvas/vue';
import CollectionViewPlugin from '@nativescript-community/ui-collectionview/vue';
import { ScrollView } from '@nativescript/core';
import type IVue from 'nativescript-vue';

class NestedScrollView extends ScrollView {
    createNativeView() {
        if (__ANDROID__) {
            const view = new androidx.core.widget.NestedScrollView(this._context);
            return view;
        }
        return super.createNativeView();
    }
}

const Plugin = {
    install(Vue: typeof IVue) {

        Vue.use(CanvasPlugin);
        Vue.use(CollectionViewPlugin);

        Vue.registerElement('Label', () => HTMLLabel);
        Vue.registerElement('NestedScrollView', () => NestedScrollView);
    }
};

export default Plugin;
