
const axios = require('axios');
const vscode = require('vscode');
var FormData = require('form-data'); 
const {baseUrl, tokenPath, uploadPath, email, password, token, strategyId} = require('../extension/config')

async function lskyUpload(file) {
    
    try {
        // 1. 获取token
        let token = await getToken();        
        console.log("token=" + token);

        // 2. 上传
        let res = await upload(token, file); 
        console.log(res);

        return res;
    } catch (err) {
		console.error(err);
		throw err;
	}
}

// 构建请求参数
async function upload(token, file) {
   
    var data = new FormData();
    data.append('file', file);
    data.append('strategy_id', strategyId);

    const url = baseUrl + uploadPath;
    const auth = "Bearer " + token;
    const headers = {
        "Authorization": auth,
        "Accept": "application/json",
        'Content-Type': 'multipart/form-data', 
    };     

    // @ts-ignore
    try {
        // @ts-ignore
        const res = await axios.post(url, data, { headers });
        console.log(res);
        if (res.status === 200) {
            return res;
        } else {
            throw new Error("图片上传失败，" + res);
        }
    } catch (error) {
        throw new Error("图片上传失败，" + error.message);
    }
}

// 获取 token
async function getToken() {
    if (!token) {
        const url = baseUrl + tokenPath;
        const data = { email, password };

        try {
            // @ts-ignore
            const res = await axios.post(url, data);
            console.log(res);

            if (res.status === 200) {
                vscode.workspace.getConfiguration().update("lsky.token", res.data.data.token, true);
                return res.data.data.token;
            } else {
                throw new Error("token 获取失败，" + res);
            }
        } catch (error) {
            throw new Error("token 获取失败，" + error.message);
        }
    }
    
    return token;
}

module.exports = {
    lskyUpload,
}