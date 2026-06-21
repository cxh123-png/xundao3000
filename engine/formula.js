const levels = require("../data/levels.json");
const bosses = require("../data/bosses.json");

function randomFloat(min, max) {
  return min + Math.random() * (max - min);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function calculatePower(stats) {
  return Math.floor(stats.attack * 1.2 + stats.defense + stats.hp * 0.2);
}

function getNextLevelXp(level) {
  if (level <= levels.earlyLevelLimit) {
    return Math.floor(levels.earlyBase + levels.earlyScale * Math.pow(level, levels.earlyExponent));
  }

  return Math.floor(
    levels.earlyBase +
      levels.earlyScale * Math.pow(levels.earlyLevelLimit, levels.earlyExponent) +
      levels.lateScale * Math.pow(level - levels.earlyLevelLimit, levels.lateExponent)
  );
}

function getNextTreeLevelXp(level) {
  return Math.floor(levels.treeXpBase + levels.treeXpScale * Math.pow(level, levels.treeXpExponent));
}

function getTreeLevel(player) {
  return Math.max(1, player.treeLevel || levels.initialTreeLevel || 1);
}

function getMaxChopTokens(treeLevel) {
  const level = Math.max(1, treeLevel || levels.initialTreeLevel || 1);
  const base = levels.baseMaxChopTokens || 20;
  const growth = levels.maxChopTokensPerTreeLevel || 0;
  const cap = levels.maxChopTokensCap || Infinity;
  return Math.min(cap, base + (level - 1) * growth);
}

function normalizeChances(chances) {
  const total = Object.values(chances).reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(Object.entries(chances).map(([key, value]) => [key, value / total]));
}

function getDropQualityChances(treeLevel, riskLevel = 1) {
  const level = Math.max(1, treeLevel || 1);
  const riskBonus = Math.max(0, riskLevel - 1);
  const legendary = clamp(0.002 + level * 0.0012 + riskBonus * 0.018, 0.002, 0.16);
  const epic = clamp(0.025 + level * 0.006 + riskBonus * 0.055, 0.025, 0.34);
  const rare = clamp(0.15 + level * 0.008 + riskBonus * 0.035, 0.15, 0.42);
  const normal = Math.max(0.08, 1 - legendary - epic - rare);

  return normalizeChances({ normal, rare, epic, legendary });
}

function getBossFactorRange(floor) {
  if (floor <= bosses.earlyFloorLimit) {
    return {
      min: bosses.earlyMinStart + floor * bosses.earlyMinStep,
      max: bosses.earlyMaxStart + floor * bosses.earlyMaxStep
    };
  }

  const late = floor - bosses.earlyFloorLimit;
  return {
    min: Math.min(bosses.lateMinCap, bosses.lateMinStart + late * bosses.lateMinStep),
    max: Math.min(bosses.lateMaxCap, bosses.lateMaxStart + late * bosses.lateMaxStep)
  };
}

function getDisplayedBossPower(player) {
  const range = getBossFactorRange(player.floor);
  return Math.floor(player.power * ((range.min + range.max) / 2));
}

function getWinChance(playerPower, bossPower) {
  if (bossPower <= 0) {
    return 0.9;
  }

  const ratio = playerPower / bossPower;
  return clamp(0.5 + (ratio - 1) * 0.45, 0.08, 0.9);
}

module.exports = {
  randomFloat,
  randomInt,
  clamp,
  calculatePower,
  getNextLevelXp,
  getNextTreeLevelXp,
  getTreeLevel,
  getMaxChopTokens,
  getDropQualityChances,
  getBossFactorRange,
  getDisplayedBossPower,
  getWinChance
};
