// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const path = require('path');
const moment = require('moment');
const fs = require('fs');
const axios = require('axios');
const { spawn } = require('child_process');
const https = require('https');

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
	progress.report({ increment: 10, message: '上传中...' });
	createImageDirWithImagePath(imagePath).then(imagePath => {
		progress.report({ increment: 20, message: '上传中...' });
		saveClipboardImageToFileAndGetPath(imagePath, (imagePath) => {
			if (!imagePath) return;
			if (imagePath === 'no image') {
				progress.report({ increment: 100, message: "剪贴板没有图片！" });
				return;
			}

			progress.report({ increment: 50, message: '上传中...' });
			lskyUpload(config, imagePath).then(img => {
				editor.edit(textEditorEdit => {
					textEditorEdit.insert(editor.selection.active, img);
				});
				progress.report({ increment: 100, message: '上传成功！' });
				uploaded = true;
			}).catch((err) => {
				progress.report({ increment: 100, message: '上传失败！' + err.message });
				return;
			});
		});
	}).catch(() => {
		progress.report({ increment: 100, message: '文件创建失败！' });
		return;
	});
}

function lskyUpload(config, imagePath){

	return new Promise(async (resolve, reject) => {
		var token = await getToken(config);
		if(token.length == 0){
			reject({"message": "原因是 token 获取失败"});
			return;
		}
		console.log("token=" + token);
		let file =  fs.createReadStream(imagePath, {autoClose: true});
		var data = {
			strategy_id: config['strategyId'],
			file,
		};
		//console.log(data.file);
		let url = config['baseUrl'] + config['uploadPath'];
		let auth = 'Bearer ' + token;
		let headers = {
			'Authorization': auth,
			'Content-Type': 'multipart/form-data',
			'Accept': 'application/json'
		};
		//@ts-ignore
		axios({
			url,
			method: 'POST',
			headers,
			data
		}).then(res => {
			console.log(res);
			if(res.status == 200){
				if(Object.keys(res.data.data).length == 0){
					reject({"message": "原因是" + res.data.message});
				}else{
					resolve(res.data.data.links.markdown);
				}
			}else{
				resolve(res);
			}
		}).catch(err => {
			console.log(err);
			reject(err);
			return;
		})
	})

}

function getToken(config) {
	var token = config['token'];
	if(token == null || token == ''){
		var tokenUrl = config['baseUrl'] + config['tokenPath'];
		console.log(tokenUrl);
		var data = {
			"email": config['email'],
			"password": config['password']
		}
		// await 不需要 then，需要等待返回结果再进行下一步
		//@ts-ignore
		let res;
		try {
			 res = await axios({
					url: tokenUrl,
					method: 'POST',
					data
			});
		}catch(err){
			console.log(err);
			return token;
		}
		console.log(res);
		if(res.status == 200){
			token = res.data.data.token;
		}
		vscode.workspace.getConfiguration().update("lsky.token", token, true)
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


