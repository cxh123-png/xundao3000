const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

const dataDir = path.join(__dirname, "..", "data");
const dbPath = process.env.SQLITE_DB_PATH || path.join(dataDir, "game.db");

let sqlitePromise = null;
let db = null;

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function getSqlite() {
  if (!sqlitePromise) {
    sqlitePromise = initSqlJs({
      locateFile: (file) => path.join(__dirname, "..", "node_modules", "sql.js", "dist", file)
    });
  }
  return sqlitePromise;
}

async function getDb() {
  if (db) {
    return db;
  }

  const SQL = await getSqlite();
  if (fs.existsSync(dbPath)) {
    db = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    db = new SQL.Database();
  }
  db.run("PRAGMA foreign_keys = ON");
  return db;
}

function isReadQuery(sql) {
  const normalized = sql.trim().toLowerCase();
  return (
    normalized.startsWith("select") ||
    normalized.startsWith("with") ||
    normalized.startsWith("pragma")
  );
}

function persistDb(database) {
  fs.writeFileSync(dbPath, Buffer.from(database.export()));
}

function readRows(statement, params) {
  const rows = [];
  statement.bind(params);
  while (statement.step()) {
    rows.push(statement.getAsObject());
  }
  statement.free();
  return rows;
}

const pool = {
  async query(sql, params = []) {
    const database = await getDb();
    const statement = database.prepare(sql);

    if (isReadQuery(sql)) {
      return [readRows(statement, params)];
    }

    statement.bind(params);
    statement.step();
    statement.free();

    const meta = database.exec("SELECT last_insert_rowid() AS insertId, changes() AS affectedRows");
    const result = meta[0] && meta[0].values[0]
      ? {
          insertId: Number(meta[0].values[0][0] || 0),
          affectedRows: Number(meta[0].values[0][1] || 0)
        }
      : { insertId: 0, affectedRows: 0 };

    persistDb(database);
    return [result];
  }
};

async function initSchema() {
  const database = await getDb();
  const schemaPath = path.join(__dirname, "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");
  database.run(sql);
  persistDb(database);
}

module.exports = {
  pool,
  initSchema,
  dbPath
};
