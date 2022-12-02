// import { getBoolean, getNumber, getString, remove, setBoolean, setNumber, setString } from '@nativescript/core/application-settings';
import { Observable } from '@nativescript/core/data/observable';
import { BiometricAuth, ERROR_CODES } from '@nativescript/biometrics';
import { booleanProperty, stringProperty } from './BackendService';
import NativeScriptVue from 'nativescript-vue';
import PasscodeWindow from '~/components/PasscodeWindow.vue';

export interface PasscodeWindowOptions {
    creation?: boolean;
    change?: boolean;
    closeOnBack?: boolean;
    allowClose?: boolean;
    storePassword?: string;
}

/**
 * Parent service class. Has common configs and methods.
 */
export default class SecurityService extends Observable {
    private biometricAuth = new BiometricAuth();
    @stringProperty storedPassword: string;
    @booleanProperty biometricEnabled: boolean;
    @booleanProperty autoLockEnabled: boolean;
    async biometricsAvailable() {
        return this.biometricAuth.available().then((r) => r.biometrics || r.touch || r.face);
    }
    clear() {
        this.storedPassword = null;
        this.autoLockEnabled = false;
        this.biometricEnabled = false;
    }
    passcodeSet() {
        return !!this.storedPassword;
    }
    createPasscode(parent: NativeScriptVue) {
        return this.showPasscodeWindow(parent, {
            creation: true
        }).then((r) => {
            this.storedPassword = r.passcode;
        });
    }
    changePasscode(parent: NativeScriptVue) {
        return this.showPasscodeWindow(parent, {
            storePassword: this.storedPassword,
            change: true
        }).then((r) => {
            if (this.storedPassword === r.oldPasscode) {
                this.storedPassword = r.passcode;
                return true;
            }
            return false;
        });
    }
    showingPasscodeWindow = false;
    async showPasscodeWindow(parent: NativeScriptVue, options?: PasscodeWindowOptions) {
        if (this.showingPasscodeWindow) {
            return;
        }
        try {
            this.showingPasscodeWindow = true;
            return (await parent.$showModal(PasscodeWindow, {
                fullscreen: true,
                animated: true,
                props: options
            })) as Promise<{ passcode: string; oldPasscode?: string }>;
        } catch (error) {
            throw error;
        } finally {
            this.showingPasscodeWindow = false;
        }
    }
    shouldReAuth() {
        if (this.biometricEnabled !== true) {
            return Promise.resolve(false);
        }
        return this.biometricAuth.didBiometricDatabaseChange().then((changed) => !changed);
    }
    validateSecurity(parent: NativeScriptVue, options?: PasscodeWindowOptions) {
        if (this.biometricEnabled) {
            return this.verifyFingerprint();
        } else {
            return this.showPasscodeWindow(parent, { storePassword: this.storedPassword, allowClose: false, ...options }).then((r) => r && this.storedPassword === r.passcode);
        }
    }
    verifyFingerprint() {
        return this.biometricAuth.verifyBiometric({}).then((result) => result.code === ERROR_CODES.SUCCESS);
    }
}
