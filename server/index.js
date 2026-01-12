const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, '..', 'data', 'tokens.json');

app.use(cors());
app.use(express.json());

// Initialize data file if it doesn't exist
function initDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ sessions: {} }, null, 2));
  }
}

// Read data from file
function readData() {
  initDataFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw);
}

// Write data to file
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// POST /api/tokens - Receive token data from hook
app.post('/api/tokens', (req, res) => {
  const {
    session_id,
    input_tokens,
    output_tokens,
    cache_read_tokens,
    cache_creation_tokens,
    timestamp
  } = req.body;

  if (!session_id) {
    return res.status(400).json({ error: 'session_id is required' });
  }

  const data = readData();

  if (!data.sessions[session_id]) {
    data.sessions[session_id] = {
      id: session_id,
      created_at: timestamp || new Date().toISOString(),
      entries: [],
      totals: {
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
        total_tokens: 0,
        request_count: 0
      }
    };
  }

  const session = data.sessions[session_id];
  const entry = {
    timestamp: timestamp || new Date().toISOString(),
    input_tokens: input_tokens || 0,
    output_tokens: output_tokens || 0,
    cache_read_tokens: cache_read_tokens || 0,
    cache_creation_tokens: cache_creation_tokens || 0,
    total_tokens: (input_tokens || 0) + (output_tokens || 0)
  };

  session.entries.push(entry);
  session.totals.input_tokens += entry.input_tokens;
  session.totals.output_tokens += entry.output_tokens;
  session.totals.cache_read_tokens += entry.cache_read_tokens;
  session.totals.cache_creation_tokens += entry.cache_creation_tokens;
  session.totals.total_tokens += entry.total_tokens;
  session.totals.request_count += 1;
  session.last_activity = entry.timestamp;

  writeData(data);

  res.json({ success: true, entry });
});

// GET /api/sessions - List all sessions
app.get('/api/sessions', (req, res) => {
  const data = readData();
  const sessions = Object.values(data.sessions)
    .map(session => ({
      id: session.id,
      created_at: session.created_at,
      last_activity: session.last_activity,
      totals: session.totals
    }))
    .sort((a, b) => new Date(b.last_activity || b.created_at) - new Date(a.last_activity || a.created_at));

  res.json({ sessions });
});

// GET /api/sessions/:sessionId - Get details for a specific session
app.get('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const data = readData();

  const session = data.sessions[sessionId];
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json({ session });
});

// GET /api/stats - Get overall statistics
app.get('/api/stats', (req, res) => {
  const data = readData();
  const sessions = Object.values(data.sessions);

  const stats = {
    total_sessions: sessions.length,
    total_requests: 0,
    total_input_tokens: 0,
    total_output_tokens: 0,
    total_cache_read_tokens: 0,
    total_cache_creation_tokens: 0,
    total_tokens: 0
  };

  sessions.forEach(session => {
    stats.total_requests += session.totals.request_count;
    stats.total_input_tokens += session.totals.input_tokens;
    stats.total_output_tokens += session.totals.output_tokens;
    stats.total_cache_read_tokens += session.totals.cache_read_tokens;
    stats.total_cache_creation_tokens += session.totals.cache_creation_tokens;
    stats.total_tokens += session.totals.total_tokens;
  });

  res.json({ stats });
});

// DELETE /api/sessions/:sessionId - Delete a session
app.delete('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const data = readData();

  if (!data.sessions[sessionId]) {
    return res.status(404).json({ error: 'Session not found' });
  }

  delete data.sessions[sessionId];
  writeData(data);

  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Token Logger API running on http://localhost:${PORT}`);
});
