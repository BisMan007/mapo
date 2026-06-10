import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Shield, Mail, CheckCircle } from 'lucide-react';

export default function Settings() {
  const [cpaCap, setCpaCap] = useState('50.0');
  const [budgetCap, setBudgetCap] = useState('20.0');
  const [bidCap, setBidCap] = useState('20.0');
  const [email, setEmail] = useState('bismayy.techie@gmail.com');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      const settingsMap = new Map<string, string>(data.map((s: any) => [s.key, s.value]));

      setCpaCap(settingsMap.get('global_cpa_cap') || '50.0');
      setBudgetCap(settingsMap.get('budget_threshold_percentage') || '20.0');
      setBidCap(settingsMap.get('bid_threshold_percentage') || '20.0');
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      const payload = [
        { key: 'global_cpa_cap', value: cpaCap },
        { key: 'budget_threshold_percentage', value: budgetCap },
        { key: 'bid_threshold_percentage', value: bidCap }
      ];

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: payload })
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Save settings failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px' }}>
      <div className="top-status-bar">
        <div>
          <h2>Settings & Guardrails</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Configure account-level budget limits, bid thresholds, and notification settings.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="glass-panel" style={{ padding: '32px' }}>
        
        {/* Safety caps */}
        <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px' }}>
          <Shield color="var(--primary)" size={20} />
          Safety & Bidding Guardrails
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div className="form-group">
            <label className="form-label">Absolute CPA Cap ($)</label>
            <input 
              type="number" 
              step="1"
              className="form-control"
              value={cpaCap}
              onChange={(e) => setCpaCap(e.target.value)}
              required
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Rejects any keyword bid increases resulting in a CPA estimate higher than this value.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Max Single Budget Adjustment (%)</label>
            <input 
              type="number" 
              className="form-control"
              value={budgetCap}
              onChange={(e) => setBudgetCap(e.target.value)}
              required
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Limits the maximum percentage change allowed for a single budget update recommendation.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Max Single Bid Adjustment (%)</label>
            <input 
              type="number" 
              className="form-control"
              value={bidCap}
              onChange={(e) => setBidCap(e.target.value)}
              required
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Limits keyword-level maximum bid increases/decreases.
            </span>
          </div>
        </div>

        {/* Digest notification settings */}
        <h3 style={{ margin: '40px 0 20px 0', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px' }}>
          <Mail color="var(--secondary)" size={20} />
          Nightly Email Notifications
        </h3>

        <div className="form-group">
          <label className="form-label">Digest Recipient Email</label>
          <input 
            type="email" 
            className="form-control"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ maxWidth: '400px' }}
          />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            The address where the daily performance digest summary and recommendations will be sent.
          </span>
        </div>

        {/* Form controls submit */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '36px' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          
          {saveSuccess && (
            <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 600 }}>
              <CheckCircle size={16} /> Guardrails successfully updated!
            </span>
          )}
        </div>

      </form>

      {/* Account Info Box */}
      <div className="glass-panel" style={{ padding: '24px', marginTop: '32px' }}>
        <h4 style={{ marginBottom: '12px' }}>Authorized Target Details</h4>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          <p style={{ margin: '4px 0' }}><strong>Target Account:</strong> Live Customer ID (8568546384)</p>
          <p style={{ margin: '4px 0' }}><strong>Access Level:</strong> Explorer Developer Access (Capped at 2,880 ops/day)</p>
          <p style={{ margin: '4px 0' }}><strong>Local Database:</strong> SQLite Cache active (google_ads_optimizer.db)</p>
        </div>
      </div>
    </div>
  );
}
