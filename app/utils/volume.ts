import { Application } from '@nativescript/core';

export function getNotificationsVolumeLevel() {
    if (__ANDROID__) {
        const AudioManager = android.media.AudioManager;
        const ctx = Application.android.context as android.content.Context;
        const audioManager = ctx.getSystemService(android.content.Context.AUDIO_SERVICE) as android.media.AudioManager;
        const musicVolumeLevel = audioManager.getStreamVolume(AudioManager.STREAM_NOTIFICATION);
        const musicVolumeMax = audioManager.getStreamMaxVolume(AudioManager.STREAM_NOTIFICATION);
        return Math.round(musicVolumeLevel / musicVolumeMax);
    }
    if (__IOS__) {
        //@ts-ignore
        AVAudioSession.sharedInstance().setActiveError(true);
        //@ts-ignore
        const vol = AVAudioSession.sharedInstance().outputVolume;
        //@ts-ignore
        AVAudioSession.sharedInstance().setActiveError(false);
        return Math.round(vol);
    }
}

export function setNotificationsVolumeLevel(audioVol: number) {
    if (__ANDROID__) {
        const AudioManager = android.media.AudioManager;
        const ctx = Application.android.context as android.content.Context;
        const audioManager = ctx.getSystemService(android.content.Context.AUDIO_SERVICE) as android.media.AudioManager;
        const musicVolumeMax = audioManager.getStreamMaxVolume(AudioManager.STREAM_NOTIFICATION);
        const volumeIndex = Math.round(audioVol * musicVolumeMax);
        DEV_LOG && console.log('setNotificationsVolumeLevel', musicVolumeMax, audioVol, volumeIndex);
        audioManager.setStreamVolume(AudioManager.STREAM_NOTIFICATION, volumeIndex, 0);
    }
    if (__IOS__) {
        //@ts-ignore
        const volumeView = MPVolumeView.alloc().init();
        for (let i = 0; i < volumeView.subviews.count; i++) {
            //@ts-ignore
            if (volumeView.subviews[i] instanceof UISlider) {
                //@ts-ignore
                const volSlider = volumeView.subviews[i] as unknown as UISlider;
                setTimeout(() => (volSlider.value = audioVol), 500);
                break;
            }
        }
    }
}
