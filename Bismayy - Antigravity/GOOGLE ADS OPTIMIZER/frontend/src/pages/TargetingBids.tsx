import React, { useState, useEffect } from 'react';
import { Smartphone, MapPin, Users, Clock, Calendar } from 'lucide-react';

interface SegmentData {
  id?: number;
  device_type?: string;
  location_name?: string;
  age_range?: string;
  gender?: string;
  hour?: number;
  day?: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
}

export default function TargetingBids({ dateRange }: { dateRange: string }) {
  const [devices, setDevices] = useState<SegmentData[]>([]);
  const [locations, setLocations] = useState<SegmentData[]>([]);
  const [demographics, setDemographics] = useState<SegmentData[]>([]);
  const [hours, setHours] = useState<SegmentData[]>([]);
  const [days, setDays] = useState<SegmentData[]>([]);
  const [activeTab, setActiveTab] = useState<'devices' | 'locations' | 'demographics' | 'scheduling'>('devices');

  const fetchData = async () => {
    try {
      const devRes = await fetch(`/api/reports/data/devices?range=${dateRange}`);
      const devData = await devRes.json();
      setDevices(devData);

      const locRes = await fetch(`/api/reports/data/locations?range=${dateRange}`);
      const locData = await locRes.json();
      setLocations(locData);

      const demRes = await fetch(`/api/reports/data/demographics?range=${dateRange}`);
      const demData = await demRes.json();
      setDemographics(demData);

      const hrRes = await fetch(`/api/reports/data/hour-of-day?range=${dateRange}`);
      const hrData = await hrRes.json();
      setHours(hrData);

      const dyRes = await fetch(`/api/reports/data/day-of-week?range=${dateRange}`);
      const dyData = await dyRes.json();
      setDays(dyData);
    } catch (err) {
      console.error('Failed to load targeting data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange]);


  const calculateCPA = (cost: number, conversions: number) => {
    return conversions > 0 ? (cost / conversions).toFixed(2) : 'N/A';
  };

  // Helper to suggest bid modifiers based on segment metrics
  const getSuggestedModifier = (cost: number, conversions: number) => {
    if (conversions === 0 && cost > 50) return '-15%';
    if (conversions > 10 && cost / conversions < 35.0) return '+10%';
    return '0%';
  };

  return (
    <div>
      <div className="top-status-bar">
        <div>
          <h2>Targeting & Bid Adjustments Workspace</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Compare conversion matrices across multiple dimensions and fine-tune bid modifiers.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
        <button 
          className={`btn ${activeTab === 'devices' ? 'btn-primary' : 'btn-secondary'}`} 
          onClick={() => setActiveTab('devices')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Smartphone size={16} /> Devices
        </button>
        <button 
          className={`btn ${activeTab === 'locations' ? 'btn-primary' : 'btn-secondary'}`} 
          onClick={() => setActiveTab('locations')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <MapPin size={16} /> Locations
        </button>
        <button 
          className={`btn ${activeTab === 'demographics' ? 'btn-primary' : 'btn-secondary'}`} 
          onClick={() => setActiveTab('demographics')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Users size={16} /> Demographics
        </button>
        <button 
          className={`btn ${activeTab === 'scheduling' ? 'btn-primary' : 'btn-secondary'}`} 
          onClick={() => setActiveTab('scheduling')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Clock size={16} /> Scheduling (Hour/Day)
        </button>
      </div>

      {/* Tab Panels */}
      <div className="glass-panel" style={{ padding: '28px' }}>
        {activeTab === 'devices' && (
          <div>
            <h3 style={{ marginBottom: '16px' }}>Device Conversion Matrix</h3>
            <div className="custom-table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Device Type</th>
                    <th>Campaign</th>
                    <th>Impressions</th>
                    <th>Clicks</th>
                    <th>Cost</th>
                    <th>Conversions</th>
                    <th>CPA</th>
                    <th>Suggested Modifier</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((d, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{d.device_type}</td>
                      <td>{d.campaign_name}</td>
                      <td>{d.impressions.toLocaleString()}</td>
                      <td>{d.clicks.toLocaleString()}</td>
                      <td>${d.cost.toFixed(2)}</td>
                      <td>{d.conversions}</td>
                      <td>${calculateCPA(d.cost, d.conversions)}</td>
                      <td>
                        <span className={`badge ${
                          getSuggestedModifier(d.cost, d.conversions).includes('-') ? 'badge-danger' : getSuggestedModifier(d.cost, d.conversions).includes('+') ? 'badge-success' : 'badge-info'
                        }`}>
                          {getSuggestedModifier(d.cost, d.conversions)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'locations' && (
          <div>
            <h3 style={{ marginBottom: '16px' }}>Geographical Performance Matrix</h3>
            <div className="custom-table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Location Region</th>
                    <th>Campaign</th>
                    <th>Impressions</th>
                    <th>Clicks</th>
                    <th>Cost</th>
                    <th>Conversions</th>
                    <th>CPA</th>
                    <th>Suggested Modifier</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map((l, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{l.location_name}</td>
                      <td>{l.campaign_name}</td>
                      <td>{l.impressions.toLocaleString()}</td>
                      <td>{l.clicks.toLocaleString()}</td>
                      <td>${l.cost.toFixed(2)}</td>
                      <td>{l.conversions}</td>
                      <td>${calculateCPA(l.cost, l.conversions)}</td>
                      <td>
                        <span className={`badge ${
                          getSuggestedModifier(l.cost, l.conversions).includes('-') ? 'badge-danger' : getSuggestedModifier(l.cost, l.conversions).includes('+') ? 'badge-success' : 'badge-info'
                        }`}>
                          {getSuggestedModifier(l.cost, l.conversions)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'demographics' && (
          <div>
            <h3 style={{ marginBottom: '16px' }}>Age & Gender Performance Matrix</h3>
            <div className="custom-table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Age Bracket</th>
                    <th>Gender</th>
                    <th>Campaign</th>
                    <th>Impressions</th>
                    <th>Clicks</th>
                    <th>Cost</th>
                    <th>Conversions</th>
                    <th>CPA</th>
                    <th>Suggested Modifier</th>
                  </tr>
                </thead>
                <tbody>
                  {demographics.map((dem, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{dem.age_range?.replace('AGE_RANGE_', '') || 'Unknown'}</td>
                      <td>{dem.gender?.replace('GENDER_', '') || 'Unknown'}</td>
                      <td>{dem.campaign_name}</td>
                      <td>{dem.impressions.toLocaleString()}</td>
                      <td>{dem.clicks.toLocaleString()}</td>
                      <td>${dem.cost.toFixed(2)}</td>
                      <td>{dem.conversions}</td>
                      <td>${calculateCPA(dem.cost, dem.conversions)}</td>
                      <td>
                        <span className={`badge ${
                          getSuggestedModifier(dem.cost, dem.conversions).includes('-') ? 'badge-danger' : getSuggestedModifier(dem.cost, dem.conversions).includes('+') ? 'badge-success' : 'badge-info'
                        }`}>
                          {getSuggestedModifier(dem.cost, dem.conversions)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'scheduling' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
            <div>
              <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} /> Hourly Performance
              </h3>
              <div className="custom-table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table className="custom-table" style={{ fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th>Hour</th>
                      <th>Conversions</th>
                      <th>Cost</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hours.map((h, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{String(h.hour).padStart(2, '0')}:00</td>
                        <td>{h.conversions}</td>
                        <td>${h.cost.toFixed(2)}</td>
                        <td>
                          {h.conversions === 0 && h.cost > 40 ? (
                            <span className="badge badge-danger">Exclude</span>
                          ) : (
                            <span className="badge badge-info">Normal</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={18} /> Day-of-Week Performance
              </h3>
              <div className="custom-table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table className="custom-table" style={{ fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Conversions</th>
                      <th>Cost</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((d, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{d.day}</td>
                        <td>{d.conversions}</td>
                        <td>${d.cost.toFixed(2)}</td>
                        <td>
                          {d.conversions === 0 && d.cost > 50 ? (
                            <span className="badge badge-danger">Bid Modifier</span>
                          ) : (
                            <span className="badge badge-info">Normal</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
