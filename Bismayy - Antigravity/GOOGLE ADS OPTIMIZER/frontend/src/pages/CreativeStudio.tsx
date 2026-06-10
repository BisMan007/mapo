import React, { useState, useEffect } from 'react';
import { Sparkles, Download, Upload, XCircle, Film, Image } from 'lucide-react';

interface CreativeAsset {
  id: string;
  type: string;
  asset_content: string;
  rating: string;
  campaign_name: string;
  impressions?: number;
  clicks?: number;
  cost?: number;
  conversions?: number;
}

interface Placement {
  id: number;
  placement_name: string;
  clicks: number;
  cost: number;
  conversions: number;
}

export default function CreativeStudio({ dateRange }: { dateRange: string }) {
  const [creatives, setCreatives] = useState<CreativeAsset[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [prompt, setPrompt] = useState('');
  const [engine, setEngine] = useState<'VERTEX_IMAGEN' | 'OPENAI_DALLE' | 'VERTEX_VEO'>('VERTEX_IMAGEN');
  const [generating, setGenerating] = useState(false);
  const [generatedAsset, setGeneratedAsset] = useState<{ url: string; asset_type: 'IMAGE' | 'VIDEO' } | null>(null);
  const [assetName, setAssetName] = useState('My AI Creative');
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const crRes = await fetch(`/api/reports/data/creative-assets?range=${dateRange}`);
      const crData = await crRes.json();
      setCreatives(crData);

      const plRes = await fetch(`/api/reports/data/pmax-placements?range=${dateRange}`);
      const plData = await plRes.json();
      setPlacements(plData);
    } catch (err) {
      console.error('Failed to load creatives data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange]);


  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setGeneratedAsset(null);
    setUploadStatus(null);
    try {
      const type = engine === 'VERTEX_VEO' ? 'VIDEO' : 'IMAGE';
      const res = await fetch('/api/creative/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, type, engine })
      });
      const data = await res.json();
      if (data.url) {
        setGeneratedAsset({
          url: data.url,
          asset_type: data.asset_type
        });
      }
    } catch (err) {
      console.error('AI creative generation failed:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleUpload = async () => {
    if (!generatedAsset) return;
    setUploadStatus('Uploading...');
    try {
      const res = await fetch('/api/creative/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: generatedAsset.url, assetName })
      });
      const result = await res.json();
      if (result.success) {
        setUploadStatus(`Uploaded! Asset ID: ${result.resourceName.split('/').pop()}`);
      } else {
        setUploadStatus(`Upload failed: ${result.error}`);
      }
    } catch (err: any) {
      setUploadStatus(`Error: ${err.message}`);
    }
  };

  const handlePlacementExclusion = async (placementName: string) => {
    try {
      // Direct placement exclusions are queued as Account Negative Placement adjustments
      const res = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: 'pmax',
          campaign_name: 'Performance Max - Main',
          ad_group_id: '',
          ad_group_name: '',
          type: 'ADD_PMAX_PLACEMENT_EXCLUSION',
          details: {
            placement: placementName,
            reason: 'Manual exclusion request from Creative & Placement Studio.'
          }
        })
      });
      await res.json();
      alert(`Placement exclusion for "${placementName}" added to the approval queue!`);
    } catch (err) {
      console.error('Exclusion request failed:', err);
    }
  };

  return (
    <div>
      <div className="top-status-bar">
        <div>
          <h2>AI Creative Studio & Placement Panel</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Evaluate responsive ad performance, brainstorm graphics, and exclude wasteful PMax placement domains.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* 1. AI Creative Studio */}
        <div className="glass-panel" style={{ padding: '28px' }}>
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={20} color="var(--primary)" />
            AI Creative Studio
          </h3>
          
          <div className="form-group">
            <label className="form-label">Creative Prompt</label>
            <textarea 
              className="form-control"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Modern abstract technology workspace graphic background with blue and violet neon lights"
              style={{ width: '100%' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Select Generator Engine</label>
            <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
              <button 
                type="button"
                className={`btn ${engine === 'VERTEX_IMAGEN' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setEngine('VERTEX_IMAGEN')}
                style={{ flex: 1, fontSize: '12px' }}
              >
                Vertex Imagen 3
              </button>
              <button 
                type="button"
                className={`btn ${engine === 'OPENAI_DALLE' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setEngine('OPENAI_DALLE')}
                style={{ flex: 1, fontSize: '12px' }}
              >
                DALL-E 3
              </button>
              <button 
                type="button"
                className={`btn ${engine === 'VERTEX_VEO' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setEngine('VERTEX_VEO')}
                style={{ flex: 1, fontSize: '12px' }}
              >
                Google Veo (Video)
              </button>
            </div>
          </div>

          <button 
            className="btn btn-primary" 
            onClick={handleGenerate}
            disabled={generating}
            style={{ width: '100%', marginTop: '12px' }}
          >
            {generating ? 'Generating Media...' : 'Generate Asset'}
          </button>

          {/* Generated Canvas */}
          {generatedAsset && (
            <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(0,0,0,0.3)', borderRadius: '12px' }}>
              <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', height: '240px', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {generatedAsset.asset_type === 'IMAGE' ? (
                  <img src={generatedAsset.url} alt="Generated Asset" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                ) : (
                  <video src={generatedAsset.url} controls style={{ maxWidth: '100%', maxHeight: '100%' }} />
                )}
              </div>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label">Asset File Name (Google Ads Asset Name)</label>
                <input 
                  type="text" 
                  className="form-control"
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button className="btn btn-primary" onClick={handleUpload} style={{ flex: 1 }}>
                  <Upload size={14} /> Upload to Ads API
                </button>
                <a 
                  href={generatedAsset.url} 
                  download={assetName} 
                  target="_blank" 
                  rel="noreferrer"
                  className="btn btn-secondary" 
                  style={{ flex: 1, textDecoration: 'none' }}
                >
                  <Download size={14} /> Download File
                </a>
              </div>

              {uploadStatus && (
                <p style={{ marginTop: '12px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center' }}>
                  {uploadStatus}
                </p>
              )}
            </div>
          )}
        </div>

        {/* 2. Ad Copy Rating Labels Table */}
        <div className="glass-panel" style={{ padding: '28px' }}>
          <h3 style={{ marginBottom: '20px' }}>Ad Copy Rating Labels (Responsive Search Ads)</h3>
          <div className="custom-table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Ad Copy Text</th>
                  <th>Type</th>
                  <th>Rating</th>
                  <th>Impressions</th>
                  <th>Clicks</th>
                  <th>CTR</th>
                  <th>Cost</th>
                  <th>Conversions</th>
                </tr>
              </thead>
              <tbody>
                {creatives.map((cr, idx) => {
                  const imps = cr.impressions || 0;
                  const clicks = cr.clicks || 0;
                  const ctr = imps > 0 ? (clicks / imps) * 100 : 0;
                  const cost = cr.cost || 0;
                  const conv = cr.conversions || 0;

                  return (
                    <tr key={idx}>
                      <td style={{ fontSize: '13px', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                        "{cr.asset_content}"
                      </td>
                      <td>
                        <span className="badge badge-info" style={{ fontSize: '10px' }}>{cr.type}</span>
                      </td>
                      <td>
                        <span className={`badge ${
                          cr.rating === 'BEST' ? 'badge-success' : cr.rating === 'GOOD' ? 'badge-info' : 'badge-danger'
                        }`}>
                          {cr.rating}
                        </span>
                      </td>
                      <td>{imps.toLocaleString()}</td>
                      <td>{clicks.toLocaleString()}</td>
                      <td style={{ fontWeight: 600 }}>{ctr.toFixed(2)}%</td>
                      <td>${cost.toFixed(2)}</td>
                      <td>{conv.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Performance Max Placements exclusions Panel (stacked at bottom) */}
        {placements.length > 0 && (
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ marginBottom: '16px' }}>Performance Max Placements Audit</h3>
            <div className="custom-table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <table className="custom-table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>Placement Domain</th>
                    <th>Clicks</th>
                    <th>Conversions</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {placements.map((p, i) => (
                    <tr key={i}>
                      <td>{p.placement_name}</td>
                      <td>{p.clicks}</td>
                      <td>{p.conversions}</td>
                      <td>
                        <button 
                          className="btn btn-danger" 
                          onClick={() => handlePlacementExclusion(p.placement_name)}
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                        >
                          Exclude
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
