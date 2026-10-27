import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from '../../context/LanguageContext';
import api from '../../api/client';
import {
  ShoppingCart,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  DollarSign,
  Package,
  X,
  CreditCard,
} from 'lucide-react';

export default function AdminPurchaseQueuePage() {
  const { navigate } = useRouter();
  const { isAdmin, isAuthenticated } = useAuth();
  const toast = useToast();
  const { t } = useTranslation();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING');

  // Process Task Modal
  const [activeTask, setActiveTask] = useState(null);
  const [merchantOrderId, setMerchantOrderId] = useState('');
  const [actualCost, setActualCost] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [taskStatus, setTaskStatus] = useState('COMPLETED');
  const [adminNotes, setAdminNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminPurchaseTasks({ status: statusFilter, limit: 50 });
      setTasks(res?.tasks || res?.items || res || []);
    } catch (err) {
      toast.error(err.message || 'Failed to fetch purchase queue.');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchTasks();
    }
  }, [isAuthenticated, isAdmin, statusFilter]);

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="impex-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
        <h3>Admin Access Required</h3>
      </div>
    );
  }

  const handleOpenProcessModal = (t) => {
    setActiveTask(t);
    setMerchantOrderId(t.merchant_order_id || '');
    setActualCost(t.actual_purchase_amount ? String(t.actual_purchase_amount) : '');
    setTrackingNumber(t.merchant_tracking_number || '');
    setTaskStatus('COMPLETED');
    setAdminNotes('');
  };

  const handleProcessSubmit = async (e) => {
    e.preventDefault();
    if (!activeTask) return;

    setSubmitting(true);
    try {
      await api.updateAdminPurchaseTask(activeTask.id, {
        status: taskStatus,
        merchant_order_id: merchantOrderId,
        actual_purchase_amount: actualCost ? parseFloat(actualCost) : null,
        merchant_tracking_number: trackingNumber,
        admin_notes: adminNotes,
      });

      toast.success(`Purchase task #${activeTask.id} marked as ${taskStatus}. Escrow finalized.`);
      setActiveTask(null);
      fetchTasks();
    } catch (err) {
      toast.error(err.message || 'Failed to update purchase task.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Store Procurement Queue</h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Process international purchases from Amazon, eBay, AliExpress, and SHEIN
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {['PENDING', 'COMPLETED', 'FAILED', ''].map((st) => (
            <button
              key={st || 'all'}
              onClick={() => setStatusFilter(st)}
              className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: 'var(--radius-full)' }}
            >
              {st || 'All Tasks'}
            </button>
          ))}
        </div>
      </div>

      {/* Task Queue Table */}
      <div className="impex-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '2rem' }}>
            <div className="skeleton" style={{ height: '40px', width: '100%', marginBottom: '0.5rem' }} />
            <div className="skeleton" style={{ height: '40px', width: '100%' }} />
          </div>
        ) : tasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: 'var(--text-muted)' }}>
            No purchase tasks currently pending in the queue.
          </div>
        ) : (
          <div className="impex-table-container" style={{ border: 'none' }}>
            <table className="impex-table">
              <thead>
                <tr>
                  <th>Task #</th>
                  <th>Order #</th>
                  <th>Merchant</th>
                  <th>Item Title</th>
                  <th>Estimated Price</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Procurement</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>#{t.id}</td>
                    <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                      #{t.order_id || t.order_number}
                    </td>
                    <td>
                      <span className="badge badge-primary">{t.merchant || 'Amazon'}</span>
                    </td>
                    <td>
                      <div style={{ maxWidth: '280px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
                        {t.product_title || t.item_title || 'Store Item'}
                      </div>
                      {t.product_url && (
                        <a
                          href={t.product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.15rem' }}
                        >
                          <span>Open Store Link</span>
                          <ExternalLink size={11} />
                        </a>
                      )}
                    </td>
                    <td style={{ fontWeight: 700 }}>
                      ${Number(t.estimated_unit_price || t.estimated_price || 0).toFixed(2)}
                    </td>
                    <td>
                      <span className={`badge ${t.status === 'COMPLETED' ? 'badge-success' : t.status === 'FAILED' ? 'badge-danger' : 'badge-warning'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => handleOpenProcessModal(t)}
                        className="btn btn-primary btn-sm"
                      >
                        {t.status === 'COMPLETED' ? 'View Details' : 'Process Purchase'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Procurement Process Modal */}
      {activeTask && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            onClick={() => setActiveTask(null)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.5)',
              backdropFilter: 'blur(3px)',
            }}
          />

          <div
            className="modal-responsive-card"
            style={{ maxWidth: '520px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                  Procure Item #{activeTask.id}
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Merchant: {activeTask.merchant} • Order #{activeTask.order_id}
                </p>
              </div>
              <button onClick={() => setActiveTask(null)} style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Florida Depot Address Box for Purchaser */}
            <div
              style={{
                backgroundColor: 'var(--bg-muted)',
                borderRadius: 'var(--radius-md)',
                padding: '0.875rem 1rem',
                fontSize: '0.8125rem',
                marginBottom: '1.25rem',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '0.25rem' }}>
                Ship to Official IMPEX Depot:
              </div>
              <div>IMPEX Logistics Florida Facility, 8400 NW 25th St</div>
              <div>Suite #IMX-{activeTask.user_id || '7740'}</div>
              <div>Doral, FL 33198</div>
            </div>

            <form onSubmit={handleProcessSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  {t('admin.purchaseForm.merchantOrderIdLabel')}
                </label>
                <input
                  type="text"
                  placeholder="e.g. 112-9842918-4928192 (Amazon)"
                  value={merchantOrderId}
                  onChange={(e) => setMerchantOrderId(e.target.value)}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  {t('admin.purchaseForm.actualPriceLabel')}
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 600, color: 'var(--text-muted)' }}>$</span>
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={actualCost}
                    onChange={(e) => setActualCost(e.target.value)}
                    className="input-field"
                    style={{ paddingLeft: '2rem' }}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  {t('admin.purchaseForm.merchantTrackingLabel')}
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1Z9999999999999999 (UPS / FedEx / USPS)"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  {t('admin.purchaseForm.taskStatusLabel')}
                </label>
                <select
                  value={taskStatus}
                  onChange={(e) => setTaskStatus(e.target.value)}
                  className="input-field"
                >
                  <option value="COMPLETED">{t('admin.purchaseForm.taskCompleted')}</option>
                  <option value="PENDING">{t('admin.purchaseForm.taskPending')}</option>
                  <option value="FAILED">{t('admin.purchaseForm.taskFailed')}</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  {t('admin.purchaseForm.notesLabel')}
                </label>
                <textarea
                  rows={2}
                  placeholder="Card used, seller notes..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="input-field"
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setActiveTask(null)} className="btn btn-secondary" style={{ flex: 1 }}>
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary" style={{ flex: 1 }}>
                  {submitting ? <span className="spinner" /> : t('common.confirm', 'Confirm & Finalize')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
