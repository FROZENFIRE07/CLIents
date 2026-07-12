require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

// Route imports
const authRoutes = require('./routes/auth.routes');
const classRoutes = require('./routes/class.routes');
const studentRoutes = require('./routes/student.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const examRoutes = require('./routes/exam.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const notificationRoutes = require('./routes/notification.routes');
const versionRoutes = require('./routes/version.routes');
const whatsappRoutes = require('./routes/whatsapp.routes');
const workerRoutes = require('./routes/worker.routes');
const syncRoutes = require('./routes/sync.routes');

const app = express();

// ---------- Middleware ----------
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
app.use('/api', apiLimiter);

// ---------- Health endpoint (public, wakes backend on free tier) ----------
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'CMS-Lite API is running',
    timestamp: new Date().toISOString(),
  });
});

// ---------- API Routes ----------
app.use('/api/auth', authRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/version', versionRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/worker', workerRoutes);
app.use('/api/sync', syncRoutes);

// ---------- 404 Handler ----------
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// ---------- Global Error Handler ----------
app.use(errorHandler);

// ---------- Start Server ----------
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`[SERVER] CMS-Lite running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
    console.log('[SERVER] Pure API server — WhatsApp worker runs inside CMS Lite Desktop.');
  });
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[SERVER] Shutting down...');
  process.exit(0);
});

// Run server only if executed directly (e.g. `node app.js`)
// If imported (e.g. by Vercel Serverless Functions), just export it.
if (require.main === module) {
  startServer().catch((err) => {
    console.error('[SERVER] Failed to start:', err.message);
    process.exit(1);
  });
} else {
  // Connect to DB for serverless environment when module is imported
  connectDB().catch(console.error);
}

module.exports = app;
