const express = require("express");
const path = require("path");
const playerEngine = require("../engine/player");
const lootEngine = require("../engine/loot");
const battleEngine = require("../engine/battle");
const items = require("../data/items.json");
const levels = require("../data/levels.json");
const { initSchema } = require("./db");
const playerRepository = require("./playerRepository");
const userRepository = require("./userRepository");

const app = express();
const port = process.env.PORT || 3000;
const frontendDir = path.join(__dirname, "..", "frontend");
const adminTokens = new Map();

app.use(express.json());
app.use(express.static(frontendDir));

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

async function loadPlayerFromRequest(req, res) {
  const id = Number(req.params.id || req.body.playerId || req.query.playerId);
  if (!id) {
    res.status(400).json({ log: "缺少 playerId" });
    return null;
  }

  const player = await playerRepository.loadPlayer(id);
  if (!player) {
    res.status(404).json({ log: "玩家不存在" });
    return null;
  }

  return player;
}

function responseState(player, extra) {
  return {
    ...extra,
    player: playerRepository.publicPlayer(player)
  };
}

function makeToken() {
  return require("crypto").randomBytes(24).toString("hex");
}

function requireAdmin(req, res, next) {
  const token = req.headers.authorization && req.headers.authorization.replace("Bearer ", "");
  const admin = token ? adminTokens.get(token) : null;
  if (!admin) {
    res.status(401).json({ log: "管理员未登录" });
    return;
  }
  req.admin = admin;
  next();
}

app.post("/api/auth/register", asyncHandler(async (req, res) => {
  try {
    const user = await userRepository.register(req.body.username, req.body.password);
    res.json(user);
  } catch (error) {
    res.status(400).json({ log: error.message });
  }
}));

app.post("/api/auth/login", asyncHandler(async (req, res) => {
  const user = await userRepository.login(req.body.username, req.body.password);
  if (!user || user.role !== "player") {
    res.status(401).json({ log: "账号或密码错误" });
    return;
  }
  res.json(user);
}));

app.post("/api/admin/login", asyncHandler(async (req, res) => {
  const user = await userRepository.login(req.body.username, req.body.password);
  if (!user || user.role !== "admin") {
    res.status(401).json({ log: "管理员账号或密码错误" });
    return;
  }

  const token = makeToken();
  adminTokens.set(token, user);
  res.json({ token, user });
}));

app.get("/api/admin/users", requireAdmin, asyncHandler(async (req, res) => {
  res.json({ users: await userRepository.listUsers() });
}));

app.post("/api/admin/users/:id/password", requireAdmin, asyncHandler(async (req, res) => {
  try {
    const ok = await userRepository.resetPassword(Number(req.params.id), req.body.password);
    res.json({ ok, log: ok ? "密码已重置" : "用户不存在" });
  } catch (error) {
    res.status(400).json({ log: error.message });
  }
}));

app.delete("/api/admin/users/:id", requireAdmin, asyncHandler(async (req, res) => {
  try {
    const ok = await userRepository.deleteUser(Number(req.params.id));
    res.json({ ok, log: ok ? "用户已删除" : "用户不存在" });
  } catch (error) {
    res.status(400).json({ log: error.message });
  }
}));

app.post("/api/player/create", asyncHandler(async (req, res) => {
  const player = await playerRepository.createPlayer();
  res.json(playerRepository.publicPlayer(player));
}));

app.get("/api/player/:id", asyncHandler(async (req, res) => {
  const player = await loadPlayerFromRequest(req, res);
  if (!player) return;
  lootEngine.refreshChopTokens(player);
  await playerRepository.savePlayer(player);
  res.json(playerRepository.publicPlayer(player));
}));

app.post("/api/player/update", asyncHandler(async (req, res) => {
  const player = await loadPlayerFromRequest(req, res);
  if (!player) return;
  await playerRepository.savePlayer(player);
  res.json(playerRepository.publicPlayer(player));
}));

app.post("/api/chop", asyncHandler(async (req, res) => {
  const player = await loadPlayerFromRequest(req, res);
  if (!player) return;

  const result = lootEngine.chop(player);
  await playerRepository.savePlayer(player);
  res.json(responseState(player, {
    item: result.item || {},
    gold: 0,
    exp: result.revealed ? Math.floor(levels.dropXpBase) : 0,
    log: result.log,
    revealed: result.revealed
  }));
}));

app.post("/api/equip", asyncHandler(async (req, res) => {
  const player = await loadPlayerFromRequest(req, res);
  if (!player) return;

  const action = req.body && req.body.action ? req.body.action : "equip";
  if (!player.pendingLoot) {
    res.status(400).json(responseState(player, { ok: false, log: "没有可处理的装备" }));
    return;
  }

  if (action === "sell") {
    const sold = playerEngine.sellPending(player);
    await playerRepository.savePlayer(player);
    res.json(responseState(player, {
      ok: true,
      item: sold,
      gold: items.sellCoin,
      log: `出售装备 +${items.sellCoin}灵石`
    }));
    return;
  }

  const item = player.pendingLoot;
  playerEngine.equip(player, item);
  await playerRepository.savePlayer(player);
  res.json(responseState(player, { ok: true, item, gold: 0, log: "替换成功" }));
}));

app.post("/api/boss/fight", asyncHandler(async (req, res) => {
  const player = await loadPlayerFromRequest(req, res);
  if (!player) return;

  if (player.pendingLoot) {
    res.status(400).json(responseState(player, { win: false, reward: {}, log: "先处理掉落" }));
    return;
  }

  const result = battleEngine.fight(player);
  await playerRepository.savePlayer(player);
  res.json(responseState(player, {
    ...result,
    log: result.win ? `Boss${result.resultType}` : "Boss翻车"
  }));
}));

app.post("/api/player/buy-xp", asyncHandler(async (req, res) => {
  const player = await loadPlayerFromRequest(req, res);
  if (!player) return;

  const ok = playerEngine.buyXp(player);
  await playerRepository.savePlayer(player);
  res.json(responseState(player, {
    ok,
    log: ok ? `购买经验 +${levels.buyXpAmount}` : "灵石不足"
  }));
}));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ log: "服务器错误", error: err.message });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(frontendDir, "index.html"));
});

initSchema()
  .then(() => userRepository.ensureAdminUser())
  .then(() => {
    app.listen(port, () => {
      console.log(`Game server listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database schema:", error);
    process.exit(1);
  });
