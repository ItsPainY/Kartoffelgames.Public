import { Exception, type IVoidParameterConstructor, type TypedArray } from '@kartoffelgames/core';
import { Serializer } from '../core/serializer.ts';
import type { SerializerMetadata } from '../core/serializer-metadata.ts';
import { ValueTypeTag, TypedArraySubType } from './blob-serializer-types.ts';

/**
 * Decodes binary `Uint8Array` data back into JavaScript values.
 */
export class BlobSerializerValueDeserializer {
    private static readonly mTextDecoder: TextDecoder = new TextDecoder();

    /**
     * Map from typed array sub-type ID to the constructor.
     */
    private static readonly mTypedArrayInfo: ReadonlyMap<TypedArraySubType, BlobSerializerValueDeserializerTypedArrayInfo> = (() => {
        return new Map([
            [TypedArraySubType.Int8Array, { subType: TypedArraySubType.Int8Array, bytesPerElement: 1, constructor: Int8Array }],
            [TypedArraySubType.Uint8Array, { subType: TypedArraySubType.Uint8Array, bytesPerElement: 1, constructor: Uint8Array }],
            [TypedArraySubType.Uint8ClampedArray, { subType: TypedArraySubType.Uint8ClampedArray, bytesPerElement: 1, constructor: Uint8ClampedArray }],
            [TypedArraySubType.Int16Array, { subType: TypedArraySubType.Int16Array, bytesPerElement: 2, constructor: Int16Array }],
            [TypedArraySubType.Uint16Array, { subType: TypedArraySubType.Uint16Array, bytesPerElement: 2, constructor: Uint16Array }],
            [TypedArraySubType.Int32Array, { subType: TypedArraySubType.Int32Array, bytesPerElement: 4, constructor: Int32Array }],
            [TypedArraySubType.Uint32Array, { subType: TypedArraySubType.Uint32Array, bytesPerElement: 4, constructor: Uint32Array }],
            [TypedArraySubType.Float32Array, { subType: TypedArraySubType.Float32Array, bytesPerElement: 4, constructor: Float32Array }],
            [TypedArraySubType.Float64Array, { subType: TypedArraySubType.Float64Array, bytesPerElement: 8, constructor: Float64Array }],
            [TypedArraySubType.BigInt64Array, { subType: TypedArraySubType.BigInt64Array, bytesPerElement: 8, constructor: BigInt64Array }],
            [TypedArraySubType.BigUint64Array, { subType: TypedArraySubType.BigUint64Array, bytesPerElement: 8, constructor: BigUint64Array }],
        ]);
    })();

    /**
     * Deserialize a value from byte data.
     *
     * @param pData - The encoded byte data.
     *
     * @returns the decoded JavaScript value.
     */
    public deserialize(pData: Uint8Array): unknown {
        const lState: BlobSerializerValueDeserializerState = {
            bytes: pData,
            cursor: 0,
            dataView: new DataView(pData.buffer, pData.byteOffset, pData.byteLength)
        };

        return this.decode(lState);
    }

    /**
     * Decode the value starting from the current cursor.
     *
     * @param pState - Current deserializer state.
     *
     * @returns the decoded JavaScript value.
     *
     * @throws Exception if an unknown type tag is encountered.
     */
    private decode(pState: BlobSerializerValueDeserializerState): unknown {
        const lTag: number = this.readNextBytesAsUint8(pState);

        switch (lTag) {
            case ValueTypeTag.Null:
                return null;
            case ValueTypeTag.BooleanFalse:
                return false;
            case ValueTypeTag.BooleanTrue:
                return true;
            case ValueTypeTag.Number:
                return this.decodeNumber(pState);
            case ValueTypeTag.String:
                return this.decodeString(pState);
            case ValueTypeTag.Array:
                return this.decodeArray(pState);
            case ValueTypeTag.Object:
                return this.decodeRegisteredObject(pState);
            case ValueTypeTag.ArrayBuffer:
                return this.decodeArrayBuffer(pState);
            case ValueTypeTag.TypedArray:
                return this.decodeTypedArray(pState);
            default:
                throw new Exception(`Unknown value type tag: 0x${lTag.toString(16).padStart(2, '0')}`, this);
        }
    }

    /**
     * Decode an array of values.
     */
    private decodeArray(pState: BlobSerializerValueDeserializerState): Array<unknown> {
        const lCount: number = this.readNextBytesAsUint32(pState);
        const lArray: Array<unknown> = new Array<unknown>(lCount);

        for (let lIndex: number = 0; lIndex < lCount; lIndex++) {
            lArray[lIndex] = this.decode(pState);
        }

        return lArray;
    }

    /**
     * Decode an ArrayBuffer.
     */
    private decodeArrayBuffer(pState: BlobSerializerValueDeserializerState): ArrayBuffer {
        const lByteLength: number = this.readNextBytesAsUint32(pState);
        const lBytes: Uint8Array = this.readNextBytes(pState, lByteLength);
        // Copy bytes into a fresh ArrayBuffer.
        const lBuffer: ArrayBuffer = new ArrayBuffer(lByteLength);
        new Uint8Array(lBuffer).set(lBytes);
        return lBuffer;
    }

    /**
     * Decode a float64 number.
     */
    private decodeNumber(pState: BlobSerializerValueDeserializerState): number {
        return this.readNextBytesAsFloat64(pState);
    }

    /**
     * Decode a registered (decorated) object.
     */
    private decodeRegisteredObject(pState: BlobSerializerValueDeserializerState): object {
        // Read UUID.
        const lUuidByteLength: number = this.readNextBytesAsUint16(pState);
        const lUuid: string = this.readNextBytesAsString(pState, lUuidByteLength);

        // Resolve constructor.
        const lConstructor: IVoidParameterConstructor<object> = Serializer.classOfUuid(lUuid);
        const lInstance: object = new lConstructor();

        // Read metadata for property alias mapping.
        const lMetadata: SerializerMetadata | null = Serializer.metadataOf(lConstructor);

        // Build alias-to-property-name reverse map.
        const lAliasToPropertyName: Map<string, string> = new Map<string, string>();
        if (lMetadata !== null) {
            for (const lPropertyName of lMetadata.propertyNames) {
                const lConfig = lMetadata.getPropertyConfig(lPropertyName);
                const lBinaryKey: string = lConfig.alias ?? lPropertyName;

                lAliasToPropertyName.set(lBinaryKey, lPropertyName);
            }
        }

        // Read properties.
        const lPropertyCount: number = this.readNextBytesAsUint32(pState);

        for (let lPropertyIndex: number = 0; lPropertyIndex < lPropertyCount; lPropertyIndex++) {
            // Read key.
            const lKeyByteLength: number = this.readNextBytesAsUint16(pState);
            const lBinaryKey: string = this.readNextBytesAsString(pState, lKeyByteLength);

            // Decode value.
            const lValue: unknown = this.decode(pState);

            // Map binary key to property name (via alias or direct match).
            const lPropertyName: string = lAliasToPropertyName.get(lBinaryKey) ?? lBinaryKey;

            // Assign to instance.
            (lInstance as Record<string, unknown>)[lPropertyName] = lValue;
        }

        return lInstance;
    }

    /**
     * Decode a UTF-8 string.
     */
    private decodeString(pState: BlobSerializerValueDeserializerState): string {
        const lByteLength: number = this.readNextBytesAsUint32(pState);
        return this.readNextBytesAsString(pState, lByteLength);
    }

    /**
     * Decode a TypedArray.
     */
    private decodeTypedArray(pState: BlobSerializerValueDeserializerState): TypedArray {
        const lSubType: TypedArraySubType = this.readNextBytesAsUint8(pState) as TypedArraySubType;
        const lByteLength: number = this.readNextBytesAsUint32(pState);
        const lBytes: Uint8Array = this.readNextBytes(pState, lByteLength);

        // Get the constructor for this sub-type.
        const lTypedArrayInformation: BlobSerializerValueDeserializerTypedArrayInfo | undefined = BlobSerializerValueDeserializer.mTypedArrayInfo.get(lSubType);
        if (lTypedArrayInformation === undefined) {
            throw new Exception(`Unknown TypedArray sub-type: ${lSubType}`, this);
        }

        // Copy bytes into a fresh ArrayBuffer and create the typed array.
        const lBuffer: ArrayBuffer = new ArrayBuffer(lByteLength);
        new Uint8Array(lBuffer).set(lBytes);

        // Calculate element count from byte length and bytes per element.
        const lBytesPerElement: number = lTypedArrayInformation.bytesPerElement;
        const lElementCount: number = lByteLength / lBytesPerElement;

        return new lTypedArrayInformation.constructor(lBuffer, 0, lElementCount);
    }

    /**
     * Read raw bytes from the buffer and advance the offset.
     *
     * @param pLength - Number of bytes to read.
     */
    private readNextBytes(pState: BlobSerializerValueDeserializerState, pLength: number): Uint8Array {
        const lBytes: Uint8Array = pState.bytes.subarray(pState.cursor, pState.cursor + pLength);
        pState.cursor += pLength;
        return lBytes;
    }

    /**
     * Read a float64 (little-endian) from the buffer and advance the offset.
     */
    private readNextBytesAsFloat64(pState: BlobSerializerValueDeserializerState): number {
        const lValue: number = pState.dataView.getFloat64(pState.cursor, true);
        pState.cursor += 8;
        return lValue;
    }

    /**
     * Read a UTF-8 string from the buffer.
     *
     * @param pByteLength - Number of bytes of the UTF-8 encoded string.
     */
    private readNextBytesAsString(pState: BlobSerializerValueDeserializerState, pByteLength: number): string {
        const lBytes: Uint8Array = this.readNextBytes(pState, pByteLength);
        return BlobSerializerValueDeserializer.mTextDecoder.decode(lBytes);
    }

    /**
     * Read a uint16 (little-endian) from the buffer and advance the offset.
     */
    private readNextBytesAsUint16(pState: BlobSerializerValueDeserializerState): number {
        const lValue: number = pState.dataView.getUint16(pState.cursor, true);
        pState.cursor += 2;
        return lValue;
    }

    /**
     * Read a uint32 (little-endian) from the buffer and advance the offset.
     */
    private readNextBytesAsUint32(pState: BlobSerializerValueDeserializerState): number {
        const lValue: number = pState.dataView.getUint32(pState.cursor, true);
        pState.cursor += 4;
        return lValue;
    }

    /**
     * Read a uint8 from the buffer and advance the offset.
     */
    private readNextBytesAsUint8(pState: BlobSerializerValueDeserializerState): number {
        const lValue: number = pState.dataView.getUint8(pState.cursor);
        pState.cursor += 1;
        return lValue;
    }
}

type BlobSerializerValueDeserializerState = {
    bytes: Uint8Array;
    cursor: number;
    dataView: DataView;
};

type BlobSerializerValueDeserializerTypedArrayInfo = {
    subType: TypedArraySubType;
    bytesPerElement: number;
    constructor: new (buffer: ArrayBuffer, byteOffset?: number, length?: number) => TypedArray;
}
