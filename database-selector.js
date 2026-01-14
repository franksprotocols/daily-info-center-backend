// Automatically select the right database based on environment
const isVercel = process.env.VERCEL === '1' || process.env.POSTGRES_URL;

let database;

if (isVercel) {
  console.log('Using Vercel Postgres database');
  database = await import('./database-postgres.js');
} else {
  console.log('Using SQLite database (local development)');
  database = await import('./database.js');
}

export const {
  initDatabase,
  getAllTopics,
  getActiveTopics,
  addTopic,
  updateTopic,
  deleteTopic,
  saveArticle,
  checkArticleExists,
  getAllDates,
  getArticlesByDate,
  getArticleById
} = database;
