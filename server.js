import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import axios from 'axios';
import { initDatabase } from './database-selector.js';
import topicsRouter from './routes/topics.js';
import articlesRouter from './routes/articles.js';
import generateRouter from './routes/generate.js';
import socialRouter from './routes/social.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/topics', topicsRouter);
app.use('/api/articles', articlesRouter);
app.use('/api/generate', generateRouter);
app.use('/api/social', socialRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Daily Info Center API is running' });
});

// Debug endpoint to check environment variables
app.get('/api/debug/env', (req, res) => {
  res.json({
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    hasGoogleSearchKey: !!process.env.GOOGLE_SEARCH_API_KEY,
    hasGoogleSearchEngineId: !!process.env.GOOGLE_SEARCH_ENGINE_ID,
    hasPostgresUrl: !!process.env.POSTGRES_URL,
    hasElevenLabsKey: !!process.env.ELEVENLABS_API_KEY,
    nodeEnv: process.env.NODE_ENV,
    anthropicKeyPrefix: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.substring(0, 10) + '...' : 'missing',
    elevenLabsKeyPrefix: process.env.ELEVENLABS_API_KEY ? process.env.ELEVENLABS_API_KEY.substring(0, 10) + '...' : 'missing'
  });
});

// Initialize database
initDatabase()
  .then(() => {
    console.log('Database initialized successfully');

    // Start server only in local development (not in Vercel)
    if (!process.env.VERCEL) {
      app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
        console.log(`API health check: http://localhost:${PORT}/api/health`);

        // Schedule daily article generation at 8:00 UTC
        cron.schedule('0 8 * * *', async () => {
          console.log('\n=== Starting scheduled article generation at 8:00 UTC ===');
          try {
            const response = await axios.post(`http://localhost:${PORT}/api/generate`);
            console.log('Scheduled generation completed:', response.data);
          } catch (error) {
            console.error('Scheduled generation failed:', error.message);
          }
        }, {
          timezone: 'UTC'
        });

        console.log('Scheduled daily article generation at 8:00 UTC');
      });
    }
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    if (!process.env.VERCEL) {
      process.exit(1);
    }
  });

// Export for Vercel
export default app;
