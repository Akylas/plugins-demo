import { AndroidActivityCallbacks, setActivityCallbacks } from '@nativescript/core/ui/frame';

@JavaProxy('__PACKAGE_NAME__.MainActivity')
export default class Activity extends androidx.fragment.app.FragmentActivity {
    private _callbacks: AndroidActivityCallbacks;
    private _ambientController: any;
    _ambientCallback: any;

    public onCreate(savedInstanceState /*: android.os.Bundle*/): void {
        if (!this._callbacks) {
            setActivityCallbacks(this);
        }

        this._callbacks.onCreate(this, savedInstanceState, this.getIntent(), super.onCreate);

        this._ambientController = (android.support as any).wear.ambient.AmbientModeSupport.attach(this);
    }

    public onSaveInstanceState(outState): void {
        this._callbacks.onSaveInstanceState(this, outState, super.onSaveInstanceState);
    }
    public onStart(): void {
        this._callbacks.onStart(this, super.onStart);
    }

    public onStop(): void {
        this._callbacks.onStop(this, super.onStop);
    }

    public onDestroy(): void {
        this._callbacks.onDestroy(this, super.onDestroy);
    }

    public onBackPressed(): void {
        this._callbacks.onBackPressed(this, super.onBackPressed);
    }
    public onRequestPermissionsResult(requestCode, permissions, grantResults) {
        this._callbacks.onRequestPermissionsResult(this, requestCode, permissions, grantResults, undefined);
    }
    public onActivityResult(requestCode, resultCode, data) {
        this._callbacks.onActivityResult(this, requestCode, resultCode, data, super.onActivityResult);
    }

    public getAmbientCallback() {
        if (!this._ambientCallback) {
            this._ambientCallback = new (android.support as any).wear.ambient.AmbientModeSupport.AmbientCallback({
                onEnterAmbient(ambientDetails) {
                    DEV_LOG && console.log('Entering ambient mode');
                },

                onExitAmbient() {
                    DEV_LOG && console.log('Exiting ambient mode');
                },

                onUpdateAmbient() {
                    DEV_LOG && console.log('update ambient mode');
                }
            });
        }
        return this._ambientCallback;
    }
}
