// const Database = require('better-sqlite3');
// const path = require('path');

// const dbPath = path.join(__dirname, 'pong.db');
// const db = new Database(dbPath);
// db.exec(`PRAGMA foreign_keys = ON`);

// console.log('Seeding without deleting existing data...');

// // Users
// const insertUser = db.prepare(`
//   INSERT OR IGNORE INTO users (username, email, password_hash, xp_level, trophies)
//   VALUES (?, ?, ?, ?, ?)
// `);

// const users = [
//   ['marc', 'marc@example.com', 'hash1', 5, 150],
//   ['aya', 'aya@example.com', 'hash2', 3, 90],
//   ['karim', 'karim@example.com', 'hash3', 2, 60],
//   ['mhaisen', 'mhaisen@example.com', 'hash4', 4, 110],
//   ['jnde', 'jnde@example.com', 'hash5', 1, 40],
//   ['omar', 'omar@example.com', 'hash6', 2, 70],
// ];

// users.forEach(u => insertUser.run(...u));

// // Fetch user IDs
// const getUserId = db.prepare(`SELECT id FROM users WHERE username = ?`);
// const marc = getUserId.get('marc')?.id;
// const aya = getUserId.get('aya')?.id;
// const karim = getUserId.get('karim')?.id;
// const mhaisen = getUserId.get('mhaisen')?.id;
// const jnde = getUserId.get('jnde')?.id;
// const omar = getUserId.get('omar')?.id;

// if (!marc || !aya || !karim || !mhaisen || !jnde || !omar) {
//   console.error('One or more users not found. Aborting.');
//   process.exit(1);
// }

// // Tournaments
// const insertTournament = db.prepare(`
//   INSERT OR IGNORE INTO tournaments (name, created_by)
//   VALUES (?, ?)
// `);

// insertTournament.run('Marc Cup', marc);
// insertTournament.run('Omar Challenge', omar);

// // Matches
// const insertMatch = db.prepare(`
//   INSERT INTO matches (player1_id, player2_id, winner_id, score_p1, score_p2, played_at, tournament_id)
//   VALUES (?, ?, ?, ?, ?, ?, ?)
// `);

// const monthsAgo = (n: number): string => {
//   const d = new Date();
//   d.setMonth(d.getMonth() - n);
//   return d.toISOString();
// };

// try {
//   insertMatch.run(marc, aya, marc, 11, 7, monthsAgo(0), 3);
//   insertMatch.run(marc, karim, karim, 9, 11, monthsAgo(1), 3);
//   insertMatch.run(marc, jnde, marc, 7, 0, monthsAgo(2), null);
//   insertMatch.run(aya, karim, aya, 11, 9, monthsAgo(3), null);
//   insertMatch.run(marc, omar, marc, 11, 8, monthsAgo(4), 4);
//   insertMatch.run(omar, karim, omar, 11, 10, monthsAgo(5), 4);
//   insertMatch.run(jnde, marc, marc, 11, 2, monthsAgo(6), null);
//   insertMatch.run(karim, marc, marc, 11, 3, monthsAgo(7), 5);
//   insertMatch.run(aya, jnde, aya, 11, 6, monthsAgo(8), null);
//   insertMatch.run(aya, omar, omar, 8, 11, monthsAgo(9), 4);
//   insertMatch.run(mhaisen, omar, omar, 9, 11, monthsAgo(10), null);
//   insertMatch.run(marc, karim, marc, 11, 9, monthsAgo(11), 4);
//   insertMatch.run(marc, aya, aya, 10, 12, monthsAgo(0), null);
//   insertMatch.run(jnde, marc, marc, 11, 5, monthsAgo(0), null);
//   insertMatch.run(mhaisen, marc, marc, 11, 4, monthsAgo(0), null);
// } catch (err) {
//   console.warn('  Some matches may already exist or violate constraints.');
// }

// // Friends
// const insertFriend = db.prepare(`
//   INSERT OR IGNORE INTO friends (sender_id, receiver_id, status)
//   VALUES (?, ?, ?)
// `);

// insertFriend.run(marc, aya, 'accepted');
// insertFriend.run(karim, marc, 'accepted');
// insertFriend.run(omar, jnde, 'pending');

// console.log(' Dummy data added (non-destructive).');

import db from './utils/db';

// const player1Id = 39;
// const player2Id = 38;

// const insertMatch = db.prepare(`
//   INSERT INTO matches (player1_id, player2_id, winner_id, score_p1, score_p2, played_at)
//   VALUES (?, ?, ?, ?, ?, ?)
// `);

// for (let i = 0; i < 10; i++) {
//   const score_p1 = Math.floor(Math.random() * 10);
//   const score_p2 = Math.floor(Math.random() * 10);
//   const winner_id = score_p1 === score_p2 ? null : (score_p1 > score_p2 ? player1Id : player2Id);

//   insertMatch.run(player1Id, player2Id, winner_id, score_p1, score_p2, new Date().toISOString());
// }

// console.log("✅ 10 dummy matches inserted.");


const senderId = 39;
const receiverId = 38;

// Check if they're already friends
const existing = db.prepare(`
  SELECT * FROM friends
  WHERE (sender_id = ? AND receiver_id = ?)
     OR (sender_id = ? AND receiver_id = ?)
`).get(senderId, receiverId, receiverId, senderId);

if (!existing) {
  db.prepare(`
    INSERT INTO friends (sender_id, receiver_id, status)
    VALUES (?, ?, 'accepted')
  `).run(senderId, receiverId);

  console.log(`✅ Friend entry inserted between users ${senderId} and ${receiverId}`);
} else {
  console.log(`⚠️  Users ${senderId} and ${receiverId} are already friends or pending`);
}