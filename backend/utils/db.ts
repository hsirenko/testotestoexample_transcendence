//backend/utils/db.ts
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'pong.db');
const db = new Database(dbPath);


// USERS
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT,
  google_id TEXT,
  avatar_url TEXT,
  twofa_secret TEXT,
  twofa_enabled INTEGER DEFAULT 0,
  xp_level INTEGER DEFAULT 0,
  trophies INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);


// TOURNAMENTS
db.exec(`
CREATE TABLE IF NOT EXISTS tournaments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  code        TEXT UNIQUE NOT NULL,
  created_by  INTEGER,
  status      TEXT CHECK (status IN ('lobby','running','finished'))
                 DEFAULT 'lobby',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  winner_id   INTEGER,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (winner_id)  REFERENCES users(id)
);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS tournament_players (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id  INTEGER NOT NULL,
  user_id        INTEGER NOT NULL,
  joined_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tournament_id, user_id),
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id),
  FOREIGN KEY (user_id)       REFERENCES users(id)
);
`);

// MATCHES
db.exec(`
CREATE TABLE IF NOT EXISTS matches (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id  INTEGER,
  game_id        TEXT UNIQUE,
  player1_id     INTEGER NOT NULL,
  player2_id     INTEGER NOT NULL,
  winner_id      INTEGER,
  score_p1       INTEGER,
  score_p2       INTEGER,
  played_at      DATETIME,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id),
  FOREIGN KEY (player1_id)    REFERENCES users(id),
  FOREIGN KEY (player2_id)    REFERENCES users(id),
  FOREIGN KEY (winner_id)     REFERENCES users(id)
);
`);

// FRIENDS
db.exec(`
CREATE TABLE IF NOT EXISTS friends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL,
  receiver_id INTEGER NOT NULL,
  status TEXT CHECK(status IN ('pending', 'accepted', 'blocked')) NOT NULL DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id),
  FOREIGN KEY (receiver_id) REFERENCES users(id)
);
`);


db.exec(`
CREATE TABLE IF NOT EXISTS challenges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  challenger_id INTEGER NOT NULL,
  challenged_id INTEGER NOT NULL,
  status TEXT CHECK(status IN ('pending', 'accepted', 'rejected', 'cancelled')) NOT NULL DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  responded_at DATETIME,
  FOREIGN KEY (challenger_id) REFERENCES users(id),
  FOREIGN KEY (challenged_id) REFERENCES users(id)
);
`);

db.exec(`
	CREATE TABLE IF NOT EXISTS notifications (
	id           INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id      INTEGER NOT NULL,
	type         TEXT NOT NULL,
	reference_id INTEGER,
	text         TEXT NOT NULL,
	is_read      INTEGER DEFAULT 0,
	created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY(user_id) REFERENCES users(id)
	);
`);

/* ───────────── Password-reset codes ───────────── */
/* ───────────── Password-reset codes ───────────── */
db.exec(`
CREATE TABLE IF NOT EXISTS password_resets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER  NOT NULL,
  code_hash  TEXT     NOT NULL,
  expires_at INTEGER  NOT NULL,        -- seconds since epoch
  used       INTEGER  NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
`);



export default db;
