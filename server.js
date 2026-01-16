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
let server = null; // Store server instance for graceful shutdown

// Global error handlers to prevent crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit process, just log the error
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Log but don't exit immediately - allow cleanup
  setTimeout(() => {
    console.error('Exiting due to uncaught exception');
    process.exit(1);
  }, 1000);
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request timeout middleware (60 seconds)
app.use((req, res, next) => {
  req.setTimeout(60000, () => {
    console.error('Request timeout:', req.method, req.url);
    res.status(408).json({ error: 'Request timeout' });
  });
  next();
});

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

// Global error handler - must be after all routes
app.use((err, req, res, next) => {
  console.error('Global error handler caught:', err);

  // Don't expose internal error details in production
  const isDev = process.env.NODE_ENV === 'development';

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(isDev && { stack: err.stack })
  });
});

// Initialize database
initDatabase()
  .then(() => {
    console.log('Database initialized successfully');

    // Start server only in local development (not in Vercel)
    if (!process.env.VERCEL) {
      server = app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
        console.log(`API health check: http://localhost:${PORT}/api/health`);

        // Schedule daily article generation at 8:00 UTC
        cron.schedule('0 8 * * *', async () => {
          console.log('\n=== Starting scheduled article generation at 8:00 UTC ===');
          try {
            // Use Railway URL if available, otherwise localhost
            const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN
              ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
              : `http://localhost:${PORT}`;

            const response = await axios.post(`${baseUrl}/api/generate`, {}, {
              timeout: 300000 // 5 minute timeout for generation
            });
            console.log('Scheduled generation completed:', response.data);
          } catch (error) {
            console.error('Scheduled generation failed:', error.message);
            // Don't crash the server if scheduled job fails
          }
        }, {
          timezone: 'UTC'
        });

        console.log('Scheduled daily article generation at 8:00 UTC');

        // Log memory usage every hour to detect potential leaks
        setInterval(() => {
          const used = process.memoryUsage();
          console.log('Memory usage:', {
            rss: `${Math.round(used.rss / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`,
            external: `${Math.round(used.external / 1024 / 1024)}MB`
          });
        }, 3600000); // Every hour
      });
    }
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    if (!process.env.VERCEL) {
      process.exit(1);
    }
  });

// Graceful shutdown handler
async function gracefulShutdown(signal) {
  console.log(`\n${signal} received, starting graceful shutdown...`);

  // Close server connections
  if (server) {
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }

  // Force shutdown after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    console.log('Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Export for Vercel
export default app;
