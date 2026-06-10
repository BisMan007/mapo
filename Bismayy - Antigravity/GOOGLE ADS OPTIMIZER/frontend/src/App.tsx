import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Search, Sparkles, Map, ClipboardList, Settings as SettingsIcon, Target } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import SearchKeywords from './pages/SearchKeywords';
import CreativeStudio from './pages/CreativeStudio';
import TargetingBids from './pages/TargetingBids';
import ApprovalQueue from './pages/ApprovalQueue';
import Settings from './pages/Settings';

type ViewState = 'dashboard' | 'keywords' | 'creatives' | 'targeting' | 'queue' | 'settings';

export default function App() {
  const [activeView, setActiveView] = useState<ViewState>('dashboard');
  const [dateRange, setDateRange] = useState<string>('30d');
  const [pendingCount, setPendingCount] = useState(0);

  const fetchPendingCount = async () => {
    try {
      const res = await fetch('/api/recommendations');
      const data = await res.json();
      setPendingCount(data.length);
    } catch {
      // Graceful ignore
    }
  };

  useEffect(() => {
    fetchPendingCount();
    // Poll the queue size every 10 seconds for real-time badge updates
    const interval = setInterval(fetchPendingCount, 10000);
    return () => clearInterval(interval);
  }, [activeView]);

  return (
    <div className="app-container">
      
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand-section">
          <Target size={32} color="var(--primary)" style={{ filter: 'drop-shadow(0 0 8px var(--primary-glow))' }} />
          <div>
            <h1 className="brand-logo">MAPO</h1>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.1em' }}>ADS COPILOT</span>
          </div>
        </div>

        {/* Date Range Picker Dropdown */}
        <div style={{ marginBottom: '24px', padding: '0 8px' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>DATE RANGE</label>
          <select 
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="form-control"
            style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: '10px', color: 'var(--text-main)', fontSize: '13px', cursor: 'pointer', padding: '8px 12px' }}
          >
            <option value="7d">Last 7 Days</option>
            <option value="14d">Last 14 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>

        <nav>
          <ul className="nav-links">
            <li 
              className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveView('dashboard')}
            >
              <LayoutDashboard size={18} />
              <span>Overview Dashboard</span>
            </li>
            <li 
              className={`nav-item ${activeView === 'keywords' ? 'active' : ''}`}
              onClick={() => setActiveView('keywords')}
            >
              <Search size={18} />
              <span>Search & Keywords</span>
            </li>
            <li 
              className={`nav-item ${activeView === 'creatives' ? 'active' : ''}`}
              onClick={() => setActiveView('creatives')}
            >
              <Sparkles size={18} />
              <span>Creative Studio</span>
            </li>
            <li 
              className={`nav-item ${activeView === 'targeting' ? 'active' : ''}`}
              onClick={() => setActiveView('targeting')}
            >
              <Map size={18} />
              <span>Targeting Matrices</span>
            </li>
            <li 
              className={`nav-item ${activeView === 'queue' ? 'active' : ''}`}
              onClick={() => setActiveView('queue')}
            >
              <ClipboardList size={18} />
              <span>Approval Queue</span>
              {pendingCount > 0 && (
                <span className="badge badge-danger" style={{ marginLeft: 'auto', padding: '2px 6px', fontSize: '10px' }}>
                  {pendingCount}
                </span>
              )}
            </li>
            <li 
              className={`nav-item ${activeView === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveView('settings')}
            >
              <SettingsIcon size={18} />
              <span>Guardrails & Settings</span>
            </li>
          </ul>
        </nav>
      </aside>

      {/* Main Workspace Frame */}
      <main className="main-content">
        {activeView === 'dashboard' && <Dashboard dateRange={dateRange} />}
        {activeView === 'keywords' && <SearchKeywords dateRange={dateRange} />}
        {activeView === 'creatives' && <CreativeStudio dateRange={dateRange} />}
        {activeView === 'targeting' && <TargetingBids dateRange={dateRange} />}
        {activeView === 'queue' && <ApprovalQueue />}
        {activeView === 'settings' && <Settings />}
      </main>

    </div>
  );
}
