import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(process.cwd(), 'docket.sqlite'));

// Create tables if they don't exist
// You can extend these schemas as needed
// Users, Images, Containers, Actions

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  name TEXT,
  tag TEXT,
  author_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(author_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS containers (
  id TEXT PRIMARY KEY,
  image_id TEXT,
  author_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT,
  FOREIGN KEY(image_id) REFERENCES images(id),
  FOREIGN KEY(author_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  action TEXT,
  target_id TEXT,
  target_type TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
`;
db.exec(schema);

export default db;
