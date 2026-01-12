import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const API_BASE = '/api';

function SessionChart({ entries }) {
  if (!entries || entries.length === 0) {
    return null;
  }

  const chartData = entries.map((entry, idx) => ({
    name: `#${idx + 1}`,
    time: new Date(entry.timestamp).toLocaleTimeString(),
    input: entry.input_tokens,
    output: entry.output_tokens,
    cacheRead: entry.cache_read_tokens,
    cacheWrite: entry.cache_creation_tokens,
    total: entry.total_tokens
  }));

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
          <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(value) => value.toLocaleString()} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '0.5rem',
              color: '#e2e8f0'
            }}
            labelStyle={{ color: '#f8fafc' }}
            formatter={(value) => value.toLocaleString()}
          />
          <Legend />
          <Line type="monotone" dataKey="input" name="Input" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="output" name="Output" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="cacheRead" name="Cache Read" stroke="#eab308" strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="cacheWrite" name="Cache Write" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="total" name="Total" stroke="#a78bfa" strokeWidth={2} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function App() {
  const [stats, setStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [statsRes, sessionsRes] = await Promise.all([
        fetch(`${API_BASE}/stats`),
        fetch(`${API_BASE}/sessions`)
      ]);

      if (!statsRes.ok || !sessionsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const statsData = await statsRes.json();
      const sessionsData = await sessionsRes.json();

      setStats(statsData.stats);
      setSessions(sessionsData.sessions);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const fetchSessionDetails = async (sessionId) => {
    try {
      const res = await fetch(`${API_BASE}/sessions/${sessionId}`);
      if (!res.ok) throw new Error('Failed to fetch session');
      const data = await res.json();
      setSelectedSession(data.session);
    } catch (err) {
      setError(err.message);
    }
  };

  const formatNumber = (num) => {
    return num?.toLocaleString() ?? '0';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  // Claude API pricing (per million tokens)
  const PRICING = {
    input: 15,        // $15 per 1M input tokens
    output: 75,       // $75 per 1M output tokens
    cacheRead: 1.5,   // $1.50 per 1M cache read tokens
    cacheCreation: 18.75  // $18.75 per 1M cache creation tokens
  };

  const calculateCost = (inputTokens, outputTokens, cacheReadTokens = 0, cacheCreationTokens = 0) => {
    const inputCost = (inputTokens / 1_000_000) * PRICING.input;
    const outputCost = (outputTokens / 1_000_000) * PRICING.output;
    const cacheReadCost = (cacheReadTokens / 1_000_000) * PRICING.cacheRead;
    const cacheCreationCost = (cacheCreationTokens / 1_000_000) * PRICING.cacheCreation;
    return inputCost + outputCost + cacheReadCost + cacheCreationCost;
  };

  const formatCost = (cost) => {
    if (cost < 0.01) return `$${cost.toFixed(4)}`;
    return `$${cost.toFixed(2)}`;
  };

  const truncateId = (id) => {
    if (!id) return 'N/A';
    return id.length > 12 ? `${id.slice(0, 6)}...${id.slice(-6)}` : id;
  };

  if (loading) {
    return <div className="container loading">Loading...</div>;
  }

  if (error) {
    return (
      <div className="container error">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={fetchData}>Retry</button>
      </div>
    );
  }

  return (
    <div className="container">
      <header>
        <h1>Claude Session Dashboard</h1>
        <button onClick={fetchData} className="refresh-btn">Refresh</button>
      </header>

      {stats && (
        <section className="stats-section">
          <div className="stats-row">
            <div className="stat-card">
              <h3>Sessions</h3>
              <p className="stat-value">{formatNumber(stats.total_sessions)}</p>
            </div>
            <div className="stat-card">
              <h3>Requests</h3>
              <p className="stat-value">{formatNumber(stats.total_requests)}</p>
            </div>
            <div className="stat-card">
              <h3>Input Tokens</h3>
              <p className="stat-value">{formatNumber(stats.total_input_tokens)}</p>
            </div>
            <div className="stat-card">
              <h3>Output Tokens</h3>
              <p className="stat-value">{formatNumber(stats.total_output_tokens)}</p>
            </div>
            <div className="stat-card">
              <h3>Cache Read</h3>
              <p className="stat-value">{formatNumber(stats.total_cache_read_tokens)}</p>
            </div>
          </div>
          <div className="stats-summary">
            <div className="stat-card highlight">
              <h3>Total Tokens</h3>
              <p className="stat-value">{formatNumber(stats.total_tokens)}</p>
            </div>
            <div className="stat-card cost">
              <h3>Estimated Cost</h3>
              <p className="stat-value">{formatCost(calculateCost(
                stats.total_input_tokens,
                stats.total_output_tokens,
                stats.total_cache_read_tokens,
                stats.total_cache_creation_tokens
              ))}</p>
            </div>
          </div>
        </section>
      )}

      <section className="sessions-section">
        <h2>Sessions</h2>
        {sessions.length === 0 ? (
          <p className="empty-state">No sessions recorded yet. Start using Claude Code with the token logger hook enabled.</p>
        ) : (
          <div className="sessions-list">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`session-card ${selectedSession?.id === session.id ? 'selected' : ''}`}
                onClick={() => fetchSessionDetails(session.id)}
              >
                <div className="session-header">
                  <span className="session-id" title={session.id}>{truncateId(session.id)}</span>
                  <div className="session-meta">
                    {session.user && <span className="session-user">{session.user}</span>}
                    {session.model && <span className="session-model">{session.model}</span>}
                    <span className="session-requests">{session.totals.request_count} requests</span>
                  </div>
                </div>
                <div className="session-tokens">
                  <span>In: {formatNumber(session.totals.input_tokens)}</span>
                  <span>Out: {formatNumber(session.totals.output_tokens)}</span>
                  <span className="total">Total: {formatNumber(session.totals.total_tokens)}</span>
                  <span className="cost">Cost: {formatCost(calculateCost(
                    session.totals.input_tokens,
                    session.totals.output_tokens,
                    session.totals.cache_read_tokens,
                    session.totals.cache_creation_tokens
                  ))}</span>
                </div>
                <div className="session-time">
                  Last activity: {formatDate(session.last_activity)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedSession && (
        <section className="session-details">
          <div className="details-header">
            <h2>Session Details</h2>
            <button onClick={() => setSelectedSession(null)} className="close-btn">Close</button>
          </div>
          <p className="session-full-id">ID: {selectedSession.id}</p>
          {selectedSession.user && <p className="session-user-detail">User: {selectedSession.user}</p>}
          {selectedSession.model && <p className="session-model-detail">Model: {selectedSession.model}</p>}
          <p>Created: {formatDate(selectedSession.created_at)}</p>

          <h3>Token Usage Over Time</h3>
          <SessionChart entries={selectedSession.entries} />
          <div className="entries-table">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Time</th>
                  <th>Input</th>
                  <th>Output</th>
                  <th>Cache Read</th>
                  <th>Cache Write</th>
                  <th>Total</th>
                  <th>Est. Cost</th>
                </tr>
              </thead>
              <tbody>
                {selectedSession.entries.map((entry, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td>{formatDate(entry.timestamp)}</td>
                    <td>{formatNumber(entry.input_tokens)}</td>
                    <td>{formatNumber(entry.output_tokens)}</td>
                    <td>{formatNumber(entry.cache_read_tokens)}</td>
                    <td>{formatNumber(entry.cache_creation_tokens)}</td>
                    <td className="total">{formatNumber(entry.total_tokens)}</td>
                    <td className="cost">{formatCost(calculateCost(
                      entry.input_tokens,
                      entry.output_tokens,
                      entry.cache_read_tokens,
                      entry.cache_creation_tokens
                    ))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="2"><strong>Session Total</strong></td>
                  <td><strong>{formatNumber(selectedSession.totals.input_tokens)}</strong></td>
                  <td><strong>{formatNumber(selectedSession.totals.output_tokens)}</strong></td>
                  <td><strong>{formatNumber(selectedSession.totals.cache_read_tokens)}</strong></td>
                  <td><strong>{formatNumber(selectedSession.totals.cache_creation_tokens)}</strong></td>
                  <td className="total"><strong>{formatNumber(selectedSession.totals.total_tokens)}</strong></td>
                  <td className="cost"><strong>{formatCost(calculateCost(
                    selectedSession.totals.input_tokens,
                    selectedSession.totals.output_tokens,
                    selectedSession.totals.cache_read_tokens,
                    selectedSession.totals.cache_creation_tokens
                  ))}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

export default App;
