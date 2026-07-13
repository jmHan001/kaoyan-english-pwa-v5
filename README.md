# 拾词 · 考研英语 PWA v5

手机优先、离线可用、支持电脑与手机加密同步的双词库英语学习工具。

## 本地运行

```powershell
python -m http.server 4173 --directory .
```

访问 `http://localhost:4173/kaoyan-english-pwa-v5/`。Service Worker 仅在 HTTP/HTTPS 下工作。

## GitHub Pages

1. 新建 GitHub 仓库，把本目录内全部文件提交到仓库根目录。
2. 在仓库 `Settings > Pages` 中选择 `Deploy from a branch`。
3. 选择 `main` 和 `/ (root)`，保存。
4. 等待部署完成，用 iPhone Safari 打开 Pages 地址，选择“分享 > 添加到主屏幕”。

## 数据与隐私

学习记录默认保存在浏览器 `localStorage`。首次打开会尝试迁移 `ky3_words`、`ky3_data`、`ky3_settings`、`ky3_pool`，不会删除旧键。词库数据来自 KyleBing/english-vocabulary，仅用于学习；详见 `data/SOURCE.md`。

## 电脑与手机同步

打开应用导航中的“同步”：

1. 无需云服务时，可在电脑导出同步文件，再发送到手机导入。导入会合并记录，不会直接清空手机数据。
2. 需要持续自动互通时，创建免费 Supabase 项目，在 SQL Editor 运行 `supabase-sync.sql`。
3. 把 Project URL 和 anon public key 填入同步页，在电脑生成同步码并设置至少 8 位密码。
4. 手机填写完全相同的项目地址、公开密钥、同步码和密码，点击“保存并同步”。

学习数据在浏览器中使用 PBKDF2 派生密钥，并通过 AES-GCM 加密后再上传。Supabase 表不开放直接查询，仅开放按高强度随机同步码读取和写入的 RPC。同步密码只保存在当前设备的本地存储中，不会上传；忘记密码后无法解密云端数据。
