import pg from 'pg';
const { Pool } = pg;

// Create a connection pool with error handling
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return error after 10 seconds if connection could not be established
});

// Handle pool errors to prevent crashes
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle database client', err);
  // Don't exit process, just log the error
});

// Handle connection errors
pool.on('connect', (client) => {
  client.on('error', (err) => {
    console.error('Database client error', err);
  });
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

    // Create social_interests table
    await client.query(`
      CREATE TABLE IF NOT EXISTS social_interests (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create social_articles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS social_articles (
        id SERIAL PRIMARY KEY,
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
    await client.query('CREATE INDEX IF NOT EXISTS idx_social_articles_scraped_at ON social_articles(scraped_at)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_social_articles_interest_id ON social_articles(interest_id)');

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

// Social Interests CRUD operations
export async function getAllSocialInterests() {
  const { rows } = await pool.query('SELECT * FROM social_interests ORDER BY created_at ASC');
  return rows;
}

export async function getActiveSocialInterests() {
  const { rows } = await pool.query('SELECT * FROM social_interests WHERE is_active = true ORDER BY created_at ASC');
  return rows;
}

export async function addSocialInterest(name) {
  const { rows } = await pool.query(
    'INSERT INTO social_interests (name, is_active) VALUES ($1, true) RETURNING *',
    [name]
  );
  return rows[0];
}

export async function updateSocialInterest(id, name, isActive) {
  const { rows } = await pool.query(
    'UPDATE social_interests SET name = $1, is_active = $2 WHERE id = $3 RETURNING *',
    [name, isActive, id]
  );
  return rows[0];
}

export async function deleteSocialInterest(id) {
  const { rowCount } = await pool.query('DELETE FROM social_interests WHERE id = $1', [id]);
  return { deleted: rowCount };
}

// Social Articles CRUD operations
export async function saveSocialArticle(data) {
  const { interestId, sourceUrl, title, content, author, publishDate, scrapedAt } = data;
  const { rows } = await pool.query(
    'INSERT INTO social_articles (interest_id, source_url, title, content, author, publish_date, scraped_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
    [interestId, sourceUrl, title, content, author, publishDate, scrapedAt]
  );
  return { id: rows[0].id };
}

export async function checkSocialArticleExists(sourceUrl) {
  const { rows } = await pool.query(
    'SELECT id FROM social_articles WHERE source_url = $1',
    [sourceUrl]
  );
  return rows.length > 0;
}

export async function getSocialArticleDates() {
  const { rows } = await pool.query('SELECT DISTINCT scraped_at FROM social_articles ORDER BY scraped_at DESC');
  return rows.map(row => row.scraped_at);
}

export async function getSocialArticlesByDate(date) {
  const { rows } = await pool.query(
    `SELECT sa.*, si.name as interest_name
     FROM social_articles sa
     JOIN social_interests si ON sa.interest_id = si.id
     WHERE sa.scraped_at = $1
     ORDER BY sa.created_at DESC`,
    [date]
  );
  return rows;
}

export async function getSocialArticleById(id) {
  const { rows } = await pool.query(
    `SELECT sa.*, si.name as interest_name
     FROM social_articles sa
     JOIN social_interests si ON sa.interest_id = si.id
     WHERE sa.id = $1`,
    [id]
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function updateSocialArticleSummary(id, summary) {
  const { rows } = await pool.query(
    'UPDATE social_articles SET summary = $1 WHERE id = $2 RETURNING *',
    [summary, id]
  );
  return rows[0];
}

export async function deleteSocialArticle(id) {
  const { rowCount } = await pool.query('DELETE FROM social_articles WHERE id = $1', [id]);
  return { deleted: rowCount };
}
