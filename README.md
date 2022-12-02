# TDK CDC

## 1. Quickstart

```bash

  npm install
  ns run ios --env.devlog --env.logins --no-hmr 

```

 It is better to run through vscode terminal as it will setup env variables 
 allowing you to publish the app

## 2. Usage

``` bash
# Install dependencies
npm install

# install cocoapods-acknowledgements
sudo gem install cocoapods-acknowledgements


# Build, watch for changes and debug the application
ns debug <platform> --env.devlog --env.logins --no-hmr

# Build, watch for changes and run the application
ns run <platform> --env.devlog --env.logins --no-hmr

# release to stores
fastlane <platform> alpha
```


## 3. Environment setup

Follow the [NativeScript Full Setup](https://docs.nativescript.org/environment-setup.html#setting-up-your-system) documentation.

As a complement, on Ubuntu:

```bash
sudo usermod -aG plugdev $LOGNAME
sudo apt-get install android-sdk-platform-tools-common
```

I also had to install [Android Studio](https://developer.android.com/studio) to be able to manage my installed Android SDK.

And I needed:

```bash
sudo chgrp -R sudo /usr/local/android/sdk/
sudo chmod -R g+rw /usr/local/android/sdk/
```

As a test:

```bash
# This should result in "No issues were detected"
ns doctor

# With your phone plugged by USB and with dev mode enabled
ns devices android

Connected devices & emulators
Searching for devices...
┌───┬─────────────┬──────────┬───────────────────┬────────┬───────────┬─────────────────┐
│ # │ Device Name │ Platform │ Device Identifier │ Type   │ Status    │ Connection Type │
│ 1 │ daisy       │ Android  │ c1c1da8b9806      │ Device │ Connected │ USB             │
└───┴─────────────┴──────────┴───────────────────┴────────┴───────────┴─────────────────┘
```

Your phone should have status "Connected". If not visible or any other issue, something is not ready!

## 4. Publishing

The Publishing uses [Fastlane](https://fastlane.tools/). Ensure you [installed](https://docs.fastlane.tools/#installing-fastlane) it correctly:
* install `fastlane`
* install plugins with `fastlane install_plugins` in the root project
* Ensure everything is fine with your iOS dev env

The release process is like this:

* bump `versionCode` and (if needed) `versionName` in `App_Resources/android/app.gradle`
* bump `CFBundleVersion` and (if needed) `CFBundleShortVersionString` in `App_Resources/iOS/Info.plist`
* commit the  files changes because fastlane expect a clean git repo
* you can now publish (alpha is for internal testing):
     - iOS : `fastlane ios alpha`
     - Android playstore for beta testing (right now using internal track): `fastlane android alpha`

That's it the process auto generate changelogs, tags based on the conventional commits.