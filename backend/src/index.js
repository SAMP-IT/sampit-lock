import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';

// Import routes
import authRoutes from './routes/authRoutes.js';
import lockRoutes from './routes/lockRoutes.js';
import lockSettingsRoutes from './routes/lockSettingsRoutes.js';
import userManagementRoutes from './routes/userManagementRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import guestAccessRoutes from './routes/guestAccessRoutes.js';
import accessCodeRoutes from './routes/accessCodeRoutes.js';
import fingerprintRoutes from './routes/fingerprintRoutes.js';
import icCardRoutes from './routes/icCardRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import emergencyRoutes from './routes/emergencyRoutes.js';
import ttlockRoutes from './routes/ttlockRoutes.js';
import ttlockV3Routes from './routes/ttlockV3Routes.js';
import accessMethodRoutes from './routes/accessMethodRoutes.js';
import pushNotificationRoutes from './routes/pushNotificationRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import securityRoutes from './routes/securityRoutes.js';
import ekeyRoutes from './routes/ekeyRoutes.js';
import passcodeRoutes from './routes/passcodeRoutes.js';

// Import middleware
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// Import WebSocket setup
import { setupWebSocket } from './services/websocket.js';

// Import AI worker
import { initWorker } from './workers/aiProcessor.js';
import supabase from './services/supabase.js';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'TTLOCK_ENCRYPTION_KEY',
  'PORT'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars.join(', '));
  process.exit(1);
}

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server
const httpServer = createServer(app);

// Security middleware
app.use(helmet());

// CORS configuration
const parseOrigins = (value) =>
  value
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

const rawOrigins = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '';
const allowedOrigins = parseOrigins(rawOrigins);

if (allowedOrigins.length === 0) {
  console.warn(
    'No explicit CORS origins configured. Defaulting to local development origins. Set CORS_ORIGIN to a comma-separated list for production.'
  );
  allowedOrigins.push('http://localhost:3000', 'http://localhost:19006');
}

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`Blocked CORS request from origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware (simple)
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`🔹 Incoming: ${req.method} ${req.url} | Full path: ${req.path} | Headers: ${req.headers.authorization ? 'Has Auth' : 'No Auth'}`);
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Root endpoint (Render health check default path)
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Awakey Smart Lock API is running',
    version: '1.0.0'
  });
});

// Root API endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to the Awakey Smart Lock API',
    version: '1.0.0',
    documentation: '/api-docs' // TODO: Add link to documentation
  });
});

// Health check endpoint with comprehensive system status
app.get('/health', async (req, res) => {
  const healthStatus = {
    success: true,
    status: 'healthy',
    message: 'Awakey Smart Lock API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: 'MB'
    },
    services: {
      database: 'unknown',
      ttlock_crypto: !!process.env.TTLOCK_ENCRYPTION_KEY,
      openai: !!process.env.OPENAI_API_KEY,
      supabase: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
    },
    ai_features: {
      background_worker: 'running',
      natural_language_logs: !!process.env.OPENAI_API_KEY,
      chat_assistant: !!process.env.OPENAI_API_KEY,
      smart_insights: true,
      risk_scores: true,
      predictive_battery: true,
      fraud_detection: true,
      auto_rules: true,
      smart_scheduling: true
    }
  };

  // Test database connection
  try {
    const { data, error } = await supabase.from('locks').select('id').limit(1);
    if (error) throw error;
    healthStatus.services.database = 'connected';
  } catch (error) {
    healthStatus.services.database = 'error';
    healthStatus.status = 'degraded';
    healthStatus.success = false;
  }

  const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(healthStatus);
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/locks', lockRoutes);
app.use('/api/locks', lockSettingsRoutes);
app.use('/api/locks', userManagementRoutes);
app.use('/api/locks', activityRoutes);
app.use('/api/activity', activityRoutes);  // Also mount at /api/activity for recent endpoint
app.use('/api/locks', guestAccessRoutes);
app.use('/api/locks', accessCodeRoutes);
app.use('/api/locks', fingerprintRoutes);  // Fingerprint management
app.use('/api/locks', icCardRoutes);  // IC Card management
app.use('/api/notifications', notificationRoutes);
app.use('/api', emergencyRoutes);
app.use('/api/ttlock', ttlockRoutes);
app.use('/api/ttlock-v3', ttlockV3Routes);
app.use('/api', accessMethodRoutes);  // Fingerprints & IC Cards
app.use('/api/push', pushNotificationRoutes);  // Push notifications
app.use('/api/webhook', webhookRoutes);  // TTLock webhooks (public endpoint)
app.use('/api/ai', aiRoutes);  // AI features (NL logs, chat, insights, risk)
app.use('/api/security', securityRoutes);  // Security dashboard
app.use('/api/activity', securityRoutes);  // Activity insights (also mounted here)
app.use('/api', ekeyRoutes);  // eKey management (uses stored TTLock tokens)
app.use('/api', passcodeRoutes);  // Local passcode management

// 404 handler
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Setup WebSocket
setupWebSocket(httpServer);

// Initialize AI background worker
initWorker(supabase);

// Start server
httpServer.listen(PORT, () => {
  console.log('==============================================');
  console.log('🚀 Awakey Smart Lock API Server');
  console.log('==============================================');
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API URL: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
  console.log('==============================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

export default app;
