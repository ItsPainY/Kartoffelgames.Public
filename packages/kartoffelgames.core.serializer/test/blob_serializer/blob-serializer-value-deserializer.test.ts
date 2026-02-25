import { expect } from '@kartoffelgames/core-test';
import { BlobSerializerValueSerializer } from '../../source/blob_serializer/blob-serializer-value-serializer.ts';
import { BlobSerializerValueDeserializer } from '../../source/blob_serializer/blob-serializer-value-deserializer.ts';
import { Serializer } from '../../source/core/serializer.ts';

Deno.test('BlobSerializerValueDeserializer.decode() - Primitives', async (pContext) => {
    await pContext.step('Round-trip null', () => {
        // Setup.
        const lEncoder: BlobSerializerValueSerializer = new BlobSerializerValueSerializer();
        const lEncoded: Uint8Array = lEncoder.serialize(null);

        // Process.
        const lDecoder: BlobSerializerValueDeserializer = new BlobSerializerValueDeserializer();
        const lResult: unknown = lDecoder.deserialize(lEncoded);

        // Evaluation.
        expect(lResult).toBeNull();
    });

    await pContext.step('Round-trip boolean true', () => {
        // Setup.
        const lEncoder: BlobSerializerValueSerializer = new BlobSerializerValueSerializer();
        const lEncoded: Uint8Array = lEncoder.serialize(true);

        // Process.
        const lDecoder: BlobSerializerValueDeserializer = new BlobSerializerValueDeserializer();
        const lResult: unknown = lDecoder.deserialize(lEncoded);

        // Evaluation.
        expect(lResult).toBe(true);
    });

    await pContext.step('Round-trip boolean false', () => {
        // Setup.
        const lEncoder: BlobSerializerValueSerializer = new BlobSerializerValueSerializer();
        const lEncoded: Uint8Array = lEncoder.serialize(false);

        // Process.
        const lDecoder: BlobSerializerValueDeserializer = new BlobSerializerValueDeserializer();
        const lResult: unknown = lDecoder.deserialize(lEncoded);

        // Evaluation.
        expect(lResult).toBe(false);
    });

    await pContext.step('Round-trip positive number', () => {
        // Setup.
        const lValue: number = 42.5;
        const lEncoder: BlobSerializerValueSerializer = new BlobSerializerValueSerializer();
        const lEncoded: Uint8Array = lEncoder.serialize(lValue);

        // Process.
        const lDecoder: BlobSerializerValueDeserializer = new BlobSerializerValueDeserializer();
        const lResult: unknown = lDecoder.deserialize(lEncoded);

        // Evaluation.
        expect(lResult).toBe(lValue);
    });

    await pContext.step('Round-trip negative number', () => {
        // Setup.
        const lValue: number = -123.456;
        const lEncoder: BlobSerializerValueSerializer = new BlobSerializerValueSerializer();
        const lEncoded: Uint8Array = lEncoder.serialize(lValue);

        // Process.
        const lDecoder: BlobSerializerValueDeserializer = new BlobSerializerValueDeserializer();
        const lResult: unknown = lDecoder.deserialize(lEncoded);

        // Evaluation.
        expect(lResult).toBe(lValue);
    });

    await pContext.step('Round-trip NaN', () => {
        // Setup.
        const lEncoder: BlobSerializerValueSerializer = new BlobSerializerValueSerializer();
        const lEncoded: Uint8Array = lEncoder.serialize(NaN);

        // Process.
        const lDecoder: BlobSerializerValueDeserializer = new BlobSerializerValueDeserializer();
        const lResult: unknown = lDecoder.deserialize(lEncoded);

        // Evaluation.
        expect(Number.isNaN(lResult as number)).toBeTruthy();
    });

    await pContext.step('Round-trip Infinity', () => {
        // Setup.
        const lEncoder: BlobSerializerValueSerializer = new BlobSerializerValueSerializer();
        const lEncoded: Uint8Array = lEncoder.serialize(Infinity);

        // Process.
        const lDecoder: BlobSerializerValueDeserializer = new BlobSerializerValueDeserializer();
        const lResult: unknown = lDecoder.deserialize(lEncoded);

        // Evaluation.
        expect(lResult).toBe(Infinity);
    });

    await pContext.step('Round-trip negative Infinity', () => {
        // Setup.
        const lEncoder: BlobSerializerValueSerializer = new BlobSerializerValueSerializer();
        const lEncoded: Uint8Array = lEncoder.serialize(-Infinity);

        // Process.
        const lDecoder: BlobSerializerValueDeserializer = new BlobSerializerValueDeserializer();
        const lResult: unknown = lDecoder.deserialize(lEncoded);

        // Evaluation.
        expect(lResult).toBe(-Infinity);
    });
});

Deno.test('ValueDecoder.decode() - String', async (pContext) => {
    await pContext.step('Round-trip empty string', () => {
        // Setup.
        const lEncoder: BlobSerializerValueSerializer = new BlobSerializerValueSerializer();
        const lEncoded: Uint8Array = lEncoder.serialize('');

        // Process.
        const lDecoder: BlobSerializerValueDeserializer = new BlobSerializerValueDeserializer();
        const lResult: unknown = lDecoder.deserialize(lEncoded);

        // Evaluation.
        expect(lResult).toBe('');
    });

    await pContext.step('Round-trip ASCII string', () => {
        // Setup.
        const lValue: string = 'Hello World';
        const lEncoder: BlobSerializerValueSerializer = new BlobSerializerValueSerializer();
        const lEncoded: Uint8Array = lEncoder.serialize(lValue);

        // Process.
        const lDecoder: BlobSerializerValueDeserializer = new BlobSerializerValueDeserializer();
        const lResult: unknown = lDecoder.deserialize(lEncoded);

        // Evaluation.
        expect(lResult).toBe(lValue);
    });

    await pContext.step('Round-trip Unicode string', () => {
        // Setup.
        const lValue: string = 'Kartoffel\u00E4\u00F6\u00FC\u00DF';
        const lEncoder: BlobSerializerValueSerializer = new BlobSerializerValueSerializer();
        const lEncoded: Uint8Array = lEncoder.serialize(lValue);

        // Process.
        const lDecoder: BlobSerializerValueDeserializer = new BlobSerializerValueDeserializer();
        const lResult: unknown = lDecoder.deserialize(lEncoded);

        // Evaluation.
        expect(lResult).toBe(lValue);
    });
});

Deno.test('ValueDecoder.decode() - Array', async (pContext) => {
    await pContext.step('Round-trip empty array', () => {
        // Setup.
        const lEncoder: BlobSerializerValueSerializer = new BlobSerializerValueSerializer();
        const lEncoded: Uint8Array = lEncoder.serialize([]);

        // Process.
        const lDecoder: BlobSerializerValueDeserializer = new BlobSerializerValueDeserializer();
        const lResult: unknown = lDecoder.deserialize(lEncoded);

        // Evaluation.
        expect(lResult).toBeDeepEqual([]);
    });

    await pContext.step('Round-trip array with mixed types', () => {
        // Setup.
        const lValue: Array<unknown> = [42, 'hello', true, null, -1.5];
        const lEncoder: BlobSerializerValueSerializer = new BlobSerializerValueSerializer();
        const lEncoded: Uint8Array = lEncoder.serialize(lValue);

        // Process.
        const lDecoder: BlobSerializerValueDeserializer = new BlobSerializerValueDeserializer();
        const lResult: unknown = lDecoder.deserialize(lEncoded);

        // Evaluation.
        expect(lResult).toBeDeepEqual(lValue);
    });

    await pContext.step('Round-trip nested array', () => {
        // Setup.
        const lValue: Array<unknown> = [[1, 2], [3, [4, 5]]];
        const lEncoder: BlobSerializerValueSerializer = new BlobSerializerValueSerializer();
        const lEncoded: Uint8Array = lEncoder.serialize(lValue);

        // Process.
        const lDecoder: BlobSerializerValueDeserializer = new BlobSerializerValueDeserializer();
        const lResult: unknown = lDecoder.deserialize(lEncoded);

        // Evaluation.
        expect(lResult).toBeDeepEqual(lValue);
    });
});

Deno.test('ValueDecoder.decode() - ArrayBuffer', async (pContext) => {
    await pContext.step('Round-trip ArrayBuffer', () => {
        // Setup.
        const lOriginal: ArrayBuffer = new ArrayBuffer(4);
        new Uint8Array(lOriginal).set([0xDE, 0xAD, 0xBE, 0xEF]);
        const lEncoder: BlobSerializerValueSerializer = new BlobSerializerValueSerializer();
        const lEncoded: Uint8Array = lEncoder.serialize(lOriginal);

        // Process.
        const lDecoder: BlobSerializerValueDeserializer = new BlobSerializerValueDeserializer();
        const lResult: unknown = lDecoder.deserialize(lEncoded);

        // Evaluation.
        expect(lResult).toBeInstanceOf(ArrayBuffer);
        const lResultBytes: Uint8Array = new Uint8Array(lResult as ArrayBuffer);
        expect(lResultBytes[0]).toBe(0xDE);
        expect(lResultBytes[1]).toBe(0xAD);
        expect(lResultBytes[2]).toBe(0xBE);
        expect(lResultBytes[3]).toBe(0xEF);
    });

    await pContext.step('Round-trip empty ArrayBuffer', () => {
        // Setup.
        const lOriginal: ArrayBuffer = new ArrayBuffer(0);
        const lEncoder: BlobSerializerValueSerializer = new BlobSerializerValueSerializer();
        const lEncoded: Uint8Array = lEncoder.serialize(lOriginal);

        // Process.
        const lDecoder: BlobSerializerValueDeserializer = new BlobSerializerValueDeserializer();
        const lResult: unknown = lDecoder.deserialize(lEncoded);

        // Evaluation.
        expect(lResult).toBeInstanceOf(ArrayBuffer);
        expect((lResult as ArrayBuffer).byteLength).toBe(0);
    });
});

Deno.test('ValueDecoder.decode() - TypedArray', async (pContext) => {
    await pContext.step('Round-trip Uint8Array', () => {
        // Setup.
        const lOriginal: Uint8Array = new Uint8Array([10, 20, 30, 40]);
        const lEncoder: BlobSerializerValueSerializer = new BlobSerializerValueSerializer();
        const lEncoded: Uint8Array = lEncoder.serialize(lOriginal);

        // Process.
        const lDecoder: BlobSerializerValueDeserializer = new BlobSerializerValueDeserializer();
        const lResult: unknown = lDecoder.deserialize(lEncoded);

        // Evaluation.
        expect(lResult).toBeInstanceOf(Uint8Array);
        const lResultArray: Uint8Array = lResult as Uint8Array;
        expect(lResultArray.length).toBe(4);
        expect(lResultArray[0]).toBe(10);
        expect(lResultArray[3]).toBe(40);
    });

    await pContext.step('Round-trip Float32Array', () => {
        // Setup.
        const lOriginal: Float32Array = new Float32Array([1.5, 2.5, 3.5]);
        const lEncoder: BlobSerializerValueSerializer = new BlobSerializerValueSerializer();
        const lEncoded: Uint8Array = lEncoder.serialize(lOriginal);

        // Process.
        const lDecoder: BlobSerializerValueDeserializer = new BlobSerializerValueDeserializer();
        const lResult: unknown = lDecoder.deserialize(lEncoded);

        // Evaluation.
        expect(lResult).toBeInstanceOf(Float32Array);
        const lResultArray: Float32Array = lResult as Float32Array;
        expect(lResultArray.length).toBe(3);
        expect(lResultArray[0]).toBe(1.5);
        expect(lResultArray[1]).toBe(2.5);
        expect(lResultArray[2]).toBe(3.5);
    });

    await pContext.step('Round-trip Int16Array', () => {
        // Setup.
        const lOriginal: Int16Array = new Int16Array([-100, 200, -300]);
        const lEncoder: BlobSerializerValueSerializer = new BlobSerializerValueSerializer();
        const lEncoded: Uint8Array = lEncoder.serialize(lOriginal);

        // Process.
        const lDecoder: BlobSerializerValueDeserializer = new BlobSerializerValueDeserializer();
        const lResult: unknown = lDecoder.deserialize(lEncoded);

        // Evaluation.
        expect(lResult).toBeInstanceOf(Int16Array);
        const lResultArray: Int16Array = lResult as Int16Array;
        expect(lResultArray[0]).toBe(-100);
        expect(lResultArray[1]).toBe(200);
        expect(lResultArray[2]).toBe(-300);
    });

    await pContext.step('Round-trip BigInt64Array', () => {
        // Setup.
        const lOriginal: BigInt64Array = new BigInt64Array([1n, -2n, 3n]);
        const lEncoder: BlobSerializerValueSerializer = new BlobSerializerValueSerializer();
        const lEncoded: Uint8Array = lEncoder.serialize(lOriginal);

        // Process.
        const lDecoder: BlobSerializerValueDeserializer = new BlobSerializerValueDeserializer();
        const lResult: unknown = lDecoder.deserialize(lEncoded);

        // Evaluation.
        expect(lResult).toBeInstanceOf(BigInt64Array);
        const lResultArray: BigInt64Array = lResult as BigInt64Array;
        expect(lResultArray[0]).toBe(1n);
        expect(lResultArray[1]).toBe(-2n);
        expect(lResultArray[2]).toBe(3n);
    });

    await pContext.step('Round-trip Float64Array', () => {
        // Setup.
        const lOriginal: Float64Array = new Float64Array([Math.PI, Math.E]);
        const lEncoder: BlobSerializerValueSerializer = new BlobSerializerValueSerializer();
        const lEncoded: Uint8Array = lEncoder.serialize(lOriginal);

        // Process.
        const lDecoder: BlobSerializerValueDeserializer = new BlobSerializerValueDeserializer();
        const lResult: unknown = lDecoder.deserialize(lEncoded);

        // Evaluation.
        expect(lResult).toBeInstanceOf(Float64Array);
        const lResultArray: Float64Array = lResult as Float64Array;
        expect(lResultArray[0]).toBe(Math.PI);
        expect(lResultArray[1]).toBe(Math.E);
    });
});

Deno.test('ValueDecoder.decode() - Registered Object', async (pContext) => {
    await pContext.step('Round-trip registered object', () => {
        // Setup.
        const lUuid: string = 'dec-test-obj-1';

        @Serializer.serializeableClass(lUuid)
        class TestObj {
            @Serializer.property()
            public age: number = 0;

            @Serializer.property()
            public name: string = '';
        }

        const lOriginal: TestObj = new TestObj();
        lOriginal.age = 30;
        lOriginal.name = 'Alice';

        const lEncoder: BlobSerializerValueSerializer = new BlobSerializerValueSerializer();
        const lEncoded: Uint8Array = lEncoder.serialize(lOriginal);

        // Process.
        const lDecoder: BlobSerializerValueDeserializer = new BlobSerializerValueDeserializer();
        const lResult: unknown = lDecoder.deserialize(lEncoded);

        // Evaluation.
        expect(lResult).toBeInstanceOf(TestObj);
        expect((lResult as TestObj).name).toBe('Alice');
        expect((lResult as TestObj).age).toBe(30);
    });

    await pContext.step('Round-trip registered object with alias', () => {
        // Setup.
        const lUuid: string = 'dec-test-obj-alias';

        @Serializer.serializeableClass(lUuid)
        class TestObj {
            @Serializer.property({ alias: 'n' })
            public name: string = '';
        }

        const lOriginal: TestObj = new TestObj();
        lOriginal.name = 'Bob';

        const lEncoder: BlobSerializerValueSerializer = new BlobSerializerValueSerializer();
        const lEncoded: Uint8Array = lEncoder.serialize(lOriginal);

        // Process.
        const lDecoder: BlobSerializerValueDeserializer = new BlobSerializerValueDeserializer();
        const lResult: unknown = lDecoder.deserialize(lEncoded);

        // Evaluation.
        expect(lResult).toBeInstanceOf(TestObj);
        expect((lResult as TestObj).name).toBe('Bob');
    });

    await pContext.step('Round-trip nested registered objects', () => {
        // Setup.
        const lInnerUuid: string = 'dec-test-inner';
        const lOuterUuid: string = 'dec-test-outer';

        @Serializer.serializeableClass(lInnerUuid)
        class Inner {
            @Serializer.property()
            public value: number = 0;
        }

        @Serializer.serializeableClass(lOuterUuid)
        class Outer {
            @Serializer.property()
            public child: Inner | null = null;

            @Serializer.property()
            public label: string = '';

        }

        const lInner: Inner = new Inner();
        lInner.value = 99;

        const lOuter: Outer = new Outer();
        lOuter.child = lInner;
        lOuter.label = 'parent';

        const lEncoder: BlobSerializerValueSerializer = new BlobSerializerValueSerializer();
        const lEncoded: Uint8Array = lEncoder.serialize(lOuter);

        // Process.
        const lDecoder: BlobSerializerValueDeserializer = new BlobSerializerValueDeserializer();
        const lResult: unknown = lDecoder.deserialize(lEncoded);

        // Evaluation.
        expect(lResult).toBeInstanceOf(Outer);
        const lResultOuter: Outer = lResult as Outer;
        expect(lResultOuter.label).toBe('parent');
        expect(lResultOuter.child).toBeInstanceOf(Inner);
        expect(lResultOuter.child!.value).toBe(99);
    });

    await pContext.step('Round-trip registered object with getter/setter', () => {
        // Setup.
        const lUuid: string = 'dec-test-getter-setter';

        @Serializer.serializeableClass(lUuid)
        class TestObj {
            private mValue: string = '';

            @Serializer.property()
            public get value(): string {
                return this.mValue;
            }

            public set value(pValue: string) {
                this.mValue = pValue;
            }
        }

        const lOriginal: TestObj = new TestObj();
        lOriginal.value = 'test-value';

        const lEncoder: BlobSerializerValueSerializer = new BlobSerializerValueSerializer();
        const lEncoded: Uint8Array = lEncoder.serialize(lOriginal);

        // Process.
        const lDecoder: BlobSerializerValueDeserializer = new BlobSerializerValueDeserializer();
        const lResult: unknown = lDecoder.deserialize(lEncoded);

        // Evaluation.
        expect(lResult).toBeInstanceOf(TestObj);
        expect((lResult as TestObj).value).toBe('test-value');
    });

    await pContext.step('Round-trip registered object with array of objects', () => {
        // Setup.
        const lItemUuid: string = 'dec-test-arr-item';
        const lContainerUuid: string = 'dec-test-arr-container';

        @Serializer.serializeableClass(lItemUuid)
        class Item {
            @Serializer.property()
            public name: string = '';
        }

        @Serializer.serializeableClass(lContainerUuid)
        class Container {
            @Serializer.property()
            public items: Array<Item> = [];
        }

        const lItem1: Item = new Item();
        lItem1.name = 'Item1';
        const lItem2: Item = new Item();
        lItem2.name = 'Item2';

        const lContainer: Container = new Container();
        lContainer.items = [lItem1, lItem2];

        const lEncoder: BlobSerializerValueSerializer = new BlobSerializerValueSerializer();
        const lEncoded: Uint8Array = lEncoder.serialize(lContainer);

        // Process.
        const lDecoder: BlobSerializerValueDeserializer = new BlobSerializerValueDeserializer();
        const lResult: unknown = lDecoder.deserialize(lEncoded);

        // Evaluation.
        expect(lResult).toBeInstanceOf(Container);
        const lResultContainer: Container = lResult as Container;
        expect(lResultContainer.items.length).toBe(2);
        expect(lResultContainer.items[0]).toBeInstanceOf(Item);
        expect(lResultContainer.items[0].name).toBe('Item1');
        expect(lResultContainer.items[1]).toBeInstanceOf(Item);
        expect(lResultContainer.items[1].name).toBe('Item2');
    });
});

Deno.test('ValueDecoder.decode() - Complex round-trip', async (pContext) => {
    await pContext.step('Round-trip complex nested structure', () => {
        // Setup.
        const lUuid: string = 'dec-test-complex';

        @Serializer.serializeableClass(lUuid)
        class ComplexObj {
            @Serializer.property()
            public active: boolean = false;

            @Serializer.property()
            public data: ArrayBuffer = new ArrayBuffer(0);

            @Serializer.property()
            public label: string = '';

            @Serializer.property()
            public numbers: Array<number> = [];

            @Serializer.property()
            public optional: null = null;

            @Serializer.property()
            public values: Float32Array = new Float32Array(0);
        }

        const lOriginal: ComplexObj = new ComplexObj();
        lOriginal.numbers = [1, 2, 3, 4, 5];
        lOriginal.label = 'Complex Test';
        lOriginal.active = true;
        lOriginal.data = new ArrayBuffer(3);
        new Uint8Array(lOriginal.data).set([0xAA, 0xBB, 0xCC]);
        lOriginal.values = new Float32Array([1.1, 2.2, 3.3]);
        lOriginal.optional = null;

        const lEncoder: BlobSerializerValueSerializer = new BlobSerializerValueSerializer();
        const lEncoded: Uint8Array = lEncoder.serialize(lOriginal);

        // Process.
        const lDecoder: BlobSerializerValueDeserializer = new BlobSerializerValueDeserializer();
        const lResult: unknown = lDecoder.deserialize(lEncoded);

        // Evaluation.
        expect(lResult).toBeInstanceOf(ComplexObj);
        const lResultObj: ComplexObj = lResult as ComplexObj;
        expect(lResultObj.numbers).toBeDeepEqual([1, 2, 3, 4, 5]);
        expect(lResultObj.label).toBe('Complex Test');
        expect(lResultObj.active).toBe(true);
        expect(new Uint8Array(lResultObj.data)).toBeDeepEqual(new Uint8Array([0xAA, 0xBB, 0xCC]));
        expect(lResultObj.values[0]).toBeCloseTo(1.1, 5);
        expect(lResultObj.optional).toBeNull();
    });
});
