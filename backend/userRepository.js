const crypto = require("crypto");
const { pool } = require("./db");
const playerRepository = require("./playerRepository");

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(":")) return false;
  const [salt, hash] = storedHash.split(":");
  return hashPassword(password, salt) === `${salt}:${hash}`;
}

function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    playerId: row.player_id,
    createdAt: row.created_at
  };
}

async function findByUsername(username) {
  const [rows] = await pool.query("SELECT * FROM users WHERE username = ?", [username]);
  return rows[0] || null;
}

async function findById(id) {
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [id]);
  return rows[0] || null;
}

async function register(username, password) {
  const normalized = String(username || "").trim();
  if (normalized.length < 3) throw new Error("用户名至少 3 个字符");
  if (String(password || "").length < 6) throw new Error("密码至少 6 个字符");

  const existing = await findByUsername(normalized);
  if (existing) throw new Error("用户名已存在");

  const player = await playerRepository.createPlayer();
  const [result] = await pool.query(
    "INSERT INTO users (username, password_hash, role, player_id) VALUES (?, ?, 'player', ?)",
    [normalized, hashPassword(password), player.id]
  );
  await pool.query("UPDATE players SET user_id = ? WHERE id = ?", [result.insertId, player.id]);

  return {
    id: result.insertId,
    username: normalized,
    role: "player",
    playerId: player.id
  };
}

async function login(username, password) {
  const user = await findByUsername(String(username || "").trim());
  if (!user || !verifyPassword(password, user.password_hash)) return null;
  return publicUser(user);
}

async function ensureAdminUser() {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "lbj19841230";
  const existing = await findByUsername(username);

  if (existing) {
    if (existing.role !== "admin") {
      await pool.query("UPDATE users SET role = 'admin' WHERE id = ?", [existing.id]);
    }
    if (!verifyPassword(password, existing.password_hash)) {
      await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [hashPassword(password), existing.id]);
    }
    return;
  }

  await pool.query(
    "INSERT INTO users (username, password_hash, role, player_id) VALUES (?, ?, 'admin', NULL)",
    [username, hashPassword(password)]
  );
}

async function listUsers() {
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.role, u.player_id, u.created_at,
            p.level, p.floor, p.power, p.gold
     FROM users u
     LEFT JOIN players p ON p.id = u.player_id
     ORDER BY u.id ASC`
  );

  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    role: row.role,
    playerId: row.player_id,
    level: row.level,
    floor: row.floor,
    power: row.power,
    gold: row.gold,
    createdAt: row.created_at
  }));
}

async function resetPassword(userId, newPassword) {
  if (String(newPassword || "").length < 6) throw new Error("新密码至少 6 个字符");
  const [result] = await pool.query(
    "UPDATE users SET password_hash = ? WHERE id = ?",
    [hashPassword(newPassword), userId]
  );
  return result.affectedRows > 0;
}

async function deleteUser(userId) {
  const user = await findById(userId);
  if (!user) return false;
  if (user.role === "admin") throw new Error("不能删除管理员账号");

  await pool.query("DELETE FROM users WHERE id = ?", [userId]);
  if (user.player_id) await pool.query("DELETE FROM players WHERE id = ?", [user.player_id]);
  return true;
}

module.exports = {
  register,
  login,
  ensureAdminUser,
  listUsers,
  resetPassword,
  deleteUser
};
