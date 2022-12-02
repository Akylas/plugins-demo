import { calculateMD5 } from '@nativescript-community/md5';
import { request } from '@nativescript-community/perms';
import { isSensorAvailable } from '@nativescript-community/sensors';
import { Session, Task, session } from '@nativescript/background-http';
import { Application, ApplicationSettings, Device, EventData, File, Folder, ImageAsset, ImageSource, Observable, ObservableArray } from '@nativescript/core';
import { getBoolean, setBoolean } from '@nativescript/core/application-settings';
import { dismissSoftInput } from '@nativescript/core/utils';
import dayjs from 'dayjs';
import Scenario, { IScenario, ScenarioInfo } from '~/handlers/scenario/Scenario';
import { $tc, getLocaleDisplayName } from '~/helpers/locale';
import { pickDate } from '~/utils';
import { NOTIFICATION_CHANEL_ID_UPLOAD_CHANNEL } from './android/NotifcationHelper';
import { numberProperty, objectProperty, stringProperty } from './BackendService';
import CrashReportService, { HTTPError, getCrashReportInstance } from './CrashReportService';
import { HttpRequestOptions, NetworkService } from './NetworkService';
import { on as applicationOn, launchEvent } from '@nativescript/core/application';
import { showSnack } from '@nativescript-community/ui-material-snackbar';
import * as perms from '@nativescript-community/perms';
import { showError } from '~/utils/utils';
import { NotificationHandler } from './android/NotificationHandler';
import { isSimulator } from '@nativescript-community/extendedinfo';

export const LoggedinEvent = 'loggedin';
export const LoggedoutEvent = 'loggedout';
export const CurrentProfileEvent = 'currentProfile';
export const UserProfileEvent = 'userprofile';

function getCacheControl(maxAge = 60, stale = 59) {
    return `max-age=${maxAge}, max-stale=${stale}, stale-while-revalidate=${stale}`;
}

export interface LoginParams {
    email: string;
    password: string;
}

interface HTTPResult {
    status: boolean;
    detail?: string;
}

export interface UserProfile {
    active: boolean;
    authenticated: boolean;
    confirmed_at?: any;
    roles: string[];
    username: string;
    userPlus: boolean;
}

interface TokenUserRequestResult {
    authentication_token: string;
}

interface TokenRequestResult {
    csrf_token: string;
    user: TokenUserRequestResult;
}

export interface UserProfileEventData extends EventData {
    data: UserProfile;
}

export interface Profile {
    firstname: string;
    lastname: string;
    gender: string;
    date_of_birth: string;
    height?: string;
    handedness?: string;
    first_language: string;
    secondary_languages?: string;
    accent_in_english?: string;
}

export interface ProfileData {
    profile_id: number;
    profile_info: Profile;
}

export interface Sensor {
    name: string;
    type: string;
    manufacturer: string;
    model: string;
    max_odr: number;
    min_odr: number;
    scaling: number;
    fsr: number[];
}
export type SensorDeviceTypes = 'mobile_phone' | 'esp32_logger';
export interface MobileSensorDevice {
    sensor_device_type: 'mobile_phone';
    sensors_list: Sensor[];
    sensor_device_custom_name: string;
    device_uuid: string;
    phone_uuid: string;
    manufacturer: string;
    model: string;
    os_type: string;
    os_version: string;
    sdk_version: string;
    form_factor?: string;
}
export interface ESPDevice {
    sensor_device_type: 'esp32_logger';
    device_uuid: string;
    phone_uuid: string;
    sensors_list: Sensor[];
    serial_number?: string;
    sensor_device_custom_name?: string;
    mac_address?: string;
    fw_info?: string;
}

export interface ListDatacollectionItem {
    data_collection_id: number;
    data_collection_info: Datacollection;
    scenario_ids: number[];
}
export interface ListDatacollections {
    data_collections: ListDatacollectionItem[];
}

export interface Datacollection {
    data_collection_id: number;
    title: string;
    description: string;
    hashtags: string[];
    creation_datetime: string;
    status: string;
    priority: number;
}

export interface DataCollectionScenario {
    scenario_id: number;
    executed: boolean;
    scenario_info: {
        data_collection_id: number;
        creation_datetime: string;
        end_valid_date: string;
        title: string;
        description: string;
        status: string;
        priority: number;
        required_diskspace: number;
        targeted_profile: Targetedprofile;
        required_sensor_devices: Requiredsensordevice[];
        exclusive_scenario_set: number[];
    };
}

interface Requiredsensordevice {
    sensor_device_type: string;
    required_sensors: string[];
}

interface Targetedprofile {
    gender: string[];
    handedness: any[];
    age_min: number;
    age_max: number;
    height_min: number;
    height_max: number;
    spoken_languages: string[];
}

interface UploadAcquisitionResult {
    exchange_id: number;
    exchange_status: Exchangestatus;
}

interface Exchangestatus {
    complete: boolean;
    finalized: boolean;
    files_status: Filesstatus[];
}

interface Filesstatus {
    received_size: number;
    complete: boolean;
    valid: boolean;
    md5: string;
}

interface UploadAcquisitionData {
    acquisition_id: number;
    exchange_id?: number;
    files: AcquisitionFile[];
}

export interface SavedAcquisitionData extends Partial<UploadAcquisitionData>, Acquisitioninfo {
    uploading?: boolean;
    acquisition_id?: number;
    exchange_id?: number;
    files: SavedAcquisitionFile[];
    uploadResult?: UploadAcquisitionResult;
    progress: number;
    scenario_id: number;
    scenario_info: ScenarioInfo;
    can_be_removed?: boolean; // only for local testing to prevent removing files on success upload
    data_path: string;
}

interface AcquisitionFile {
    name: string;
    size: number;
    md5: string;
    part_number?: any;
}

interface SavedAcquisitionFile extends AcquisitionFile {
    filePath: string;
}

interface AddAcquisitionData {
    acquisition_info: Acquisitioninfo;
}

interface Acquisitioninfo {
    acquisition_id?: number;
    scenario_id: number;
    data_collection_id: number;
    profile_id: number;
    status: 'completed' | 'aborted';
    start_datetime: string;
    end_datetime: string;
    upload_datetime?: any;
    abort_reason?: any;
}

interface Acquisitions {
    acquisitions: Acquisition[];
}

export interface Acquisition {
    acquisition_id: number;
    scenario_id: number;
    data_collection_id: number;
    status: 'completed' | 'aborted';
    profile_id: number;
    start_datetime: string;
    end_datetime: string;
    upload_datetime?: any;
    abort_reason?: any;
}

export type SensorDevice = MobileSensorDevice | ESPDevice;

const currentYear = dayjs().get('year');
const years = [...Array(100)].map((v, i) => ({ title: currentYear - i + '', id: currentYear - i }));
const languages = Object.keys(require('~/languages'))
    // .sort()
    .map((s) => ({ id: s, title: getLocaleDisplayName(s) }));
export const getProfileSettings = () => [
    { id: 'firstname', required: true, name: $tc('firstname') },
    {
        id: 'gender',
        required: true,
        values: [
            { id: 'male', title: $tc('male') },
            { id: 'female', title: $tc('female') }
        ],
        name: $tc('gender')
    },
    {
        id: 'date_of_birth',
        required: true,
        values: years,
        name: $tc('year_of_birth'),
        currentOption: years[40],
        formatBack: (s) => `${s}-01-01`
    },
    { id: 'height', formatBack: parseFloat, name: $tc('height'), keyboardType: 'number' },
    {
        id: 'handedness',
        values: [
            { id: 'left-handed', title: $tc('left_handed') },
            { id: 'right-handed', title: $tc('right_handed') },
            { id: 'ambidextrous', title: $tc('ambidextrous') }
        ],
        name: $tc('handedness')
    },
    {
        id: 'first_language',
        values: languages,
        required: true,
        name: $tc('first_language'),
        format: (v) => (Array.isArray(v) ? v.map(getLocaleDisplayName) : getLocaleDisplayName(v))
    },
    {
        id: 'secondary_languages',
        values: languages,
        required: false,
        format: (v) => (Array.isArray(v) ? v.map(getLocaleDisplayName) : getLocaleDisplayName(v)),
        name: $tc('secondary_languages'),
        type: 'array',
        currentValue: []
    },
    { id: 'accent_in_english', name: $tc('accent_in_english') }
];
function getImageData(asset: ImageAsset | ImageSource): Promise<any> {
    return new Promise((resolve, reject) => {
        if (asset instanceof ImageAsset) {
            asset.getImageAsync((image, error) => {
                if (error) {
                    return reject(error);
                }
                let imageData: any;
                if (image) {
                    if (__IOS__) {
                        // @ts-ignore
                        imageData = UIImagePNGRepresentation(image);
                    } else {
                        const bitmap: android.graphics.Bitmap = image;
                        const stream = new java.io.ByteArrayOutputStream();
                        bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, stream);
                        const byteArray = stream.toByteArray();
                        bitmap.recycle();

                        imageData = byteArray;
                    }
                }
                resolve(imageData);
            });
        } else {
            let imageData: any;
            if (__IOS__) {
                // @ts-ignore
                imageData = UIImagePNGRepresentation(asset.ios);
            } else {
                // can be one of these overloads https://square.github.io/okhttp/3.x/okhttp/okhttp3/RequestBody.html
                const bitmapImage: android.graphics.Bitmap = asset.android;
                const stream = new java.io.ByteArrayOutputStream();
                bitmapImage.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, stream);
                const byteArray = stream.toByteArray();
                bitmapImage.recycle();

                imageData = byteArray;
            }
            resolve(imageData);
        }
    });
}

function getFormData(actualData, prefix?: string) {
    return Promise.all(
        Object.keys(actualData).map(async (k) => {
            const value = actualData[k];
            if (!!value) {
                if (value instanceof ImageAsset || value instanceof ImageSource) {
                    return getImageData(value).then((data) => ({
                        data,
                        contentType: 'image/png',
                        fileName: 'image.png',
                        parameterName: prefix ? `${prefix}[${k}]` : k
                    }));
                } else if (typeof value === 'object') {
                    if (value.parameterName) {
                        return value;
                    }
                    return getFormData(value, `${prefix || ''}[${k}]`);
                } else {
                    return {
                        data: value.toString(),
                        parameterName: prefix ? `${prefix}[${k}]` : k
                    };
                }
            }

            return Promise.resolve(null);
        })
    ).then((result) => result.flat().filter((f) => f !== null));
}

applicationOn(launchEvent, () => {
    APIService.device_uuid = __IOS__ ? UIDevice.currentDevice.identifierForVendor.UUIDString : Device.uuid;
});

export default class APIService extends NetworkService {
    @objectProperty tokenData: TokenRequestResult;
    @objectProperty userInfo: UserProfile;
    @stringProperty pushToken: string;
    @numberProperty current_profile_id: number;
    @objectProperty current_profile_info: Profile;
    mApiUrl = ApplicationSettings.getString('api_url', API_DEV_URL);
    crashReportService: CrashReportService = getCrashReportInstance();

    static device_uuid: string;

    //@ts-ignore
    set apiUrl(value: string) {
        this.mApiUrl = value;
        ApplicationSettings.setString('api_url', value);
    }
    get apiUrl() {
        return this.mApiUrl;
    }
    isLoggedIn() {
        return !!this.tokenData;
    }
    isUserPlus() {
        return this.userInfo?.userPlus;
    }

    async onConnectionChanged(value: boolean) {
        super.onConnectionChanged(value);
        if (value) {
            try {
                await getUploaderInstance().uploadAcquisitions();
            } catch (error) {
                console.log('upload error', error);
                showError(error);
            }
        } else {
            getUploaderInstance().stopAll();
        }
    }

    // onConnectionChanged(value: boolean) {
    //     super.onConnectionChanged(value);
    //     if (this.isLoggedIn()) {
    //         this.getUserProfile();
    //     }
    // }

    setCurrentProfile({ profile_id, profile_info }: ProfileData) {
        this.current_profile_id = profile_id;
        this.current_profile_info = profile_info;
        DEV_LOG && console.log('setCurrentProfile', { profile_id, profile_info });
        this.notify({
            eventName: CurrentProfileEvent,
            object: this,
            data: { profile_id, profile_info }
        });
    }
    clearCurrentProfile() {
        DEV_LOG && console.log('clearCurrentProfile');
        this.current_profile_id = null;
        this.current_profile_info = null;
        this.notify({
            eventName: CurrentProfileEvent,
            object: this,
            data: { profile_id: null, profile_info: null }
        });
    }

    async getRequestHeaders(requestParams?: HttpRequestOptions) {
        // if (requestParams.noToken !== false && this.tokenData) {
        //     requestParams.queryParams = requestParams.queryParams || {};
        //     requestParams.queryParams['auth_token'] = this.tokenData.user.authentication_token;
        //     console.log('getRequestHeaders', requestParams, this.tokenData);
        // }
        const headers = await super.getRequestHeaders(requestParams);
        if (requestParams.noToken !== false && this.tokenData) {
            headers['Authentication-Token'] = apiService.tokenData.user.authentication_token;
        }
        // if (!headers['Cache-Control'])
        return headers;
    }

    async registerPushToken(pushToken: string) {
        this.pushToken = pushToken;
        // return this.request<{ validation_url: string }>({
        //     apiPath: '/mobile/token-subscription',
        //     method: 'POST',
        //     body: {
        //         action: 'POST',
        //         platform: NS_PLATFORM,
        //         device_token: pushToken
        //     }
        // });
    }
    async unregisterPushToken() {
        if (this.pushToken) {
            const token = this.pushToken;
            this.pushToken = undefined;
            // return this.request<{ validation_url: string }>({
            //     apiPath: '/mobile/token-subscription',
            //     method: 'POST',
            //     body: {
            //         action: 'DELETE',
            //         platform: NS_PLATFORM,
            //         device_token: token
            //     }
            // });
        }
    }

    async handleRequestRetry(requestParams: HttpRequestOptions, retry = 0) {
        if (requestParams.canRetry === false || retry === 2) {
            this.logout();
            throw new HTTPError({
                statusCode: 401,
                message: 'not_authorized',
                requestParams
            });
        }
        await this.getRefreshToken();
        return this.request(requestParams, retry + 1);
    }
    async getUserProfile() {
        const profile = (
            await this.request<{ user: UserProfile }>({
                apiPath: '/user_info',
                method: 'GET'
            })
        ).user;
        if (!profile) {
            return null;
        }
        if (!this.userInfo || JSON.stringify(this.userInfo) !== JSON.stringify(profile)) {
            // only send update if profile actually changed
            this.userInfo = { ...profile, userPlus: profile.roles.indexOf('user_plus') !== -1 };
            this.notify({
                eventName: UserProfileEvent,
                object: this,
                data: profile
            } as UserProfileEventData);
        }
        return profile;
    }

    async getToken(csrf_token: string, user: LoginParams, options: Partial<HttpRequestOptions> = {}) {
        try {
            const result = await this.request<TokenRequestResult & UserProfile>({
                apiPath: '/login?include_auth_token',
                canRetry: false,
                method: 'POST',
                noToken: true,
                headers: {
                    'Cache-Control': 'no-cache'
                },
                // cookiesEnabled: false,
                body: {
                    email: user.email,
                    password: user.password,
                    csrf_token
                },
                ...options
            });
            this.tokenData = result;
        } catch (err) {
            this.tokenData = null;
            return Promise.reject(err);
        }
    }
    isRefreshing = false;
    async getRefreshToken() {
        if (this.isRefreshing) {
            return new Promise((resolve, reject) => {
                this.once('tokenRefreshed', resolve);
                this.once('tokenRefreshError', reject);
            });
        }
        this.isRefreshing = true;
        try {
            DEV_LOG && console.log('getRefreshToken', this.tokenData);
            const result = await this.request<TokenUserRequestResult>({
                apiPath: '/refresh_auth_token',
                method: 'POST',
                canRetry: false
            });
            this.tokenData.user = result;
            this.notify({ eventName: 'tokenRefreshed' });
            return result;
        } catch (err) {
            this.logout();
            this.notify({ eventName: 'tokenRefreshError' });
            throw new HTTPError({
                statusCode: 401,
                message: 'not_authorized'
            });
        } finally {
            this.isRefreshing = false;
        }
    }

    async getDeviceSensor() {
        const sensors_list = [];
        if ((!PRODUCTION && isSimulator()) || isSensorAvailable('accelerometer')) {
            sensors_list.push({
                type: 'generic.acc',
                name: 'acc0',
                manufacturer: Device.manufacturer
            });
        }
        if ((!PRODUCTION && isSimulator()) || isSensorAvailable('gyroscope')) {
            sensors_list.push({
                type: 'generic.gyr',
                name: 'gyr0',
                manufacturer: Device.manufacturer
            });
        }
        sensors_list.push({
            type: 'generic.mic',
            name: 'mic0',
            manufacturer: Device.manufacturer
        });
        // to get BluetoothAdapter we need BLUETOOTH_CONNECT permission
        if (__ANDROID__) {
            await perms.request('bluetoothConnect');
        }
        return {
            sensor_device_type: 'mobile_phone' as SensorDeviceTypes,
            manufacturer: Device.manufacturer,
            model: Device.model,
            sensor_device_custom_name: __IOS__ ? UIDevice.currentDevice.name : android.bluetooth.BluetoothAdapter.getDefaultAdapter()?.getName(),
            device_uuid: APIService.device_uuid,
            phone_uuid: APIService.device_uuid,
            os_version: Device.osVersion,
            sdk_version: Device.sdkVersion,
            os_type: gVars.platform,
            sensors_list
        };
    }

    async handleLoggedin() {
        DEV_LOG && console.log('handleLoggedin');
        await this.getUserProfile();
        await this.addSensorDevice(await this.getDeviceSensor(), true);
        // await this.getRemoteConfig();
        this.notify({
            eventName: LoggedinEvent,
            object: this,
            data: this.userInfo
        });
        this.crashReportService.setExtra('profile', JSON.stringify(this.userInfo));
    }
    async getCsrfToken() {
        return (
            await this.request({
                apiPath: '/login',
                noToken: true,
                headers: {
                    'Cache-Control': 'no-cache'
                }
            })
        ).csrf_token;
    }
    async login(user: LoginParams, options: Partial<HttpRequestOptions> = {}) {
        if (!user) {
            throw new Error('missing_login_params');
        }
        try {
            const csrf_token = await this.getCsrfToken();
            DEV_LOG && console.log('csrf_token', csrf_token);
            await this.getToken(csrf_token, user, options);
            await this.handleLoggedin();
        } catch (err) {
            this.onLoggedOut();
            return Promise.reject(err);
        }
    }
    async register({ email, password }) {
        const csrf_token = await this.getCsrfToken();
        return this.request({
            apiPath: '/register',
            method: 'POST',
            body: {
                email: email.trim(),
                password,
                csrf_token
            }
        });
    }

    onLoggedOut() {
        DEV_LOG && console.log('onLoggedOut', this.tokenData, this.userInfo);
        dismissSoftInput();
        // if (this.tokenData) {
        this.tokenData = null;
        this.userInfo = null;
        this.pushToken = null;
        this.clearCurrentProfile();
        this.notify({
            eventName: LoggedoutEvent,
            object: this
        });
        // }
        this.crashReportService.setExtra('profile', null);
    }

    async logout() {
        await this.request({
            apiPath: '/logout',
            method: 'GET'
        });
        this.onLoggedOut();
    }
    async callJSONRPC<T = any>(method: string, params?) {
        return (
            await this.request<{ result: T }>({
                apiPath: '/api',
                method: 'POST',
                body: {
                    jsonrpc: '2.0',
                    id: 0,
                    method,
                    params
                }
            })
        ).result;
    }
    async listProfile() {
        return (await this.callJSONRPC<{ profiles: ProfileData[] }>('list_profile')).profiles;
    }
    async getProfile(profile_id: number) {
        return (
            await this.callJSONRPC<{ profile_info: Profile }>('get_profile', {
                profile_id
            })
        ).profile_info;
    }
    async updateProfile(profile_id: number, data: Partial<Profile>) {
        return this.callJSONRPC('update_profile', {
            profile_id,
            profile_info: data
        });
    }
    async addProfile(data: Partial<Profile>) {
        return this.callJSONRPC<{ profile_id: number }>('add_profile', {
            profile_info: data
        });
    }
    async listSensorDevices() {
        return (await this.callJSONRPC<{ sensor_devices: { sensor_device_id: number; sensor_device_info: SensorDevice }[] }>('list_sensor_device')).sensor_devices;
    }
    async updateSensorDevice(id: number, data: Partial<SensorDevice>) {
        return this.callJSONRPC('update_sensor_device', {
            sensor_device_id: id,
            sensor_device_info: data
        });
    }
    async addSensorDevice(data: SensorDevice, reuse = false) {
        return this.callJSONRPC<{ sensor_device_id: number }>('add_sensor_device', {
            reuse_device_uuid: reuse,
            sensor_device_info: data
        });
    }

    async listDataCollections(profile_id: number, filter_executed = PRODUCTION) {
        return (
            await this.callJSONRPC<ListDatacollections>('list_data_collection', {
                profile_id,
                filter_executed,
                phone_or_device_uuids: [APIService.device_uuid]
            })
        ).data_collections;
    }
    async getDataCollectionInfo(profile_id: number, data_collection_id: number, filter_executed = PRODUCTION) {
        return this.callJSONRPC<{
            data_collection_id: string;
            data_collection_info: Datacollection;
            scenario_ids: number[];
            scenarios: DataCollectionScenario[];
        }>('list_data_collection_scenario', {
            profile_id,
            filter_executed,
            data_collection_id
        });
    }
    async getScenarioContent(scenario_id: number) {
        return this.callJSONRPC<IScenario>('get_scenario_content', {
            scenario_id
        });
    }

    async listAcquisitions() {
        return (
            await this.callJSONRPC<Acquisitions>('list_acquisition', {
                profile_id: this.current_profile_id
            })
        ).acquisitions;
    }

    async addAcquisition(args: AddAcquisitionData) {
        return this.callJSONRPC<{ acquisition_id: number }>('add_acquisition', { acquisition_info: { acquisition_id: null, abort_reason: null, upload_datetime: null, ...args.acquisition_info } });
    }
    async uploadAcquisition(args: UploadAcquisitionData) {
        return this.callJSONRPC<UploadAcquisitionResult>('upload_acquisition', args);
    }
    async getUploadAcquisitionStatus(args: { exchange_id: number }) {
        return this.callJSONRPC<UploadAcquisitionResult>('upload_acquisition_status', args);
    }
}

export interface UploadingItem {
    session: Session;
    task?: Task;
    data: SavedAcquisitionData;
    uploadResult: UploadAcquisitionResult;
}
export class AcquisitionUploader extends Observable {
    acquisitions: ObservableArray<SavedAcquisitionData>;
    constructor() {
        super();
        DEV_LOG && console.log('AcquisitionUploader', TEST_UPLOAD_PATH);
        this.acquisitions = new ObservableArray(
            JSON.parse(ApplicationSettings.getString('toUploadAcquisitions', '[]'))
            // .map((s) => {
            //     const { uploading, ...toSave } = s;
            //     return toSave;
            // })
        );
        if (TEST_UPLOAD_PATH && Folder.exists(TEST_UPLOAD_PATH)) {
            DEV_LOG && console.log('AcquisitionUploader2', TEST_UPLOAD_PATH);
            (async () => {
                await request('storage');
                const folder = Folder.fromPath(TEST_UPLOAD_PATH);
                const files = folder.getEntitiesSync();
                const toAdd = {
                    progress: 0,
                    start_datetime: dayjs().subtract(1, 'h').toISOString(),
                    end_datetime: dayjs().toISOString(),
                    data_collection_id: 1,
                    profile_id: apiService.current_profile_id,
                    scenario_id: 1,
                    status: 'completed',
                    can_be_removed: false,
                    data_path: folder.path,
                    scenario_info: {
                        creation_datetime: dayjs().subtract(1, 'y').toISOString(),
                        description: 'test scenario',
                        title: 'test scenario'
                    }
                } as SavedAcquisitionData;
                if (this.acquisitions.findIndex((s) => s.scenario_id === toAdd.scenario_id) === -1) {
                    toAdd.files = files.map((e) => ({
                        name: e.name,
                        filePath: e.path,
                        size: File.fromPath(e.path).size,
                        md5: calculateMD5(e.path)
                    }));
                    this.acquisitions.push(toAdd);
                }
                DEV_LOG && console.log('AcquisitionUploader test', this.acquisitions.toJSON());
            })();
        } else {
        }
        // if (__ANDROID__) {
        //     // we want one notification for all uploads
        //     net.gotev.uploadservice.UploadServiceConfig.setNotificationHandlerFactory(
        //         new kotlin.jvm.functions.Function1({
        //             invoke(uploadService) {
        //                 return new NotificationHandler(uploadService);
        //             }
        //         })
        //     );
        // }
    }
    saveToUploadAcquisitions() {
        DEV_LOG && console.log('saveToUploadAcquisitions');
        ApplicationSettings.setString(
            'toUploadAcquisitions',
            JSON.stringify(
                this.acquisitions.toJSON().map((s) => {
                    const { uploading, ...toSave } = s;
                    return toSave;
                })
            )
        );
    }
    async addScenarioAcquisition(scenario: Scenario) {
        const metadata = scenario.metadata;
        DEV_LOG &&
            console.log(
                'addScenarioAcquisition',
                this.acquisitions.length,
                this.acquisitions.map((s) => s.scenario_id),
                scenario.metadata.scenario_id,
                scenario.aborted,
                JSON.stringify(scenario.metadata)
            );
        // if (this.acquisitions.findIndex((s) => s.scenario_id === metadata.scenario_id) === -1) {
        const files = await Folder.fromPath(scenario.dataPath).getEntities();
        const acquisition = {
            progress: 0,
            start_datetime: dayjs(scenario.startTime).toISOString(),
            end_datetime: dayjs(scenario.endTime).toISOString(),
            data_collection_id: metadata.data_collection_id,
            profile_id: apiService.current_profile_id,
            scenario_id: metadata.scenario_id,
            status: scenario.aborted ? 'aborted' : 'completed',
            can_be_removed: true,
            data_path: scenario.dataPath,
            scenario_info: scenario.info,
            files: files.map((e) => ({
                name: e.name,
                filePath: e.path,
                size: File.fromPath(e.path).size,
                md5: calculateMD5(e.path)
            }))
        } as SavedAcquisitionData;
        DEV_LOG && console.log('addScenarioAcquisition', JSON.stringify(acquisition));
        this.acquisitions.push(acquisition);
        this.saveToUploadAcquisitions();
        // we try to add acquisition when the scenario finishes so that the backend knows about it
        if (!acquisition.acquisition_id) {
            try {
                const { files, progress, uploading, scenario_info, exchange_id, data_path, can_be_removed, ...acquisition_info } = acquisition;
                const { acquisition_id } = await apiService.addAcquisition({ acquisition_info });
                this.updateAcquisitionData(this.acquisitions.length - 1, acquisition, { acquisition_id });
            } catch (error) {
                console.error(error);
            }
        }
        // }
    }

    uploadingTasks: { [k: number]: UploadingItem } = {};

    getTotalSize(data: SavedAcquisitionData) {
        return data.files.reduce((prev, current) => prev + current.size, 0);
    }
    getCurrentDoneSize(uploadResult: UploadAcquisitionResult) {
        return uploadResult.exchange_status.files_status.reduce((prev, current, index) => prev + current.received_size, 0);
    }

    async startAcquisitionUpload(data: SavedAcquisitionData, uploadResult: UploadAcquisitionResult, acquisitionIndex: number) {
        const currentSession = session(`acq-upload-${data.exchange_id}`);
        const currentAcquisitionData: UploadingItem = { data, uploadResult, session: currentSession };
        this.uploadingTasks[data.acquisition_id] = currentAcquisitionData;
        this.updateStatus();
        this.updateAcquisitionData(acquisitionIndex, data, { uploading: true });
        let offset = 0;
        const totalSize = this.getTotalSize(data);
        DEV_LOG && console.log('startAcquisitionUpload', data.acquisition_id, totalSize, data.files);
        const tasks = [];
        for (let index = 0; index < data.files.length; index++) {
            const fileData = data.files[index];
            const fileStatus = uploadResult.exchange_status.files_status[index];
            if (fileStatus.complete && fileStatus.valid) {
                continue;
            }
            tasks.push({ name: fileData.name, filename: fileData.filePath, mimeType: 'application/octet-stream' });
            offset = 0;
            let currentDoneSize = this.getCurrentDoneSize(uploadResult);
            const actualFileSize = File.fromPath(fileData.filePath).size;
            DEV_LOG && console.log('upload file', data.acquisition_id, fileData.name, fileData.size, actualFileSize, totalSize, currentDoneSize, acquisitionIndex);
            await new Promise<void>((resolve, reject) => {
                try {
                    let url = `${apiService.apiUrl}/upload_acquisition/${data.exchange_id}/${index}`;
                    if (offset) {
                        url += `&offset=${offset}`;
                    }
                    DEV_LOG && console.log('url', url, fileData);
                    this.notify({ eventName: 'uploading', data: { data, uploadResult, fileData } as any });
                    const task = (currentAcquisitionData.task = currentSession.uploadFile(fileData.filePath, {
                        url,
                        headers: {
                            'Authentication-Token': apiService.tokenData.user.authentication_token,
                            'Content-Type': 'application/octet-stream'
                        },
                        method: 'POST',
                        androidRingToneEnabled: false,
                        androidAutoClearNotification: true,
                        androidNotificationChannelID: NOTIFICATION_CHANEL_ID_UPLOAD_CHANNEL,
                        androidNotificationOnCancelledTitle: $tc('acquisition_upload'),
                        androidNotificationOnCompleteTitle: $tc('acquisition_upload'),
                        androidNotificationOnProgressTitle: $tc('acquisition_upload'),
                        androidNotificationOnErrorTitle: $tc('acquisition_upload'),
                        androidNotificationOnErrorMessage: $tc('acquisition_upload_error'),
                        androidNotificationOnCancelledMessage: $tc('acquisition_upload_cancelled'),
                        androidNotificationOnCompleteMessage: $tc('acquisition_upload_finished'),
                        androidNotificationOnProgressMessage: $tc('acquisition_upload_progress'),
                        description: fileData.filePath
                    }));
                    task.on('error', (e) => {
                        currentAcquisitionData.task = null;
                        DEV_LOG && console.log('on error', data.acquisition_id, Object.keys(e), e.error, e.response, e.responseCode, e.error?.stack);
                        this.updateAcquisitionData(acquisitionIndex, data, { uploading: false, progress: Math.floor(currentDoneSize / totalSize) * 100 });
                        this.notify({ eventName: 'error', data: { data, uploadResult, fileData, error: e.error } as any });
                        reject(e.error || new Error(e.response));
                    });
                    task.on('complete', (e) => {
                        DEV_LOG && console.log('on complete file', data.acquisition_id, fileData.name, acquisitionIndex, currentDoneSize, fileData.size, totalSize);
                        currentAcquisitionData.task = null;
                        // update progress
                        currentDoneSize += fileData.size;
                        this.updateAcquisitionData(acquisitionIndex, data, { progress: Math.floor((currentDoneSize / totalSize) * 100) });
                        this.notify({ eventName: 'uploaded', data: { data, uploadResult, fileData } as any });
                        resolve();
                    });
                    task.on('cancelled', (e) => {
                        currentAcquisitionData.task = null;
                        DEV_LOG && console.log('on cancelled', data.acquisition_id, fileData.name, acquisitionIndex, currentDoneSize, totalSize);
                        this.updateAcquisitionData(acquisitionIndex, data, { uploading: false, progress: Math.floor((currentDoneSize / totalSize) * 100) });
                        this.notify({ eventName: 'cancelled', data: { data, uploadResult, fileData } as any });
                        reject();
                    });
                    task.on('progress', (e) => {
                        const progress = Math.floor(((currentDoneSize + e.currentBytes) / totalSize) * 100);
                        this.notify({ eventName: 'progress', data: { progress } as any });
                        this.updateAcquisitionData(acquisitionIndex, data, { progress }, false);
                        DEV_LOG && console.log('on progress', data.acquisition_id, fileData.name, acquisitionIndex, e.currentBytes, e.totalBytes, (e.currentBytes / e.totalBytes) * 100, progress);
                    });
                } catch (error) {
                    delete this.uploadingTasks[data.acquisition_id];
                    reject(error);
                }
            });
            uploadResult = await apiService.getUploadAcquisitionStatus({ exchange_id: data.exchange_id });
            this.updateAcquisitionData(acquisitionIndex, data, { uploadResult });
        }
        // await new Promise<void>((resolve, reject) => {
        //     try {
        //         let url = `${apiService.apiUrl}/upload_acquisition/${data.exchange_id}`;
        //         if (offset) {
        //             url += `&offset=${offset}`;
        //         }
        //         DEV_LOG && console.log('url', url, tasks);
        //         this.notify({ eventName: 'uploading', data: { data, uploadResult, tasks } as any });
        //         const task = (currentAcquisitionData.task = currentSession.multipartUpload(tasks, {
        //             url,
        //             headers: {
        //                 'Authentication-Token': apiService.tokenData.user.authentication_token,
        //                 'Content-Type': 'application/octet-stream'
        //             },
        //             method: 'POST',
        //             description: data.exchange_id + '',
        //             androidRingToneEnabled: false,
        //             androidAutoClearNotification: true,
        //             androidNotificationChannelID: NOTIFICATION_CHANEL_ID_UPLOAD_CHANNEL,
        //             androidNotificationOnCancelledTitle: $tc('acquisition_upload'),
        //             androidNotificationOnCompleteTitle: $tc('acquisition_upload'),
        //             androidNotificationOnProgressTitle: $tc('acquisition_upload'),
        //             androidNotificationOnErrorTitle: $tc('acquisition_upload'),
        //             androidNotificationOnErrorMessage: $tc('acquisition_upload_error'),
        //             androidNotificationOnCancelledMessage: $tc('acquisition_upload_cancelled'),
        //             androidNotificationOnCompleteMessage: $tc('acquisition_upload_finished'),
        //             androidNotificationOnProgressMessage: $tc('acquisition_upload_progress')
        //         }));
        //         task.on('error', (e) => {
        //             currentAcquisitionData.task = null;
        //             DEV_LOG && console.log('on error', data.acquisition_id, Object.keys(e), e.error, e.response, e.responseCode, e.error?.stack);
        //             // this.updateAcquisitionData(acquisitionIndex, data, { uploading: false, progress: Math.floor(currentDoneSize / totalSize) * 100 });
        //             this.notify({ eventName: 'error', data: { data, uploadResult, tasks, error: e.error } as any });
        //             reject(e.error || new Error(e.response));
        //         });
        //         task.on('complete', (e) => {
        //             DEV_LOG && console.log('on complete', data.acquisition_id, tasks, acquisitionIndex, Object.keys(e));
        //             currentAcquisitionData.task = null;
        //             // update progress
        //             // currentDoneSize += fileData.size;
        //             this.updateAcquisitionData(acquisitionIndex, data, { progress: 100 });
        //             this.notify({ eventName: 'uploaded', data: { data, uploadResult, tasks } as any });
        //             resolve();
        //         });
        //         task.on('cancelled', (e) => {
        //             currentAcquisitionData.task = null;
        //             DEV_LOG && console.log('on cancelled', data.acquisition_id, acquisitionIndex, Object.keys(e));
        //             this.updateAcquisitionData(acquisitionIndex, data, { uploading: false });
        //             this.notify({ eventName: 'cancelled', data: { data, uploadResult, tasks } as any });
        //             reject();
        //         });
        //         task.on('progress', (e) => {
        //             const progress = Math.floor(((e.currentBytes) / e.totalBytes) * 100);
        //             this.notify({ eventName: 'progress', data: {progress} as any });
        //             this.updateAcquisitionData(acquisitionIndex, data, {progress}, false);
        //             DEV_LOG && console.log('on progress', data.acquisition_id, acquisitionIndex, Object.keys(e));
        //         });
        //     } catch (error) {
        //         delete this.uploadingTasks[data.acquisition_id];
        //         reject(error);
        //     }
        // });
        // uploadResult = await apiService.getUploadAcquisitionStatus({ exchange_id: data.exchange_id });
        this.updateAcquisitionData(acquisitionIndex, data, { uploading: false });
        return uploadResult;
    }
    async stopUploading(item: UploadingItem) {
        delete this.uploadingTasks[item.data.acquisition_id];
        this.updateStatus();
    }
    updateStatus() {
        const nbCurrent = Object.values(this.uploadingTasks).length;
        DEV_LOG && console.log('updateStatus', nbCurrent, this.uploading);
        if (nbCurrent && !this.uploading) {
            this.uploading = true;
            this.notify({ eventName: 'state', state: 'uploading' });
        } else if (!nbCurrent && this.uploading) {
            this.uploading = false;
            this.notify({ eventName: 'state', state: 'finished' });
        }
    }

    async stopAll() {
        Object.values(this.uploadingTasks).forEach(this.stopUploading);
    }

    updateAcquisitionData(index, data: SavedAcquisitionData, newData: Partial<SavedAcquisitionData>, save = true) {
        Object.assign(data, newData);
        this.acquisitions.setItem(index, data);
        if (save) {
            this.saveToUploadAcquisitions();
        }
    }
    uploading = false;
    async uploadAcquisitions() {
        DEV_LOG && console.log('uploadAcquisitions', Application.inBackground, this.acquisitions.length, this.uploading);
        if (this.uploading || Application.inBackground || this.acquisitions.length === 0) {
            // let s not start upload while in inBackground
            // forbidden in android >= 12
            return;
        }
        for (let index = this.acquisitions.length - 1; index >= 0; index--) {
            try {
                const acquisition = this.acquisitions.getItem(index);
                const { files, progress, uploading, scenario_info, exchange_id, data_path, can_be_removed, ...acquisition_info } = acquisition;
                if (!acquisition.acquisition_id) {
                    const { acquisition_id } = await apiService.addAcquisition({ acquisition_info });
                    this.updateAcquisitionData(index, acquisition, { acquisition_id });
                }
                let result = await apiService.uploadAcquisition({ acquisition_id: acquisition.acquisition_id, files, exchange_id });
                if (result.exchange_status.finalized) {
                    DEV_LOG && console.log('finalized acquisition', acquisition.acquisition_id, index);
                    this.acquisitions.splice(index, 1);
                    this.saveToUploadAcquisitions();
                    this.notify({ eventName: 'completed', data: { acquisition, uploadResult: result } });
                } else if (result.exchange_status.complete) {
                    // the server is processing, let ignore for now
                    this.updateAcquisitionData(index, acquisition, { uploadResult: result });
                    this.notify({ eventName: 'processing', data: { acquisition, uploadResult: result } });
                    continue;
                }
                this.notify({ eventName: 'uploading', data: { acquisition, uploadResult: result } });
                this.updateAcquisitionData(index, acquisition, { exchange_id: result.exchange_id });
                result = await this.startAcquisitionUpload(acquisition, result, index);
                DEV_LOG && console.log('finished acquisition', acquisition.acquisition_id, JSON.stringify(result), can_be_removed, index);
                delete this.uploadingTasks[acquisition.acquisition_id];
                if (result.exchange_status.finalized) {
                    DEV_LOG && console.log('finalized acquisition', acquisition.acquisition_id, index);
                    this.acquisitions.splice(index, 1);
                    this.saveToUploadAcquisitions();
                    this.notify({ eventName: 'completed', data: { acquisition, uploadResult: result } });
                    if (can_be_removed) {
                        const folder = Folder.fromPath(data_path);
                        await folder.remove();
                    }
                } else if (result.exchange_status.complete) {
                    this.updateAcquisitionData(index, acquisition, { uploadResult: result });
                    this.notify({ eventName: 'processing', data: { acquisition, uploadResult: result } });
                } else {
                    // not normal let s throw
                    throw new Error($tc('upload_acquisition_error'));
                }
            } catch (error) {
                throw error;
            } finally {
                this.updateStatus();
            }
        }
        DEV_LOG && console.log('uploadAcquisitions done ', Application.inBackground, this.acquisitions.length, this.uploading);
        showSnack({ message: $tc('uploading_finished') });
    }
    removeAcquisition(acquisition: SavedAcquisitionData) {
        const index = this.acquisitions.indexOf(acquisition);
        if (index >= 0) {
            this.acquisitions.splice(index, 1);
        }
        if (this.uploadingTasks[acquisition.acquisition_id]) {
            this.uploadingTasks[acquisition.acquisition_id].task?.cancel();
            delete this.uploadingTasks[acquisition.acquisition_id];
            this.updateStatus();
        }
        this.saveToUploadAcquisitions();
    }
}

let apiService: APIService;
export function getAPIInstance(crashReportService?: CrashReportService) {
    if (!apiService) {
        apiService = new APIService();
    }
    return apiService;
}

let uploader: AcquisitionUploader;

export function getUploaderInstance() {
    if (!uploader) {
        uploader = new AcquisitionUploader();
    }
    return uploader;
}
