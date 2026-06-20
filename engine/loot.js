const items = require("../data/items.json");
const levels = require("../data/levels.json");
const formula = require("./formula");
const playerEngine = require("./player");

function pick(array) {
  return array[formula.randomInt(0, array.length - 1)];
}

function rollBreakAt() {
  const roll = Math.random();
  if (roll < 0.5) return 1;
  if (roll < 0.75) return 2;
  if (roll < 0.9) return 3;
  return Math.random() < 0.55 ? 4 : 5;
}

function rollPowerBand() {
  const roll = Math.random();
  let cursor = 0;
  for (const band of items.powerBands) {
    cursor += band.chance;
    if (roll < cursor) return band.key;
  }
  return "weak";
}

function pickQualityByRisk(riskLevel, forceLegendary) {
  if (forceLegendary) return "legendary";
  const tier = Math.max(1, Math.min(5, riskLevel + formula.randomInt(-1, 1)));
  if (tier <= 1) return "normal";
  if (tier === 2) return Math.random() < 0.8 ? "rare" : "normal";
  if (tier === 3) return Math.random() < 0.75 ? "epic" : "rare";
  return Math.random() < 0.28 + riskLevel * 0.08 ? "legendary" : "epic";
}

function createItemPowerTarget(player, slot, quality, forceOverpowered, powerBand) {
  const qualityConfig = items.qualities[quality];
  const currentSlotPower = playerEngine.getEquipmentPower(player.equipment[slot]);
  const averagePower = playerEngine.getAverageEquipmentPower(player);
  const treeLevel = formula.getTreeLevel(player);
  const lateLevelScale = 1 + Math.max(0, player.level - 20) * 0.08;
  const lateFloorScale = 1 + Math.max(0, player.floor - 20) * 0.06;
  const floorBase = Math.max(12, Math.floor(18 * Math.pow(player.floor, 1.18) * (1 + treeLevel * 0.08) * lateLevelScale * lateFloorScale));
  const qualityMult = formula.randomFloat(qualityConfig.powerMultiplier[0], qualityConfig.powerMultiplier[1]);
  let target = floorBase * qualityMult * formula.randomFloat(0.85, 1.25);

  if (powerBand === "weak") {
    target = currentSlotPower > 0 ? currentSlotPower * formula.randomFloat(0.35, 0.9) : target * formula.randomFloat(0.45, 0.8);
  }

  if (powerBand === "strong") {
    target = Math.max(
      target * formula.randomFloat(1.8, 2.6 + Math.max(0, player.level - 20) * 0.05),
      currentSlotPower * formula.randomFloat(1.35, 2.2 + Math.max(0, player.level - 20) * 0.04)
    );
  }

  if (powerBand === "god") {
    const lateBurst = 1 + Math.max(0, player.level - 20) * 0.04;
    target = Math.max(
      target * formula.randomFloat(5, 10 * lateBurst),
      currentSlotPower * formula.randomFloat(2, 10 * lateBurst),
      player.power * formula.randomFloat(0.5, 1.8 * lateBurst)
    );
  }

  if (forceOverpowered) {
    target = Math.max(target, currentSlotPower * formula.randomFloat(1.5, 1.9), averagePower * formula.randomFloat(1.35, 1.7));
  }

  if (quality === "legendary") {
    target = Math.max(
      target,
      currentSlotPower * formula.randomFloat(1.3, 1.8 + Math.max(0, player.level - 20) * 0.025),
      floorBase * 5 * formula.randomFloat(0.9, 1.25 + Math.max(0, player.level - 20) * 0.025)
    );
  }

  return Math.floor(target);
}

function splitPowerToStats(targetPower, quality) {
  const attackShare = formula.randomFloat(0.35, 0.55);
  const defenseShare = formula.randomFloat(0.18, 0.32);
  const hpShare = Math.max(0.15, 1 - attackShare - defenseShare);
  const burst = quality === "legendary" ? formula.randomFloat(1.05, 1.25) : formula.randomFloat(0.9, 1.1);
  return {
    attack: Math.max(1, Math.floor((targetPower * attackShare * burst) / 1.2)),
    defense: Math.max(1, Math.floor(targetPower * defenseShare * burst)),
    hp: Math.max(1, Math.floor((targetPower * hpShare * burst) / 0.2))
  };
}

function generateItem(player, riskLevel) {
  const powerBand = rollPowerBand();
  const forceOverpowered = !player.floorPowerDropUsed && (player.floorDropCount >= 6 || Math.random() < 0.12);
  let quality = pickQualityByRisk(riskLevel, false);
  if (powerBand === "god") quality = "legendary";

  const slot = pick(items.slots).key;
  const qualityConfig = items.qualities[quality];
  const targetPower = createItemPowerTarget(player, slot, quality, forceOverpowered || powerBand === "god" || quality === "legendary", powerBand);
  const stats = splitPowerToStats(targetPower, quality);
  const name = `${pick(qualityConfig.names)}·${pick(items.slotNames[slot])}`;

  return {
    name,
    slot,
    attack: stats.attack,
    defense: stats.defense,
    hp: stats.hp,
    quality,
    qualityLabel: qualityConfig.label,
    legendary: quality === "legendary",
    overpowered: forceOverpowered || quality === "legendary" || powerBand === "god",
    powerBand,
    godlike: powerBand === "god"
  };
}

function refreshChopTokens(player) {
  if (player.chopTokens >= player.maxChopTokens) {
    player.lastTokenAt = Date.now();
    return 0;
  }

  const elapsed = Math.floor((Date.now() - player.lastTokenAt) / 1000);
  const gained = Math.floor(elapsed / player.tokenRegenSeconds);
  if (gained <= 0) return 0;

  const before = player.chopTokens;
  player.chopTokens = Math.min(player.maxChopTokens, player.chopTokens + gained);
  player.lastTokenAt += gained * player.tokenRegenSeconds * 1000;
  return player.chopTokens - before;
}

function chop(player) {
  refreshChopTokens(player);

  if (player.pendingLoot) return { item: player.pendingLoot, gold: 0, log: "先处理掉落", revealed: true };
  if (player.chopTokens <= 0) return { item: null, gold: 0, log: "伐木令不足", revealed: false };

  player.chopTokens -= 1;

  if (!player.riskBreakAt) {
    player.floorDropCount += 1;
    player.riskBreakAt = rollBreakAt();
    player.charge = 0;
  }

  player.charge += 1;
  player.emotionState = player.charge >= 4 ? "赌狗模式" : player.charge >= 2 ? "危险边缘" : "稳定发育";
  console.log(`[sfx] chop risk ${player.charge}`);

  if (player.charge < player.riskBreakAt) {
    return { item: null, gold: 0, log: player.charge >= 3 ? "灵光一闪" : "木屑飞溅", revealed: false };
  }

  const item = generateItem(player, player.charge);
  const currentPower = playerEngine.getEquipmentPower(player.equipment[item.slot]);
  const newPower = playerEngine.getEquipmentPower(item);
  player.lastDropDiffPct = currentPower > 0 ? Math.round(((newPower - currentPower) / currentPower) * 100) : 100;
  player.pendingLoot = item;
  player.riskBreakAt = null;
  playerEngine.addXp(player, levels.dropXpBase + formula.getTreeLevel(player));

  if (item.overpowered && player.lastDropDiffPct >= 50) player.floorPowerDropUsed = true;

  if (item.godlike) {
    player.emotionState = "爆发期";
    console.log("[sfx] legendary jackpot");
    return { item, gold: 0, log: "LEGENDARY 断层神装！！", revealed: true };
  }

  if (item.legendary) {
    player.emotionState = "爆发期";
    console.log("[sfx] legendary");
    return { item, gold: 0, log: "神话装备掉落！！", revealed: true };
  }

  if (item.quality === "epic") {
    player.emotionState = "危险边缘";
    return { item, gold: 0, log: "高级装备！", revealed: true };
  }

  player.emotionState = player.lastDropDiffPct >= 0 ? "稳定发育" : "危险边缘";
  return { item, gold: 0, log: `获得【${item.name}】`, revealed: true };
}

module.exports = {
  chop,
  refreshChopTokens
};
