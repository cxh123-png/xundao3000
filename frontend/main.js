const state = {
  player: null,
  user: JSON.parse(localStorage.getItem("treeLootUser") || "null"),
  playerId: localStorage.getItem("treeLootPlayerId"),
  logs: [],
  battleActive: false,
  autoChop: false,
  autoBoss: false,
  autoBossPaused: false,
  chopInFlight: false,
  bossInFlight: false,
  recentAutoItem: "无"
};

if (!state.user) {
  state.playerId = null;
  localStorage.removeItem("treeLootPlayerId");
}

const el = {
  authPanel: document.getElementById("authPanel"),
  gamePanel: document.getElementById("gamePanel"),
  username: document.getElementById("usernameInput"),
  password: document.getElementById("passwordInput"),
  login: document.getElementById("loginButton"),
  register: document.getElementById("registerButton"),
  authMessage: document.getElementById("authMessage"),
  account: document.getElementById("accountText"),
  logout: document.getElementById("logoutButton"),
  floor: document.getElementById("floorText"),
  level: document.getElementById("levelText"),
  treeLevel: document.getElementById("treeLevelText"),
  bossPower: document.getElementById("bossPowerText"),
  emotion: document.getElementById("emotionText"),
  power: document.getElementById("powerText"),
  xp: document.getElementById("xpText"),
  xpFill: document.getElementById("xpFill"),
  treeXp: document.getElementById("treeXpText"),
  treeXpFill: document.getElementById("treeXpFill"),
  dropChanceList: document.getElementById("dropChanceList"),
  token: document.getElementById("tokenText"),
  coins: document.getElementById("coinText"),
  buyXp: document.getElementById("buyXpButton"),
  stats: document.getElementById("playerStats"),
  equipment: document.getElementById("equipmentGrid"),
  dropCard: document.getElementById("dropCard"),
  compare: document.getElementById("compareText"),
  logs: document.getElementById("logList"),
  chop: document.getElementById("chopButton"),
  boss: document.getElementById("bossButton"),
  autoChop: document.getElementById("autoChopButton"),
  autoBoss: document.getElementById("autoBossButton"),
  autoStatus: document.getElementById("autoStatusText"),
  autoRecent: document.getElementById("autoRecentText"),
  autoWinRate: document.getElementById("autoWinRateText"),
  equip: document.getElementById("equipButton"),
  sell: document.getElementById("sellButton"),
  battleOverlay: document.getElementById("battleOverlay"),
  battleModal: document.getElementById("battleModal"),
  battleTitle: document.getElementById("battleTitle"),
  battleCountdown: document.getElementById("battleCountdown"),
  battleStatus: document.getElementById("battleStatus"),
  battleResult: document.getElementById("battleResult")
};

function addLog(message) {
  if (!message) return;
  state.logs.unshift(`[${new Date().toLocaleTimeString()}] ${message}`);
  if (state.logs.length > 80) state.logs.pop();
}

function estimateBossWinRate(player) {
  if (!player || !player.bossPower) return 0;
  const ratio = player.power / player.bossPower;
  return Math.max(5, Math.min(95, Math.round(50 + (ratio - 1) * 90)));
}

function updateAutomationUi() {
  if (!el.autoChop || !el.autoBoss) return;

  el.autoChop.textContent = `自动砍树：${state.autoChop ? "ON" : "OFF"}`;
  el.autoBoss.textContent = `自动Boss：${state.autoBoss ? "ON" : "OFF"}`;
  el.autoChop.classList.toggle("toggle-on", state.autoChop);
  el.autoBoss.classList.toggle("toggle-on", state.autoBoss && !state.autoBossPaused);
  el.autoBoss.classList.toggle("toggle-wait", state.autoBoss && state.autoBossPaused);

  const modes = [];
  if (state.autoChop) modes.push("砍树挂机中");
  if (state.autoBoss && state.autoBossPaused) modes.push("Boss等待强化");
  else if (state.autoBoss) modes.push("Boss推进中");
  if (!modes.length) modes.push("手动模式");

  el.autoStatus.textContent = modes.join(" / ");
  el.autoRecent.textContent = state.recentAutoItem;
  el.autoWinRate.textContent = `${estimateBossWinRate(state.player)}%`;
}

async function api(path, options) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json();
  if (!response.ok) addLog(data.log || "请求失败");
  return data;
}

async function ensurePlayerId() {
  if (state.playerId) {
    return state.playerId;
  }

  throw new Error("请先登录");
}

function qualityLabel(item) {
  return item.qualityLabel || item.quality;
}

function renderDropChances(chances) {
  if (!chances) return "";
  const labels = {
    normal: "普通",
    rare: "稀有",
    epic: "高级",
    legendary: "神话"
  };

  return ["normal", "rare", "epic", "legendary"].map((quality) => {
    const pct = ((chances[quality] || 0) * 100).toFixed(1);
    return `<div class="quality-${quality}">${labels[quality]}：${pct}%</div>`;
  }).join("");
}

function renderEquipmentCard(slot, item) {
  if (!item) {
    return `<div class="equipment-card"><span>${slot.label}</span><strong>未装备</strong></div>`;
  }

  const itemLevel = item.itemLevel || 1;
  const title = `${slot.label}: Lv.${itemLevel} ${qualityLabel(item)} ${item.name}\n攻击 +${item.attack}\n防御 +${item.defense}\n生命 +${item.hp}`;
  return `
    <div class="equipment-card quality-${item.quality}" title="${title}">
      <span>${slot.label}</span>
      <strong>Lv.${itemLevel} ${qualityLabel(item)} ${item.name}</strong>
    </div>
  `;
}

function renderDrop(player) {
  const item = player.pendingLoot;
  if (!item) {
    el.dropCard.className = "drop-card";
    el.dropCard.textContent = "无装备";
    el.compare.className = "muted";
    el.compare.textContent = "砍树后会显示新装备对比。";
    el.equip.disabled = true;
    el.sell.disabled = true;
    return;
  }

  const diff = player.pendingComparison ? player.pendingComparison.diff : 0;
  const sign = diff >= 0 ? "+" : "";
  const diffPct = player.pendingComparison ? player.pendingComparison.diffPct : 0;
  const pctSign = diffPct >= 0 ? "+" : "";
  const hot = item.legendary || item.godlike;
  const itemLevel = item.itemLevel || 1;
  el.dropCard.className = `drop-card quality-${item.quality}${hot ? " legendary" : ""}`;
  el.dropCard.innerHTML = `
    <strong>${item.godlike ? "LEGENDARY 断层神装！！" : `${qualityLabel(item)}装备`}</strong>
    <div>【${item.name}】</div>
    <div>等级 Lv.${itemLevel}</div>
    <div>攻击 +${item.attack}</div>
    <div>防御 +${item.defense}</div>
    <div>生命 +${item.hp}</div>
    <div>战力 ${pctSign}${diffPct}%</div>
  `;
  el.compare.className = diff >= 0 ? "gain" : "loss";
  el.compare.textContent = `战力 ${sign}${diff} (${pctSign}${diffPct}%)`;
  el.equip.disabled = false;
  el.sell.disabled = false;
}

function render(player) {
  state.player = player;
  el.authPanel.classList.add("hidden");
  el.gamePanel.classList.remove("hidden");
  el.account.textContent = state.user ? state.user.username : `#${state.playerId}`;
  el.floor.textContent = player.floor;
  el.level.textContent = player.level;
  el.treeLevel.textContent = String(player.treeLevel.toFixed(1)).replace(".0", "");
  el.bossPower.textContent = player.bossPower;
  el.emotion.textContent = player.emotionState;
  el.power.textContent = player.power;
  el.xp.textContent = `${player.xp} / ${player.nextXp}`;
  el.xpFill.style.width = `${Math.min(100, Math.floor((player.xp / player.nextXp) * 100))}%`;
  el.treeXp.textContent = `${player.treeXp} / ${player.treeNextXp}`;
  el.treeXpFill.style.width = `${Math.min(100, Math.floor((player.treeXp / player.treeNextXp) * 100))}%`;
  el.dropChanceList.innerHTML = renderDropChances(player.dropQualityChances);
  el.token.textContent = `${player.chopTokens}/${player.maxChopTokens}`;
  el.coins.textContent = player.coins;
  el.buyXp.textContent = `购买树经验 ${player.buyTreeXpCost || player.buyXpCost}灵石`;
  el.buyXp.disabled = player.coins < (player.buyTreeXpCost || player.buyXpCost);
  el.stats.innerHTML = `
    <div>攻击：${player.attack}</div>
    <div>防御：${player.defense}</div>
    <div>生命：${player.hp}</div>
    <div>战力：${player.power}</div>
  `;
  el.equipment.innerHTML = player.slots.map((slot) => renderEquipmentCard(slot, player.equipment[slot.key])).join("");
  renderDrop(player);
  el.chop.disabled = (player.chopTokens <= 0 && !player.charge) || !!player.pendingLoot;
  updateAutomationUi();
  el.logs.innerHTML = state.logs.map((log) => {
    const hot = log.includes("LEGENDARY") || log.includes("神话");
    return `<li class="${hot ? "hot-log" : ""}">${log}</li>`;
  }).join("");
}

function flashIfNeeded(data) {
  if (data.item && (data.item.legendary || data.item.godlike)) {
    document.body.classList.remove("flash");
    void document.body.offsetWidth;
    document.body.classList.add("flash");
  }
}

async function loadPlayer() {
  if (state.battleActive || state.chopInFlight || state.bossInFlight) {
    return;
  }

  if (!state.playerId) {
    el.authPanel.classList.remove("hidden");
    el.gamePanel.classList.add("hidden");
    return;
  }

  const playerId = await ensurePlayerId();
  const player = await api(`/api/player/${playerId}`);
  render(player);
}

async function auth(path) {
  const username = el.username.value.trim();
  const password = el.password.value;
  const user = await api(path, {
    method: "POST",
    body: JSON.stringify({ username, password })
  });

  if (!user.playerId) {
    el.authMessage.textContent = user.log || "登录失败";
    return;
  }

  state.user = user;
  state.playerId = String(user.playerId);
  localStorage.setItem("treeLootUser", JSON.stringify(user));
  localStorage.setItem("treeLootPlayerId", state.playerId);
  el.authMessage.textContent = "";
  addLog(`欢迎 ${user.username}`);
  await loadPlayer();
}

el.login.addEventListener("click", () => auth("/api/auth/login"));
el.register.addEventListener("click", () => auth("/api/auth/register"));
el.logout.addEventListener("click", () => {
  state.user = null;
  state.playerId = null;
  state.logs = [];
  state.autoChop = false;
  state.autoBoss = false;
  state.autoBossPaused = false;
  state.recentAutoItem = "无";
  localStorage.removeItem("treeLootUser");
  localStorage.removeItem("treeLootPlayerId");
  el.authPanel.classList.remove("hidden");
  el.gamePanel.classList.add("hidden");
});

el.autoChop.addEventListener("click", () => {
  state.autoChop = !state.autoChop;
  addLog(state.autoChop ? "自动砍树已开启" : "自动砍树已关闭");
  updateAutomationUi();
});

el.autoBoss.addEventListener("click", () => {
  state.autoBoss = !state.autoBoss;
  state.autoBossPaused = false;
  addLog(state.autoBoss ? "自动Boss已开启" : "自动Boss已关闭");
  updateAutomationUi();
});

el.chop.addEventListener("click", async () => {
  el.chop.classList.remove("shake");
  void el.chop.offsetWidth;
  el.chop.classList.add("shake");
  const playerId = await ensurePlayerId();
  const data = await api("/api/chop", {
    method: "POST",
    body: JSON.stringify({ playerId })
  });
  addLog(data.log);
  flashIfNeeded(data);
  render(data.player);
});

el.equip.addEventListener("click", async () => {
  const data = await api("/api/equip", {
    method: "POST",
    body: JSON.stringify({ playerId: state.playerId, action: "equip" })
  });
  addLog(data.log);
  render(data.player);
});

el.sell.addEventListener("click", async () => {
  const data = await api("/api/equip", {
    method: "POST",
    body: JSON.stringify({ playerId: state.playerId, action: "sell" })
  });
  addLog(data.log);
  render(data.player);
});

async function handlePendingLootAutomatically(player) {
  if (!player || !player.pendingLoot) {
    return player;
  }

  const shouldEquip = player.pendingComparison && player.pendingComparison.diff > 0;
  const action = shouldEquip ? "equip" : "sell";
  const data = await api("/api/equip", {
    method: "POST",
    body: JSON.stringify({ playerId: state.playerId, action })
  });

  const itemName = data.item ? `${qualityLabel(data.item)} ${data.item.name}` : "装备";
  state.recentAutoItem = `${itemName} -> ${shouldEquip ? "自动替换" : "自动出售"}`;
  addLog(shouldEquip ? `自动替换 ${itemName}` : `自动出售 ${itemName}`);
  render(data.player);
  return data.player;
}

async function autoChopTick() {
  if (!state.autoChop || state.chopInFlight || state.bossInFlight || state.battleActive || !state.playerId) {
    return;
  }

  state.chopInFlight = true;
  try {
    if (state.player && state.player.pendingLoot) {
      await handlePendingLootAutomatically(state.player);
      return;
    }

    if (state.player && state.player.chopTokens <= 0 && !state.player.charge) {
      updateAutomationUi();
      return;
    }

    el.chop.classList.remove("shake");
    void el.chop.offsetWidth;
    el.chop.classList.add("shake");

    const data = await api("/api/chop", {
      method: "POST",
      body: JSON.stringify({ playerId: state.playerId })
    });

    addLog(`自动砍树 ${data.log || ""}`.trim());
    flashIfNeeded(data);
    render(data.player);

    if (data.revealed && data.player && data.player.pendingLoot) {
      await handlePendingLootAutomatically(data.player);
    }
  } catch (error) {
    addLog("自动砍树请求失败");
  } finally {
    state.chopInFlight = false;
    updateAutomationUi();
  }
}

async function autoBossTick() {
  if (!state.autoBoss || state.bossInFlight || state.chopInFlight || state.battleActive || !state.playerId) {
    return;
  }

  const player = state.player;
  if (!player || player.pendingLoot) {
    return;
  }

  if (state.autoBossPaused) {
    if (player.power >= player.bossPower * 1.08) {
      state.autoBossPaused = false;
      addLog("战力提升，自动Boss恢复");
    } else {
      updateAutomationUi();
      return;
    }
  }

  if (player.power < player.bossPower * 0.92) {
    state.autoBossPaused = true;
    addLog("Boss胜率偏低，自动Boss暂停");
    updateAutomationUi();
    return;
  }

  state.bossInFlight = true;
  try {
    const data = await api("/api/boss/fight", {
      method: "POST",
      body: JSON.stringify({ playerId: state.playerId })
    });

    addLog(data.win ? `自动Boss成功，进入 ${data.player.floor} 层` : "自动Boss失败，等待玩家选择");
    render(data.player);

    if (!data.win) {
      state.autoBossPaused = true;
    }
  } catch (error) {
    addLog("自动Boss请求失败");
  } finally {
    state.bossInFlight = false;
    updateAutomationUi();
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function showBattleModal() {
  state.battleActive = true;
  el.boss.disabled = true;
  el.battleOverlay.classList.remove("hidden");
  el.battleModal.className = "battle-modal";
  el.battleTitle.textContent = "Boss 战";
  el.battleCountdown.textContent = "!";
  el.battleStatus.textContent = "结算中...";
  el.battleResult.textContent = "";
}

function hideBattleModal() {
  el.battleOverlay.classList.add("hidden");
  el.battleModal.className = "battle-modal";
  state.battleActive = false;
  el.boss.disabled = false;
}

async function showBattleResult(data) {
  const win = data.win || (data.log && data.log.includes("胜"));
  el.battleModal.className = `battle-modal ${win ? "win" : "lose"}`;
  el.battleTitle.textContent = win ? "挑战胜利" : "挑战失败";
  el.battleCountdown.textContent = win ? "胜" : "败";
  el.battleStatus.textContent = win ? "奖励已结算" : "再刷一轮";
  el.battleResult.textContent = data.log || (win ? "Boss 倒下了！" : "差一点，再刷一轮！");
  addLog(data.log);
  render(data.player);
  await wait(1300);
  hideBattleModal();
}

el.boss.addEventListener("click", async () => {
  showBattleModal();
  try {
    const data = await api("/api/boss/fight", {
      method: "POST",
      body: JSON.stringify({ playerId: state.playerId })
    });
    await showBattleResult(data);
  } catch (error) {
    el.battleModal.className = "battle-modal lose";
    el.battleTitle.textContent = "挑战中断";
    el.battleCountdown.textContent = "!";
    el.battleStatus.textContent = "请求失败";
    el.battleResult.textContent = "请稍后再试";
    addLog("Boss挑战请求失败");
    await wait(1000);
    hideBattleModal();
  }
});

el.buyXp.addEventListener("click", async () => {
  const data = await api("/api/player/buy-xp", {
    method: "POST",
    body: JSON.stringify({ playerId: state.playerId })
  });
  addLog(data.log);
  render(data.player);
});

setInterval(loadPlayer, 1000);
setInterval(autoChopTick, 1200);
setInterval(autoBossTick, 2600);
loadPlayer();
