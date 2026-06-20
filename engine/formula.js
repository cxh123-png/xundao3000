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

function getTreeLevel(player) {
  return Math.max(1, player.level / levels.treeLevelDivisor);
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
  getTreeLevel,
  getBossFactorRange,
  getDisplayedBossPower,
  getWinChance
};
