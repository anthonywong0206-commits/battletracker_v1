# BattleBracket

競技晉級比賽制管理系統。支援建立比賽、批量加入參加者、隨機抽籤、BYE 自動晉級、即時紀錄分數、晉級圖、匯出 PNG / JSON。

## 本次修正

已固定依賴版本，避免 Vercel 出現：

`peer vite "^8.0.0" from @vitejs/plugin-react@6.0.2`

重要版本：

```json
"vite": "5.4.21",
"@vitejs/plugin-react": "4.3.4"
```

並加入 `.npmrc`：

```txt
legacy-peer-deps=true
```

## 本機安裝

```bash
npm install
npm run dev
```

## Vercel 部署

Build Command:

```bash
npm run build
```

Output Directory:

```bash
dist
```

Install Command 可留空，或填：

```bash
npm install
```

## GitHub Pages 部署

```bash
npm install
npm run build
```

將 `dist` 內容部署到 GitHub Pages。

## 如果仍然出現 plugin-react latest 錯誤

代表 GitHub repo 未成功覆蓋舊檔案，請檢查 repo 入面的 `package.json`，不可再有：

```json
"@vitejs/plugin-react": "latest"
```

如 repo 有舊 `package-lock.json`，請刪除後重新 commit。
