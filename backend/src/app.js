const express = require('express');
const cors = require('cors');
const healthRouter = require('./routes/health');
const jobRouter = require('./routes/jobRoutes');
const adminRouter = require('./routes/adminRoutes');
const errorHandler = require('./middleware/errorHandler');
const { createApiError } = require('./utils/apiError');

const app = express();

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

app.use('/api/health', healthRouter);
app.use('/api/jobs', jobRouter);
app.use('/api/admin', adminRouter);

app.use((req, res) => {
  throw createApiError(404, 'NOT_FOUND', 'Route not found.', { path: req.originalUrl });
});

app.use(errorHandler);

module.exports = app;
