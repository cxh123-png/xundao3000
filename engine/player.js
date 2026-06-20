const items = require("../data/items.json");
const levels = require("../data/levels.json");
const formula = require("./formula");

function createEmptyEquipment() {
  return items.slots.reduce((equipment, slot) => {
    equipment[slot.key] = null;
    return equipment;
  }, {});
}

function createPlayer() {
  const player = {
    floor: 1,
    level: levels.initialLevel,
    xp: levels.initialXp,
    nextXp: formula.getNextLevelXp(levels.initialLevel),
    coins: 0,
    chopTokens: 10,
    maxChopTokens: 20,
    tokenRegenSeconds: 10,
    lastTokenAt: Date.now(),
    charge: 0,
    riskBreakAt: null,
    floorDropCount: 0,
    floorPowerDropUsed: false,
    pendingLoot: null,
    lastDropDiffPct: 0,
    emotionState: "稳定发育",
    equipment: createEmptyEquipment()
  };

  return recalculateStats(player);
}

function recalculateStats(player) {
  const base = levels.baseStats;
  const perLevel = levels.statsPerLevel;
  const levelOffset = player.level - 1;
  const totals = {
    attack: base.attack + levelOffset * perLevel.attack,
    defense: base.defense + levelOffset * perLevel.defense,
    hp: base.hp + levelOffset * perLevel.hp
  };

  items.slots.forEach((slot) => {
    const item = player.equipment[slot.key];
    if (!item) return;
    totals.attack += item.attack;
    totals.defense += item.defense;
    totals.hp += item.hp;
  });

  player.attack = totals.attack;
  player.defense = totals.defense;
  player.hp = totals.hp;
  player.power = formula.calculatePower(totals);
  return player;
}

function addXp(player, amount) {
  let leveled = 0;
  player.xp += Math.floor(amount);

  while (player.xp >= player.nextXp) {
    player.xp -= player.nextXp;
    player.level += 1;
    leveled += 1;
    player.nextXp = formula.getNextLevelXp(player.level);
  }

  recalculateStats(player);
  return leveled;
}

function equip(player, item) {
  player.equipment[item.slot] = item;
  player.pendingLoot = null;
  player.charge = 0;
  player.riskBreakAt = null;
  return recalculateStats(player);
}

function sellPending(player) {
  if (!player.pendingLoot) return null;

  const sold = player.pendingLoot;
  player.pendingLoot = null;
  player.charge = 0;
  player.riskBreakAt = null;
  player.coins += items.sellCoin;
  return sold;
}

function buyXp(player) {
  if (player.coins < levels.buyXpCost) return false;
  player.coins -= levels.buyXpCost;
  addXp(player, levels.buyXpAmount);
  return true;
}

function getEquipmentPower(item) {
  if (!item) return 0;
  return formula.calculatePower(item);
}

function getAverageEquipmentPower(player) {
  const equipped = items.slots.map((slot) => player.equipment[slot.key]).filter(Boolean);
  if (equipped.length === 0) return Math.max(1, player.power);
  const total = equipped.reduce((sum, item) => sum + getEquipmentPower(item), 0);
  return Math.max(1, Math.floor(total / equipped.length));
}

function toPublicPlayer(player) {
  let pendingComparison = null;

  if (player.pendingLoot) {
    const current = player.equipment[player.pendingLoot.slot];
    pendingComparison = {
      diff: getEquipmentPower(player.pendingLoot) - getEquipmentPower(current),
      diffPct: player.lastDropDiffPct
    };
  }

  return {
    floor: player.floor,
    level: player.level,
    xp: player.xp,
    nextXp: player.nextXp,
    treeLevel: formula.getTreeLevel(player),
    coins: player.coins,
    chopTokens: player.chopTokens,
    maxChopTokens: player.maxChopTokens,
    tokenRegenSeconds: player.tokenRegenSeconds,
    charge: player.charge,
    emotionState: player.emotionState,
    attack: player.attack,
    defense: player.defense,
    hp: player.hp,
    power: player.power,
    bossPower: formula.getDisplayedBossPower(player),
    equipment: player.equipment,
    pendingLoot: player.pendingLoot,
    pendingComparison,
    lastDropDiffPct: player.lastDropDiffPct,
    slots: items.slots,
    buyXpCost: levels.buyXpCost,
    buyXpAmount: levels.buyXpAmount
  };
}

module.exports = {
  createPlayer,
  recalculateStats,
  addXp,
  equip,
  sellPending,
  buyXp,
  getEquipmentPower,
  getAverageEquipmentPower,
  toPublicPlayer
};
