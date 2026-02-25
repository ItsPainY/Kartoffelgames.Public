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

    private mBytes: Uint8Array;
    private mDataView: DataView;
    private mOffset: number;

    /**
     * Constructor.
     *
     * @param pData - The encoded byte data.
     */
    public constructor(pData?: Uint8Array) {
        this.mBytes = new Uint8Array(0);
        this.mDataView = new DataView(this.mBytes.buffer);
        this.mOffset = 0;

        if (pData) {
            this.setData(pData);
        }
    }

    /**
     * Deserialize a value from the provided byte data.
     * Resets the internal cursor to the beginning of the provided buffer.
     *
     * @param pData - The encoded byte data.
     *
     * @returns the decoded JavaScript value.
     */
    public deserialize(pData: Uint8Array): unknown {
        this.setData(pData);
        return this.decode();
    }

    /**
     * Decode the value starting from the current offset.
     *
     * @returns the decoded JavaScript value.
     *
     * @throws Exception if an unknown type tag is encountered.
     */
    public decode(): unknown {
        const lTag: number = this.readNextBytesAsUint8();

        switch (lTag) {
            case ValueTypeTag.Null:
                return null;
            case ValueTypeTag.BooleanFalse:
                return false;
            case ValueTypeTag.BooleanTrue:
                return true;
            case ValueTypeTag.Number:
                return this.decodeNumber();
            case ValueTypeTag.String:
                return this.decodeString();
            case ValueTypeTag.Array:
                return this.decodeArray();
            case ValueTypeTag.Object:
                return this.decodeRegisteredObject();
            case ValueTypeTag.ArrayBuffer:
                return this.decodeArrayBuffer();
            case ValueTypeTag.TypedArray:
                return this.decodeTypedArray();
            default:
                throw new Exception(`Unknown value type tag: 0x${lTag.toString(16).padStart(2, '0')}`, this);
        }
    }

    /**
     * Set the source data and reset the internal cursor.
     *
     * @param pData - The encoded byte data.
     */
    public setData(pData: Uint8Array): void {
        this.mBytes = pData;
        this.mDataView = new DataView(pData.buffer, pData.byteOffset, pData.byteLength);
        this.mOffset = 0;
    }

    /**
     * Decode an array of values.
     */
    private decodeArray(): Array<unknown> {
        const lCount: number = this.readNextBytesAsUint32();
        const lArray: Array<unknown> = new Array<unknown>(lCount);

        for (let lIndex: number = 0; lIndex < lCount; lIndex++) {
            lArray[lIndex] = this.decode();
        }

        return lArray;
    }

    /**
     * Decode an ArrayBuffer.
     */
    private decodeArrayBuffer(): ArrayBuffer {
        const lByteLength: number = this.readNextBytesAsUint32();
        const lBytes: Uint8Array = this.readNextBytes(lByteLength);
        // Copy bytes into a fresh ArrayBuffer.
        const lBuffer: ArrayBuffer = new ArrayBuffer(lByteLength);
        new Uint8Array(lBuffer).set(lBytes);
        return lBuffer;
    }

    /**
     * Decode a float64 number.
     */
    private decodeNumber(): number {
        return this.readNextBytesAsFloat64();
    }

    /**
     * Decode a registered (decorated) object.
     */
    private decodeRegisteredObject(): object {
        // Read UUID.
        const lUuidByteLength: number = this.readNextBytesAsUint16();
        const lUuid: string = this.readNextBytesAsString(lUuidByteLength);

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
        const lPropertyCount: number = this.readNextBytesAsUint32();

        for (let lPropertyIndex: number = 0; lPropertyIndex < lPropertyCount; lPropertyIndex++) {
            // Read key.
            const lKeyByteLength: number = this.readNextBytesAsUint16();
            const lBinaryKey: string = this.readNextBytesAsString(lKeyByteLength);

            // Decode value.
            const lValue: unknown = this.decode();

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
    private decodeString(): string {
        const lByteLength: number = this.readNextBytesAsUint32();
        return this.readNextBytesAsString(lByteLength);
    }

    /**
     * Decode a TypedArray.
     */
    private decodeTypedArray(): TypedArray {
        const lSubType: TypedArraySubType = this.readNextBytesAsUint8() as TypedArraySubType;
        const lByteLength: number = this.readNextBytesAsUint32();
        const lBytes: Uint8Array = this.readNextBytes(lByteLength);

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
    private readNextBytes(pLength: number): Uint8Array {
        const lBytes: Uint8Array = this.mBytes.subarray(this.mOffset, this.mOffset + pLength);
        this.mOffset += pLength;
        return lBytes;
    }

    /**
     * Read a float64 (little-endian) from the buffer and advance the offset.
     */
    private readNextBytesAsFloat64(): number {
        const lValue: number = this.mDataView.getFloat64(this.mOffset, true);
        this.mOffset += 8;
        return lValue;
    }

    /**
     * Read a UTF-8 string from the buffer.
     *
     * @param pByteLength - Number of bytes of the UTF-8 encoded string.
     */
    private readNextBytesAsString(pByteLength: number): string {
        const lBytes: Uint8Array = this.readNextBytes(pByteLength);
        return BlobSerializerValueDeserializer.mTextDecoder.decode(lBytes);
    }

    /**
     * Read a uint16 (little-endian) from the buffer and advance the offset.
     */
    private readNextBytesAsUint16(): number {
        const lValue: number = this.mDataView.getUint16(this.mOffset, true);
        this.mOffset += 2;
        return lValue;
    }

    /**
     * Read a uint32 (little-endian) from the buffer and advance the offset.
     */
    private readNextBytesAsUint32(): number {
        const lValue: number = this.mDataView.getUint32(this.mOffset, true);
        this.mOffset += 4;
        return lValue;
    }

    /**
     * Read a uint8 from the buffer and advance the offset.
     */
    private readNextBytesAsUint8(): number {
        const lValue: number = this.mDataView.getUint8(this.mOffset);
        this.mOffset += 1;
        return lValue;
    }
}

type BlobSerializerValueDeserializerTypedArrayInfo = {
    subType: TypedArraySubType;
    bytesPerElement: number;
    constructor: new (buffer: ArrayBuffer, byteOffset?: number, length?: number) => TypedArray;
}
