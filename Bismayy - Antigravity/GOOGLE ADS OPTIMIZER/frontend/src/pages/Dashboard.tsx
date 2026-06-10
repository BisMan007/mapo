import React, { useState, useEffect } from 'react';
import { TrendingUp, AlertTriangle, RefreshCw, DollarSign, Activity } from 'lucide-react';

interface KPI {
  clicks: number;
  impressions: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpa: number;
  last_sync: string;
}

interface Anomaly {
  type: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
}

interface SyncHistory {
  id: number;
  sync_timestamp: string;
  status: string;
  api_operations_count: number;
  error_message: string;
}

export default function Dashboard({ dateRange }: { dateRange: string }) {
  const [kpis, setKpis] = useState<KPI | null>(null);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [syncHistory, setSyncHistory] = useState<SyncHistory[]>([]);
  const [syncing, setSyncing] = useState(false);

  const fetchData = async () => {
    try {
      const kpiRes = await fetch(`/api/reports/kpis?range=${dateRange}`);
      const kpiData = await kpiRes.json();
      if (kpiData && !kpiData.error) {
        setKpis(kpiData);
      }

      const anomalyRes = await fetch(`/api/reports/anomalies?range=${dateRange}`);
      const anomalyData = await anomalyRes.json();
      if (Array.isArray(anomalyData)) {
        setAnomalies(anomalyData);
      } else {
        setAnomalies([]);
      }

      const historyRes = await fetch('/api/reports/sync-history');
      const historyData = await historyRes.json();
      if (Array.isArray(historyData)) {
        setSyncHistory(historyData);
      } else {
        setSyncHistory([]);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange]);


  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/reports/sync', { method: 'POST' });
      await res.json();
      await fetchData();
    } catch (err) {
      console.error('Manual sync failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  if (!kpis) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
        <RefreshCw className="animate-spin" size={36} />
      </div>
    );
  }

  return (
    <div>
      <div className="top-status-bar">
        <div>
          <h2>Account Performance Cockpit</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Single Live Advertiser (Customer ID: 8568546384)
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>CACHE STATUS</span>
            <p style={{ fontSize: '13px', fontWeight: 600 }}>Sync at {new Date(kpis.last_sync).toLocaleString()}</p>
          </div>
          <button 
            className="btn btn-primary" 
            onClick={handleManualSync}
            disabled={syncing}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw className={syncing ? 'animate-spin' : ''} size={16} />
            {syncing ? 'Syncing...' : 'Sync Cache'}
          </button>
        </div>
      </div>

      {/* KPI Metrics Widgets */}
      <div className="metrics-grid">
        <div className="glass-panel metric-card">
          <div className="metric-header">
            <span>Spend (30D)</span>
            <DollarSign size={16} color="var(--primary)" />
          </div>
          <span className="metric-val">${kpis.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Google Ads budget spend</span>
        </div>

        <div className="glass-panel metric-card">
          <div className="metric-header">
            <span>Conversions</span>
            <TrendingUp size={16} color="var(--success)" />
          </div>
          <span className="metric-val" style={{ color: 'var(--success)' }}>{kpis.conversions.toLocaleString()}</span>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Completed conversion actions</span>
        </div>

        <div className="glass-panel metric-card">
          <div className="metric-header">
            <span>Average CPA</span>
            <Activity size={16} color="var(--secondary)" />
          </div>
          <span className="metric-val">${kpis.cpa.toFixed(2)}</span>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Cost-Per-Acquisition average</span>
        </div>

        <div className="glass-panel metric-card">
          <div className="metric-header">
            <span>CTR / Clicks</span>
            <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{kpis.ctr.toFixed(2)}%</span>
          </div>
          <span className="metric-val">{kpis.clicks.toLocaleString()}</span>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total clicks captured</span>
        </div>
      </div>

      {/* Main Layout Stack: Anomalies & Sync History */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', marginTop: '32px' }}>
        
        {/* Anomaly Alerts */}
        <div className="glass-panel" style={{ padding: '28px' }}>
          <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle color="var(--warning)" size={20} />
            Performance Anomalies ({anomalies.length})
          </h3>
          {anomalies.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
              🟢 No budget leaks or anomalies detected.
            </div>
          ) : (
            <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
              {anomalies.map((an, i) => (
                <div key={i} className="anomaly-row" style={{
                  background: an.severity === 'HIGH' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(245, 158, 11, 0.05)',
                  borderColor: an.severity === 'HIGH' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'
                }}>
                  <div style={{
                    color: an.severity === 'HIGH' ? 'var(--danger)' : 'var(--warning)',
                    fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px'
                  }}>
                    {an.severity} Priority - {an.type}
                  </div>
                  <h4 style={{ fontSize: '15px', color: 'var(--text-main)', marginBottom: '4px' }}>{an.title}</h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{an.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sync History Logs */}
        <div className="glass-panel" style={{ padding: '28px' }}>
          <h3 style={{ marginBottom: '20px' }}>Sync Activity History</h3>
          <div className="custom-table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Sync Time</th>
                  <th>Status</th>
                  <th>Ops Count</th>
                </tr>
              </thead>
              <tbody>
                {syncHistory.map((sh, idx) => (
                  <tr key={idx}>
                    <td style={{ fontSize: '13px' }}>{new Date(sh.sync_timestamp).toLocaleString()}</td>
                    <td>
                      <span className={`badge ${sh.status === 'SUCCESS' ? 'badge-success' : 'badge-danger'}`}>
                        {sh.status}
                      </span>
                    </td>
                    <td>{sh.api_operations_count} / 2880</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
