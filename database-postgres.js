import pg from 'pg';
const { Pool } = pg;

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Initialize database schema
export async function initDatabase() {
  const client = await pool.connect();
  try {
    // Create topics table
    await client.query(`
      CREATE TABLE IF NOT EXISTS topics (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create articles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id SERIAL PRIMARY KEY,
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

    for (const topic of defaultTopics) {
      await client.query(
        'INSERT INTO topics (name, is_active) VALUES ($1, true) ON CONFLICT (name) DO NOTHING',
        [topic]
      );
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Topic CRUD operations
export async function getAllTopics() {
  const { rows } = await pool.query('SELECT * FROM topics ORDER BY created_at ASC');
  return rows;
}

export async function getActiveTopics() {
  const { rows } = await pool.query('SELECT * FROM topics WHERE is_active = true ORDER BY created_at ASC');
  return rows;
}

export async function addTopic(name) {
  const { rows } = await pool.query(
    'INSERT INTO topics (name, is_active) VALUES ($1, true) RETURNING *',
    [name]
  );
  return rows[0];
}

export async function updateTopic(id, name, isActive) {
  const { rows } = await pool.query(
    'UPDATE topics SET name = $1, is_active = $2 WHERE id = $3 RETURNING *',
    [name, isActive, id]
  );
  return rows[0];
}

export async function deleteTopic(id) {
  const { rowCount } = await pool.query('DELETE FROM topics WHERE id = $1', [id]);
  return { deleted: rowCount };
}

// Article CRUD operations
export async function saveArticle(date, topicId, language, headline, content, sources, voiceFilePath) {
  const { rows } = await pool.query(
    'INSERT INTO articles (date, topic_id, language, headline, content, sources, voice_file_path) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
    [date, topicId, language, headline, content, JSON.stringify(sources), voiceFilePath]
  );
  return { id: rows[0].id };
}

export async function checkArticleExists(date, topicId, language) {
  const { rows } = await pool.query(
    'SELECT id FROM articles WHERE date = $1 AND topic_id = $2 AND language = $3',
    [date, topicId, language]
  );
  return rows.length > 0;
}

export async function getAllDates() {
  const { rows } = await pool.query('SELECT DISTINCT date FROM articles ORDER BY date DESC');
  return rows.map(row => row.date);
}

export async function getArticlesByDate(date) {
  const { rows } = await pool.query(
    `SELECT a.*, t.name as topic_name
     FROM articles a
     JOIN topics t ON a.topic_id = t.id
     WHERE a.date = $1
     ORDER BY a.created_at ASC`,
    [date]
  );

  return rows.map(row => ({
    ...row,
    sources: JSON.parse(row.sources),
    is_active: row.is_active ? 1 : 0  // Convert boolean to number for compatibility
  }));
}

export async function getArticleById(id) {
  const { rows } = await pool.query(
    `SELECT a.*, t.name as topic_name
     FROM articles a
     JOIN topics t ON a.topic_id = t.id
     WHERE a.id = $1`,
    [id]
  );

  if (rows.length === 0) {
    return null;
  }

  return {
    ...rows[0],
    sources: JSON.parse(rows[0].sources)
  };
}

export async function updateArticleAudioUrl(id, audioUrl) {
  const { rows } = await pool.query(
    'UPDATE articles SET voice_file_path = $1 WHERE id = $2 RETURNING *',
    [audioUrl, id]
  );
  return rows[0];
}
