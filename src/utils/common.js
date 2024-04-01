const { baseUrl, email, password } = require("../extension/config");


function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function basicValidate(vscode) {
    let editor = vscode.window.activeTextEditor;
    
    if (!editor) {
        throw new Error('校验失败，没有活动的文本编辑器！');
    }

    let fileUri = editor.document.uri;
    if (!fileUri) { 
        throw new Error('校验失败，文档 URI 无效！');
    }

    if (fileUri.scheme === 'untitled') {
        throw new Error('校验失败，未保存的文件无法上传图片！');
    }

    if (!baseUrl || !email || !password) {
        throw new Error('校验失败，必须提供图床地址、用户名和邮箱！');
    }

    return editor;
}

// 基础的验证以及返回当前编辑对象
function clipboardUploadValidate(vscode) {
    let editor = basicValidate(vscode);
    
    let selection = editor.selection;
    let selectText = editor.document.getText(selection);
    if (selectText && !/^[\w\-.]+$/.test(selectText)) {
        throw new Error('校验失败，选择的文本不是可用的文件名！');
    }

    return editor;
}


// 获取给定文本所有图片链接
function getImageUrls(text) {
    const imageRegex = /!\[.*?\]\((.*?)\)/g;
    const imageUrls = [];
    let match;
    while ((match = imageRegex.exec(text)) !== null) {
        imageUrls.push(match[1]);
    }
    return imageUrls;
}

module.exports = {
    sleep,
    clipboardUploadValidate,
    basicValidate,
    getImageUrls
};