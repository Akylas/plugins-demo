let nCharset: java.nio.charset.Charset;
let nEncoder: java.nio.charset.CharsetEncoder;
let nDecoder: java.nio.charset.CharsetDecoder;

const Object_prototype_toString = {}.toString;
const ArrayBufferString = Object_prototype_toString.call(ArrayBuffer.prototype);

export class TextDecoder {
    public get encoding() {
        return 'utf-8';
    }

    public decode(input): string {
        if (__ANDROID__) {
            const buffer = ArrayBuffer.isView(input) ? input.buffer : input;
            if (Object_prototype_toString.call(buffer) !== ArrayBufferString) {
                throw Error("Failed to execute 'decode' on 'TextDecoder': The provided value is not of type '(ArrayBuffer or ArrayBufferView)'");
            }
            if (!nCharset) {
                nCharset = java.nio.charset.Charset.forName('UTF-8');
            }
            if (!nDecoder) {
                nDecoder = nCharset.newDecoder();
            }
            return nDecoder.decode(input).toString();
        }
        if (__IOS__) {
            return NSString.alloc().initWithDataEncoding(input, NSUTF8StringEncoding) + '';
        }
    }

    public toString() {
        return '[object TextDecoder]';
    }

    [Symbol.toStringTag] = 'TextDecoder';
}

export class TextEncoder {
    public get encoding() {
        return 'utf-8';
    }

    public encode(input = ''): Uint8Array {
        if (__ANDROID__) {
            if (!nCharset) {
                nCharset = java.nio.charset.Charset.forName('UTF-8');
            }
            if (!nEncoder) {
                nEncoder = nCharset.newEncoder();
            }
            const buffer = java.nio.CharBuffer.wrap(input);
            const encoded = nEncoder.encode(buffer);
            const result = new Uint8Array((ArrayBuffer as any).from(encoded));
            // ArrayBuffer.from will change position so let s rewind
            encoded.rewind();
            return result;
        }
        if (__IOS__) {
            // @ts-ignore
            return new Uint8Array(interop.bufferFromData(NSString.stringWithString(input).dataUsingEncoding(NSUTF8StringEncoding)));
        }
    }

    public toString() {
        return '[object TextEncoder]';
    }

    [Symbol.toStringTag] = 'TextEncoder';
}
