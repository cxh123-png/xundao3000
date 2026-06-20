const { pool } = require("./db");
const playerEngine = require("../engine/player");
const dataItems = require("../data/items.json");

const QUALITY_TO_INT = { normal: 1, rare: 2, epic: 3, legendary: 4 };
const INT_TO_QUALITY = { 1: "normal", 2: "rare", 3: "epic", 4: "legendary" };

function qualityLabel(quality) {
  return dataItems.qualities[quality] ? dataItems.qualities[quality].label : quality;
}

function toDbQuality(quality) {
  return QUALITY_TO_INT[quality] || 1;
}

function fromDbItem(row) {
  const quality = INT_TO_QUALITY[row.quality] || "normal";
  return {
    id: row.id,
    slot: row.slot,
    name: row.name,
    quality,
    qualityLabel: qualityLabel(quality),
    attack: row.attack,
    defense: row.defense,
    hp: row.hp,
    powerBand: row.power_band || "weak",
    legendary: Boolean(row.is_legendary),
    overpowered: Boolean(row.is_overpowered),
    godlike: Boolean(row.is_godlike)
  };
}

function applyPlayerRow(player, row) {
  player.id = row.id;
  player.level = row.level;
  player.xp = row.exp;
  player.nextXp = require("../engine/formula").getNextLevelXp(row.level);
  player.coins = row.gold;
  player.floor = row.floor;
  player.chopTokens = row.chop_tokens;
  player.maxChopTokens = row.max_chop_tokens;
  player.tokenRegenSeconds = row.token_regen_seconds;
  player.lastTokenAt = Number(row.last_token_at);
  player.charge = row.charge;
  player.riskBreakAt = row.risk_break_at;
  player.floorDropCount = row.floor_drop_count;
  player.floorPowerDropUsed = Boolean(row.floor_power_drop_used);
  player.lastDropDiffPct = row.last_drop_diff_pct;
  player.emotionState = row.emotion_state;
}

async function createPlayer() {
  const player = playerEngine.createPlayer();
  const [result] = await pool.query(
    `INSERT INTO players
      (level, exp, attack, defense, hp, gold, floor, power, chop_tokens, max_chop_tokens,
       token_regen_seconds, last_token_at, charge, risk_break_at, floor_drop_count,
       floor_power_drop_used, last_drop_diff_pct, emotion_state)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      player.level,
      player.xp,
      player.attack,
      player.defense,
      player.hp,
      player.coins,
      player.floor,
      player.power,
      player.chopTokens,
      player.maxChopTokens,
      player.tokenRegenSeconds,
      player.lastTokenAt,
      player.charge,
      player.riskBreakAt,
      player.floorDropCount,
      player.floorPowerDropUsed ? 1 : 0,
      player.lastDropDiffPct,
      player.emotionState
    ]
  );

  player.id = result.insertId;
  return player;
}

async function loadPlayer(id) {
  const [rows] = await pool.query("SELECT * FROM players WHERE id = ?", [id]);
  if (rows.length === 0) return null;

  const player = playerEngine.createPlayer();
  applyPlayerRow(player, rows[0]);

  const [itemRows] = await pool.query("SELECT * FROM items WHERE player_id = ? ORDER BY id ASC", [id]);
  itemRows.forEach((row) => {
    const item = fromDbItem(row);
    if (row.is_equipped) player.equipment[item.slot] = item;
    else player.pendingLoot = item;
  });

  return playerEngine.recalculateStats(player);
}

async function savePlayer(player) {
  playerEngine.recalculateStats(player);
  await pool.query(
    `UPDATE players SET
      level = ?, exp = ?, attack = ?, defense = ?, hp = ?, gold = ?, floor = ?, power = ?,
      chop_tokens = ?, max_chop_tokens = ?, token_regen_seconds = ?, last_token_at = ?,
      charge = ?, risk_break_at = ?, floor_drop_count = ?, floor_power_drop_used = ?,
      last_drop_diff_pct = ?, emotion_state = ?
     WHERE id = ?`,
    [
      player.level,
      player.xp,
      player.attack,
      player.defense,
      player.hp,
      player.coins,
      player.floor,
      player.power,
      player.chopTokens,
      player.maxChopTokens,
      player.tokenRegenSeconds,
      player.lastTokenAt,
      player.charge,
      player.riskBreakAt,
      player.floorDropCount,
      player.floorPowerDropUsed ? 1 : 0,
      player.lastDropDiffPct,
      player.emotionState,
      player.id
    ]
  );

  await pool.query("DELETE FROM items WHERE player_id = ?", [player.id]);
  const itemsToSave = [];
  Object.values(player.equipment).forEach((item) => {
    if (item) itemsToSave.push({ item, isEquipped: true });
  });
  if (player.pendingLoot) itemsToSave.push({ item: player.pendingLoot, isEquipped: false });

  for (const entry of itemsToSave) {
    const item = entry.item;
    await pool.query(
      `INSERT INTO items
        (player_id, slot, name, quality, attack, defense, hp, is_equipped,
         power_band, is_legendary, is_overpowered, is_godlike)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        player.id,
        item.slot,
        item.name,
        toDbQuality(item.quality),
        item.attack,
        item.defense,
        item.hp,
        entry.isEquipped ? 1 : 0,
        item.powerBand || null,
        item.legendary ? 1 : 0,
        item.overpowered ? 1 : 0,
        item.godlike ? 1 : 0
      ]
    );
  }
}

function publicPlayer(player) {
  return { id: player.id, ...playerEngine.toPublicPlayer(player) };
}

module.exports = {
  createPlayer,
  loadPlayer,
  savePlayer,
  publicPlayer
};
