const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const tree = require('./jsonTree');
const { createApiError } = require('../utils/apiError');
const NESTED = new Set(['job_files', 'warning_items', 'review_required_items']);
const SCHEMA = 1;
const driver = () => {
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('SQLite provider requires Node.js 24 or newer.');
  return require('node:sqlite');
};
class SqliteStore {
  constructor(filename) {
    this.filename = path.resolve(filename);
    if (!fs.existsSync(this.filename)) throw createApiError(503, 'SQLITE_NOT_INITIALIZED', 'SQLite database is missing. Initialize explicitly with the database CLI.');
    const { DatabaseSync } = driver();
    this.db = new DatabaseSync(this.filename);
    try {
      this.db.exec('PRAGMA busy_timeout=3000; PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL;');
      const version = this.db.prepare('PRAGMA user_version').get().user_version;
      if (version !== SCHEMA) throw new Error(`Unsupported SQLite schema ${version}; expected ${SCHEMA}.`);
      if (this.db.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('SQLite integrity check failed.');
      this.db.exec('PRAGMA journal_mode=WAL;');
    } catch (error) { this.db.close(); throw error; }
    this.insideAtomic = false;
  }
  static initialize(filename) {
    filename = path.resolve(filename);
    const { DatabaseSync } = driver();
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    const fd = fs.openSync(filename, 'wx', 0o600); fs.closeSync(fd);
    const db = new DatabaseSync(filename);
    try {
      db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
        CREATE TABLE metadata (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, last_backup_at TEXT);
        INSERT INTO metadata(id,revision) VALUES(1,0);
        CREATE TABLE documents (
          path TEXT PRIMARY KEY, collection TEXT NOT NULL, record_key TEXT NOT NULL,
          document TEXT NOT NULL CHECK(json_valid(document)), revision INTEGER NOT NULL DEFAULT 1,
          worker_id TEXT GENERATED ALWAYS AS (json_extract(document,'$.workerId')) VIRTUAL,
          status TEXT GENERATED ALWAYS AS (json_extract(document,'$.status')) VIRTUAL,
          scope TEXT GENERATED ALWAYS AS (json_extract(document,'$.prScope')) VIRTUAL,
          created_at TEXT GENERATED ALWAYS AS (json_extract(document,'$.createdAt')) VIRTUAL
        );
        CREATE INDEX documents_collection ON documents(collection,record_key);
        CREATE INDEX jobs_history ON documents(collection,worker_id,status,scope,created_at);
        PRAGMA user_version=1;`);
    } finally { db.close(); }
    return new SqliteStore(filename);
  }
  atomic(operation) {
    if (this.insideAtomic) return operation();
    this.db.exec('BEGIN IMMEDIATE'); this.insideAtomic = true;
    try {
      const result = operation();
      if (result && typeof result.then === 'function') throw new Error('SQLite atomic operations must be synchronous.');
      this.db.exec('COMMIT'); return result;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    finally { this.insideAtomic = false; }
  }
  anchor(segments) { return segments.slice(0, NESTED.has(segments[0]) ? 3 : 2).join('/'); }
  read(dataPath = '') {
    const segments = tree.parts(dataPath);
    const anchor = this.anchor(segments);
    const fullDepth = NESTED.has(segments[0]) ? 3 : 2;
    if (segments.length >= fullDepth) {
      const row = this.db.prepare('SELECT document FROM documents WHERE path=?').get(anchor);
      return row ? tree.get(JSON.parse(row.document), segments.slice(fullDepth).join('/')) : null;
    }
    const rows = segments.length
      ? this.db.prepare('SELECT path,document FROM documents WHERE collection=?').all(segments[0])
      : this.db.prepare('SELECT path,document FROM documents').all();
    const result = {};
    for (const row of rows) tree.set(result, row.path, JSON.parse(row.document));
    return tree.get(result, segments.join('/'));
  }
  revision() { return this.db.prepare('SELECT revision FROM metadata WHERE id=1').get().revision; }
  upsert(anchor, value) {
    if (value === null) { this.db.prepare('DELETE FROM documents WHERE path=?').run(anchor); return; }
    const p = tree.parts(anchor);
    this.db.prepare(`INSERT INTO documents(path,collection,record_key,document) VALUES(?,?,?,?)
      ON CONFLICT(path) DO UPDATE SET document=excluded.document,revision=documents.revision+1`)
      .run(anchor, p[0], p.slice(1).join('/'), JSON.stringify(value));
  }
  write(dataPath, value, merge = false) {
    // Match the Firebase REST JSON serialization boundary (Dates, model objects, omitted undefined fields).
    value = tree.clone(value);
    tree.validate(value);
    const segments = tree.parts(dataPath);
    if (!segments.length) throw createApiError(400, 'INVALID_DATA_PATH', 'Root writes require the offline import tool.');
    return this.atomic(() => {
      const fullDepth = NESTED.has(segments[0]) ? 3 : 2;
      if (segments.length >= fullDepth) {
        const anchor = this.anchor(segments), tail = segments.slice(fullDepth).join('/');
        let document = this.read(anchor);
        const next = merge ? tree.patch(tail ? tree.get(document, tail) : document, value) : value;
        document = tail ? tree.set(document || {}, tail, next) : next;
        this.upsert(anchor, document);
      } else {
        let next = merge ? tree.patch(this.read(dataPath), value) : value;
        this.db.prepare('DELETE FROM documents WHERE collection=? AND (path=? OR substr(path,1,?)=?)')
          .run(segments[0], dataPath, dataPath.length + 1, `${dataPath}/`);
        if (next !== null) {
          const expanded = {}; tree.set(expanded, dataPath, next);
          const collection = expanded[segments[0]];
          if (!collection || typeof collection !== 'object' || Array.isArray(collection)) throw createApiError(400,'INVALID_COLLECTION','Collection must be an object.');
          for (const [key, child] of Object.entries(collection)) {
            if (NESTED.has(segments[0])) {
              for (const [id, doc] of Object.entries(child || {})) this.upsert(`${segments[0]}/${key}/${id}`, doc);
            } else this.upsert(`${segments[0]}/${key}`, child);
          }
        }
      }
      this.db.prepare('UPDATE metadata SET revision=revision+1 WHERE id=1').run();
      return tree.clone(value);
    });
  }
  async transact(dataPath, updater, { maxRetries = 8 } = {}) {
    for (let attempt=0; attempt<maxRetries; attempt++) {
      const before = this.revision(), existing = this.read(dataPath);
      const next = await updater(tree.clone(existing));
      if (next === undefined) return { committed:false, snapshot:existing };
      const result = this.atomic(() => {
        if (this.revision() !== before) return null;
        this.write(dataPath,next);
        return { committed:true, snapshot:tree.clone(next) };
      });
      if (result) return result;
    }
    throw createApiError(409,'DATABASE_CONTENTION','Concurrent database update; retry the operation.');
  }
  list(collection, { page=1, limit=50, search='', status='', workerId='', scope='' } = {}) {
    tree.parts(collection);
    const where=['collection=?'], values=[collection];
    if (search) { where.push('instr(lower(record_key),lower(?))>0'); values.push(search); }
    for (const [column,value] of [['status',status],['worker_id',workerId],['scope',scope]]) {
      if (value) { where.push(`${column}=?`); values.push(value); }
    }
    const clause=where.join(' AND ');
    const total=this.db.prepare(`SELECT count(*) AS n FROM documents WHERE ${clause}`).get(...values).n;
    const rows=this.db.prepare(`SELECT path,record_key,document,revision FROM documents WHERE ${clause} ORDER BY record_key LIMIT ? OFFSET ?`)
      .all(...values,limit,(page-1)*limit);
    return { page,limit,total,items:rows.map(row=>({ key:row.record_key, document:JSON.parse(row.document), revision:row.revision })) };
  }
  info() {
    return { provider:'sqlite', schemaVersion:SCHEMA, revision:this.revision(),
      sizeBytes:fs.statSync(this.filename).size,
      walBytes:fs.existsSync(`${this.filename}-wal`)?fs.statSync(`${this.filename}-wal`).size:0,
      lastBackupAt:this.db.prepare('SELECT last_backup_at FROM metadata WHERE id=1').get().last_backup_at,
      collections:this.db.prepare('SELECT collection,count(*) AS count FROM documents GROUP BY collection ORDER BY collection').all() };
  }
  backup(destination) {
    destination=path.resolve(destination);
    if (fs.existsSync(destination)) throw new Error('Backup destination already exists.');
    fs.mkdirSync(path.dirname(destination),{recursive:true});
    this.db.exec(`VACUUM INTO '${destination.replace(/'/g,"''")}'`);
    this.db.prepare('UPDATE metadata SET last_backup_at=? WHERE id=1').run(new Date().toISOString());
    return destination;
  }
  close() { this.db.close(); }
  push(dataPath,value) { const name=`local_${Date.now().toString(36)}_${crypto.randomUUID().replace(/-/g,'')}`; this.write(`${dataPath}/${name}`,value); return {name}; }
}
module.exports={SqliteStore};
