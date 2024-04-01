// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { basicValidate, clipboardUploadValidate, getImageUrls} = require("./src/utils/common");
const { compressImage } = require("./src/utils/compress");
const { saveClipboardImage } = require("./src/utils/clipboard");
const { lskyUpload } = require("./src/utils/lsky");
const { getNewUrl } = require("./src/utils/replace");
const { tempPath, tinyKeys, domainList } = require("./src/extension/config");


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {


	let uploadDisposable  = vscode.commands.registerCommand('lsky-upload', function () {

		vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '图片上传',
            cancellable: true
        }, async (progress) => {
			try{
				await upload(progress);
				vscode.window.showInformationMessage("图片上传成功！");
			}catch(e){
				console.log(e);
				vscode.window.showErrorMessage(e.message);
			}
		});
	});

	context.subscriptions.push(uploadDisposable);

	let batchUploadDisposable = vscode.commands.registerCommand('lsky-batch-upload', () => {
		
		vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '图片批量上传',
            cancellable: true
        }, async (progress) => {
			try{
				const { totalImages, replacedCount, skipCount, failedReplacements } = await batchUpload(progress);
				let message = `共 ${totalImages} 张图片，成功：${replacedCount}，跳过：${skipCount}，失败：${failedReplacements.length}. `;
				if (failedReplacements.length > 0) {
					failedReplacements.forEach(failedUrl => {
						message += `\n\n${failedUrl}`;
					});
				}
				vscode.window.showInformationMessage(message);
			}catch(e){
				console.error(e);
				vscode.window.showErrorMessage(e.message);
			}
		});
	});
	

	context.subscriptions.push(batchUploadDisposable);
}

async function upload(progress) {

    return new Promise(async (resolve, reject) => {
        try {
            console.log(`剪贴板上传图片...`);
            
			// 1. 验证
            let editor = clipboardUploadValidate(vscode);

			progress.report({ increment: 0, message: '准备上传图片...' });
            
			// 2. 将图片保存至本地
            let imagePath = await saveClipboardImage(tempPath, editor.document.getText(editor.selection));
			console.log('图片地址：' + imagePath);

            // 3. 压缩图片
            if (tinyKeys) {
                progress.report({ increment: 30, message: '正在使用 Tinypng 压缩图片...' });
                await compressImage(imagePath);
            }

            // 4. 上传图片
			progress.report({ increment: 70, message: '图片正在上传到图床...' });
            let file = fs.createReadStream(imagePath);
            let res = await lskyUpload(file);

			editor.edit(textEditorEdit => {
				textEditorEdit.insert(editor.selection.active, res.data.data.links.markdown);
			});
			progress.report({ increment: 100, message: '上传成功！' });

            resolve();
        } catch (error) {
            reject(error);
        }
    });
}

async function batchUpload(progress) {
    return new Promise(async (resolve, reject) => {
		try {
			console.log(`批量上传图片...`);
			// 1. 验证
			basicValidate(vscode);

			// 2. 获取原始图片链接
			const document = vscode.window.activeTextEditor?.document;
			const imageUrls = getImageUrls(document.getText());
			const totalImages = imageUrls.length;
			progress.report({ increment: 0, message: '准备替换 ' + totalImages + ' 张图片...' });

			// 3. 遍历替换图片链接
			let replacedCount = 0;
			let skipCount = 0;
			let failedReplacements = [];
			for (let i = 0; i < totalImages; i++) {
				const imageUrl = imageUrls[i];
				if (domainList.includes(new URL(imageUrl).hostname)) {
					skipCount++;
					console.log(`图片 ${imageUrl} 在 domainList 中，跳过`);
					continue;
				}
				try {
					await replaceImage(document, imageUrl);
					replacedCount++;
				} catch (error) {
					failedReplacements.push(imageUrl);
					console.error(`替换失败: ${imageUrl}. 错误: ${error}`);
				}
				progress.report({ increment: (replacedCount / totalImages) * 100, message: '共 ' + totalImages + ' 张图片，已替换 ' + replacedCount + ' 张图片' });
			}
			resolve({ totalImages, replacedCount, skipCount, failedReplacements });
		} catch (error) {
            reject(error);
        }
    });
}
// 替换指定的图片链接
async function replaceImage(document, imageUrl) {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        const newUrl = await getNewUrl(imageUrl);
        let newText = document.getText();
        newText = newText.replace(imageUrl, newUrl);

        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(newText.length)
        );
        editor.edit(editBuilder => {
            editBuilder.replace(fullRange, newText);
        });
    }
}
// 扩展被禁用，会调用此方法
function deactivate() {}

module.exports = {
	activate,
	deactivate
}