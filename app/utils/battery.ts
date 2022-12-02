import { Application } from '@nativescript/core';

export function getBatteryInfo() {
    if (__ANDROID__) {
        const BM = android.os.BatteryManager;
        const iFilter = new android.content.IntentFilter(android.content.Intent.ACTION_BATTERY_CHANGED);
        const ctx = Application.android.context as android.content.Context;
        const batteryStatus = ctx.registerReceiver(null, iFilter);
        const level = batteryStatus.getIntExtra(BM.EXTRA_LEVEL, -1);
        const scale = batteryStatus.getIntExtra(BM.EXTRA_SCALE, -1);
        const chargingStatus = batteryStatus.getIntExtra(BM.EXTRA_STATUS, -1);
        return {
            charging: chargingStatus === BM.BATTERY_STATUS_CHARGING,
            level: (level * 100) / scale
        };
    }
    if (__IOS__) {
        //@ts-ignore
        UIDevice.currentDevice.batteryMonitoringEnabled = true;
        //@ts-ignore
        const level = UIDevice.currentDevice.batteryLevel * 100;
        //@ts-ignore
        const batteryStatus = UIDevice.currentDevice.batteryState;
        //@ts-ignore
        UIDevice.currentDevice.batteryMonitoringEnabled = false;
        return {
            //@ts-ignore
            charging: batteryStatus === UIDeviceBatteryState.Charging,
            level
        };
    }
}
