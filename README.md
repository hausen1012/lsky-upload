# lsky-upload

## 功能

- 快捷上传剪贴板图片到 lsky 图床
- 批量上传 markdown 文档中的图片到 lsky 图床
- 上传之前压缩图片（如果第一次压缩后的图片大于 1M，会再次尝试压缩）

## 配置项

- baseUrl：lsky 图床地址
- email：用户名
- password：密码
- tempPath：本地图片临时存放路径
- token：如果已经获取过 token，可直接填入，留空则自动获取
- tokenPath：获取 token 的接口路径，默认 /api/v1/tokens
- uploadPath：上传的接口路径，默认 /api/v1/upload
- strategyId：图床的储存策略id，可以在后台中管理界面查看，默认 1
- tinyKeys：调用 Tinypng 接口使用的 key，默认为空，则不进行压缩
- domainList：如果图片域名包含在内，就不进行上传替换，多个域名以英文逗号分隔

必填：Base Url，Email，Password。

## 注意事项

- 如返回 401 错误，请确认填写的 token 是否正确。
- 如返回 404 错误，请确认填写的 api 路径是否正确