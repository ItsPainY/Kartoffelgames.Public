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

    private readonly mInitialData: Uint8Array | null;

    /**
     * Constructor.
     *
     * @param pData - The encoded byte data.
     */
    public constructor(pData?: Uint8Array) {
        this.mInitialData = pData ?? null;
    }

    /**
     * Decode the value starting from the current offset.
     *
     * @returns the decoded JavaScript value.
     *
     * @throws Exception if an unknown type tag is encountered.
     */
    public decode(pData?: Uint8Array): unknown {
        const lData: Uint8Array | null = pData ?? this.mInitialData;
        if (lData === null) {
            throw new Exception('No decoder input data was provided.', this);
        }

        const lCursor: BlobSerializerValueDeserializerCursor = {
            bytes: lData,
            dataView: new DataView(lData.buffer, lData.byteOffset, lData.byteLength),
            offset: 0,
        };

        return this.decodeWithCursor(lCursor);
    }

    /**
     * Decode the next value from the current cursor position.
     */
    private decodeWithCursor(pCursor: BlobSerializerValueDeserializerCursor): unknown {
        const lTag: number = this.readNextBytesAsUint8(pCursor);

        switch (lTag) {
            case ValueTypeTag.Null:
                return null;
            case ValueTypeTag.BooleanFalse:
                return false;
            case ValueTypeTag.BooleanTrue:
                return true;
            case ValueTypeTag.Number:
                return this.decodeNumber(pCursor);
            case ValueTypeTag.String:
                return this.decodeString(pCursor);
            case ValueTypeTag.Array:
                return this.decodeArray(pCursor);
            case ValueTypeTag.Object:
                return this.decodeRegisteredObject(pCursor);
            case ValueTypeTag.ArrayBuffer:
                return this.decodeArrayBuffer(pCursor);
            case ValueTypeTag.TypedArray:
                return this.decodeTypedArray(pCursor);
            default:
                throw new Exception(`Unknown value type tag: 0x${lTag.toString(16).padStart(2, '0')}`, this);
        }
    }

    /**
     * Decode an array of values.
     */
    private decodeArray(pCursor: BlobSerializerValueDeserializerCursor): Array<unknown> {
        const lCount: number = this.readNextBytesAsUint32(pCursor);
        const lArray: Array<unknown> = new Array<unknown>(lCount);

        for (let lIndex: number = 0; lIndex < lCount; lIndex++) {
            lArray[lIndex] = this.decodeWithCursor(pCursor);
        }

        return lArray;
    }

    /**
     * Decode an ArrayBuffer.
     */
    private decodeArrayBuffer(pCursor: BlobSerializerValueDeserializerCursor): ArrayBuffer {
        const lByteLength: number = this.readNextBytesAsUint32(pCursor);
        const lBytes: Uint8Array = this.readNextBytes(pCursor, lByteLength);
        // Copy bytes into a fresh ArrayBuffer.
        const lBuffer: ArrayBuffer = new ArrayBuffer(lByteLength);
        new Uint8Array(lBuffer).set(lBytes);
        return lBuffer;
    }

    /**
     * Decode a float64 number.
     */
    private decodeNumber(pCursor: BlobSerializerValueDeserializerCursor): number {
        return this.readNextBytesAsFloat64(pCursor);
    }

    /**
     * Decode a registered (decorated) object.
     */
    private decodeRegisteredObject(pCursor: BlobSerializerValueDeserializerCursor): object {
        // Read UUID.
        const lUuidByteLength: number = this.readNextBytesAsUint16(pCursor);
        const lUuid: string = this.readNextBytesAsString(pCursor, lUuidByteLength);

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
        const lPropertyCount: number = this.readNextBytesAsUint32(pCursor);

        for (let lPropertyIndex: number = 0; lPropertyIndex < lPropertyCount; lPropertyIndex++) {
            // Read key.
            const lKeyByteLength: number = this.readNextBytesAsUint16(pCursor);
            const lBinaryKey: string = this.readNextBytesAsString(pCursor, lKeyByteLength);

            // Decode value.
            const lValue: unknown = this.decodeWithCursor(pCursor);

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
    private decodeString(pCursor: BlobSerializerValueDeserializerCursor): string {
        const lByteLength: number = this.readNextBytesAsUint32(pCursor);
        return this.readNextBytesAsString(pCursor, lByteLength);
    }

    /**
     * Decode a TypedArray.
     */
    private decodeTypedArray(pCursor: BlobSerializerValueDeserializerCursor): TypedArray {
        const lSubType: TypedArraySubType = this.readNextBytesAsUint8(pCursor) as TypedArraySubType;
        const lByteLength: number = this.readNextBytesAsUint32(pCursor);
        const lBytes: Uint8Array = this.readNextBytes(pCursor, lByteLength);

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
    private readNextBytes(pCursor: BlobSerializerValueDeserializerCursor, pLength: number): Uint8Array {
        const lBytes: Uint8Array = pCursor.bytes.subarray(pCursor.offset, pCursor.offset + pLength);
        pCursor.offset += pLength;
        return lBytes;
    }

    /**
     * Read a float64 (little-endian) from the buffer and advance the offset.
     */
    private readNextBytesAsFloat64(pCursor: BlobSerializerValueDeserializerCursor): number {
        const lValue: number = pCursor.dataView.getFloat64(pCursor.offset, true);
        pCursor.offset += 8;
        return lValue;
    }

    /**
     * Read a UTF-8 string from the buffer.
     *
     * @param pByteLength - Number of bytes of the UTF-8 encoded string.
     */
    private readNextBytesAsString(pCursor: BlobSerializerValueDeserializerCursor, pByteLength: number): string {
        const lBytes: Uint8Array = this.readNextBytes(pCursor, pByteLength);
        return BlobSerializerValueDeserializer.mTextDecoder.decode(lBytes);
    }

    /**
     * Read a uint16 (little-endian) from the buffer and advance the offset.
     */
    private readNextBytesAsUint16(pCursor: BlobSerializerValueDeserializerCursor): number {
        const lValue: number = pCursor.dataView.getUint16(pCursor.offset, true);
        pCursor.offset += 2;
        return lValue;
    }

    /**
     * Read a uint32 (little-endian) from the buffer and advance the offset.
     */
    private readNextBytesAsUint32(pCursor: BlobSerializerValueDeserializerCursor): number {
        const lValue: number = pCursor.dataView.getUint32(pCursor.offset, true);
        pCursor.offset += 4;
        return lValue;
    }

    /**
     * Read a uint8 from the buffer and advance the offset.
     */
    private readNextBytesAsUint8(pCursor: BlobSerializerValueDeserializerCursor): number {
        const lValue: number = pCursor.dataView.getUint8(pCursor.offset);
        pCursor.offset += 1;
        return lValue;
    }
}

type BlobSerializerValueDeserializerCursor = {
    bytes: Uint8Array;
    dataView: DataView;
    offset: number;
};

type BlobSerializerValueDeserializerTypedArrayInfo = {
    subType: TypedArraySubType;
    bytesPerElement: number;
    constructor: new (buffer: ArrayBuffer, byteOffset?: number, length?: number) => TypedArray;
}
