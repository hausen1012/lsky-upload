const axios = require('axios');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const {compressImage} = require('./compress')
const {lskyUpload} = require('./lsky')
const { tempPath, tinyKeys } = require("../extension/config");

async function downloadImage(imageUrl) {

	// @ts-ignore
	const response = await axios({
	  url: imageUrl,
	  method: 'GET',
	  responseType: 'stream',
	  headers: {
		Accept: 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
	  },
	});
  
	const contentType = response.headers['content-type'];

	// 判断是否是图片
	if (!contentType.startsWith('image/')) {
		throw new Error('下载图片失败，链接地址不为图片！');
	}

	let extension = '.png'; // 默认后缀为 .jpg
	if (contentType.startsWith('image/')) {
	  extension = '.' + contentType.substring('image/'.length);
	}
  
	const imageFileName = moment().format('YMMDDHHmmss') + extension;
	const imagePath = path.join(tempPath, imageFileName);
  
	const writer = fs.createWriteStream(imagePath);
	response.data.pipe(writer);
  
	return new Promise((resolve, reject) => {
        writer.on('finish', () => {
            resolve(imagePath);
        });
        writer.on('error', reject);
	});
}

async function getNewUrl(imageUrl) {

    try {
		// 1. 下载图片
		let imagePath = await downloadImage(imageUrl);
			
		// 2. 压缩图片
		if (tinyKeys) {
			await compressImage(imagePath);
		}

		// 3. 上传图片
		let file = fs.createReadStream(imagePath);
		let res = await lskyUpload(file);

		// 4. 提取图片地址
		const markdown = res.data.data.links.markdown;
		const regex = /\(([^)]+)\)/;
		const matches = markdown.match(regex);
		const imgurl = matches[1];
		
		return imageUrl;
	} catch (error) {
		throw new Error(imageUrl + "替换失败");
	}
}

function preHandleUrl(imageUrl) {

	if (imageUrl.includes("img-blog.csdn.net")) { // 检查字符串是否包含 "img-blog.csdn.net"
		imageUrl = imageUrl.split("?")[0]; // 使用 split() 方法获取 "?" 前的字符串
		console.log("csdn 去水印图片地址: " + imageUrl);
	}
	return imageUrl;
}

module.exports = {
    getNewUrl,
};