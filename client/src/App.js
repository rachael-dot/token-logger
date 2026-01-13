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
  const [timeframe, setTimeframe] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('all');
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesInput, setNotesInput] = useState('');
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [editingTags, setEditingTags] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [sessionTags, setSessionTags] = useState([]);

  // Helper function to calculate date range based on timeframe
  const getDateRange = useCallback(() => {
    const now = new Date();
    let startDate, endDate;

    switch (timeframe) {
      case 'today':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          startDate = new Date(customStartDate);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(customEndDate);
          endDate.setHours(23, 59, 59, 999);
        }
        break;
      default:
        return null;
    }

    return startDate && endDate ? {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    } : null;
  }, [timeframe, customStartDate, customEndDate]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/users`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/tags`);
      if (res.ok) {
        const data = await res.json();
        setTags(data.tags);
      }
    } catch (err) {
      console.error('Failed to fetch tags:', err);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setError(null);

      const dateRange = getDateRange();
      const params = new URLSearchParams();

      if (dateRange) {
        params.append('startDate', dateRange.startDate);
        params.append('endDate', dateRange.endDate);
      }

      if (selectedUser !== 'all') {
        params.append('user', selectedUser);
      }

      const statsUrl = params.toString()
        ? `${API_BASE}/stats?${params.toString()}`
        : `${API_BASE}/stats`;

      const [statsRes, sessionsRes] = await Promise.all([
        fetch(statsUrl),
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
  }, [getDateRange, selectedUser]);

  useEffect(() => {
    fetchUsers();
    fetchTags();
  }, [fetchUsers, fetchTags]);

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
      setNotesInput(data.session.notes || '');
      setSessionTags(data.session.tags || []);
      setEditingNotes(false);
      setEditingTags(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const saveNotes = async () => {
    if (!selectedSession) return;

    try {
      const res = await fetch(`${API_BASE}/sessions/${selectedSession.id}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesInput })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || errorData.errors?.[0]?.msg || 'Failed to save notes');
      }

      const data = await res.json();
      // Use the sanitized notes from the server response
      setSelectedSession({ ...selectedSession, notes: data.notes });
      setNotesInput(data.notes || '');
      setEditingNotes(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const cancelEditNotes = () => {
    setNotesInput(selectedSession?.notes || '');
    setEditingNotes(false);
  };

  const saveTags = async () => {
    if (!selectedSession) return;

    try {
      const res = await fetch(`${API_BASE}/sessions/${selectedSession.id}/tags`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: sessionTags })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || errorData.errors?.[0]?.msg || 'Failed to save tags');
      }

      const data = await res.json();
      setSelectedSession({ ...selectedSession, tags: data.tags });
      setSessionTags(data.tags);
      setEditingTags(false);
      // Refresh tags list to include new tags
      fetchTags();
    } catch (err) {
      setError(err.message);
    }
  };

  const cancelEditTags = () => {
    setSessionTags(selectedSession?.tags || []);
    setEditingTags(false);
    setTagInput('');
  };

  const addTag = () => {
    const newTag = tagInput.trim();
    if (newTag && !sessionTags.includes(newTag) && sessionTags.length < 10) {
      setSessionTags([...sessionTags, newTag]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove) => {
    setSessionTags(sessionTags.filter(tag => tag !== tagToRemove));
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

  // Filter sessions based on selected tags
  const getFilteredSessions = useCallback((sessions) => {
    if (selectedTags.length === 0) {
      return sessions;
    }

    return sessions.filter(session => {
      const sessionTagList = session.tags || [];
      // Session must have at least one of the selected tags
      return selectedTags.some(selectedTag =>
        sessionTagList.includes(selectedTag)
      );
    });
  }, [selectedTags]);

  // Sort sessions based on selected sort option
  const getSortedSessions = useCallback((sessions) => {
    const sorted = [...sessions];

    switch (sortBy) {
      case 'recent':
        return sorted.sort((a, b) =>
          new Date(b.last_activity || b.created_at) - new Date(a.last_activity || a.created_at)
        );
      case 'cost-high':
        return sorted.sort((a, b) => {
          const costA = calculateCost(
            a.totals.input_tokens,
            a.totals.output_tokens,
            a.totals.cache_read_tokens,
            a.totals.cache_creation_tokens
          );
          const costB = calculateCost(
            b.totals.input_tokens,
            b.totals.output_tokens,
            b.totals.cache_read_tokens,
            b.totals.cache_creation_tokens
          );
          return costB - costA;
        });
      case 'cost-low':
        return sorted.sort((a, b) => {
          const costA = calculateCost(
            a.totals.input_tokens,
            a.totals.output_tokens,
            a.totals.cache_read_tokens,
            a.totals.cache_creation_tokens
          );
          const costB = calculateCost(
            b.totals.input_tokens,
            b.totals.output_tokens,
            b.totals.cache_read_tokens,
            b.totals.cache_creation_tokens
          );
          return costA - costB;
        });
      case 'tokens-high':
        return sorted.sort((a, b) => b.totals.total_tokens - a.totals.total_tokens);
      case 'tokens-low':
        return sorted.sort((a, b) => a.totals.total_tokens - b.totals.total_tokens);
      case 'requests-high':
        return sorted.sort((a, b) => b.totals.request_count - a.totals.request_count);
      case 'requests-low':
        return sorted.sort((a, b) => a.totals.request_count - b.totals.request_count);
      default:
        return sorted;
    }
  }, [sortBy]);

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
          <div className="stats-header">
            <h2>Usage Statistics</h2>
            <div className="stats-filters">
              <div className="timeframe-controls">
                <label>
                  Timeframe:
                  <select
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value)}
                    className="timeframe-select"
                  >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="week">Last 7 Days</option>
                    <option value="month">Last 30 Days</option>
                    <option value="custom">Custom Range</option>
                  </select>
                </label>
                {timeframe === 'custom' && (
                  <div className="date-range-picker">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="date-input"
                    />
                    <span>to</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="date-input"
                    />
                  </div>
                )}
              </div>
              {users.length > 0 && (
                <div className="user-filter">
                  <label>
                    User:
                    <select
                      value={selectedUser}
                      onChange={(e) => setSelectedUser(e.target.value)}
                      className="user-select"
                    >
                      <option value="all">All Users</option>
                      {users.map(user => (
                        <option key={user} value={user}>{user}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>
          </div>
          {tags.length > 0 && (
            <div className="tag-filter-row">
              <div className="tag-filter">
                <label>
                  Filter by Tags:
                  <div className="tag-filter-chips">
                    {tags.map(tag => (
                      <button
                        key={tag}
                        onClick={() => {
                          if (selectedTags.includes(tag)) {
                            setSelectedTags(selectedTags.filter(t => t !== tag));
                          } else {
                            setSelectedTags([...selectedTags, tag]);
                          }
                        }}
                        className={`tag-filter-chip ${selectedTags.includes(tag) ? 'active' : ''}`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  {selectedTags.length > 0 && (
                    <button
                      onClick={() => setSelectedTags([])}
                      className="clear-tags-btn"
                    >
                      Clear tag filters
                    </button>
                  )}
                </label>
              </div>
            </div>
          )}
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
        <div className="sessions-header">
          <h2>Sessions</h2>
          <div className="sort-controls">
            <label>
              Sort by:
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="sort-select"
              >
                <option value="recent">Most Recent</option>
                <option value="cost-high">Highest Cost</option>
                <option value="cost-low">Lowest Cost</option>
                <option value="tokens-high">Most Tokens</option>
                <option value="tokens-low">Least Tokens</option>
                <option value="requests-high">Most Requests</option>
                <option value="requests-low">Least Requests</option>
              </select>
            </label>
          </div>
        </div>
        {sessions.length === 0 ? (
          <p className="empty-state">No sessions recorded yet. Start using Claude Code with the token logger hook enabled.</p>
        ) : (
          <div className="sessions-list">
            {getSortedSessions(getFilteredSessions(sessions)).map((session) => (
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
                {session.tags && session.tags.length > 0 && (
                  <div className="session-tags">
                    <div className="tag-list">
                      {session.tags.map(tag => (
                        <span key={tag} className="tag-badge">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
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

          <div className="session-notes">
            <div className="notes-header">
              <h3>Notes</h3>
              {!editingNotes ? (
                <button onClick={() => setEditingNotes(true)} className="edit-notes-btn">
                  {selectedSession.notes ? 'Edit' : 'Add Notes'}
                </button>
              ) : (
                <div className="notes-actions">
                  <button onClick={saveNotes} className="save-notes-btn">Save</button>
                  <button onClick={cancelEditNotes} className="cancel-notes-btn">Cancel</button>
                </div>
              )}
            </div>
            {editingNotes ? (
              <textarea
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                placeholder="Add notes about what you were working on..."
                className="notes-input"
                rows={4}
                maxLength={10000}
              />
            ) : (
              <p className="notes-display">
                {selectedSession.notes || 'No notes added yet. Click "Add Notes" to describe what you were working on.'}
              </p>
            )}
          </div>

          <div className="session-tags-section">
            <div className="tags-header">
              <h3>Tags</h3>
              {!editingTags ? (
                <button onClick={() => setEditingTags(true)} className="edit-tags-btn">
                  {selectedSession.tags && selectedSession.tags.length > 0 ? 'Edit Tags' : 'Add Tags'}
                </button>
              ) : (
                <div className="tags-actions">
                  <button onClick={saveTags} className="save-tags-btn">Save</button>
                  <button onClick={cancelEditTags} className="cancel-tags-btn">Cancel</button>
                </div>
              )}
            </div>
            {editingTags ? (
              <div className="tags-editor">
                <div className="tag-input-wrapper">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="Type a tag and press Enter..."
                    className="tag-input"
                    maxLength={50}
                    list="tag-suggestions"
                  />
                  <datalist id="tag-suggestions">
                    {tags
                      .filter(tag => !sessionTags.includes(tag))
                      .map(tag => (
                        <option key={tag} value={tag} />
                      ))}
                  </datalist>
                  <button onClick={addTag} className="add-tag-btn">Add</button>
                </div>
                <div className="current-tags">
                  {sessionTags.map(tag => (
                    <span key={tag} className="tag-badge editable">
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="remove-tag-btn"
                        aria-label={`Remove ${tag}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                {sessionTags.length === 0 && (
                  <p className="no-tags-message">No tags added yet. Add tags to organize your sessions.</p>
                )}
                {sessionTags.length >= 10 && (
                  <p className="tag-limit-message">Maximum 10 tags reached.</p>
                )}
              </div>
            ) : (
              <div className="tags-display">
                {selectedSession.tags && selectedSession.tags.length > 0 ? (
                  <div className="tag-list">
                    {selectedSession.tags.map(tag => (
                      <span key={tag} className="tag-badge">{tag}</span>
                    ))}
                  </div>
                ) : (
                  <p className="no-tags-message">No tags added yet. Click "Add Tags" to organize this session.</p>
                )}
              </div>
            )}
          </div>

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
