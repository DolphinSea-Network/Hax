# Hax/Woiden VPS 自动管理脚本

一个功能强大的 Tampermonkey 用户脚本，用于自动化管理 [Hax.co.id](https://hax.co.id) 和 [Woiden.id](https://woiden.id) 的 VPS 创建、续期和删除操作。

## 功能特性

### 悬浮球面板
- 可拖拽悬浮球，支持 PC 和移动端
- 最高层级显示（z-index: 2147483647），不受广告遮挡
- 标签页切换自动跳转到对应页面

### Create - 自动创建 VPS
- 自动填充表单（数据中心、操作系统、密码）
- 自动检测 Cloudflare Turnstile 验证状态
- 验证通过后自动点击创建按钮
- Woiden 站自动解算图片数学题验证码

### Renew - 自动续期 VPS
- 自动填写网站地址（hax.co.id / woiden.id）
- 自动勾选同意协议
- 自动检测 Cloudflare 验证并提交续期请求

### Remove - 自动删除 VPS
- 自动填写确认信息（AGREE）
- 自动勾选同意协议
- 自动检测 Cloudflare 验证并提交删除请求

### Power / Info
- 功能开发中...

## 安装

1. 安装浏览器扩展 [Tampermonkey](https://www.tampermonkey.net/)
2. 点击 [hax.js](hax.js) 查看脚本源码
3. 在 Tampermonkey 中创建新脚本，复制 `hax.js` 内容并保存
4. 访问 Hax.co.id 或 Woiden.id 即可自动生效

## 使用说明

1. 页面加载后会自动显示悬浮球
2. 点击悬浮球打开配置面板
3. 在 Create 标签页配置 VPS 参数并点击"应用配置"
4. 切换到对应标签页可执行续期、删除等操作
5. 配置会自动保存到浏览器本地存储

## 文件说明

| 文件 | 说明 |
|------|------|
| `hax.js` | Tampermonkey 用户脚本（主要文件） |
| `.gitignore` | Git 忽略配置 |

## 兼容性

- Chrome / Edge / Firefox
- PC 端和移动端
- Hax.co.id 和 Woiden.id 双站支持

## 许可证

MIT License
