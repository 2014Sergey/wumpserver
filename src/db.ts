import {PromisedDatabase} from 'promised-sqlite3';
import squel from 'squel';

const CTINE_HUNTERS = `
CREATE TABLE IF NOT EXISTS hunters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  login TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
)`;
const CTINE_DUNGEONS = `
CREATE TABLE IF NOT EXISTS dungeons (
  uuid CHAR(38) NOT NULL UNIQUE,
  login TEXT NOT NULL UNIQUE,
  PRIMARY KEY (uuid, login)
)`;
const CTINE_SESSIONS = `
CREATE TABLE IF NOT EXISTS sessions (
  login TEXT PRIMARY KEY,
  uuid CHAR(38) NOT NULL UNIQUE
)`;

const db = new PromisedDatabase();
async function initDB() {
  await db.open('wump.db');
  await db.exec(CTINE_HUNTERS);
  await db.exec(CTINE_DUNGEONS);
  await db.exec(CTINE_SESSIONS);
  await db.exec(`DELETE FROM sessions`);
  await db.exec(`DELETE FROM dungeons`);
  console.log("DB initialised");
}
await initDB();

export async function getHunters(uuid: string | undefined): Promise<any[]> {
  let q = squel.select().field('login').from('hunters');
  if (uuid !== undefined) {
    const logins = squel.select()
      .field('login')
      .from('dungeons')
      .where('uuid = ?', uuid);
    q = q.where('login IN ?', logins);
  }
  return (await db.all(q.toString()));
}

export async function getDungeon(login: string | undefined): Promise<any[]> {
  let q = squel.select().field('uuid').from('dungeons');
  if (login !== undefined)
    q = q.where('login = ?', login);
  return await db.all(q.toString());
}

export async function regSession(login: string, uuid: string): Promise<void> {
  await db.run(
    squel.insert()
    .into('sessions')
    .set('uuid', uuid)
    .set('login', login)
    .toString()
  );
}

export async function getLoginFromSession(uuid: string): Promise<any> {
  return await db.get("SELECT login FROM sessions WHERE uuid=?", uuid);
}

export async function get(query: string): Promise<any> {
  return await db.get(query);
}

export async function delSession(uuidOrLogin: string): Promise<void> {
  await db.run(
    squel.delete()
    .from('sessions')
    .where('uuid=? OR login=?', uuidOrLogin, uuidOrLogin)
    .toString()
  );
}

export async function insertHunter(login: string, password: string): Promise<boolean> {
  if (await isUserExists(login))
    return false;
  await db.run(
    squel.insert()
    .into('hunters')
    .set('login', login)
    .set('password', password)
    .toString()
  );
  return true;
}

export async function isUserExists(login: string): Promise<boolean> {
  return await db.get(
    squel.select()
    .from('hunters')
    .where('login = ?', login)
    .toString()
  );
}
export async function isPasswordValid(login: string, password: string): Promise<boolean> {
  return await db.get(
    squel.select()
    .from('hunters')
    .where('login = ?', login)
    .where('password = ?', password)
    .toString()
  );
}

export * as DBFuncs from './db';