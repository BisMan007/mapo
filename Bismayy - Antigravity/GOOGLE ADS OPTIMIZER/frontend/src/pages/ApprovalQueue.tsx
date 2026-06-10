import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Edit, AlertCircle, RefreshCw } from 'lucide-react';

interface Recommendation {
  id: number;
  campaign_id: string;
  campaign_name: string;
  ad_group_id: string;
  ad_group_name: string;
  type: string;
  details: string; // JSON string
  status: string;
  safety_status: string;
  safety_notes: string;
  created_at: string;
  error_message?: string;
}

export default function ApprovalQueue() {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [actioningId, setActioningId] = useState<number | null>(null);
  
  // Edit Modal State
  const [editingRec, setEditingRec] = useState<Recommendation | null>(null);
  const [editedDetails, setEditedDetails] = useState<any>(null);
  const [editNotes, setEditNotes] = useState('');
  const [userNotes, setUserNotes] = useState('');

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/recommendations');
      const data = await res.json();
      setRecs(data);
    } catch (err) {
      console.error('Failed to load queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleApprove = async (id: number, notes: string = '') => {
    setActioningId(id);
    try {
      const res = await fetch(`/api/recommendations/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes || userNotes })
      });
      const data = await res.json();
      if (data.success) {
        await fetchQueue();
        setUserNotes('');
      } else {
        alert(`Failed to apply mutation: ${data.error}`);
        await fetchQueue();
      }
    } catch (err) {
      console.error('Approval failed:', err);
    } finally {
      setActioningId(null);
    }
  };

  const handleDismiss = async (id: number, notes: string = '') => {
    setActioningId(id);
    try {
      await fetch(`/api/recommendations/${id}/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes || 'Dismissed via Queue view' })
      });
      await fetchQueue();
    } catch (err) {
      console.error('Dismiss failed:', err);
    } finally {
      setActioningId(null);
    }
  };

  const openEditModal = (rec: Recommendation) => {
    setEditingRec(rec);
    setEditedDetails(JSON.parse(rec.details));
    setEditNotes('');
  };

  const saveEdit = async () => {
    if (!editingRec) return;
    setActioningId(editingRec.id);
    try {
      const res = await fetch(`/api/recommendations/${editingRec.id}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ details: editedDetails, notes: editNotes })
      });
      const data = await res.json();
      if (data.success) {
        setEditingRec(null);
        await fetchQueue();
      } else {
        alert(`Edit validation failed: ${data.error}`);
      }
    } catch (err) {
      console.error('Edit failed:', err);
    } finally {
      setActioningId(null);
    }
  };

  const handleBulkApprove = async () => {
    const passedRecs = recs.filter((r) => r.safety_status === 'PASSED');
    if (passedRecs.length === 0) return;
    
    setLoading(true);
    for (const r of passedRecs) {
      try {
        await fetch(`/api/recommendations/${r.id}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: 'Bulk Approval execution' })
        });
      } catch (err) {
        console.error(`Bulk approval failed for rec ID ${r.id}:`, err);
      }
    }
    await fetchQueue();
    setLoading(false);
  };

  const parseDetailsText = (type: string, detailsStr: string) => {
    try {
      const d = JSON.parse(detailsStr);
      if (type === 'ADD_NEGATIVE_KEYWORD') return `Add Negative exact: "${d.keyword}"`;
      if (type === 'ADD_EXACT_KEYWORD') return `Add Exact: "${d.keyword}" at $${d.suggested_bid?.toFixed(2)} CPC`;
      if (type === 'ADJUST_KEYWORD_BID') return `Adjust "${d.keyword}" bid: $${d.current_bid?.toFixed(2)} -> $${d.suggested_bid?.toFixed(2)}`;
      if (type === 'ADJUST_DAILY_BUDGET') return `Adjust budget: $${d.current_budget?.toFixed(0)} -> $${d.suggested_budget?.toFixed(0)}`;
      if (type === 'ADJUST_GEO_BID') return `Set geo modifier for "${d.location_name}": ${d.suggested_modifier}%`;
      if (type === 'ADJUST_DEVICE_BID') return `Set mobile bid modifier: ${d.suggested_modifier}%`;
      if (type === 'EXCLUDE_DEMOGRAPHIC') return `Exclude Age/Gender cohort: ${d.age_range?.replace('AGE_RANGE_', '')}`;
      if (type === 'ADD_PMAX_PLACEMENT_EXCLUSION') return `Exclude Placement URL: "${d.placement}"`;
      if (type === 'REDIRECT_LANDING_PAGE') return `Redirect URL: ${d.current_url.substring(0, 20)}... -> ${d.suggested_url}`;
      return `Taxonomy: ${type}`;
    } catch {
      return 'Details payload corrupted.';
    }
  };

  return (
    <div>
      <div className="top-status-bar">
        <div>
          <h2>Central Recommendations Queue</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Approve queued optimization recommendations, modify bid parameters, or dismiss irrelevant alerts.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={fetchQueue} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh Queue
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleBulkApprove} 
            disabled={recs.filter((r) => r.safety_status === 'PASSED').length === 0 || loading}
          >
            Bulk Approve Safe Items
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
        {loading && recs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <RefreshCw className="animate-spin" size={32} />
          </div>
        ) : recs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
            🎉 Queue is clean! No pending recommendations left to audit.
          </div>
        ) : (
          <div className="custom-table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Campaign / Ad Group</th>
                  <th>Action Type</th>
                  <th>Proposal Details</th>
                  <th>Safety Verification</th>
                  <th>Action Controls</th>
                </tr>
              </thead>
              <tbody>
                {recs.map((r) => (
                  <tr key={r.id} style={{ opacity: actioningId === r.id ? 0.5 : 1 }}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.campaign_name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{r.ad_group_name || 'Campaign Level'}</div>
                    </td>
                    <td>
                      <span className="badge badge-info" style={{ fontSize: '11px' }}>{r.type}</span>
                    </td>
                    <td style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '300px' }}>
                      {parseDetailsText(r.type, r.details)}
                    </td>
                    <td>
                      <span className={`badge ${r.safety_status === 'PASSED' ? 'badge-success' : 'badge-danger'}`}>
                        {r.safety_status}
                      </span>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', maxWidth: '200px' }}>
                        {r.safety_notes}
                      </p>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          className="btn btn-primary" 
                          onClick={() => handleApprove(r.id)}
                          disabled={actioningId === r.id || r.safety_status === 'FAILED'}
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                        >
                          Approve
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          onClick={() => openEditModal(r)}
                          disabled={actioningId === r.id}
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                        >
                          <Edit size={12} />
                        </button>
                        <button 
                          className="btn btn-danger" 
                          onClick={() => handleDismiss(r.id)}
                          disabled={actioningId === r.id}
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                        >
                          Dismiss
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal Dialog */}
      {editingRec && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content">
            <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Edit color="var(--primary)" />
              Modify Recommendation Parameters
            </h3>
            
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Adjust proposed budget or CPC bidding parameters. All modifications are re-verified by the Audit Agent.
            </p>

            {/* Render conditional inputs depending on type */}
            {editingRec.type === 'ADJUST_KEYWORD_BID' && (
              <div>
                <div className="form-group">
                  <label className="form-label">Keyword</label>
                  <input type="text" className="form-control" value={editedDetails.keyword} disabled />
                </div>
                <div className="form-group">
                  <label className="form-label">Suggested Bid Max CPC ($)</label>
                  <input 
                    type="number" 
                    step="0.05"
                    className="form-control" 
                    value={editedDetails.suggested_bid} 
                    onChange={(e) => setEditedDetails({ ...editedDetails, suggested_bid: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
            )}

            {editingRec.type === 'ADJUST_DAILY_BUDGET' && (
              <div>
                <div className="form-group">
                  <label className="form-label">Campaign</label>
                  <input type="text" className="form-control" value={editingRec.campaign_name} disabled />
                </div>
                <div className="form-group">
                  <label className="form-label">Suggested Daily Budget ($)</label>
                  <input 
                    type="number" 
                    step="1"
                    className="form-control" 
                    value={editedDetails.suggested_budget} 
                    onChange={(e) => setEditedDetails({ ...editedDetails, suggested_budget: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
            )}

            {editingRec.type === 'ADD_NEGATIVE_KEYWORD' && (
              <div>
                <div className="form-group">
                  <label className="form-label">Negative Phrase Keyword</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={editedDetails.keyword} 
                    onChange={(e) => setEditedDetails({ ...editedDetails, keyword: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Change Log Notes (Saved to Audit Log)</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="e.g. Lowering bid to adhere to regional budget constraints."
                value={editNotes} 
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button className="btn btn-secondary" onClick={() => setEditingRec(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={saveEdit}>
                Validate & Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
