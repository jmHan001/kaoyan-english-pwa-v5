# 拾词 · 考研英语 PWA v5

手机优先、纯前端、可离线的双词库英语学习工具。

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

所有学习记录只保存在浏览器 `localStorage`。首次打开会尝试迁移 `ky3_words`、`ky3_data`、`ky3_settings`、`ky3_pool`，不会删除旧键。词库数据来自 KyleBing/english-vocabulary，仅用于学习；详见 `data/SOURCE.md`。
