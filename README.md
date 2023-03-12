# lsky-upload

## 属性

- baseUrl：lsky 根目录地址
- email：用户名
- password：密码
- tempPath：图片临时存放路径
- token：如果已经获取过 token，可直接填入
- tokenPath：获取 token 的接口路径，默认 /api/v1/tokens
- uploadPath：上传的接口路径，默认 /api/v1/upload
- strategyId：储存策略id，默认 1
- tinyKeys：调用 Tinypng 接口使用的 key，默认为空，则不进行压缩

必填：Base Url，Email，Password。

如返回 401 错误，请确认填写的 token 是否正确
如返回 404 错误，请确认填写的 api 路径是否正确