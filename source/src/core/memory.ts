﻿///<reference path="../global.d.ts" />

declare function saveAs(data: Blob, name: string):void;

interface MemoryBase {
	writeInt8(address: number, value: number);
	writeInt16(address: number, value: number);
	writeInt32(address: number, value: number);
	writeFloat32(address: number, value: number);
	readInt8(address: number);
	readUInt8(address: number);
	readInt16(address: number);
	readUInt16(address: number);
	readInt32(address: number);
	readUInt32(address: number);
	readFloat32(address: number);
	readUInt32_2(address: number);

	slice(low:number, high:number):Uint8Array;
	availableAfterAddress(address:number):number;
}

class FastMemoryBase implements MemoryBase {
	private buffer: ArrayBuffer;
	private s8: Uint8Array;
	private u8: Uint8Array;
	private s16: Int16Array;
	private u16: Uint16Array;
	private s32: Uint32Array;
	private u32: Uint32Array;
	private f32: Float32Array;

	constructor() {
		this.buffer = new ArrayBuffer(0x0a000000 + 4);
		this.s8 = new Int8Array(this.buffer);
		this.u8 = new Uint8Array(this.buffer);
		this.u16 = new Uint16Array(this.buffer);
		this.s16 = new Int16Array(this.buffer);
		this.s32 = new Int32Array(this.buffer);
		this.u32 = new Uint32Array(this.buffer);
		this.f32 = new Float32Array(this.buffer);
	}

	writeInt8(address: number, value: number) { this.u8[(address & FastMemory.MASK) >> 0] = value; }
	writeInt16(address: number, value: number) { this.u16[(address & FastMemory.MASK) >> 1] = value; }
	writeInt32(address: number, value: number) { this.u32[(address & FastMemory.MASK) >> 2] = value; }
	writeFloat32(address: number, value: number) { this.f32[(address & FastMemory.MASK) >> 2] = value; }
	readInt8(address: number) { return this.s8[(address & FastMemory.MASK) >> 0]; }
	readUInt8(address: number) { return this.u8[(address & FastMemory.MASK) >> 0]; }
	readInt16(address: number) { return this.s16[(address & FastMemory.MASK) >> 1]; }
	readUInt16(address: number) { return this.u16[(address & FastMemory.MASK) >> 1]; }
	readInt32(address: number) { return this.s32[(address & FastMemory.MASK) >> 2]; }
	readUInt32(address: number) { return this.u32[(address & FastMemory.MASK) >> 2]; }
	readFloat32(address: number) { return this.f32[(address & FastMemory.MASK) >> 2]; }
	readUInt32_2(address: number) { return this.u32[address]; }

	slice(low:number, high:number):Uint8Array {
		low &= FastMemory.MASK;
		high &= FastMemory.MASK;
		return new Uint8Array(this.buffer, low, high - low);
	}

	availableAfterAddress(address:number):number {
		return this.buffer.byteLength - (address & FastMemory.MASK);
	}
}

class LowMemorySegment {
	size: number;
	low: number;
	high: number;
	offset4: number;
	s8: Uint8Array;
	u8: Uint8Array;
	s16: Int16Array;
	u16: Uint16Array;
	s32: Uint32Array;
	u32: Uint32Array;
	f32: Float32Array;

	constructor(public name:string, public offset:number, public buffer:ArrayBuffer) {
		this.size = buffer.byteLength;
		this.low = offset;
		this.offset4 = (offset / 4) | 0;
		this.high = this.low + this.size;
		this.s8 = new Int8Array(this.buffer);
		this.u8 = new Uint8Array(this.buffer);
		this.u16 = new Uint16Array(this.buffer);
		this.s16 = new Int16Array(this.buffer);
		this.s32 = new Int32Array(this.buffer);
		this.u32 = new Uint32Array(this.buffer);
		this.f32 = new Float32Array(this.buffer);
	}

	contains(address: number) {
		address &= FastMemory.MASK;
		return address >= this.low && address < this.high;
	}

	writeInt8(address: number, value: number) { this.u8[(address & FastMemory.MASK - this.offset) >> 0] = value; }
	writeInt16(address: number, value: number) { this.u16[(address & FastMemory.MASK - this.offset) >> 1] = value; }
	writeInt32(address: number, value: number) { this.u32[(address & FastMemory.MASK - this.offset) >> 2] = value; }
	writeFloat32(address: number, value: number) { this.f32[(address & FastMemory.MASK - this.offset) >> 2] = value; }
	readInt8(address: number) { return this.s8[(address & FastMemory.MASK - this.offset) >> 0]; }
	readUInt8(address: number) { return this.u8[(address & FastMemory.MASK - this.offset) >> 0]; }
	readInt16(address: number) { return this.s16[(address & FastMemory.MASK - this.offset) >> 1]; }
	readUInt16(address: number) { return this.u16[(address & FastMemory.MASK - this.offset) >> 1]; }
	readInt32(address: number) { return this.s32[(address & FastMemory.MASK - this.offset) >> 2]; }
	readUInt32(address: number) { return this.u32[(address & FastMemory.MASK - this.offset) >> 2]; }
	readFloat32(address: number) { return this.f32[(address & FastMemory.MASK - this.offset) >> 2]; }
	readUInt32_2(address: number) { return this.u32[address - this.offset4]; }

	slice(low:number, high:number):Uint8Array {
		low &= FastMemory.MASK;
		high &= FastMemory.MASK;
		low -= this.offset;
		high -= this.offset;
		return new Uint8Array(this.buffer, low, high - low);
	}

	availableAfterAddress(address:number):number {
		return this.buffer.byteLength - (address & FastMemory.MASK - this.offset);
	}
}

class LowMemoryBase implements MemoryBase {
	private scratchpad: LowMemorySegment;
	private videomem: LowMemorySegment;
	private mainmem: LowMemorySegment;

	constructor() {
		this.scratchpad = new LowMemorySegment('scatchpad', 0x00010000, new ArrayBuffer(16 * 1024));
		this.videomem = new LowMemorySegment('videomem', 0x04000000, new ArrayBuffer(2 * 1024 * 1024));
		this.mainmem = new LowMemorySegment('mainmem', 0x08000000, new ArrayBuffer(32 * 1024 * 1024));
	}

	getMemRange(address:number):LowMemorySegment {
		if (this.scratchpad.contains(address)) return this.scratchpad;
		if (this.videomem.contains(address)) return this.videomem;
		if (this.mainmem.contains(address)) return this.mainmem;
		// 02203738
		printf("Unmapped: %08X", address);
		return null;
	}

	writeInt8(address: number, value: number) { this.getMemRange(address).writeInt8(address, value); }
	writeInt16(address: number, value: number) { this.getMemRange(address).writeInt16(address, value); }
	writeInt32(address: number, value: number) { this.getMemRange(address).writeInt32(address, value); }
	writeFloat32(address: number, value: number) { this.getMemRange(address).writeFloat32(address, value); }
	readInt8(address: number) { return this.getMemRange(address).readInt8(address); }
	readUInt8(address: number) { return this.getMemRange(address).readUInt8(address); }
	readInt16(address: number) { return this.getMemRange(address).readInt16(address); }
	readUInt16(address: number) { return this.getMemRange(address).readUInt16(address); }
	readInt32(address: number) { return this.getMemRange(address).readInt32(address); }
	readUInt32(address: number) { return this.getMemRange(address).readUInt32(address); }
	readFloat32(address: number) { return this.getMemRange(address).readFloat32(address); }
	readUInt32_2(address: number) { return this.getMemRange(address).readUInt32_2(address); }

	slice(low:number, high:number):Uint8Array {
		return this.getMemRange(low).slice(low, high);
	}

	availableAfterAddress(address:number):number {
		return this.getMemRange(address).availableAfterAddress(address);
	}
}

declare var process:any;
function isNodeJs() {
	return typeof process != 'undefined';
}

class FastMemory {
	static DEFAULT_FRAME_ADDRESS: number = 0x04000000;
	static MASK = 0x0FFFFFFF;
	static MAIN_OFFSET = 0x08000000;

	isAddressInRange(address: number, min: number, max: number) {
		address &= FastMemory.MASK; address >>>= 0;
		min &= FastMemory.MASK; min >>>= 0;
		max &= FastMemory.MASK; max >>>= 0;

		return (address >= min) && (address < max);
	}

	isValidAddress(address: number) {
		address &= FastMemory.MASK;
		if ((address & 0x3E000000) == 0x08000000) return true;
		if ((address & 0x3F800000) == 0x04000000) return true;
		if ((address & 0xBFFF0000) == 0x00010000) return true;
		if (this.isAddressInRange(address, FastMemory.DEFAULT_FRAME_ADDRESS, FastMemory.DEFAULT_FRAME_ADDRESS + 0x200000)) return true;
		if (this.isAddressInRange(address, 0x08000000, 0x08000000 + 0x04000000)) return true;
		return false;
	}

	private base: MemoryBase;

	invalidateDataRange = new Signal<NumericRange>();
	invalidateDataAll = new Signal();

	constructor() {
		if (isNodeJs()) {
			this.base = new LowMemoryBase();
		} else {
			this.base = new FastMemoryBase();
		}
		this._updateWriteFunctions();
	}

	private availableAfterAddress(address:number) {
		return this.base.availableAfterAddress(address);
	}

	getPointerPointer<T>(type: IType, address: number) {
		if (address == 0) return null;
		return new Pointer<T>(type, this, address);
	}

	getPointerDataView(address: number, size?: number) {
		var data = this.getPointerU8Array(address, size);
		return new DataView(data.buffer, data.byteOffset, data.byteLength);
	}

	getPointerU8Array(address: number, size?: number) {
		if (!size) size = this.availableAfterAddress(address);
		return this.base.slice(address, address + size);
	}

	getPointerU16Array(address: number, size?: number) {
		return new Uint16Array(this.getPointerU8Array(address, size));
	}

	getPointerStream(address: number, size?: number) {
		//console.log(sprintf("getPointerStream: %08X", address));
		if (address == 0) return null;
		if (size === 0) return new Stream(new DataView(new ArrayBuffer(0)));
		if (!this.isValidAddress(address)) return Stream.INVALID;
		if (size === undefined) size = this.availableAfterAddress(address & FastMemory.MASK);
		if (size < 0) return Stream.INVALID;
		//if (size > this.u8.length - (address & FastMemory.MASK)) return Stream.INVALID;
		return new Stream(this.getPointerDataView(address & FastMemory.MASK, size));
	}

	getU8Array(address: number, size?: number) {
		if (address == 0) return null;
		if (!this.isValidAddress(address)) return null;
		if (!size) size = this.availableAfterAddress(address & FastMemory.MASK);
		return this.getPointerU8Array(address & FastMemory.MASK, size);
	}

	getU16Array(address: number, size?: number) {
		if (address == 0) return null;
		if (!this.isValidAddress(address)) return null;
		if (!size) size = this.availableAfterAddress(address & FastMemory.MASK);
		return this.getPointerU16Array(address & FastMemory.MASK, size);
	}

	private writeBreakpoints = <{ address: number; action: (address: number) => void; }[]>[]

	_updateWriteFunctions() {
		if (this.writeBreakpoints.length > 0) {
			this.writeInt8 = this._writeInt8_break;
			this.writeInt16 = this._writeInt16_break;
			this.writeInt32 = this._writeInt32_break;
			this.writeFloat32 = this._writeFloat32_break;
		} else {
			this.writeInt8 = this._writeInt8;
			this.writeInt16 = this._writeInt16;
			this.writeInt32 = this._writeInt32;
			this.writeFloat32 = this._writeFloat32;
		}
	}

	addWatch4(address: number) {
		this.addWriteAction(address, (address: number) => {
			console.log(sprintf('Watch:0x%08X <- 0x%08X', address, this.readUInt32(address)));
		});
	}

	addBreakpointOnValue(address: number, value: number) {
		//Watch: 0x0951044C < - 0x2A000000 

		this.addWriteAction(address, (actualAddress: number) => {
			var actualValue: number = this.readUInt32(address);

			console.log(sprintf('TryBreakpoint:0x%08X <- 0x%08X | 0x%08X (%d)', address, actualValue, value, (actualValue == value)));

			if (actualValue == value) {
				debugger;
			}
		});
	}

	addWriteAction(address: number, action: (address: number) => void) {
		this.writeBreakpoints.push({ address: address, action: action });

		this._updateWriteFunctions();
	}

	_checkWriteBreakpoints(start: number, end:number) {
		start &= FastMemory.MASK;
		end &= FastMemory.MASK;
		for (var n = 0; n < this.writeBreakpoints.length; n++) {
			var writeBreakpoint = this.writeBreakpoints[n];
			var addressCheck = writeBreakpoint.address & FastMemory.MASK;
			if (addressCheck >= start && addressCheck < end) {
				writeBreakpoint.action(writeBreakpoint.address);
			}
		}
	}

	protected _writeInt8(address: number, value: number) { this.base.writeInt8(address, value); }
	protected _writeInt16(address: number, value: number) { this.base.writeInt16(address, value); }
	protected _writeInt32(address: number, value: number) { this.base.writeInt32(address, value); }
	protected _writeFloat32(address: number, value: number) { this.base.writeFloat32(address, value); }

	protected _writeInt8_break(address: number, value: number) { this._writeInt8(address, value); this._checkWriteBreakpoints(address, address + 1); }
	protected _writeInt16_break(address: number, value: number) { this._writeInt16(address, value); this._checkWriteBreakpoints(address, address + 2); }
	protected _writeInt32_break(address: number, value: number) { this._writeInt32(address, value); this._checkWriteBreakpoints(address, address + 4); }
	protected _writeFloat32_break(address: number, value: number) { this._writeFloat32(address, value); this._checkWriteBreakpoints(address, address + 4); }

	writeInt8(address: number, value: number) { this._writeInt8(address, value); }
	writeInt16(address: number, value: number) { this._writeInt16(address, value); }
	writeInt32(address: number, value: number) { this._writeInt32(address, value); }
	writeFloat32(address: number, value: number) { this._writeFloat32(address, value); }

	readInt8(address: number) { return this.base.readInt8(address); }
	readUInt8(address: number) { return this.base.readUInt8(address); }
	readInt16(address: number) { return this.base.readInt16(address); }
	readUInt16(address: number) { return this.base.readUInt16(address); }
	readInt32(address: number) { return this.base.readInt32(address); }
	readUInt32(address: number) { return this.base.readUInt32(address); }
	readFloat32(address: number) { return this.base.readFloat32(address); }
	readUInt32_2(address: number) { return this.base.readUInt32_2(address); }

	readArrayBuffer(address: number, length: number) {
		var out = new Uint8Array(length);
		out.set(this.getPointerU8Array(address, length));
		return out.buffer;
	}

	sliceWithBounds(low: number, high: number) {
		return new Stream(this.getPointerDataView(low, high - low));
	}

	sliceWithSize(address: number, size: number) {
		return new Stream(this.getPointerDataView(address, size));
	}
}

export class Memory extends FastMemory {
	private static _instance: Memory;
	static get instance() {
		if (!Memory._instance) Memory._instance = new Memory();
		return Memory._instance;
	}

	reset() {
		this.memset(FastMemory.DEFAULT_FRAME_ADDRESS, 0, 0x200000);
	}

	copy(from: number, to: number, length: number) {
		if (length <= 0) return;
		//console.warn('copy:', from, to, length);
		this.getPointerU8Array(to, length).set(this.getPointerU8Array(from, length));
		this._checkWriteBreakpoints(to, to + length);
	}

	memset(address: number, value: number, length: number) {
		var buffer = this.getPointerU8Array(address, length);
		for (var n = 0; n < buffer.length; n++) buffer[n] = value & 0xFF;
		this._checkWriteBreakpoints(address, address + length);
	}

	writeBytes(address: number, data: ArrayBuffer) {
		this.getPointerU8Array(address, data.byteLength).set(new Uint8Array(data));
		this._checkWriteBreakpoints(address, address + data.byteLength);
	}

	writeStream(address: number, stream: Stream) {
		stream = stream.sliceWithLength(0, stream.length);
		while (stream.available > 0) {
			this.writeInt8(address++, stream.readUInt8());
		}
		this._checkWriteBreakpoints(address, address + stream.length);
	}

	readStringz(address: number) {
		if (address == 0) return null;
		var out = '';
		while (true) {
			var _char = this.readUInt8(address++);
			if (_char == 0) break;
			out += String.fromCharCode(_char);
		}
		return out;
	}

	hashWordCount(addressAligned: number, count: number) {
		addressAligned >>>= 2;
		count >>>= 2;

		var result = 0;
		for (var n = 0; n < count; n++) {
			var v = this.readUInt32_2(addressAligned + n);
			result = (result + v ^ n) | 0;
		}
		return result;
	}

	hash(address: number, count: number) {
		var result = 0;

		while ((address & 3) != 0) { result += this.readUInt8(address++); count--; }

		var count2 = MathUtils.prevAligned(count, 4);

		result += this.hashWordCount(address, count2);

		address += count2;
		count -= count2;

		while ((address & 3) != 0) { result += this.readUInt8(address++) * 7; count--; }

		return result;
	}

	writeUint8Array(address: number, data: Uint8Array) {
		for (var n = 0; n < data.length; n++) this._writeInt8(address + n, data[n]);
		this._checkWriteBreakpoints(address, address + data.length);
	}

	static memoryCopy(source: ArrayBuffer, sourcePosition: number, destination: ArrayBuffer, destinationPosition: number, length: number) {
		var _source = new Uint8Array(source, sourcePosition, length);
		var _destination = new Uint8Array(destination, destinationPosition, length);
		_destination.set(_source);
	}

	dump(name = 'memory.bin') {
		saveAs(new Blob([this.getPointerDataView(0x08000000, 0x2000000)]), name);
	}
}