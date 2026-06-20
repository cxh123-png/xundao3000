const state = {
  player: null,
  user: JSON.parse(localStorage.getItem("treeLootUser") || "null"),
  playerId: localStorage.getItem("treeLootPlayerId"),
  logs: [],
  battleActive: false
};

if (!state.user) {
  state.playerId = null;
  localStorage.removeItem("treeLootPlayerId");
}

const $ = (id) => document.getElementById(id);
const el = {
  authPanel: $("authPanel"), gamePanel: $("gamePanel"), username: $("usernameInput"), password: $("passwordInput"), login: $("loginButton"), register: $("registerButton"), authMessage: $("authMessage"), account: $("accountText"), logout: $("logoutButton"), floor: $("floorText"), level: $("levelText"), treeLevel: $("treeLevelText"), bossPower: $("bossPowerText"), emotion: $("emotionText"), power: $("powerText"), xp: $("xpText"), xpFill: $("xpFill"), token: $("tokenText"), coins: $("coinText"), buyXp: $("buyXpButton"), stats: $("playerStats"), equipment: $("equipmentGrid"), dropCard: $("dropCard"), compare: $("compareText"), logs: $("logList"), chop: $("chopButton"), boss: $("bossButton"), equip: $("equipButton"), sell: $("sellButton"), battleOverlay: $("battleOverlay"), battleModal: $("battleModal"), battleTitle: $("battleTitle"), battleCountdown: $("battleCountdown"), battleStatus: $("battleStatus"), battleResult: $("battleResult")
};

function addLog(message) {
  if (!message) return;
  state.logs.unshift(`[${new Date().toLocaleTimeString()}] ${message}`);
  if (state.logs.length > 80) state.logs.pop();
}

async function api(path, options) {
  const response = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  const data = await response.json();
  if (!response.ok) addLog(data.log || "请求失败");
  return data;
}

async function ensurePlayerId() {
  if (state.playerId) return state.playerId;
  throw new Error("请先登录");
}

function qualityLabel(item) {
  return item.qualityLabel || item.quality;
}

function renderEquipmentCard(slot, item) {
  if (!item) return `<div class="equipment-card"><span>${slot.label}</span><strong>未装备</strong></div>`;
  const title = `${slot.label}: ${qualityLabel(item)} ${item.name}\n攻击 +${item.attack}\n防御 +${item.defense}\n生命 +${item.hp}`;
  return `<div class="equipment-card quality-${item.quality}" title="${title}"><span>${slot.label}</span><strong>${qualityLabel(item)} ${item.name}</strong></div>`;
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
  const diffPct = player.pendingComparison ? player.pendingComparison.diffPct : 0;
  const sign = diff >= 0 ? "+" : "";
  const pctSign = diffPct >= 0 ? "+" : "";
  const hot = item.legendary || item.godlike;
  el.dropCard.className = `drop-card quality-${item.quality}${hot ? " legendary" : ""}`;
  el.dropCard.innerHTML = `<strong>${item.godlike ? "LEGENDARY 断层神装！！" : `${qualityLabel(item)}装备`}</strong><div>【${item.name}】</div><div>攻击 +${item.attack}</div><div>防御 +${item.defense}</div><div>生命 +${item.hp}</div><div>战力 ${pctSign}${diffPct}%</div>`;
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
  el.token.textContent = `${player.chopTokens}/${player.maxChopTokens}`;
  el.coins.textContent = player.coins;
  el.buyXp.textContent = `购买经验 ${player.buyXpCost}灵石`;
  el.buyXp.disabled = player.coins < player.buyXpCost;
  el.stats.innerHTML = `<div>攻击：${player.attack}</div><div>防御：${player.defense}</div><div>生命：${player.hp}</div><div>战力：${player.power}</div>`;
  el.equipment.innerHTML = player.slots.map((slot) => renderEquipmentCard(slot, player.equipment[slot.key])).join("");
  renderDrop(player);
  el.chop.disabled = player.chopTokens <= 0 || !!player.pendingLoot;
  el.logs.innerHTML = state.logs.map((log) => `<li class="${log.includes("LEGENDARY") || log.includes("神话") ? "hot-log" : ""}">${log}</li>`).join("");
}

function flashIfNeeded(data) {
  if (data.item && (data.item.legendary || data.item.godlike)) {
    document.body.classList.remove("flash");
    void document.body.offsetWidth;
    document.body.classList.add("flash");
  }
}

async function loadPlayer() {
  if (state.battleActive) return;
  if (!state.playerId) {
    el.authPanel.classList.remove("hidden");
    el.gamePanel.classList.add("hidden");
    return;
  }
  const player = await api(`/api/player/${await ensurePlayerId()}`);
  render(player);
}

async function auth(path) {
  const username = el.username.value.trim();
  const password = el.password.value;
  const user = await api(path, { method: "POST", body: JSON.stringify({ username, password }) });
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

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function showBattleModal() { state.battleActive = true; el.boss.disabled = true; el.battleOverlay.classList.remove("hidden"); el.battleModal.className = "battle-modal"; el.battleTitle.textContent = "Boss 战"; el.battleCountdown.textContent = "3"; el.battleStatus.textContent = "战斗中..."; el.battleResult.textContent = ""; }
function hideBattleModal() { el.battleOverlay.classList.add("hidden"); el.battleModal.className = "battle-modal"; state.battleActive = false; el.boss.disabled = false; }

async function playBattleCountdown(resultPromise) {
  const statuses = ["刀光交错...", "Boss 反击！", "最后一击..."];
  let resultData = null;
  resultPromise.then((data) => { resultData = data; }).catch(() => {});
  for (let second = 3; second >= 1; second -= 1) {
    el.battleCountdown.textContent = String(second);
    el.battleStatus.textContent = statuses[3 - second] || "战斗中...";
    el.battleModal.classList.remove("shake");
    void el.battleModal.offsetWidth;
    el.battleModal.classList.add("shake");
    await wait(1000);
  }
  el.battleCountdown.textContent = "0";
  el.battleStatus.textContent = "结算中...";
  const data = resultData || await resultPromise;
  el.battleModal.className = `battle-modal ${data.win ? "win" : "lose"}`;
  el.battleTitle.textContent = data.win ? "挑战胜利" : "挑战失败";
  el.battleResult.textContent = data.log || (data.win ? "Boss 倒下了！" : "差一点，再刷一轮！");
  addLog(data.log);
  render(data.player);
  await wait(1000);
  hideBattleModal();
}

el.login.addEventListener("click", () => auth("/api/auth/login"));
el.register.addEventListener("click", () => auth("/api/auth/register"));
el.logout.addEventListener("click", () => { state.user = null; state.playerId = null; state.logs = []; localStorage.removeItem("treeLootUser"); localStorage.removeItem("treeLootPlayerId"); el.authPanel.classList.remove("hidden"); el.gamePanel.classList.add("hidden"); });
el.chop.addEventListener("click", async () => { el.chop.classList.remove("shake"); void el.chop.offsetWidth; el.chop.classList.add("shake"); const data = await api("/api/chop", { method: "POST", body: JSON.stringify({ playerId: await ensurePlayerId() }) }); addLog(data.log); flashIfNeeded(data); render(data.player); });
el.equip.addEventListener("click", async () => { const data = await api("/api/equip", { method: "POST", body: JSON.stringify({ playerId: state.playerId, action: "equip" }) }); addLog(data.log); render(data.player); });
el.sell.addEventListener("click", async () => { const data = await api("/api/equip", { method: "POST", body: JSON.stringify({ playerId: state.playerId, action: "sell" }) }); addLog(data.log); render(data.player); });
el.boss.addEventListener("click", async () => { showBattleModal(); const resultPromise = api("/api/boss/fight", { method: "POST", body: JSON.stringify({ playerId: state.playerId }) }); try { await playBattleCountdown(resultPromise); } catch (error) { el.battleModal.className = "battle-modal lose"; el.battleTitle.textContent = "挑战中断"; el.battleCountdown.textContent = "!"; el.battleStatus.textContent = "请求失败"; el.battleResult.textContent = "请稍后再试"; addLog("Boss挑战请求失败"); await wait(1000); hideBattleModal(); } });
el.buyXp.addEventListener("click", async () => { const data = await api("/api/player/buy-xp", { method: "POST", body: JSON.stringify({ playerId: state.playerId }) }); addLog(data.log); render(data.player); });

setInterval(loadPlayer, 1000);
loadPlayer();
