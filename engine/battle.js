const bosses = require("../data/bosses.json");
const formula = require("./formula");

function fight(player) {
  const range = formula.getBossFactorRange(player.floor);
  const bossPower = Math.floor(player.power * formula.randomFloat(range.min, range.max));
  const finalPower = Math.floor(player.power * formula.randomFloat(bosses.playerPowerVariance[0], bosses.playerPowerVariance[1]));
  const roll = finalPower / bossPower;
  const win = finalPower >= bossPower;
  let resultType = "翻车";

  if (win && roll >= 1.18) {
    resultType = "碾压胜";
  } else if (win) {
    resultType = "险胜";
  }

  if (win) {
    player.floor += 1;
    player.floorDropCount = 0;
    player.floorPowerDropUsed = false;
    player.chopTokens = Math.min(player.maxChopTokens, player.chopTokens + bosses.winRewardTokens);
    player.emotionState = resultType === "险胜" ? "危险边缘" : "爆发期";
  } else {
    player.emotionState = "危险边缘";
  }

  return {
    win,
    playerPower: player.power,
    finalPower,
    bossPower,
    winChance: formula.getWinChance(finalPower, bossPower),
    roll,
    resultType,
    reward: win ? { chopTokens: bosses.winRewardTokens, floor: player.floor } : {}
  };
}

module.exports = {
  fight
};
