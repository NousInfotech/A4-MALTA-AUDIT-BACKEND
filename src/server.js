// server.js
require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const cors    = require('cors');
const http    = require('http');
const { Server } = require('socket.io');
const engagementRoutes      = require('./routes/engagements');
const documentRequestRoutes = require('./routes/documentRequests');
const procedureRoutes       = require('./routes/procedures');
const checklistRoutes       = require('./routes/checklist');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*' }
});

// Make io available to your controllers
app.set('io', io);

// Middleware & DB
app.use(cors());
connectDB();
app.use(express.json());

// Routes
app.use('/api/checklist',         checklistRoutes);
app.use('/api/engagements',       engagementRoutes);
app.use('/api/document-requests', documentRequestRoutes);
app.use('/api/procedures',        procedureRoutes);

// Health check
app.get('/', (req, res) => res.send('API is running'));

// Socket.IO rooms
io.on('connection', socket => {
  socket.on('joinEngagement',  id => socket.join(`engagement_${id}`));
  socket.on('leaveEngagement', id => socket.leave(`engagement_${id}`));
});

// **This** starts *both* Express and Socket.IO
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`🚀 Server + Socket.IO listening on http://localhost:${PORT}`);
});
