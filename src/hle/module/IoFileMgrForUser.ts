﻿import _utils = require('../utils');
import _manager = require('../manager');
import _context = require('../../context');
import createNativeFunction = _utils.createNativeFunction;
import _vfs = require('../vfs');
import _structs = require('../structs');
import SceKernelErrors = require('../SceKernelErrors');

import FileMode = _vfs.FileMode;
import FileOpenFlags = _vfs.FileOpenFlags;
import VfsStat = _vfs.VfsStat;


export class IoFileMgrForUser {
	constructor(private context: _context.EmulatorContext) { }

	sceIoDevctl = createNativeFunction(0x54F5FB11, 150, 'uint', 'string/uint/uint/int/uint/int', this, (deviceName: string, command: number, inputPointer: number, inputLength: number, outputPointer: number, outputLength: number) => {
		var input = this.context.memory.getPointerStream(inputPointer, inputLength);
		var output = this.context.memory.getPointerStream(outputPointer, outputLength);
		/*
		public enum EmulatorDevclEnum : int
		{
			GetHasDisplay = 0x00000001,
			SendOutput = 0x00000002,
			IsEmulator = 0x00000003,
			SendCtrlData = 0x00000010,
			EmitScreenshot = 0x00000020,
		}
		*/

		switch (deviceName) {
			case 'emulator:': case 'kemulator:':
				switch (command) {
					case 1:
						output.writeInt32(0);
						//output.writeInt32(1);
						return 0;
						break;
					case 2:
						var str = input.readString(input.length);
						this.context.output += str;
						$('#output').append(str);
						//console.info();
						return 0;
						break;
				}
				break;
		}

		console.warn(sprintf('Not implemented IoFileMgrForUser.sceIoDevctl("%s", %d, %08X, %d, %08X, %d)', deviceName, command, inputPointer, inputLength, outputPointer, outputLength));
		return 0;
	});


	fileUids = new UidCollection<_manager.HleFile>(1);
	directoryUids = new UidCollection<_manager.HleDirectory>(1);

	sceIoOpen = createNativeFunction(0x109F50BC, 150, 'int', 'string/int/int', this, (filename: string, flags: FileOpenFlags, mode: FileMode) => {
		console.info(sprintf('IoFileMgrForUser.sceIoOpen("%s", %d(%s), 0%o)', filename, flags, setToString(FileOpenFlags, flags), mode));

		return this._sceIoOpen(filename, flags, mode);
	});

	private _sceIoOpen(filename: string, flags: FileOpenFlags, mode: FileMode) {
		return this.context.fileManager.openAsync(filename, flags, mode)
			.then(file => this.fileUids.allocate(file))
			.catch(e => {
				console.log('SceKernelErrors.ERROR_ERRNO_FILE_NOT_FOUND: ' + SceKernelErrors.ERROR_ERRNO_FILE_NOT_FOUND);
				return SceKernelErrors.ERROR_ERRNO_FILE_NOT_FOUND;
			})
			;
	}

	sceIoOpenAsync = createNativeFunction(0x89AA9906, 150, 'int', 'string/int/int', this, (filename: string, flags: FileOpenFlags, mode: FileMode) => {
		console.info(sprintf('IoFileMgrForUser.sceIoOpenAsync("%s", %d(%s), 0%o)', filename, flags, setToString(FileOpenFlags, flags), mode));
		//if (filename == '') return Promise.resolve(0);

		return this._sceIoOpen(filename, flags, mode);
	});

	sceIoClose = createNativeFunction(0x810C4BC3, 150, 'int', 'int', this, (fileId: number) => {
		var file = this.fileUids.get(fileId);
		if (file) file.close();

		this.fileUids.remove(fileId);

		return 0;
	});

	sceIoWrite = createNativeFunction(0x42EC03AC, 150, 'int', 'int/uint/int', this, (fileId: number, inputPointer: number, inputLength: number) => {
		var input = this.context.memory.getPointerStream(inputPointer, inputLength);
		console.warn(sprintf('Not implemented IoFileMgrForUser.sceIoWrite("%s")', input.readString(input.length)));
		//console.warn(sprintf('Not implemented IoFileMgrForUser.sceIoWrite(%d, 0x%08X, %d)', fileId, inputPointer, inputLength));
		return inputLength;
	});

	sceIoRead = createNativeFunction(0x6A638D83, 150, 'int', 'int/uint/int', this, (fileId: number, outputPointer: number, outputLength: number) => {
		var file = this.fileUids.get(fileId);

		return file.entry.readChunkAsync(file.cursor, outputLength).then((readedData) => {
			file.cursor += readedData.byteLength;
			//console.log(new Uint8Array(readedData));
			this.context.memory.writeBytes(outputPointer, readedData);
			//console.info(sprintf('IoFileMgrForUser.sceIoRead(%d, %08X: %d) : cursor:%d ->%d', fileId, outputPointer, outputLength, file.cursor, readedData.byteLength));
			return readedData.byteLength;
		});
	});

	_vfsStatToSceIoStat(stat: VfsStat) {
		var stat2 = new _structs.SceIoStat();
		stat2.mode = <_structs.SceMode>parseInt('777', 8)
				stat2.size = stat.size;
		stat2.timeCreation = _structs.ScePspDateTime.fromDate(stat.timeCreation);
		stat2.timeLastAccess = _structs.ScePspDateTime.fromDate(stat.timeLastAccess);
		stat2.timeLastModification = _structs.ScePspDateTime.fromDate(stat.timeLastModification);
		stat2.deviceDependentData[0] = stat.dependentData0 || 0;
		stat2.deviceDependentData[1] = stat.dependentData1 || 0;

		stat2.attributes = 0;
		stat2.attributes |= _structs.IOFileModes.CanExecute;
		stat2.attributes |= _structs.IOFileModes.CanRead;
		stat2.attributes |= _structs.IOFileModes.CanWrite;
		if (stat.isDirectory) {
			stat2.attributes |= _structs.IOFileModes.Directory;
		} else {
			stat2.attributes |= _structs.IOFileModes.File;
		}
		return stat2;
	}

	sceIoGetstat = createNativeFunction(0xACE946E8, 150, 'int', 'string/void*', this, (fileName: string, sceIoStatPointer: Stream) => {
		_structs.SceIoStat.struct.write(sceIoStatPointer, new _structs.SceIoStat());
		return this.context.fileManager.getStatAsync(fileName)
			.then(stat => {
				var stat2 = this._vfsStatToSceIoStat(stat);
				console.info(sprintf('IoFileMgrForUser.sceIoGetstat("%s")', fileName), stat2);
				_structs.SceIoStat.struct.write(sceIoStatPointer, stat2);
				return 0;
			})
			.catch(error => SceKernelErrors.ERROR_ERRNO_FILE_NOT_FOUND)
		;
	});

	sceIoChdir = createNativeFunction(0x55F4717D, 150, 'int', 'string', this, (path: string) => {
		console.info(sprintf('IoFileMgrForUser.sceIoChdir("%s")', path));
		this.context.fileManager.chdir(path);
		return 0;
	});

	sceIoLseek = createNativeFunction(0x27EB27B8, 150, 'long', 'int/long/int', this, (fileId: number, offset: Integer64, whence: number) => {
		var result = this._seek(fileId, offset.getNumber(), whence);
		//console.info(sprintf('IoFileMgrForUser.sceIoLseek(%d, %d, %d): %d', fileId, offset, whence, result));
		return Integer64.fromNumber(result);
	});

	sceIoLseek32 = createNativeFunction(0x68963324, 150, 'int', 'int/int/int', this, (fileId: number, offset: number, whence: number) => {
		var result = this._seek(fileId, offset, whence);
		//console.info(sprintf('IoFileMgrForUser.sceIoLseek32(%d, %d, %d) : %d', fileId, offset, whence, result));
		return result;
	});

	sceIoDopen = createNativeFunction(0xB29DDF9C, 150, 'uint', 'string', this, (path: string) => {
		console.log('sceIoDopen("' + path + '")');
		return this.context.fileManager.openDirectoryAsync(path).then((directory) => {
			console.log('opened directory "' + path + '"');
			return this.directoryUids.allocate(directory);
		}).catch((error) => {
			console.error(error);
			return -1;
		});
	});

	sceIoDclose = createNativeFunction(0xEB092469, 150, 'uint', 'int', this, (fileId: number) => {
		console.warn('Not implemented IoFileMgrForUser.sceIoDclose');
		this.directoryUids.remove(fileId);
		return 0;
	});

	sceIoDread = createNativeFunction(0xE3EB004C, 150, 'int', 'int/void*', this, (fileId: number, hleIoDirentPtr: Stream) => {
		var directory = this.directoryUids.get(fileId);
		if (directory.left > 0) {
			var stat = directory.read();
			var hleIoDirent = new _structs.HleIoDirent();
			hleIoDirent.name = stat.name;
			hleIoDirent.stat = this._vfsStatToSceIoStat(stat);
			hleIoDirent.privateData = 0;
			_structs.HleIoDirent.struct.write(hleIoDirentPtr, hleIoDirent);
		}
		return directory.left;
	});

	_seek(fileId: number, offset: number, whence: number) {
		var file = this.fileUids.get(fileId);
		switch (whence) {
			case _structs.SeekAnchor.Set:
				file.cursor = 0 + offset;
				break;
			case _structs.SeekAnchor.Cursor:
				file.cursor = file.cursor + offset;
				break;
			case _structs.SeekAnchor.End:
				file.cursor = file.entry.size + offset;
				break;
		}
		return file.cursor;
	}
}
