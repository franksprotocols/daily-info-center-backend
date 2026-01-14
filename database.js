import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new sqlite3.Database(join(__dirname, 'database.sqlite'));

// Initialize database schema
export function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create topics table
      db.run(`
        CREATE TABLE IF NOT EXISTS topics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          is_active BOOLEAN DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create articles table
      db.run(`
        CREATE TABLE IF NOT EXISTS articles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date DATE NOT NULL,
          topic_id INTEGER NOT NULL,
          language TEXT NOT NULL DEFAULT 'en',
          headline TEXT NOT NULL,
          content TEXT NOT NULL,
          sources TEXT,
          voice_file_path TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
          UNIQUE(date, topic_id, language)
        )
      `);

      // Insert default topics if they don't exist
      const defaultTopics = ['Politics', 'Macro Economy Data', 'AI', 'EV', 'Stock Market'];
      const stmt = db.prepare('INSERT OR IGNORE INTO topics (name, is_active) VALUES (?, 1)');

      defaultTopics.forEach(topic => {
        stmt.run(topic);
      });

      stmt.finalize((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

// Topic CRUD operations
export function getAllTopics() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM topics ORDER BY created_at ASC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export function getActiveTopics() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM topics WHERE is_active = 1 ORDER BY created_at ASC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export function addTopic(name) {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO topics (name, is_active) VALUES (?, 1)', [name], function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, name, is_active: 1 });
    });
  });
}

export function updateTopic(id, name, isActive) {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE topics SET name = ?, is_active = ? WHERE id = ?',
      [name, isActive, id],
      function(err) {
        if (err) reject(err);
        else resolve({ id, name, is_active: isActive });
      }
    );
  });
}

export function deleteTopic(id) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM topics WHERE id = ?', [id], function(err) {
      if (err) reject(err);
      else resolve({ deleted: this.changes });
    });
  });
}

// Article CRUD operations
export function saveArticle(date, topicId, language, headline, content, sources, voiceFilePath) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO articles (date, topic_id, language, headline, content, sources, voice_file_path) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [date, topicId, language, headline, content, JSON.stringify(sources), voiceFilePath],
      function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      }
    );
  });
}

export function checkArticleExists(date, topicId, language) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT id FROM articles WHERE date = ? AND topic_id = ? AND language = ?',
      [date, topicId, language],
      (err, row) => {
        if (err) reject(err);
        else resolve(!!row);
      }
    );
  });
}

export function getAllDates() {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT DISTINCT date FROM articles ORDER BY date DESC',
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => row.date));
      }
    );
  });
}

export function getArticlesByDate(date) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT a.*, t.name as topic_name
       FROM articles a
       JOIN topics t ON a.topic_id = t.id
       WHERE a.date = ?
       ORDER BY a.created_at ASC`,
      [date],
      (err, rows) => {
        if (err) reject(err);
        else {
          const articles = rows.map(row => ({
            ...row,
            sources: JSON.parse(row.sources)
          }));
          resolve(articles);
        }
      }
    );
  });
}

export function getArticleById(id) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT a.*, t.name as topic_name
       FROM articles a
       JOIN topics t ON a.topic_id = t.id
       WHERE a.id = ?`,
      [id],
      (err, row) => {
        if (err) reject(err);
        else if (!row) resolve(null);
        else {
          resolve({
            ...row,
            sources: JSON.parse(row.sources)
          });
        }
      }
    );
  });
}

export default db;
