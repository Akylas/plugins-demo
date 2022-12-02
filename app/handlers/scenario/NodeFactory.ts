import AbortNode from './AbortNode';
import CounterNode from './CounterNode';
import DisplayMessageNode from './DisplayMessageNode';
import DisplayProgressNode from './DisplayProgressNode';
import EventNode from './EventNode';
import ForkNode from './ForkNode';
import JoinNode from './JoinNode';
import RecordNode from './RecordNode';
import LogInfoNode from './LogInfoNode';
import MetadataSetNode from './MetadataSetNode';
import Node from './Node';
import NopNode from './NopNode';
import Scenario, { NodeDef } from './Scenario';
import SensorNode from './SensorNode';
import WaitNextNode from './WaitNextNode';
import WaitNode from './WaitNode';
import WaitOptionNode from './WaitOptionNode';
import ScreenSleepNode from './ScreenSleepNode';

export declare namespace IFactory {
    export function createNode(node_id: string, options: NodeDef, scenario: Scenario): Node | null;
}

export type NodesType =
    | 'nop'
    | 'abort'
    | 'record_create'
    | 'record_close'
    | 'record_annotate'
    | 'record_pause'
    | 'record_unpause'
    | 'log_create'
    | 'log_close'
    | 'log_annotate'
    | 'log_pause'
    | 'log_unpause'
    | 'log_info'
    | 'counter_set'
    | 'counter_equ'
    | 'counter_inc'
    | 'counter_dec'
    | 'counter_cmp'
    | 'event_create'
    | 'event_set'
    | 'event_reset'
    | 'event_wait'
    | 'event_wait_all'
    | 'metadata_set'
    | 'sensor_device_dump_config'
    | 'sensor_device_set_config'
    | 'sensor_device_pause_sensor'
    | 'sensor_device_select'
    | 'sensor_device_start_sensor'
    | 'sensor_device_stop_sensor'
    | 'sensor_device_unpause_sensor'
    | 'sensor_device_start_record'
    | 'sensor_device_tag_record'
    | 'sensor_device_stop_record'
    | 'sensor_device_download_record'
    | 'disable_screen_sleep'
    | 'display_page'
    | 'display_msg'
    | 'display_clear'
    | 'display_progress'
    | 'wait_delay'
    | 'wait_next'
    | 'wait_option'
    | 'fork'
    | 'join';

export default class NodeFactory {
    static createNode(node_id: string, options: NodeDef, scenario: Scenario): Node | null {
        DEV_LOG && console.log('NodeFactory.createNode', node_id);
        switch (options.primitive_name) {
            case 'abort':
                return AbortNode.instance();
            case 'nop':
                return NopNode.instance();
            case 'fork':
                return ForkNode.instance();
            case 'join':
                return JoinNode.instance();
            case 'display_page':
            case 'display_msg':
            case 'display_clear':
                return DisplayMessageNode.instance();
            case 'display_progress':
                return DisplayProgressNode.instance();
            case 'event_create':
            case 'event_reset':
            case 'event_set':
            case 'event_wait':
            case 'event_wait_all':
                return EventNode.instance();
            case 'wait_delay':
                return WaitNode.instance();
            case 'wait_next':
                return WaitNextNode.instance();
            case 'wait_option':
                return WaitOptionNode.instance();
            case 'record_create':
            case 'record_close':
            case 'record_annotate':
            case 'record_pause':
            case 'record_unpause':
            case 'log_create':
            case 'log_close':
            case 'log_annotate':
            case 'log_pause':
            case 'log_unpause':
                return RecordNode.instance();
            case 'log_info':
                return LogInfoNode.instance();
            case 'metadata_set':
                return MetadataSetNode.instance();
            case 'counter_set':
            case 'counter_equ':
            case 'counter_inc':
            case 'counter_dec':
            case 'counter_cmp':
                return CounterNode.instance();
            case 'sensor_device_select':
            case 'sensor_device_set_config':
            case 'sensor_device_dump_config':
            case 'sensor_device_start_record':
            case 'sensor_device_stop_record':
            case 'sensor_device_tag_record':
            case 'sensor_device_download_record':
            case 'sensor_device_pause_sensor':
            case 'sensor_device_unpause_sensor':
            case 'sensor_device_start_sensor':
            case 'sensor_device_stop_sensor':
                return SensorNode.instance();
            case 'disable_screen_sleep':
                return ScreenSleepNode.instance();
        }
    }
}
