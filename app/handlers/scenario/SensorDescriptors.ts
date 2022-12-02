import { TextDecoder, TextEncoder } from '~/utils/encoder_decoder';
// import { TextDecoder, TextEncoder } from '@nativescript/core/text';
import struct from '~/utils/struct';
import SensorLogger from './SensorLogger';

declare class Struct {
    unpack: (arrb: any) => any[];
    pack: (...values: any[]) => ArrayBuffer;
    unpack_from: (arrb: any, offs: any) => any[];
    pack_into: (arrb: any, offs: any, ...values: any[]) => void;
    format: any;
    size: number;
}

function zipLongest([...args], fillvalue = null) {
    const result = [];
    let i = 0;
    while (args.some((argArray) => argArray[i])) {
        const ithColumn = args.map((argArray) => {
            const item = typeof argArray[i] === 'undefined' ? fillvalue : argArray[i];
            return item;
        });
        result.push(ithColumn);
        i++;
    }
    return result;
}

class Item {
    KEYWORDS: { [k: string]: any } = {};

    parse(content: string[], key?: string, value?: string) {
        while (content.length > 0) {
            const [key, value] = Item.parse_item(content[0]);

            if (!this.KEYWORDS[key]) {
                break;
            }

            delete content[0];
            const cb = this.KEYWORDS[key];
            if (typeof cb === 'function') {
                cb(content, key, value);
            } else {
                this[key.toLowerCase()] = value;
            }
        }
        return this;
    }

    static decode_datatype(datatype: string) {
        const ST_ENDIAN = { LITTLEENDIAN: '<', BIGENDIAN: '>' };
        const ST_FORMAT = {
            SIGNED: {
                '8BIT': 'b',
                '12BIT': 'h',
                '16BIT': 'h',
                '20BIT': 'l',
                '32BIT': 'l',
                '64BIT': 'q'
            },
            UNSIGNED: {
                '8BIT': 'B',
                '12BIT': 'H',
                '16BIT': 'H',
                '20BIT': 'L',
                '32BIT': 'L',
                '64BIT': 'Q'
            },
            FLOAT: {
                '8BIT': 'f',
                '12BIT': 'f',
                '16BIT': 'f',
                '20BIT': 'f',
                '32BIT': 'f',
                '64BIT': 'd'
            }
        };

        const [type_, length, endianess] = datatype.split(',');
        return ST_ENDIAN[endianess] + ST_FORMAT[type_][length];
    }
    static split_values(value) {
        return value.split(',').filter((s) => !!s);
    }

    static parse_item(item: string): [string, string | undefined] {
        const data = item
            .split('=')
            .filter((s) => !!s)
            .map((s) => s.trim());
        try {
            return [data[0], data[1]];
        } catch (error) {
            return [data[0], undefined];
        }
    }
    parse_values(content: string[], key: string, value: string) {
        this[key.toLowerCase()] = Item.split_values(value);
    }

    parse_datatype(content: string[], key: string, value: string) {
        this[key.toLowerCase()] = Item.decode_datatype(value);
    }

    parse_int(content: string[], key: string, value: string) {
        this[key.toLowerCase()] = parseInt(value, 10);
    }

    join_values(values) {
        return values.join(',');
    }

    format_datatype(datatype) {
        const ENDIAN = { '<': 'LITTLEENDIAN', '>': 'BIGENDIAN' };
        const FORMAT = {
            b: ['8BIT', 'SIGNED'],
            h: ['16BIT', 'SIGNED'],
            l: ['32BIT', 'SIGNED'],
            q: ['64BIT', 'SIGNED'],

            B: ['8BIT', 'UNSIGNED'],
            H: ['16BIT', 'UNSIGNED'],
            L: ['32BIT', 'UNSIGNED'],
            Q: ['64BIT', 'UNSIGNED'],

            f: ['32BIT', 'FLOAT'],
            d: ['64BIT', 'FLOAT']
        };

        const [length, sign] = FORMAT[datatype[1]];
        const endianess = ENDIAN[datatype[0]];

        return `${sign},${length},${endianess}`;
    }
}

class SensorParamItem extends Item {
    constructor(public name?: string, public datatype?: string, public values?: string[], public unit?: string) {
        super();
        this.KEYWORDS = {
            NAME: undefined,
            DATATYPE: this.parse_datatype,
            VALUES: this.parse_values,
            UNIT: undefined
        };
    }
    format_desc() {
        const lines: string[] = [];
        lines.push(`NAME=${this.name}`);
        lines.push(`DATATYPE=${this.format_datatype(this.datatype)}`);
        lines.push(`VALUES=${this.join_values(this.values)}`);
        lines.push(`UNIT=${this.unit}`);
        return lines;
    }
}
class SensorItem extends Item {
    constructor(public id?: number, public sensor_name?: string, public driver_version?: string, public param: SensorParamItem[] = []) {
        super();
        this.KEYWORDS = {
            ID: undefined,
            SENSOR_NAME: undefined,
            DRIVER_VERSION: undefined,
            PARAM: undefined
        };
        this.KEYWORDS['PARAM'] = this.parse_param;
        this.KEYWORDS['ID'] = this.parse_int;
    }
    parse_param(content, key, value) {
        this.param.push(new SensorParamItem().parse(content, key, value));
    }

    format_desc() {
        const lines: string[] = [];
        lines.push(`ID=${this.id}`);
        if (this.sensor_name) {
            lines.push(`SENSOR_NAME=${this.sensor_name}`);
        }
        if (this.driver_version) {
            lines.push(`DRIVER_VERSION=${this.driver_version}`);
        }
        this.param.forEach((param) => {
            lines.push('PARAM');
            lines.push(...param.format_desc());
        });
        return lines;
    }
}

class FrameAxisItem extends Item {
    constructor(public name?: string, public datatype?: string, public plot_id?: string, public bar_id?: string, public picture_id?: string) {
        super();
        this.KEYWORDS = {
            NAME: undefined,
            DATATYPE: undefined,
            PLOT_ID: undefined,
            BAR_ID: undefined,
            PICTURE_ID: undefined
        };
        this.KEYWORDS['DATATYPE'] = this.parse_datatype;
    }

    format_desc() {
        const lines: string[] = [];
        if (this.name) {
            lines.push(`NAME=${this.name}`);
        }
        if (this.datatype) {
            lines.push(`DATATYPE=${this.format_datatype(this.datatype)}`);
        }
        if (this.plot_id) {
            lines.push(`PLOT_ID=${this.plot_id}`);
        }
        if (this.bar_id) {
            lines.push(`BAR_ID=${this.bar_id}`);
        }
        if (this.picture_id) {
            lines.push(`PICTURE_ID=${this.picture_id}`);
        }
        return lines;
    }
}
class FrameDescItem extends Item {
    constructor(public frame_id?: number, public timestamp_datatype: string = '<Q', public axis: FrameAxisItem[] = [], public incr_time_datatype?: string) {
        super();
        this.KEYWORDS = {
            FRAME_ID: this.parse_int,
            TIMESTAMP_DATATYPE: this.parse_datatype,
            INCR_TIME_DATATYPE: this.parse_axis,
            AXIS: this.parse_datatype
        };
    }
    parse_axis(content, keyword, value) {
        this.axis.push(new FrameAxisItem().parse(content, keyword, value));
    }

    get_struct_format() {
        const increment = this.incr_time_datatype ? [this.incr_time_datatype] : [];
        return [this.timestamp_datatype].concat(increment).concat(this.axis.map((a) => a.datatype));
    }

    format_desc() {
        const lines: string[] = [];
        lines.push(`FRAME_ID=${this.frame_id}`);
        lines.push(`TIMESTAMP_DATATYPE=${this.format_datatype(this.timestamp_datatype)}`);
        if (this.incr_time_datatype) {
            lines.push(`INCR_TIME_DATATYPE=${this.format_datatype(this.incr_time_datatype)}`);
        }
        this.axis.forEach((axis) => {
            lines.push('AXIS');
            lines.push(...axis.format_desc());
        });
        return lines;
    }
}

class ButtonItem extends Item {
    constructor(public name?: string, public datatype?: string, public info?: string, public values: string[] = []) {
        super();
        this.KEYWORDS = {
            VALUES: undefined,
            DATATYPE: undefined,
            INFO: undefined,
            NAME: undefined
        };
        this.KEYWORDS['VALUES'] = this.parse_values;
        this.KEYWORDS['DATATYPE'] = this.parse_datatype;
    }
    format_desc() {
        const lines: string[] = [];
        if (this.name) {
            lines.push(`NAME=${this.name}`);
        }
        if (this.datatype) {
            lines.push(`DATATYPE=${this.format_datatype(this.datatype)}`);
        }
        if (this.info) {
            lines.push(`INFO=${this.info}`);
        }
        if (this.values) {
            lines.push(`VALUES=${this.join_values(this.values)}`);
        }
        return lines;
    }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
class SensorDescriptor extends Item {
    constructor(public sensor: SensorItem[] = [], public frame_desc: FrameDescItem[] = [], public plot_name: string[] = [], public picture_name: string[] = [], public button: ButtonItem[] = []) {
        super();
        this.KEYWORDS = {
            SENSOR: this.parse_sensor,
            PLOT_NAME: this.parse_frame,
            PICTURE_NAME: this.parse_plot,
            FRAME_DESC: this.parse_picture,
            BUTTON: this.parse_button
        };
    }

    from_bytes(data: Uint8Array) {
        const content = decoder
            .decode(data)
            .split('\n')
            .filter((s) => !!s)
            .map((s) => s.trim());
        return new SensorDescriptor().parse(content);
    }
    to_bytes() {
        const lines: string[] = [];
        this.sensor.forEach((sensor_desc) => {
            lines.push('SENSOR');
            lines.push(...sensor_desc.format_desc());
        });
        this.frame_desc.forEach((frame_desc) => {
            lines.push('FRAME_DESC');
            lines.push(...frame_desc.format_desc());
        });
        this.plot_name.forEach((plot_name) => {
            lines.push(...`PLOT_NAME=${plot_name}`);
        });
        this.picture_name.forEach((picture_name) => {
            lines.push(...`PICTURE_NAME=${picture_name}`);
        });
        this.button.forEach((button) => {
            lines.push('BUTTON');
            lines.push(...button.format_desc());
        });
        return encoder.encode(lines.join('\n'));
    }
    parse_sensor(content, key, value) {
        this.sensor.push(new SensorItem().parse(content, key, value));
    }

    parse_frame(content, key, value) {
        this.frame_desc.push(new FrameDescItem().parse(content, key, value));
    }

    parse_button(content, key, value) {
        this.button.push(new ButtonItem().parse(content, key, value));
    }

    parse_plot(content, key, value) {
        this.plot_name.push(value);
    }

    parse_picture(content, key, value) {
        this.picture_name.push(value);
    }

    get_frame_desc(frame_id) {
        for (const frame_desc of this.frame_desc) {
            if (frame_desc.frame_id === frame_id) {
                return frame_desc;
            } else {
                throw new Error('frame_id {frame_id} not found in sensor descriptor');
            }
        }
    }

    get_sensor_desc(sensor_id) {
        for (const sensor_desc of this.sensor) {
            if (sensor_desc.id === sensor_id) {
                return sensor_desc;
            } else {
                throw new Error('sensor_id {sensor_id} not found in sensor descriptor');
            }
        }
    }

    get_sensor_desc_from_frame_id(sensor_id) {
        return this.get_sensor_desc(sensor_id & 0x0f);
    }
}

// class EspLoggerRecordReader:

//     _frame_id_st = struct.Struct('<BB')

//     constructor( fp: BinaryIO):
//         this._fp: BinaryIO = fp
//         this._descriptor_raw: bytes = undefined
//         this._descriptor: SensorDescriptor = undefined
//         this._frame_reader: dict[int,Callable] = {}

//     def _read_descriptor(self) -> bytes:
//         this._fp.seek(0)

//         if this._fp.read(6) != bytes("SENSOR".encode()):
//             # no descriptor
//             return bytes()

//         # read until '\r' is found
//         this._fp.seek(0)

//         sensor_desc = bytearray()

//         while True:
//             c = this._fp.read(1)

//             if not c:
//                 # eof
//                 break

//             if c.decode() == '\r':
//                 # string NUL byte
//                 this._fp.read(1)
//                 break

//             sensor_desc += c

//         return bytes(sensor_desc)

//     @property
//     def descriptor_raw(self) -> bytes:
//         if this._descriptor_raw is undefined:
//             this._descriptor_raw = this._read_descriptor()
//         return this._descriptor_raw

//     @property
//     def descriptor(self) -> SensorDescriptor:
//         if this._descriptor is undefined:
//             this._descriptor = SensorDescriptor.from_bytes(this.descriptor_raw)
//         return this._descriptor

//     def rewind(self):
//         this._fp.seek(len(this._descriptor_raw)+2)

//     def read(self) -> tuple[str,int,int,list]:
//         if not this._frame_reader:
//             this._create_frame_reader()

//         for buffer in iter(lambda: this._fp.read(this._frame_id_st.size), b''):
//             if len(buffer) < this._frame_id_st.size:
//                 return

//             frame_id, nb_data = this._frame_id_st.unpack(buffer)

//             for data in this._frame_reader[frame_id](nb_data):
//                 yield data

//     def _create_frame_reader(self):
//         for frame_desc in this.descriptor.frame_desc:
//             st = [struct.Struct(fmt) for fmt in frame_desc.get_struct_format()]
//             multi_frame = frame_desc.incr_time_datatype is not undefined
//             cb = this._read_multi_frame if multi_frame else this._read_single_frame
//             this._frame_reader[frame_desc.frame_id] = functools.partial(cb, frame_desc.frame_id, st)

//     def _read_multi_frame( frame_id, st, nb_data):
//         timestamp = st[0].unpack(this._fp.read(st[0].size))[0]
//         cum_timestamp = 0
//         all_data = []
//         for _ in range(nb_data+1):
//             data = []
//             for st_ in st[1:]:
//                 data += st_.unpack(this._fp.read(st_.size))
//             all_data.push(data)
//             cum_timestamp += data[0]

//         timestamp -= cum_timestamp

//         for data in all_data:
//             timestamp += data[0]
//             yield frame_id, int(timestamp), data[1:]

//     def _read_single_frame( frame_id, st, nb_data):
//         timestamp = st[0].unpack(this._fp.read(st[0].size))[0]
//         data = []
//         for st_ in st[1:]:
//             data += st_.unpack(this._fp.read(st_.size))
//         yield frame_id, timestamp, data

//     @classmethod
//     def to_csv( filename):
//         root, _ = os.path.splitext(filename)
//         csv_filename = root + '.csv'

//         with open(filename, 'rb') as f:
//             reader = EspLoggerRecordReader(f)

//             with open(csv_filename, 'w', newline='') as csv_f:
//                 csv_w = csv.writer(csv_f)

//                 for frame_id, timestamp, data in reader.read():
//                     csv_w.writerow([frame_id, timestamp] + data)

export class EspLoggerRecordWriter {
    _frame_id_st: Struct = struct('<BB');
    _frame_writer_st: { [key: number]: [Struct[], boolean] } = {};
    _paused = false;

    get paused() {
        return this._paused;
    }
    set paused(value: boolean) {
        this._paused = value;
        this.fp.paused = value;
    }
    constructor(private fp: SensorLogger, public sensor_desc: SensorDescriptor) {
        this.fp.write(sensor_desc.to_bytes());
        this.fp.write(new Uint8Array(['\r'.charCodeAt(0), '\x00'.charCodeAt(0)]));

        this._create_frame_writer();
    }
    get descriptor() {
        return this.sensor_desc;
    }

    _create_frame_writer() {
        let st: Struct[];
        let multi_frame: boolean;
        for (const frame_desc of this.descriptor.frame_desc) {
            st = frame_desc.get_struct_format().map((d) => struct(d));
            multi_frame = !!frame_desc.incr_time_datatype;
            this._frame_writer_st[frame_desc.frame_id] = [st, multi_frame];
        }
    }

    write(frame_id, ...data) {
        const [st, ..._] = this._frame_writer_st[frame_id];
        this.fp.write(this._frame_id_st.pack(frame_id, 0));
        for (const [st_, data_] of zipLongest([st, data.slice(0, st.length)], 0) as [Struct, any[]][]) {
            this.fp.write(st_.pack(data_));
        }
    }

    write_multi(frame_id, timestamp, datas) {
        const [st, _] = this._frame_writer_st[frame_id];

        this.fp.write(this._frame_id_st.pack(frame_id, datas.length - 1));
        this.fp.write(st[0].pack(timestamp));

        for (const data of datas) {
            for (const d of zipLongest([st, data], 0)) {
                const [st_, data_] = d;
                this.fp.write(st_.pack(data_) as ArrayBuffer);
            }
        }
    }
    close() {
        this.fp.close();
    }
}

export class MobilePhoneSensorDescriptor extends SensorDescriptor {
    static ID_ACC = 0;
    static ID_GYR = 1;
    static ID_UNCAL_ACC = 2;
    static ID_UNCAL_GYR = 3;

    constructor(hasGyr = true, hasAcc = true) {
        super(
            []
                .concat(
                    hasGyr ? [new SensorItem(MobilePhoneSensorDescriptor.ID_GYR, 'generic.gyr', '0.0.0'), new SensorItem(MobilePhoneSensorDescriptor.ID_UNCAL_GYR, 'generic.uncal_gyr', '0.0.0')] : []
                )
                .concat(
                    hasAcc ? [new SensorItem(MobilePhoneSensorDescriptor.ID_ACC, 'generic.acc', '0.0.0'), new SensorItem(MobilePhoneSensorDescriptor.ID_UNCAL_ACC, 'generic.uncal_acc', '0.0.0')] : []
                ),
            []
                .concat(
                    hasGyr
                        ? [
                              new FrameDescItem(MobilePhoneSensorDescriptor.ID_GYR, '<Q', [new FrameAxisItem('gyr_x', '<f'), new FrameAxisItem('gyr_y', '<f'), new FrameAxisItem('gyr_z', '<f')]),
                              new FrameDescItem(MobilePhoneSensorDescriptor.ID_UNCAL_GYR, '<Q', [
                                  new FrameAxisItem('uncal_gyr_x', '<f'),
                                  new FrameAxisItem('uncal_gyr_y', '<f'),
                                  new FrameAxisItem('uncal_gyr_z', '<f'),
                                  new FrameAxisItem('bias_gyr_x', '<f'),
                                  new FrameAxisItem('bias_gyr_y', '<f'),
                                  new FrameAxisItem('bias_gyr_z', '<f')
                              ])
                          ]
                        : []
                )
                .concat(
                    hasAcc
                        ? [
                              new FrameDescItem(MobilePhoneSensorDescriptor.ID_ACC, '<Q', [new FrameAxisItem('acc_x', '<f'), new FrameAxisItem('acc_y', '<f'), new FrameAxisItem('acc_z', '<f')]),
                              new FrameDescItem(MobilePhoneSensorDescriptor.ID_UNCAL_ACC, '<Q', [
                                  new FrameAxisItem('uncal_acc_x', '<f'),
                                  new FrameAxisItem('uncal_acc_y', '<f'),
                                  new FrameAxisItem('uncal_acc_z', '<f'),
                                  new FrameAxisItem('bias_acc_x', '<f'),
                                  new FrameAxisItem('bias_acc_y', '<f'),
                                  new FrameAxisItem('bias_acc_z', '<f')
                              ])
                          ]
                        : []
                )
        );
    }
}
