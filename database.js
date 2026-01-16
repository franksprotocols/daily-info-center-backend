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

      // Create social_interests table
      db.run(`
        CREATE TABLE IF NOT EXISTS social_interests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          is_active BOOLEAN DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create social_articles table
      db.run(`
        CREATE TABLE IF NOT EXISTS social_articles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          interest_id INTEGER NOT NULL,
          source_url TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          summary TEXT,
          author TEXT,
          publish_date DATE,
          scraped_at DATE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (interest_id) REFERENCES social_interests(id) ON DELETE CASCADE
        )
      `);

      // Create indexes for social_articles
      db.run('CREATE INDEX IF NOT EXISTS idx_social_articles_scraped_at ON social_articles(scraped_at)');
      db.run('CREATE INDEX IF NOT EXISTS idx_social_articles_interest_id ON social_articles(interest_id)');

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

export function deleteArticlesByDate(date) {
  return new Promise((resolve, reject) => {
    db.run(
      'DELETE FROM articles WHERE date = ?',
      [date],
      function(err) {
        if (err) reject(err);
        else resolve({ deleted: this.changes });
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

export function updateArticleAudioUrl(id, audioUrl) {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE articles SET voice_file_path = ? WHERE id = ?',
      [audioUrl, id],
      function(err) {
        if (err) reject(err);
        else resolve({ id, audioUrl, changes: this.changes });
      }
    );
  });
}

// Social Interests CRUD operations
export function getAllSocialInterests() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM social_interests ORDER BY created_at ASC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export function getActiveSocialInterests() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM social_interests WHERE is_active = 1 ORDER BY created_at ASC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export function addSocialInterest(name) {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO social_interests (name, is_active) VALUES (?, 1)', [name], function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, name, is_active: 1 });
    });
  });
}

export function updateSocialInterest(id, name, isActive) {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE social_interests SET name = ?, is_active = ? WHERE id = ?',
      [name, isActive, id],
      function(err) {
        if (err) reject(err);
        else resolve({ id, name, is_active: isActive });
      }
    );
  });
}

export function deleteSocialInterest(id) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM social_interests WHERE id = ?', [id], function(err) {
      if (err) reject(err);
      else resolve({ deleted: this.changes });
    });
  });
}

// Social Articles CRUD operations
export function saveSocialArticle(data) {
  const { interestId, sourceUrl, title, content, author, publishDate, scrapedAt } = data;
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO social_articles (interest_id, source_url, title, content, author, publish_date, scraped_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [interestId, sourceUrl, title, content, author, publishDate, scrapedAt],
      function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      }
    );
  });
}

export function checkSocialArticleExists(sourceUrl) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT id FROM social_articles WHERE source_url = ?',
      [sourceUrl],
      (err, row) => {
        if (err) reject(err);
        else resolve(!!row);
      }
    );
  });
}

export function getSocialArticleDates() {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT DISTINCT scraped_at FROM social_articles ORDER BY scraped_at DESC',
      (err, rows) => {
        if (err) reject(err);
        else {
          // Ensure dates are returned as YYYY-MM-DD strings
          const dates = rows.map(row => {
            const date = row.scraped_at;
            // If it's already a string in correct format, return as-is
            if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
              return date;
            }
            // Otherwise convert to proper format
            return new Date(date).toISOString().split('T')[0];
          });
          resolve(dates);
        }
      }
    );
  });
}

export function getSocialArticlesByDate(date) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT sa.*, si.name as interest_name
       FROM social_articles sa
       JOIN social_interests si ON sa.interest_id = si.id
       WHERE sa.scraped_at = ?
       ORDER BY sa.created_at DESC`,
      [date],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

export function getSocialArticleById(id) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT sa.*, si.name as interest_name
       FROM social_articles sa
       JOIN social_interests si ON sa.interest_id = si.id
       WHERE sa.id = ?`,
      [id],
      (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      }
    );
  });
}

export function updateSocialArticleSummary(id, summary) {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE social_articles SET summary = ? WHERE id = ?',
      [summary, id],
      function(err) {
        if (err) reject(err);
        else resolve({ id, summary, changes: this.changes });
      }
    );
  });
}

export function deleteSocialArticle(id) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM social_articles WHERE id = ?', [id], function(err) {
      if (err) reject(err);
      else resolve({ deleted: this.changes });
    });
  });
}

export default db;
