const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { RailwayClient } = require('./src/query-railway');
const { DashboardGenerator } = require('./src/generate-html');
const { testIndividualQueries } = require('./src/debug-queries');
const { debugAdvanced } = require('./src/debug-advanced');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline styles for the dashboard
}));
app.use(cors());
app.use(express.json());

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      error: 'Access token required',
      message: 'Please provide a Bearer token in the Authorization header'
    });
  }

  const expectedToken = process.env.TERMINUS_AUTH_TOKEN;
  if (!expectedToken) {
    console.error('❌ TERMINUS_AUTH_TOKEN environment variable is not set');
    return res.status(500).json({ 
      error: 'Server configuration error',
      message: 'Authentication token not configured on server'
    });
  }

  if (token !== expectedToken) {
    return res.status(403).json({ 
      error: 'Invalid token',
      message: 'The provided authentication token is invalid'
    });
  }

  next();
}

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'railway-terminus'
  });
});

// Main dashboard endpoint
app.get('/', authenticateToken, async (req, res) => {
  try {
    // Extract parameters from headers
    const environmentId = req.headers['x-environment-id'] || process.env.RAILWAY_ENVIRONMENT_ID;
    const lookbackHours = parseInt(req.headers['x-lookback-hours']) || 24;
    const projectId = req.headers['x-project-id'];
    const serviceId = req.headers['x-service-id'];

    console.log(`📊 Dashboard request - Environment: ${environmentId}, Lookback: ${lookbackHours}h`);

    // Validate Railway token
    const railwayToken = process.env.RAILWAY_TOKEN;
    if (!railwayToken) {
      return res.status(500).json({
        error: 'Railway configuration error',
        message: 'RAILWAY_TOKEN environment variable is not set'
      });
    }

    // Fetch data from Railway
    const client = new RailwayClient(railwayToken);
    const dashboardData = await client.fetchDashboardData(environmentId, lookbackHours);

    // Generate HTML
    const generator = new DashboardGenerator();
    generator.loadData(dashboardData);
    const html = generator.generateHTML();

    // Set appropriate headers
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.status(200).send(html);

  } catch (error) {
    console.error('❌ Error generating dashboard:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Debug endpoint
app.get('/debug', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 Debug endpoint called');
    
    // Capture console output
    const originalLog = console.log;
    const originalError = console.error;
    const logs = [];
    
    console.log = (...args) => {
      logs.push({ type: 'log', message: args.join(' ') });
      originalLog(...args);
    };
    
    console.error = (...args) => {
      logs.push({ type: 'error', message: args.join(' ') });
      originalError(...args);
    };

    // Run debug queries
    await testIndividualQueries();

    // Restore console functions
    console.log = originalLog;
    console.error = originalError;

    res.status(200).json({
      success: true,
      message: 'Debug queries completed',
      logs: logs,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error in debug endpoint:', error);
    res.status(500).json({
      error: 'Debug execution failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Advanced debug endpoint
app.get('/debug/advanced', authenticateToken, async (req, res) => {
  try {
    console.log('🔬 Advanced debug endpoint called');
    
    // Capture console output
    const originalLog = console.log;
    const originalError = console.error;
    const logs = [];
    
    console.log = (...args) => {
      logs.push({ type: 'log', message: args.join(' ') });
      originalLog(...args);
    };
    
    console.error = (...args) => {
      logs.push({ type: 'error', message: args.join(' ') });
      originalError(...args);
    };

    // Run advanced debug
    await debugAdvanced();

    // Restore console functions
    console.log = originalLog;
    console.error = originalError;

    res.status(200).json({
      success: true,
      message: 'Advanced debug completed',
      logs: logs,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error in advanced debug endpoint:', error);
    res.status(500).json({
      error: 'Advanced debug execution failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// JSON data endpoint (for API consumers)
app.get('/api/data', authenticateToken, async (req, res) => {
  try {
    const environmentId = req.headers['x-environment-id'] || process.env.RAILWAY_ENVIRONMENT_ID;
    const lookbackHours = parseInt(req.headers['x-lookback-hours']) || 24;

    console.log(`📡 API data request - Environment: ${environmentId}, Lookback: ${lookbackHours}h`);

    const railwayToken = process.env.RAILWAY_TOKEN;
    if (!railwayToken) {
      return res.status(500).json({
        error: 'Railway configuration error',
        message: 'RAILWAY_TOKEN environment variable is not set'
      });
    }

    const client = new RailwayClient(railwayToken);
    const dashboardData = await client.fetchDashboardData(environmentId, lookbackHours);

    res.status(200).json(dashboardData);

  } catch (error) {
    console.error('❌ Error fetching API data:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Endpoint ${req.method} ${req.path} not found`,
    availableEndpoints: [
      'GET / - Dashboard (requires auth)',
      'GET /debug - Debug queries (requires auth)',
      'GET /debug/advanced - Advanced debugging (requires auth)',
      'GET /api/data - JSON data (requires auth)',
      'GET /health - Health check (no auth)'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚂 Railway Terminus server starting on port ${PORT}`);
  console.log(`📊 Dashboard available at: http://localhost:${PORT}/`);
  console.log(`🔍 Debug endpoint: http://localhost:${PORT}/debug`);
  console.log(`📡 API endpoint: http://localhost:${PORT}/api/data`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
  
  // Validate required environment variables
  if (!process.env.TERMINUS_AUTH_TOKEN) {
    console.warn('⚠️  TERMINUS_AUTH_TOKEN not set - authentication will fail');
  }
  if (!process.env.RAILWAY_TOKEN) {
    console.warn('⚠️  RAILWAY_TOKEN not set - Railway API calls will fail');
  }
});

module.exports = app; 