// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const path = require('path');
const moment = require('moment');
const fs = require('fs');
const axios = require('axios');
const { spawn } = require('child_process');
const https = require('https');
const tinify = require("tinify");

var uploaded = false;
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	console.log('Congratulations, your extension "lsky-upload" is now active!');
	let disposable = vscode.commands.registerCommand('lsky-upload', function () {
		uploaded = false;
		vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Progress',
            cancellable: true
        }, (progress) => {
            return new Promise(resolve => {
								uploaded = false;
                start(progress);
                var intervalObj = setInterval(() => {
                    if (uploaded) {
                        setTimeout(() => {
                            clearInterval(intervalObj);
                            resolve();
                        }, 1000);
                    }
                }, 1000);
            });
        });
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}

function start(progress) {
	// 获取当前编辑文件
	let editor = vscode.window.activeTextEditor;
	if (!editor) return;
	let fileUri = editor.document.uri;
	if (!fileUri) return;
	if (fileUri.scheme === 'untitled') {
		progress.report({ increment: 100, message: '需要先保存文件，才能粘贴图片'});
		return;
	}
	let selection = editor.selection;
	let selectText = editor.document.getText(selection);
	if (selectText && !/^[\w\-.]+$/.test(selectText)) {
		progress.report({ increment: 100, message: '选择的文本不是可用的文件名'});
		return;
	}
	let config = vscode.workspace.getConfiguration('lsky');
	let localPath = config['tempPath'];
	if (localPath && (localPath.length !== localPath.trim().length)) {
		progress.report({ increment: 100, message: `本地临时保存图片路径未定义 ${localPath}`});
		return;
	}
	let filePath = fileUri.fsPath;
	let imagePath = getImagePath(filePath, selectText, localPath);
	createImageDirWithImagePath(imagePath).then(imagePath => {
		saveClipboardImageToFileAndGetPath(imagePath, progress, (imagePath) => {
			if (!imagePath) {
				progress.report({ increment: 100, message: '上传失败！'});
				return;
			}
			if (imagePath === 'no image') {
				progress.report({ increment: 100, message: "剪贴板没有图片！" });
				return;
			}

			compressImage(imagePath, progress).then((imagePath) => {
				lskyUpload(config, imagePath, progress).then(img => {
				  editor.edit(textEditorEdit => {
					textEditorEdit.insert(editor.selection.active, img);
				  });
				  progress.report({ increment: 100, message: '上传成功！' });
				  uploaded = true;
				}).catch((err) => {
				  progress.report({ increment: 100, message: '上传失败！' + err.message });
				  return;
				});
			}).catch(err => {
				progress.report({ increment: 100, message: '压缩失败！' + err.message });
				return;
			});
		});
	}).catch(() => {
		progress.report({ increment: 100, message: '文件创建失败！' });
		return;
	});
}

function lskyUpload(config, imagePath, progress) {
	progress.report({ increment: 20, message: '压缩完成，图片正在上传到图床...' });
	return new Promise(async (resolve, reject) => {
		let token = await getToken(config);
		if (token.length === 0) {
			reject({ message: "原因是 token 获取失败" });
			return;
		}
		console.log("token=" + token);

		const file = fs.createReadStream(imagePath, { autoClose: true });
		const data = {
			strategy_id: config.strategyId,
			file,
		};
		const url = config.baseUrl + config.uploadPath;
		const auth = "Bearer " + token;
		const headers = {
			Authorization: auth,
			"Content-Type": "multipart/form-data",
			Accept: "application/json",
		};

		try {
		// @ts-ignore
		const res = await axios({
			url,
			method: "POST",
			headers,
			data,
		});

		console.log(res);
		if (res.status === 200) {
			if (Object.keys(res.data.data).length === 0) {
			reject({ message: "原因是" + res.data.message });
				return;
			}
				resolve(res.data.data.links.markdown);
			return;
		} else {
			resolve(res);
			return;
		}
		} catch (err) {
			console.log(err);
			reject(err);
			return;
		}
	});
}
  
async function getToken(config) {
	let token = config.token;
	if (!token) {
		const tokenUrl = config.baseUrl + config.tokenPath;
		console.log(tokenUrl);
		const data = {
		email: config.email,
		password: config.password,
		};

		try {
			// @ts-ignore
			const res = await axios({
				url: tokenUrl,
				method: "POST",
				data,
			});

			console.log(res);
		if (res.status === 200) {
			token = res.data.data.token;
		}
		vscode.workspace.getConfiguration().update("lsky.token", token, true);
		} catch (err) {
		console.log(err);
		token = null;
		}
	}
	return token;
}
  

function getImagePath(filePath, selectText, localPath) {
	// 图片名称
	let imageFileName = '';
	if (!selectText) {
		imageFileName = moment().format('YMMDDHHmmss') + '.png';
	} else {
		imageFileName = selectText + '.png';
	}

	// 图片本地保存路径
	let folderPath = path.dirname(filePath);
	let imagePath = '';
	if (path.isAbsolute(localPath)) {
		imagePath = path.join(localPath, imageFileName);
	} else {
		imagePath = path.join(folderPath, localPath, imageFileName);
	}
	return imagePath;
}

function createImageDirWithImagePath(imagePath) {
	return new Promise((resolve, reject) => {
		let imageDir = path.dirname(imagePath);
		fs.exists(imageDir, (exists) => {
			if (exists) {
				resolve(imagePath);
				return;
			}
			fs.mkdir(imageDir, (err) => {
				if (err) {
					reject(err);
					return;
				}
				resolve(imagePath);
			});
		});
	});
}

/** 
function saveClipboardImageToFileAndGetPath(imagePath, cb) {
	if (!imagePath) return;
	let platform = process.platform;
	if (platform === 'win32') {
		// Windows
		const scriptPath = path.join(__dirname, './lib/pc.ps1');
		const powershell = spawn('powershell', [
			'-noprofile',
			'-noninteractive',
			'-nologo',
			'-sta',
			'-executionpolicy', 'unrestricted',
			'-windowstyle', 'hidden',
			'-file', scriptPath,
			imagePath
		]);
		powershell.on('exit', function (code, signal) {

		});
		powershell.stdout.on('data', function (data) {
			cb(data.toString().trim());
		});
	} else if (platform === 'darwin') {
		// Mac
		let scriptPath = path.join(__dirname, './lib/mac.applescript');

		let ascript = spawn('osascript', [scriptPath, imagePath]);
		ascript.on('exit', function (code, signal) {

		});

		ascript.stdout.on('data', function (data) {
			cb(data.toString().trim());
		});
	} else {
		// Linux

		let scriptPath = path.join(__dirname, './lib/linux.sh');

		let ascript = spawn('sh', [scriptPath, imagePath]);
		ascript.on('exit', function (code, signal) {

		});

		ascript.stdout.on('data', function (data) {
			let result = data.toString().trim();
			if (result == 'no xclip') {
					vscode.window.showInformationMessage('You need to install xclip command first.');
					return;
			}
			cb(result);
		});
	}
}

function compressImage(imagePath, progress, cb) {
	let config = vscode.workspace.getConfiguration('lsky');
	let tinyKeys = config['tinyKeys'];
	if (!tinyKeys) {
		cb(null);
		return;
	}
	progress.report({ increment: 20, message: '正在使用 Tinypng 压缩图片...' });
	let keys = tinyKeys.split(',');
	let key = keys[Math.floor(Math.random() * keys.length)].toString().trim();
	console.log(key);
	tinify.key = key;
	tinify.fromFile(imagePath).toFile(imagePath, err => {
		if (err) {
			cb(err);
			return;
		}
		cb(null);
    });
}
console.error('Failed to compress image:', err);
					vscode.window.showErrorMessage('Tinypng 压缩图片失败, 原因是 ' +  err.message);
					reject(null);
*/

function compressImage(imagePath, progress) {
  return new Promise((resolve, reject) => {
    let config = vscode.workspace.getConfiguration('lsky');
    let tinyKeys = config['tinyKeys'];
    if (!tinyKeys) {
      reject(null);
      return;
    }

	// 检查图片大小
    const stats = fs.statSync(imagePath);
    const fileSizeInBytes = stats.size;
    const fileSizeInMegabytes = fileSizeInBytes / (1024 * 1024);
    if (fileSizeInMegabytes > 5) {
	    reject({ message: "图片不能超过5M" });
        return;
    }

	progress.report({ increment: 20, message: '正在使用Tinypng压缩图片...' });
    let keys = tinyKeys.split(',');
    let key = keys[Math.floor(Math.random() * keys.length)].toString().trim();
    tinify.key = key;

	// 
    tinify.fromFile(imagePath).toFile(imagePath, err => {
		if (err) {
		  reject(err);
		  return;
		}
  
		// 检查压缩后的图片是否大于1M，如果大于1M继续进行压缩
		const compressedStats = fs.statSync(imagePath);
		const compressedSizeInBytes = compressedStats.size;
		const compressedSizeInMegabytes = compressedSizeInBytes / (1024 * 1024);
  
		if (compressedSizeInMegabytes > 1) {
		  console.log(`第一次压缩大小: ${compressedSizeInMegabytes}MB`);
		  progress.report({ increment: 20, message: '正在使用Tinypng进行二次压缩...' });
		  // Perform another round of compression
		  tinify.fromFile(imagePath).toFile(imagePath, err => {
			if (err) {
			  reject(err);
			  return;
			}
			const reCompressedStats = fs.statSync(imagePath);
			const reCompressedSizeInBytes = reCompressedStats.size;
			const reCompressedSizeInMegabytes = reCompressedSizeInBytes / (1024 * 1024);
			console.log(`第二次压缩大小: ${reCompressedSizeInMegabytes}MB`);
			resolve(imagePath);
		  });
		} else {
		  resolve(imagePath);
		}
	});
  });
}

function saveClipboardImageToFileAndGetPath(imagePath, progress, cb) {
	progress.report({ increment: 20, message: '将剪贴板图片保存到本地...' });
	if (!imagePath) return;
	let platform = process.platform;
	if (platform === 'win32') {
		// Windows
		const scriptPath = path.join(__dirname, './lib/pc.ps1');
		const powershell = spawn('powershell', [
			'-noprofile',
			'-noninteractive',
			'-nologo',
			'-sta',
			'-executionpolicy', 'unrestricted',
			'-windowstyle', 'hidden',
			'-file', scriptPath,
			imagePath
		]);
		powershell.on('exit', function (code, signal) {

		});
		powershell.stdout.on('data', function (data) {
			cb(data.toString().trim());
		});
	} else if (platform === 'darwin') {
		// Mac
		let scriptPath = path.join(__dirname, './lib/mac.applescript');

		let ascript = spawn('osascript', [scriptPath, imagePath]);
		ascript.on('exit', function (code, signal) {

		});

		ascript.stdout.on('data', function (data) {
			cb(data.toString().trim());
		});
	} else {
		// Linux

		let scriptPath = path.join(__dirname, './lib/linux.sh');

		let ascript = spawn('sh', [scriptPath, imagePath]);
		ascript.on('exit', function (code, signal) {

		});

		ascript.stdout.on('data', function (data) {
			let result = data.toString().trim();
			if (result == 'no xclip') {
					vscode.window.showInformationMessage('You need to install xclip command first.');
					return;
			}
			cb(result);
		});
	}
}
