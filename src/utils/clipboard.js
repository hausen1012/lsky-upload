const path = require('path');
const { spawn } = require('child_process');
const moment = require('moment');
const fs = require('fs');
async function saveClipboardImage(tempPath, selectText) {
    return new Promise((resolve, reject) => {
        let imagePath = getImagePath(tempPath, selectText);
        let platform = process.platform;
        
        let childProcess;
        let scriptPath;

        if (platform === 'win32') {
            // Windows
            scriptPath = path.join(__dirname, '../lib/pc.ps1');
            childProcess = spawn('powershell', [
                '-noprofile',
                '-noninteractive',
                '-nologo',
                '-sta',
                '-executionpolicy', 'unrestricted',
                '-windowstyle', 'hidden',
                '-file', scriptPath,
                imagePath
            ]);
        } else if (platform === 'darwin') {
            // Mac
            scriptPath = path.join(__dirname, '../lib/mac.applescript');
            childProcess = spawn('osascript', [scriptPath, imagePath]);
        } else {
            // Linux
            scriptPath = path.join(__dirname, '../lib/linux.sh');
            childProcess = spawn('sh', [scriptPath, imagePath]);
        }

        childProcess.on('exit', function (code, signal) {
            if (code === 0) {
                resolve(imagePath);
            }else {
                reject(new Error(`文件写入剪贴板失败，请确认剪贴板是否为图片！`));
            }
        });

        childProcess.on('error', function (error) {
            reject(new Error(`文件写入剪贴板失败，运行子进程发生错误: ${error.message}`));
        });
    });
}

function getImagePath(filePath, selectText) {
    // 图片名称
    let imageFileName = '';
    if (!selectText) {
        imageFileName = moment().format('YMMDDHHmmss') + '.png';
    } else {
        imageFileName = selectText + '.png';
    }

	try{
		if (!fs.existsSync(filePath)) {
			fs.mkdirSync(filePath, { recursive: true });
		}
	}catch(e){
		throw new Error('创建目录失败，原因：' + e);
	}

    return path.join(filePath, imageFileName);
}

module.exports = {
    saveClipboardImage,
};