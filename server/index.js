const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const { body, validationResult } = require('express-validator');
const sanitizeHtml = require('sanitize-html');

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

// Add tags column if it doesn't exist (migration for existing databases)
try {
  db.exec(`ALTER TABLE sessions ADD COLUMN tags TEXT DEFAULT '[]'`);
} catch (e) {
  // Column already exists, ignore
}

// Add platform column if it doesn't exist (migration for existing databases)
try {
  db.exec(`ALTER TABLE sessions ADD COLUMN platform TEXT DEFAULT 'claude'`);
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
    duration_ms INTEGER DEFAULT 0,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  )
`);

// Add duration_ms column if it doesn't exist (migration for existing databases)
try {
  db.exec(`ALTER TABLE entries ADD COLUMN duration_ms INTEGER DEFAULT 0`);
} catch (e) {
  // Column already exists, ignore
}

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Prepared statements
const insertSession = db.prepare(`
  INSERT OR IGNORE INTO sessions (id, created_at, last_activity, model, user, platform)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const updateSessionActivity = db.prepare(`
  UPDATE sessions SET last_activity = ?, model = COALESCE(?, model), user = COALESCE(?, user), platform = COALESCE(?, platform) WHERE id = ?
`);

const insertEntry = db.prepare(`
  INSERT INTO entries (session_id, timestamp, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, total_tokens, duration_ms)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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

const getSessionsByPlatform = db.prepare(`
  SELECT * FROM sessions WHERE platform = ? ORDER BY COALESCE(last_activity, created_at) DESC
`);

const getSessionTotals = db.prepare(`
  SELECT
    COALESCE(SUM(input_tokens), 0) as input_tokens,
    COALESCE(SUM(output_tokens), 0) as output_tokens,
    COALESCE(SUM(cache_read_tokens), 0) as cache_read_tokens,
    COALESCE(SUM(cache_creation_tokens), 0) as cache_creation_tokens,
    COALESCE(SUM(total_tokens), 0) as total_tokens,
    COALESCE(SUM(duration_ms), 0) as total_duration_ms,
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

const updateSessionTags = db.prepare(`
  UPDATE sessions SET tags = ? WHERE id = ?
`);

const getAllTags = db.prepare(`
  SELECT DISTINCT json_each.value as tag
  FROM sessions, json_each(sessions.tags)
  WHERE sessions.tags IS NOT NULL AND sessions.tags != '[]'
  ORDER BY tag ASC
`);

app.use(cors());
app.use(express.json());

// Serve static files from React build
app.use(express.static(path.join(__dirname, '..', 'client', 'build')));

// Generic handler for token data from hooks
const handleTokenData = (req, res, platform) => {
  const {
    session_id,
    input_tokens,
    output_tokens,
    cache_read_tokens,
    cache_creation_tokens,
    model,
    user,
    timestamp,
    duration_ms
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
    total_tokens: (input_tokens || 0) + (output_tokens || 0),
    duration_ms: duration_ms || 0
  };

  // Insert session if it doesn't exist
  insertSession.run(session_id, ts, ts, model || null, user || null, platform);

  // Update last activity, model, user, and platform
  updateSessionActivity.run(ts, model || null, user || null, platform, session_id);

  // Insert entry
  insertEntry.run(
    session_id,
    entry.timestamp,
    entry.input_tokens,
    entry.output_tokens,
    entry.cache_read_tokens,
    entry.cache_creation_tokens,
    entry.total_tokens,
    entry.duration_ms
  );

  res.json({ success: true, entry });
};

// POST /api/claude/tokens - Receive token data from Claude Code hook
app.post('/api/claude/tokens', (req, res) => {
  console.log('Received Claude token data:', { session_id: req.body.session_id, timestamp: new Date().toISOString() });
  handleTokenData(req, res, 'claude');
});

// POST /api/copilot/tokens - Receive token data from GitHub Copilot hook
app.post('/api/copilot/tokens', (req, res) => {
  console.log('Received Copilot token data:', { session_id: req.body.session_id, timestamp: new Date().toISOString() });
  handleTokenData(req, res, 'copilot');
});

// GET /api/sessions - List all sessions, optionally filtered by platform
app.get('/api/sessions', (req, res) => {
  const { platform } = req.query;

  let sessions;
  if (platform && (platform === 'claude' || platform === 'copilot')) {
    sessions = getSessionsByPlatform.all(platform);
  } else {
    sessions = getAllSessions.all();
  }

  sessions = sessions.map(session => {
    const totals = getSessionTotals.get(session.id);
    return {
      id: session.id,
      created_at: session.created_at,
      last_activity: session.last_activity,
      model: session.model,
      user: session.user,
      platform: session.platform,
      tags: session.tags ? JSON.parse(session.tags) : [],
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
      tags: session.tags ? JSON.parse(session.tags) : [],
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

// GET /api/stats - Get overall statistics with optional date, user, and platform filtering
app.get('/api/stats', (req, res) => {
  const { startDate, endDate, user, platform } = req.query;

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

  if (platform && (platform === 'claude' || platform === 'copilot')) {
    whereClauses.push('s.platform = ?');
    params.push(platform);
  }

  if (whereClauses.length > 0) {
    // Filter by date range, user, and/or platform
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
app.patch('/api/sessions/:sessionId/notes', [
  // Validation middleware
  body('notes')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage('Notes must be a string')
    .trim()
    .isLength({ max: 10000 })
    .withMessage('Notes must not exceed 10,000 characters')
], (req, res) => {
  // Check validation results
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { sessionId } = req.params;
  let { notes } = req.body;

  // Validate sessionId format (basic UUID validation)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(sessionId)) {
    return res.status(400).json({ error: 'Invalid session ID format' });
  }

  const session = getSession.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Sanitize notes to prevent XSS attacks
  // Strip all HTML tags and dangerous content
  if (notes) {
    notes = sanitizeHtml(notes, {
      allowedTags: [], // No HTML tags allowed
      allowedAttributes: {}, // No attributes allowed
      disallowedTagsMode: 'discard' // Remove disallowed tags completely
    });

    // Additional sanitization: remove any remaining special characters that could be dangerous
    notes = notes.trim();

    // If notes become empty after sanitization, set to null
    if (notes === '') {
      notes = null;
    }
  } else {
    notes = null;
  }

  // Use prepared statement to prevent SQL injection (already protected, but explicit)
  updateSessionNotes.run(notes, sessionId);

  res.json({ success: true, notes: notes });
});

// PATCH /api/sessions/:sessionId/tags - Update session tags
app.patch('/api/sessions/:sessionId/tags', [
  // Validation middleware
  body('tags')
    .optional({ nullable: true })
    .isArray()
    .withMessage('Tags must be an array')
    .custom((tags) => {
      if (tags.length > 10) {
        throw new Error('Maximum 10 tags allowed per session');
      }
      return true;
    }),
  body('tags.*')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be between 1 and 50 characters')
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage('Tags can only contain letters, numbers, spaces, hyphens, and underscores')
], (req, res) => {
  // Check validation results
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { sessionId } = req.params;
  let { tags } = req.body;

  // Validate sessionId format (basic UUID validation)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(sessionId)) {
    return res.status(400).json({ error: 'Invalid session ID format' });
  }

  const session = getSession.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Process tags
  if (tags && Array.isArray(tags)) {
    // Normalize tags: trim, deduplicate (case-insensitive), remove empty
    tags = tags
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    // Remove duplicates (case-insensitive)
    const seenTags = new Set();
    tags = tags.filter(tag => {
      const lowerTag = tag.toLowerCase();
      if (seenTags.has(lowerTag)) {
        return false;
      }
      seenTags.add(lowerTag);
      return true;
    });

    // Sanitize each tag
    tags = tags.map(tag =>
      sanitizeHtml(tag, {
        allowedTags: [],
        allowedAttributes: {},
        disallowedTagsMode: 'discard'
      })
    );
  } else {
    tags = [];
  }

  // Convert to JSON string for storage
  const tagsJson = JSON.stringify(tags);

  // Use prepared statement
  updateSessionTags.run(tagsJson, sessionId);

  res.json({ success: true, tags: tags });
});

// GET /api/tags - Get list of all unique tags
app.get('/api/tags', (req, res) => {
  const tags = getAllTags.all();
  res.json({ tags: tags.map(t => t.tag) });
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
