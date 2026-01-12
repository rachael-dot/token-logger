import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = '/api';

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
        <h1>Token Logger Dashboard</h1>
        <button onClick={fetchData} className="refresh-btn">Refresh</button>
      </header>

      {stats && (
        <section className="stats-grid">
          <div className="stat-card">
            <h3>Total Sessions</h3>
            <p className="stat-value">{formatNumber(stats.total_sessions)}</p>
          </div>
          <div className="stat-card">
            <h3>Total Requests</h3>
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
          <div className="stat-card highlight">
            <h3>Total Tokens</h3>
            <p className="stat-value">{formatNumber(stats.total_tokens)}</p>
          </div>
          <div className="stat-card">
            <h3>Cache Read</h3>
            <p className="stat-value">{formatNumber(stats.total_cache_read_tokens)}</p>
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
                  <span className="session-requests">{session.totals.request_count} requests</span>
                </div>
                <div className="session-tokens">
                  <span>In: {formatNumber(session.totals.input_tokens)}</span>
                  <span>Out: {formatNumber(session.totals.output_tokens)}</span>
                  <span className="total">Total: {formatNumber(session.totals.total_tokens)}</span>
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
          <p>Created: {formatDate(selectedSession.created_at)}</p>

          <h3>Token Usage Over Time</h3>
          <div className="entries-table">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Time</th>
                  <th>Input</th>
                  <th>Output</th>
                  <th>Cache Read</th>
                  <th>Total</th>
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
                    <td className="total">{formatNumber(entry.total_tokens)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="2"><strong>Session Total</strong></td>
                  <td><strong>{formatNumber(selectedSession.totals.input_tokens)}</strong></td>
                  <td><strong>{formatNumber(selectedSession.totals.output_tokens)}</strong></td>
                  <td><strong>{formatNumber(selectedSession.totals.cache_read_tokens)}</strong></td>
                  <td className="total"><strong>{formatNumber(selectedSession.totals.total_tokens)}</strong></td>
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
