import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import path from 'path';
import { SocketService } from './services/socket.service.js';

// Import routes
import authRoutes from './routes/auth.js'; 
import packagesRoutes from './routes/packages.js';
import cartRoutes from './routes/cart.js';
import checkoutRoutes from './routes/checkout.js';
import BillingRoutes from './routes/billing.js';
import webhookRoutes from './routes/webhook.js';
import settingsRoutes from './routes/settings.js';
import dashboardRoutes from './routes/dashboard.js';
import accountRoutes from './routes/account.js';
import workspaceRoutes from './routes/workspace.js';
import HistoryRoutes from './routes/history.js';
import adminInvoiceRoutes from './routes/admin.invoice.js';
import chatRoutes from './routes/chat.js';
import paymentRoutes from './routes/payment.js';
import datasetRoutes from './routes/datasets.js';
import adminDashboardRoutes from './routes/admin.dashboard.js';
import notificationRoutes from './routes/notifications.js';
import reportsRoutes from './routes/reports.js';

import { startInactivityJob } from './jobs/inactivity.job.js';

const app = express();

const PORT = Number(process.env.PORT) || 5000;
const HOST = '0.0.0.0'; 

// 1. Create the HTTP server instance
const httpServer = createServer(app);

// 2. Initialize SocketService
SocketService.init(httpServer);

// 3. CORS Configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://slipzmarket.onrender.com', // Your primary production URL
  'https://slipz-market-1.onrender.com',
  'https://slipz-market-2.onrender.com'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, webhooks, or server-to-server) 
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Increase JSON limit slightly to prevent payload-too-large crashes
app.use(express.json({ limit: '10mb' }));

// 4. API Routes (Must be declared BEFORE the static frontend files)
app.use('/api/webhooks', webhookRoutes); 
app.use('/api/auth', authRoutes);
app.use('/api/packages', packagesRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/billing', BillingRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/workspace', workspaceRoutes);
app.use('/api/history', HistoryRoutes);
app.use('/api/admin-invoice', adminInvoiceRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/datasets', datasetRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportsRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'API is running smoothly' });
});

// 5. SERVE THE REACT FRONTEND (Render Monorepo Fix)
// Notice we use __dirname directly here! It is native to CommonJS.
const clientBuildPath = path.join(__dirname, '../client/dist'); 
app.use(express.static(clientBuildPath));

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// 6. Start Background Jobs
startInactivityJob();

// --- DEFENSIVE LAYER ---

// Global Express Error Handler
app.use((err, req, res, next) => {
  console.error('Express Error:', err.message);
  
  // Handle CORS errors gracefully without crashing
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS policy violation' });
  }

  res.status(500).json({ error: 'Internal Server Error' });
});

// Catch unhandled async promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Catch synchronous exceptions outside of Express
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

// 7. Listen explicitly on 0.0.0.0
httpServer.listen(PORT, HOST, () => {
  console.log(`🚀 SlipZMarket API & Socket Server safely running on http://${HOST}:${PORT}`);
});