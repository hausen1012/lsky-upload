const tinify = require("tinify");
const fs = require('fs');
const { tinyKeys } = require("../extension/config");
async function compressImage(imagePath) {

    // 检查图片大小
    const stats = fs.statSync(imagePath);
    const fileSize = stats.size / (1024 * 1024);
    console.log("压缩前 fileSize: " + stats.size + "bytes");
    if (fileSize > 5) {
        throw new Error("图片不能超过5M！");
    }

    // 使用 Promise 封装 tinify 压缩操作
    return new Promise((resolve, reject) => {
        tinify.key = getKey();
        tinify.fromFile(imagePath).toFile(imagePath, err => {
            if (err) {
                reject(new Error("图片压缩失败！" + err.message));
            } else {
                console.log("压缩后 fileSize: " + fs.statSync(imagePath).size + "bytes");
                resolve();
            }
        });
    });
}

function getKey(){
    let keys = tinyKeys.split(',');
    return keys[Math.floor(Math.random() * keys.length)].toString().trim();
}

// function test (){
//     // 检查压缩后的图片是否大于1M，如果大于1M继续进行压缩
//     const compressedStats = fs.statSync(imagePath);
//     const compressedSizeInBytes = compressedStats.size;
//     const compressedSizeInMegabytes = compressedSizeInBytes / (1024 * 1024);

//     if (compressedSizeInMegabytes > 1) {
//       console.log(`第一次压缩大小: ${compressedSizeInMegabytes}MB`);
//       progress.report({ increment: 20, message: '正在使用Tinypng进行二次压缩...' });
//       // Perform another round of compression
//       tinify.fromFile(imagePath).toFile(imagePath, err => {
//         if (err) {
//           return;
//         }
//         const reCompressedStats = fs.statSync(imagePath);
//         const reCompressedSizeInBytes = reCompressedStats.size;
//         const reCompressedSizeInMegabytes = reCompressedSizeInBytes / (1024 * 1024);
//         console.log(`第二次压缩大小: ${reCompressedSizeInMegabytes}MB`);
//       });
//     } 
// }

module.exports = { 
    compressImage,
};