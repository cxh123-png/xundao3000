# xundao3000

砍树刷装备 + Boss 爬层网页小游戏。

## 启动

```powershell
npm install
npm start
```

启动后打开：

```text
http://localhost:3000
```

管理员页面：

```text
http://localhost:3000/admin.html
```

默认管理员：

```text
admin / lbj19841230
```

## 说明

- 后端：Node.js + Express
- 存档：SQLite 文件 `data/game.db`
- 前端：原生 HTML + JavaScript
- 游戏逻辑在 `engine/`
- 配置在 `data/`

`data/game.db`、`node_modules/` 不会上传到 GitHub。
