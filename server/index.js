const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = path.join(__dirname, '..', 'data', 'tokens.db');

// Initialize database
const db = new Database(DB_PATH);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    last_activity TEXT,
    model TEXT
  )
`);

// Add model column if it doesn't exist (migration for existing databases)
try {
  db.exec(`ALTER TABLE sessions ADD COLUMN model TEXT`);
} catch (e) {
  // Column already exists, ignore
}

// Add user column if it doesn't exist (migration for existing databases)
try {
  db.exec(`ALTER TABLE sessions ADD COLUMN user TEXT`);
} catch (e) {
  // Column already exists, ignore
}

// Add notes column if it doesn't exist (migration for existing databases)
try {
  db.exec(`ALTER TABLE sessions ADD COLUMN notes TEXT`);
} catch (e) {
  // Column already exists, ignore
}

db.exec(`
  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cache_read_tokens INTEGER DEFAULT 0,
    cache_creation_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  )
`);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Prepared statements
const insertSession = db.prepare(`
  INSERT OR IGNORE INTO sessions (id, created_at, last_activity, model, user)
  VALUES (?, ?, ?, ?, ?)
`);

const updateSessionActivity = db.prepare(`
  UPDATE sessions SET last_activity = ?, model = COALESCE(?, model), user = COALESCE(?, user) WHERE id = ?
`);

const insertEntry = db.prepare(`
  INSERT INTO entries (session_id, timestamp, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, total_tokens)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const getSession = db.prepare(`
  SELECT * FROM sessions WHERE id = ?
`);

const getSessionEntries = db.prepare(`
  SELECT * FROM entries WHERE session_id = ? ORDER BY timestamp ASC
`);

const getAllSessions = db.prepare(`
  SELECT * FROM sessions ORDER BY COALESCE(last_activity, created_at) DESC
`);

const getSessionTotals = db.prepare(`
  SELECT
    COALESCE(SUM(input_tokens), 0) as input_tokens,
    COALESCE(SUM(output_tokens), 0) as output_tokens,
    COALESCE(SUM(cache_read_tokens), 0) as cache_read_tokens,
    COALESCE(SUM(cache_creation_tokens), 0) as cache_creation_tokens,
    COALESCE(SUM(total_tokens), 0) as total_tokens,
    COUNT(*) as request_count
  FROM entries WHERE session_id = ?
`);

const deleteSession = db.prepare(`
  DELETE FROM sessions WHERE id = ?
`);

const deleteSessionEntries = db.prepare(`
  DELETE FROM entries WHERE session_id = ?
`);

const getOverallStats = db.prepare(`
  SELECT
    COUNT(DISTINCT session_id) as total_sessions,
    COUNT(*) as total_requests,
    COALESCE(SUM(input_tokens), 0) as total_input_tokens,
    COALESCE(SUM(output_tokens), 0) as total_output_tokens,
    COALESCE(SUM(cache_read_tokens), 0) as total_cache_read_tokens,
    COALESCE(SUM(cache_creation_tokens), 0) as total_cache_creation_tokens,
    COALESCE(SUM(total_tokens), 0) as total_tokens
  FROM entries
`);

const updateSessionNotes = db.prepare(`
  UPDATE sessions SET notes = ? WHERE id = ?
`);

app.use(cors());
app.use(express.json());

// Serve static files from React build
app.use(express.static(path.join(__dirname, '..', 'client', 'build')));

// POST /api/tokens - Receive token data from hook
app.post('/api/tokens', (req, res) => {
  const {
    session_id,
    input_tokens,
    output_tokens,
    cache_read_tokens,
    cache_creation_tokens,
    model,
    user,
    timestamp
  } = req.body;

  if (!session_id) {
    return res.status(400).json({ error: 'session_id is required' });
  }

  const ts = timestamp || new Date().toISOString();
  const entry = {
    timestamp: ts,
    input_tokens: input_tokens || 0,
    output_tokens: output_tokens || 0,
    cache_read_tokens: cache_read_tokens || 0,
    cache_creation_tokens: cache_creation_tokens || 0,
    total_tokens: (input_tokens || 0) + (output_tokens || 0)
  };

  // Insert session if it doesn't exist
  insertSession.run(session_id, ts, ts, model || null, user || null);

  // Update last activity, model, and user
  updateSessionActivity.run(ts, model || null, user || null, session_id);

  // Insert entry
  insertEntry.run(
    session_id,
    entry.timestamp,
    entry.input_tokens,
    entry.output_tokens,
    entry.cache_read_tokens,
    entry.cache_creation_tokens,
    entry.total_tokens
  );

  res.json({ success: true, entry });
});

// GET /api/sessions - List all sessions
app.get('/api/sessions', (req, res) => {
  const sessions = getAllSessions.all().map(session => {
    const totals = getSessionTotals.get(session.id);
    return {
      id: session.id,
      created_at: session.created_at,
      last_activity: session.last_activity,
      model: session.model,
      user: session.user,
      totals
    };
  });

  res.json({ sessions });
});

// GET /api/sessions/:sessionId - Get details for a specific session
app.get('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  const session = getSession.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const entries = getSessionEntries.all(sessionId);
  const totals = getSessionTotals.get(sessionId);

  res.json({
    session: {
      id: session.id,
      created_at: session.created_at,
      last_activity: session.last_activity,
      model: session.model,
      user: session.user,
      notes: session.notes,
      entries,
      totals
    }
  });
});

// GET /api/users - Get list of unique users
app.get('/api/users', (req, res) => {
  const users = db.prepare(`
    SELECT DISTINCT user
    FROM sessions
    WHERE user IS NOT NULL
    ORDER BY user ASC
  `).all();

  res.json({ users: users.map(u => u.user) });
});

// GET /api/stats - Get overall statistics with optional date and user filtering
app.get('/api/stats', (req, res) => {
  const { startDate, endDate, user } = req.query;

  let stats;
  let sessionCount;

  // Build WHERE clause based on filters
  let whereClauses = [];
  let params = [];

  if (startDate && endDate) {
    whereClauses.push('e.timestamp >= ? AND e.timestamp <= ?');
    params.push(startDate, endDate);
  }

  if (user) {
    whereClauses.push('s.user = ?');
    params.push(user);
  }

  if (whereClauses.length > 0) {
    // Filter by date range and/or user
    const whereClause = whereClauses.join(' AND ');
    const filteredStats = db.prepare(`
      SELECT
        COUNT(DISTINCT e.session_id) as total_sessions,
        COUNT(*) as total_requests,
        COALESCE(SUM(e.input_tokens), 0) as total_input_tokens,
        COALESCE(SUM(e.output_tokens), 0) as total_output_tokens,
        COALESCE(SUM(e.cache_read_tokens), 0) as total_cache_read_tokens,
        COALESCE(SUM(e.cache_creation_tokens), 0) as total_cache_creation_tokens,
        COALESCE(SUM(e.total_tokens), 0) as total_tokens
      FROM entries e
      JOIN sessions s ON e.session_id = s.id
      WHERE ${whereClause}
    `).get(...params);

    stats = filteredStats;
  } else {
    stats = getOverallStats.get();

    // Get session count separately since entries table might be empty
    sessionCount = db.prepare('SELECT COUNT(*) as count FROM sessions').get();
    stats.total_sessions = sessionCount.count;
  }

  res.json({ stats });
});

// PATCH /api/sessions/:sessionId/notes - Update session notes
app.patch('/api/sessions/:sessionId/notes', (req, res) => {
  const { sessionId } = req.params;
  const { notes } = req.body;

  const session = getSession.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  updateSessionNotes.run(notes || null, sessionId);

  res.json({ success: true, notes: notes || null });
});

// DELETE /api/sessions/:sessionId - Delete a session
app.delete('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  const session = getSession.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Delete entries first, then session
  deleteSessionEntries.run(sessionId);
  deleteSession.run(sessionId);

  res.json({ success: true });
});

// Serve React app for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'build', 'index.html'));
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  db.close();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Token Logger API running on http://localhost:${PORT}`);
});
