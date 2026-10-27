import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../api/client';
import {
  Store,
  CheckCircle2,
  AlertCircle,
  Key,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Info,
  Clock,
  Layers,
  Database,
  Play,
  FileText,
} from 'lucide-react';

export default function AdminMerchantsPage() {
  const { isAdmin, isAuthenticated } = useAuth();
  const toast = useToast();
  const [merchants, setMerchants] = useState([]);
  const [awinStatus, setAwinStatus] = useState(null);
  const [awinLogs, setAwinLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  const fetchIntegrationData = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminIntegrationsStatus();
      if (res) {
        setMerchants(Array.isArray(res.merchants) ? res.merchants : []);
        setAwinStatus(res.awin || null);
      }
    } catch {
      try {
        const data = await api.getAdminMerchants();
        setMerchants(Array.isArray(data) ? data : []);
      } catch (err) {
        toast.error(err.message || 'Failed to fetch merchant statuses.');
        setMerchants([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAwinLogs = async () => {
    try {
      const res = await api.getAwinLogs({ page: 1, limit: 10 });
      setAwinLogs(res?.logs || []);
    } catch {
      setAwinLogs([]);
    }
  };

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchIntegrationData();
      fetchAwinLogs();
    }
  }, [isAuthenticated, isAdmin]);

  const handleTriggerAwinSync = async (merchantSlug = null) => {
    setSyncLoading(true);
    try {
      const res = await api.triggerAwinSync(merchantSlug);
      toast.success(res?.message || 'Awin feed sync job executed successfully!');
      await fetchIntegrationData();
      await fetchAwinLogs();
    } catch (err) {
      toast.error(err.message || 'Failed to run Awin feed sync.');
    } finally {
      setSyncLoading(false);
    }
  };

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="impex-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
        <ShieldCheck size={48} style={{ color: 'var(--danger)', margin: '0 auto 1rem' }} />
        <h3>Admin Access Required</h3>
      </div>
    );
  }

  const merchantLogos = {
    amazon: '🛒',
    shein: '👗',
    aliexpress: '📦',
    ebay: '🏷️',
    fashionnova: '✨',
    hm: '🧥',
    temu: '⚡',
    walmart: '🏬',
    custom: '🌐',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span className="badge badge-primary">
              <ShieldCheck size={12} />
              <span>Phase 1 Integrated Stores</span>
            </span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Store Adapters & Integration Health</h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Real-time connectivity status, Awin affiliate feeds, and API credentials for all 8 supported merchants
          </p>
        </div>

        <button
          onClick={() => {
            fetchIntegrationData();
            fetchAwinLogs();
          }}
          disabled={loading}
          className="btn btn-secondary btn-sm"
          style={{ gap: '0.35rem' }}
        >
          <RefreshCw size={14} className={loading ? 'spinner' : ''} />
          <span>Refresh Health</span>
        </button>
      </div>

      {/* AWIN PRODUCT FEED STATUS CARD */}
      <div
        className="impex-card"
        style={{
          border: '1px solid var(--border)',
          backgroundColor: '#ffffff',
          padding: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
              }}
            >
              <Database size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Awin Affiliate Product Feed Engine</h2>
                <span className="badge badge-muted" style={{ backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                  Paused (URL-Only Mode)
                </span>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Feed sync is temporarily disabled while PRODUCT_SOURCE_MODE=url_only. Customer orders are processed exclusively via submitted product URLs.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="btn btn-secondary btn-sm"
              style={{ gap: '0.35rem' }}
            >
              <FileText size={14} />
              <span>{showLogs ? 'Hide Logs' : 'View Sync Logs'}</span>
            </button>
            <button
              onClick={() => handleTriggerAwinSync(null)}
              disabled={syncLoading}
              className="btn btn-primary btn-sm"
              style={{ gap: '0.4rem' }}
            >
              <Play size={14} className={syncLoading ? 'spinner' : ''} />
              <span>{syncLoading ? 'Syncing...' : 'Trigger Feed Sync'}</span>
            </button>
          </div>
        </div>

        {/* Awin Metrics Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
            gap: '1rem',
            backgroundColor: 'var(--bg-muted)',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>API Token Status</div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: awinStatus?.api_key_present ? 'var(--success)' : 'var(--warning-text)' }}>
              {awinStatus?.api_key_present ? '● Verified (AWIN_API_TOKEN)' : '○ Missing Key'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Publisher ID</div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: awinStatus?.publisher_id_present ? 'var(--success)' : 'var(--warning-text)' }}>
              {awinStatus?.publisher_id_present ? '● Configured' : '○ Missing ID'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Synced Products</div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {Number(awinStatus?.total_synced_products || 0).toLocaleString()} items
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Last Synchronization</div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {awinStatus?.last_sync ? new Date(awinStatus.last_sync).toLocaleString() : 'Never Synced'}
            </div>
          </div>
        </div>

        {/* Sync Logs Table */}
        {showLogs && (
          <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-light)' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem' }}>Recent Feed Sync Audit History</h3>
            {awinLogs.length === 0 ? (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No feed synchronization logs recorded yet.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.5rem' }}>Started</th>
                      <th style={{ padding: '0.5rem' }}>Status</th>
                      <th style={{ padding: '0.5rem' }}>Records</th>
                      <th style={{ padding: '0.5rem' }}>Imported</th>
                      <th style={{ padding: '0.5rem' }}>Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {awinLogs.map((log) => (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '0.5rem' }}>{new Date(log.started_at).toLocaleString()}</td>
                        <td style={{ padding: '0.5rem' }}>
                          <span className={`badge ${log.status === 'SUCCESS' ? 'badge-success' : log.status === 'FAILED' ? 'badge-danger' : 'badge-muted'}`}>
                            {log.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.5rem' }}>{log.total_records || 0}</td>
                        <td style={{ padding: '0.5rem', color: 'var(--success)', fontWeight: 600 }}>{log.imported_records || 0}</td>
                        <td style={{ padding: '0.5rem', color: log.error_count > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{log.error_count || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Summary Info Alert */}
      <div
        className="impex-card"
        style={{
          backgroundColor: '#ffffff',
          borderLeft: '4px solid var(--primary)',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          gap: '1rem',
          alignItems: 'flex-start',
        }}
      >
        <Info size={22} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '0.875rem', lineHeight: '1.5' }}>
          <strong style={{ color: 'var(--text-primary)' }}>Merchant Integration Architecture:</strong>
          <span style={{ color: 'var(--text-secondary)', marginLeft: '0.35rem' }}>
            All 8 target international merchants (Amazon US, SHEIN US, AliExpress, eBay, Fashion Nova, H&M, Temu, Walmart) are active for <strong>Order by Link</strong> and <strong>Screenshot Ordering</strong>. eBay is fully operational with live API catalog queries. For merchants awaiting official affiliate/partner credentials, IMPEX safely routes orders through the <strong>Admin Verification & Purchase Queue</strong>.
          </span>
        </div>
      </div>

      {/* Merchants Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '1.25rem' }}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="impex-card" style={{ height: '260px' }}>
              <div className="skeleton" style={{ height: '40px', width: '50%', marginBottom: '1rem' }} />
              <div className="skeleton" style={{ height: '20px', width: '80%', marginBottom: '0.5rem' }} />
              <div className="skeleton" style={{ height: '80px', width: '100%' }} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '1.25rem' }}>
          {merchants.map((m) => {
            const logo = merchantLogos[m.merchant_id] || '🏬';
            const isConfigured = m.is_configured;
            const hasPublicApi = m.has_public_api;
            const missingKeys = m.missing_keys || [];

            return (
              <div
                key={m.merchant_id}
                className="impex-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderTop: isConfigured ? '3px solid var(--success)' : '3px solid var(--primary)',
                }}
              >
                <div>
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div
                        style={{
                          fontSize: '1.75rem',
                          width: '44px',
                          height: '44px',
                          borderRadius: '10px',
                          backgroundColor: 'var(--bg-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {logo}
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>{m.display_name}</h3>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {m.api_name || 'Standard Gateway'}
                        </span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    {isConfigured ? (
                      <span className="badge badge-success" style={{ gap: '0.25rem' }}>
                        <CheckCircle2 size={12} />
                        <span>API Configured</span>
                      </span>
                    ) : hasPublicApi ? (
                      <span className="badge badge-warning" style={{ gap: '0.25rem' }}>
                        <Key size={12} />
                        <span>Awaiting Keys</span>
                      </span>
                    ) : (
                      <span className="badge badge-primary" style={{ gap: '0.25rem' }}>
                        <ShieldCheck size={12} />
                        <span>Assisted Mode</span>
                      </span>
                    )}
                  </div>

                  {/* API Credentials Diagnostic Section */}
                  <div
                    style={{
                      backgroundColor: 'var(--bg-muted)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.875rem',
                      marginBottom: '1rem',
                      fontSize: '0.8125rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                      border: '1px solid var(--border-light)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Official Public API:</span>
                      <strong style={{ color: hasPublicApi ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {hasPublicApi ? 'Yes (Developer Program)' : 'No (Assisted Ordering)'}
                      </strong>
                    </div>

                    {/* Missing keys list */}
                    {missingKeys.length > 0 ? (
                      <div>
                        <span style={{ color: 'var(--warning-text)', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                          Missing Environment Keys:
                        </span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {missingKeys.map((k) => (
                            <span
                              key={k}
                              style={{
                                fontFamily: 'monospace',
                                fontSize: '0.6875rem',
                                backgroundColor: 'var(--warning-bg)',
                                color: 'var(--warning-text)',
                                border: '1px solid var(--warning-border)',
                                padding: '0.15rem 0.4rem',
                                borderRadius: '4px',
                              }}
                            >
                              {k}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : isConfigured ? (
                      <div style={{ color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <CheckCircle2 size={13} />
                        <span>Credentials verified in server environment.</span>
                      </div>
                    ) : (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        Operates seamlessly via direct URL intake & Admin Purchase Queue.
                      </div>
                    )}
                  </div>

                  {/* Guidance Note */}
                  {m.guide && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '1rem' }}>
                      <strong>Integration Note:</strong> {m.guide}
                    </div>
                  )}

                  {/* Capabilities List */}
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                      Active Capabilities:
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {(m.capabilities || []).map((cap, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: '0.6875rem',
                            backgroundColor: '#ffffff',
                            border: '1px solid var(--border)',
                            padding: '0.2rem 0.5rem',
                            borderRadius: 'var(--radius-sm)',
                            fontWeight: 500,
                          }}
                        >
                          {cap.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer status row */}
                <div
                  style={{
                    borderTop: '1px solid var(--border-light)',
                    paddingTop: '0.75rem',
                    marginTop: '1.25rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <span>Procurement: Admin Purchase Queue</span>
                  <span style={{ color: 'var(--success)', fontWeight: 700 }}>● Active in Store</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
