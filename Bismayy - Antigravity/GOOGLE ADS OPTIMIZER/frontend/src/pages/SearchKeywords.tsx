import React, { useState, useEffect } from 'react';
import { Search, Upload, Plus, AlertCircle, Sparkles } from 'lucide-react';

interface Keyword {
  id: string;
  campaign_name: string;
  ad_group_name: string;
  keyword: string;
  match_type: string;
  status: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  cpc: number;
  ctr: number;
  quality_score: number;
}

interface SearchTerm {
  query: string;
  campaign_name: string;
  ad_group_name: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  cpc: number;
}

interface VolumeIndex {
  keyword: string;
  volume: number;
  intent_score: number;
  source: string;
}

export default function SearchKeywords({ dateRange }: { dateRange: string }) {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [searchTerms, setSearchTerms] = useState<SearchTerm[]>([]);
  const [volumes, setVolumes] = useState<VolumeIndex[]>([]);
  const [csvText, setCsvText] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);

  const fetchData = async () => {
    try {
      const kwRes = await fetch(`/api/reports/data/keywords?range=${dateRange}`);
      const kwData = await kwRes.json();
      setKeywords(kwData);

      const stRes = await fetch(`/api/reports/data/search-terms?range=${dateRange}`);
      const stData = await stRes.json();
      setSearchTerms(stData);

      const volRes = await fetch('/api/keywords/volumes');
      const volData = await volRes.json();
      setVolumes(volData);
    } catch (err) {
      console.error('Failed to load keywords data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange]);


  const handleCsvImport = async () => {
    if (!csvText.trim()) return;
    // Simple parser: Keyword, Volume, Intent (one per line)
    const lines = csvText.split('\n');
    const importedKws = [];
    for (const line of lines) {
      const parts = line.split(',');
      if (parts[0] && parts[0].trim()) {
        importedKws.push({
          keyword: parts[0].trim(),
          volume: parseInt(parts[1] || '0', 10),
          intent_score: parseFloat(parts[2] || '0.5')
        });
      }
    }

    try {
      const res = await fetch('/api/keywords/upload-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: importedKws })
      });
      await res.json();
      setCsvText('');
      await fetchData();
    } catch (err) {
      console.error('CSV Import failed:', err);
    }
  };

  const handleAIEstimate = async () => {
    if (!aiPrompt.trim()) return;
    setLoadingAI(true);
    try {
      const res = await fetch('/api/keywords/llm-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: aiPrompt })
      });
      await res.json();
      setAiPrompt('');
      await fetchData();
    } catch (err) {
      console.error('AI estimation failed:', err);
    } finally {
      setLoadingAI(false);
    }
  };

  return (
    <div>
      <div className="top-status-bar">
        <div>
          <h2>Search Terms & Keywords Audit</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Identify wasteful keywords, high-converting customer searches, and load Google Search planner volume.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
        
        {/* Keywords Table list */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ marginBottom: '16px' }}>Active Keywords Index ({keywords.length})</h3>
          <div className="custom-table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Keyword</th>
                  <th>Match Type</th>
                  <th>QS</th>
                  <th>Clicks</th>
                  <th>Cost</th>
                  <th>Conversions</th>
                </tr>
              </thead>
              <tbody>
                {keywords.map((kw, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{kw.keyword}</td>
                    <td><span className="badge badge-info">{kw.match_type}</span></td>
                    <td>
                      <span className={`badge ${kw.quality_score >= 7 ? 'badge-success' : kw.quality_score >= 4 ? 'badge-warning' : 'badge-danger'}`}>
                        {kw.quality_score}/10
                      </span>
                    </td>
                    <td>{kw.clicks}</td>
                    <td>${kw.cost.toFixed(2)}</td>
                    <td>{kw.conversions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ margin: '32px 0 16px 0' }}>Search Queries (Actual Search Logs)</h3>
          <div className="custom-table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>User Query Search Term</th>
                  <th>Ad Group</th>
                  <th>Clicks</th>
                  <th>Cost</th>
                  <th>Conversions</th>
                </tr>
              </thead>
              <tbody>
                {searchTerms.map((st, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--text-secondary)' }}>"{st.query}"</td>
                    <td>{st.ad_group_name}</td>
                    <td>{st.clicks}</td>
                    <td>${st.cost.toFixed(2)}</td>
                    <td>{st.conversions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Workaround Panel: CSV Volume Planner & AI Estimator */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* CSV Uploader */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Upload size={18} color="var(--primary)" />
              CSV Volume Importer
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Input official planner or Semrush metrics.<br/>
              Format: <code>keyword, volume, commercial_intent(0-1)</code>
            </p>
            <textarea 
              className="form-control" 
              rows={4}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="e.g. smart bidding app, 1500, 0.85"
              style={{ width: '100%', marginBottom: '16px', fontSize: '13px' }}
            />
            <button className="btn btn-primary" onClick={handleCsvImport} style={{ width: '100%' }}>
              Import Volumes Index
            </button>
          </div>

          {/* AI Volume Estimator */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="var(--secondary)" />
              LLM Relative Volume
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Estimate volume relative intent values for a keyword theme using AI.
            </p>
            <input 
              type="text" 
              className="form-control"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g. google ads copilot tools"
              style={{ width: '100%', marginBottom: '16px' }}
            />
            <button className="btn btn-secondary" onClick={handleAIEstimate} disabled={loadingAI} style={{ width: '100%' }}>
              {loadingAI ? 'Estimating...' : 'Run AI Estimation'}
            </button>
          </div>

          {/* Volume Cache List */}
          <div className="glass-panel" style={{ padding: '24px', flex: 1 }}>
            <h3 style={{ marginBottom: '14px' }}>Planner Volume Cache</h3>
            {volumes.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No volumes cached yet.</p>
            ) : (
              <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                <table className="custom-table" style={{ fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th>Keyword</th>
                      <th>Vol</th>
                      <th>Intent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {volumes.map((v, i) => (
                      <tr key={i}>
                        <td>{v.keyword}</td>
                        <td>{v.volume.toLocaleString()}</td>
                        <td>{Math.round(v.intent_score * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
