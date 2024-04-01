const vscode = require('vscode');
const os = require('os');
const path = require('path');

// 获取lsky配置
const config = vscode.workspace.getConfiguration('lsky');
// 当前文件路径
const documentPath = vscode.window.activeTextEditor.document.uri.fsPath;

const systemTempDir = os.tmpdir();
let tempPath = '';
if (config['tempPath']) {
  if (path.isAbsolute(config['tempPath'])) {
      tempPath = config['tempPath'];
  } else {
      tempPath = path.join(path.dirname(documentPath), config['tempPath']);
  }
} else {
  tempPath = path.join(systemTempDir, 'tmpImg');
}
// 更新tempPath配置项为系统临时目录
vscode.workspace.getConfiguration().update("lsky.tempPath", tempPath, true);

// 获取配置项的值，如果为空则使用默认值
module.exports = {
  baseUrl: config['baseUrl'],
  tokenPath: config['tokenPath'] || '/api/v1/tokens',
  uploadPath: config['uploadPath'] || '/api/v1/upload',
  email: config['email'],
  password: config['password'],
  token: config['token'],
  tempPath: tempPath,
  strategyId: config['strategyId'] || 1,
  tinyKeys: config['tinyKeys'],
  domainList: config['domainList']
};