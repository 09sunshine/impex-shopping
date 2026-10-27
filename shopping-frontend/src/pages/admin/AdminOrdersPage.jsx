import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from '../../context/LanguageContext';
import api from '../../api/client';
import {
  Package,
  Search,
  Filter,
  CheckCircle2,
  Truck,
  ArrowRight,
  ShieldCheck,
  Edit,
  X,
  ExternalLink,
  DollarSign,
  AlertTriangle,
  Clock,
  QrCode,
  Layers,
  FileText,
  RotateCcw,
  User,
  Phone,
  MapPin,
  Tag,
  Camera,
  Image as ImageIcon,
} from 'lucide-react';

export default function AdminOrdersPage() {
  const { navigate } = useRouter();
  const { isAdmin, isAuthenticated } = useAuth();
  const toast = useToast();
  const { t } = useTranslation();

  const [orders, setOrders] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [merchantFilter, setMerchantFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Selected Order Modal / Workflow State
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [activeTab, setActiveTab] = useState('verify'); // 'verify' | 'validate' | 'purchase' | 'shipping' | 'refund' | 'audit'
  const [actionLoading, setActionLoading] = useState(false);

  // Form States for Admin Actions
  // 1. Price Verification
  const [verifiedPrice, setVerifiedPrice] = useState('');
  const [verifiedShipping, setVerifiedShipping] = useState('');
  const [verifiedTax, setVerifiedTax] = useState('');
  const [serviceFee, setServiceFee] = useState('');
  const [quoteNotes, setQuoteNotes] = useState('');

  // 2. Pre-Purchase Validation
  const [currentMerchantPrice, setCurrentMerchantPrice] = useState('');
  const [isStockAvailable, setIsStockAvailable] = useState(true);
  const [validationResult, setValidationResult] = useState(null);

  // 3. Purchase Completion
  const [merchantOrderId, setMerchantOrderId] = useState('');
  const [actualPrice, setActualPrice] = useState('');
  const [actualShipping, setActualShipping] = useState('');
  const [actualTax, setActualTax] = useState('');
  const [actualTotal, setActualTotal] = useState('');
  const [merchantTrackingNo, setMerchantTrackingNo] = useState('');
  const [purchaseNotes, setPurchaseNotes] = useState('');

  // 4. Logistics
  const [carrier, setCarrier] = useState('FedEx');
  const [shippingTracking, setShippingTracking] = useState('');
  const [arrivedNotes, setArrivedNotes] = useState('');
  const [pickupCodeInput, setPickupCodeInput] = useState('');
  const [pickupCollectorName, setPickupCollectorName] = useState('');

  // 5. Refund
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  // 6. Reject
  const [rejectReason, setRejectReason] = useState('');

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminOrders({
        status: statusFilter,
        merchant: merchantFilter,
        search: searchFilter,
        page,
        limit,
      });
      const list = Array.isArray(res) ? res : (res?.orders || res?.items || []);
      setOrders(list);
      setTotalCount(res?.total || list.length);
    } catch (err) {
      toast.error(err.message || 'Failed to fetch admin orders.');
      setOrders([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchOrders();
      const poll = setInterval(() => {
        // Silently poll in background to keep admin queue live-synced
        api.getAdminOrders({
          status: statusFilter,
          merchant: merchantFilter,
          search: searchFilter,
          page,
          limit,
        }).then((res) => {
          const list = Array.isArray(res) ? res : (res?.orders || res?.items || []);
          setOrders(list);
          setTotalCount(res?.total || list.length);
          if (selectedOrder) {
            const updated = list.find((o) => o.id === selectedOrder.id);
            if (updated) setSelectedOrder(updated);
          }
        }).catch(() => {});
      }, 15000);
      return () => clearInterval(poll);
    }
  }, [isAuthenticated, isAdmin, statusFilter, merchantFilter, page, selectedOrder?.id]);

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="impex-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', maxWidth: '520px', margin: '2rem auto' }}>
        <ShieldCheck size={48} style={{ color: 'var(--danger)', margin: '0 auto 1rem' }} />
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Admin Access Required</h3>
        <p style={{ color: 'var(--text-muted)' }}>You must be an authenticated administrator or staff member.</p>
      </div>
    );
  }

  const handleOpenDetailModal = (o) => {
    setSelectedOrder(o);

    // Pre-populate forms based on current order state immediately
    setVerifiedPrice(o.verified_product_price || o.customer_estimated_price || '');
    setVerifiedShipping(o.international_shipping_fee || '15.00');
    setVerifiedTax('');
    setServiceFee(o.service_fee || '8.00');
    setQuoteNotes('');

    setCurrentMerchantPrice(o.verified_product_price || o.customer_estimated_price || '');
    setIsStockAvailable(true);
    setValidationResult(null);

    setMerchantOrderId(o.merchant_order_id || '');
    setActualPrice(o.verified_product_price || '');
    setActualShipping(o.international_shipping_fee || '');
    setActualTax('');
    setActualTotal(o.quoted_total || '');
    setMerchantTrackingNo(o.merchant_tracking_number || '');
    setPurchaseNotes('');

    setShippingTracking(o.merchant_tracking_number || '');
    setPickupCodeInput('');

    // Default tab based on current status
    if (['SUBMITTED', 'UNDER_REVIEW'].includes(o.status)) {
      setActiveTab('verify');
    } else if (['FUNDS_RESERVED', 'PURCHASE_PROCESSING'].includes(o.status)) {
      setActiveTab('validate');
    } else if (['PURCHASE_COMPLETED', 'MERCHANT_SHIPPED', 'INTERNATIONAL_TRANSIT', 'ARRIVED_AT_IMPEX'].includes(o.status)) {
      setActiveTab('shipping');
    } else {
      setActiveTab('verify');
    }

    // Silently enrich with latest details in background without delaying modal opening
    api.getAdminOrder(o.id).then((fresh) => {
      if (fresh) setSelectedOrder(fresh);
    }).catch(() => {});
  };

  // 1. Submit Price Verification & Generate Quote
  const handleVerifyPriceAndQuote = async (e) => {
    e.preventDefault();
    if (!verifiedPrice || parseFloat(verifiedPrice) <= 0) {
      toast.error('Please enter a valid verified product price.');
      return;
    }

    setActionLoading(true);
    try {
      await api.verifyPriceAndQuote(selectedOrder.id, {
        verified_product_price: parseFloat(verifiedPrice),
        verified_shipping_cost: verifiedShipping ? parseFloat(verifiedShipping) : 0.0,
        verified_tax: verifiedTax ? parseFloat(verifiedTax) : 0.0,
        service_fee: serviceFee ? parseFloat(serviceFee) : undefined,
        notes: quoteNotes || undefined,
        valid_minutes: 60,
      });
      toast.success('Official quote generated! Order is now awaiting customer confirmation.');
      setSelectedOrder(null);
      fetchOrders();
    } catch (err) {
      toast.error(err.message || 'Failed to generate quote.');
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Perform Pre-Purchase Validation Check
  const handlePrePurchaseValidation = async () => {
    if (!currentMerchantPrice || parseFloat(currentMerchantPrice) <= 0) {
      toast.error('Please enter current verified merchant price.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await api.prePurchaseValidation(selectedOrder.id, {
        current_merchant_price: parseFloat(currentMerchantPrice),
        is_available: isStockAvailable,
        is_variant_available: true,
      });
      setValidationResult(res);
      if (res.result === 'VALID') {
        toast.success('Pre-purchase validation passed! Purchase authorized.');
        setActiveTab('purchase');
      } else {
        toast.warning(`Validation result: ${res.result} - ${res.message}`);
      }
    } catch (err) {
      toast.error(err.message || 'Validation check failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Complete Actual Purchase
  const authorizedAmount = Number(selectedOrder?.quoted_total || 0);
  const enteredActualTotal = parseFloat(actualTotal || (parseFloat(actualPrice || 0) + parseFloat(actualShipping || 0) + parseFloat(actualTax || 0)));
  const isOverAuthorized = enteredActualTotal > authorizedAmount && authorizedAmount > 0;

  const handleRecordPurchase = async (e) => {
    e.preventDefault();
    if (isOverAuthorized) {
      toast.error('Actual total exceeds customer authorized quote amount! Customer re-approval is required.');
      return;
    }
    if (!merchantOrderId.trim()) {
      toast.error('Please provide the official Merchant Order ID.');
      return;
    }

    setActionLoading(true);
    try {
      await api.recordPurchase(selectedOrder.id, {
        merchant_order_id: merchantOrderId.trim(),
        actual_product_price: parseFloat(actualPrice || 0),
        actual_shipping: actualShipping ? parseFloat(actualShipping) : 0.0,
        actual_tax: actualTax ? parseFloat(actualTax) : 0.0,
        actual_total: enteredActualTotal,
        merchant_tracking_number: merchantTrackingNo.trim() || undefined,
        notes: purchaseNotes || undefined,
      });
      toast.success('Purchase recorded! Any unused remainder has been released back to customer wallet.');
      setSelectedOrder(null);
      fetchOrders();
    } catch (err) {
      toast.error(err.message || 'Failed to record purchase.');
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Mark Shipped
  const handleMarkShipped = async (e) => {
    e.preventDefault();
    if (!shippingTracking.trim()) {
      toast.error('Please provide a tracking number.');
      return;
    }

    setActionLoading(true);
    try {
      await api.markOrderShipped(selectedOrder.id, {
        merchant_tracking_number: shippingTracking.trim(),
        carrier: carrier.trim() || undefined,
      });
      toast.success('Order marked as shipped by merchant.');
      setSelectedOrder(null);
      fetchOrders();
    } catch (err) {
      toast.error(err.message || 'Failed to update shipping.');
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Mark Arrived at IMPEX
  const handleMarkArrived = async () => {
    setActionLoading(true);
    try {
      await api.markOrderArrived(selectedOrder.id, arrivedNotes);
      toast.success('Package marked arrived at IMPEX hub! Pickup code generated.');
      setSelectedOrder(null);
      fetchOrders();
    } catch (err) {
      toast.error(err.message || 'Failed to mark package arrived.');
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Verify Agency Counter Pickup
  const handleVerifyPickup = async (e) => {
    e.preventDefault();
    if (!pickupCodeInput.trim()) {
      toast.error('Please provide the customer pickup code.');
      return;
    }

    setActionLoading(true);
    try {
      await api.verifyAdminPickup(selectedOrder.id, {
        pickupCode: pickupCodeInput.trim(),
        pickedUpByName: pickupCollectorName.trim() || undefined,
      });
      toast.success('Pickup verified! Order marked DELIVERED.');
      setSelectedOrder(null);
      fetchOrders();
    } catch (err) {
      toast.error(err.message || 'Pickup code verification failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // 7. Issue Refund
  const handleRefund = async (e) => {
    e.preventDefault();
    if (!window.confirm('Are you sure you want to refund this order into the customer wallet?')) {
      return;
    }

    setActionLoading(true);
    try {
      await api.refundAdminOrder(selectedOrder.id, {
        amountUsd: refundAmount ? parseFloat(refundAmount) : undefined,
        reason: refundReason || 'Admin issued refund',
      });
      toast.success('Refund credited to customer wallet successfully.');
      setSelectedOrder(null);
      fetchOrders();
    } catch (err) {
      toast.error(err.message || 'Refund failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // 8. Reject Order Request
  const handleRejectOrder = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      toast.error('Please specify a rejection reason for the customer.');
      return;
    }

    setActionLoading(true);
    try {
      await api.rejectAdminOrder(selectedOrder.id, { reason: rejectReason.trim() });
      toast.success('Order rejected. Any reserved funds released.');
      setSelectedOrder(null);
      fetchOrders();
    } catch (err) {
      toast.error(err.message || 'Failed to reject order.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)', fontWeight: 700, fontSize: '0.8125rem' }}>
            <ShieldCheck size={16} />
            <span>{t('admin.consoleBadge')}</span>
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800 }}>{t('admin.ordersTitle')}</h1>
        </div>

        <button onClick={fetchOrders} className="btn btn-secondary btn-sm" disabled={loading}>
          <span>{t('common.refresh')}</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="impex-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '1rem', alignItems: 'center' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
              {t('common.filter')} {t('common.status')}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="input"
              style={{ height: '38px', fontSize: '0.8125rem' }}
            >
              <option value="">{t('admin.filterStatusPlaceholder')}</option>
              <option value="SUBMITTED">SUBMITTED</option>
              <option value="UNDER_REVIEW">UNDER_REVIEW</option>
              <option value="QUOTE_READY">QUOTE_READY</option>
              <option value="PRICE_CHANGED">PRICE_CHANGED</option>
              <option value="FUNDS_RESERVED">FUNDS_RESERVED</option>
              <option value="PURCHASE_COMPLETED">PURCHASE_COMPLETED</option>
              <option value="MERCHANT_SHIPPED">MERCHANT_SHIPPED</option>
              <option value="ARRIVED_AT_IMPEX">ARRIVED_AT_IMPEX</option>
              <option value="READY_FOR_PICKUP">READY_FOR_PICKUP</option>
              <option value="DELIVERED">DELIVERED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
              {t('common.search')}
            </label>
            <form onSubmit={(e) => { e.preventDefault(); fetchOrders(); }} style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
              <input
                type="text"
                placeholder={t('admin.searchOrdersPlaceholder')}
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="input"
                style={{ paddingLeft: '2.25rem', height: '38px', fontSize: '0.8125rem' }}
              />
            </form>
          </div>
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div className="skeleton" style={{ height: '70px', borderRadius: 'var(--radius-lg)' }} />
          <div className="skeleton" style={{ height: '70px', borderRadius: 'var(--radius-lg)' }} />
        </div>
      ) : orders.length > 0 ? (
        <>
          {/* Desktop Table View */}
          <div className="impex-card desktop-table-view" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-muted)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '0.875rem 1.25rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Order #</th>
                    <th style={{ padding: '0.875rem 1.25rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Product & Store</th>
                    <th style={{ padding: '0.875rem 1.25rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Est. Price</th>
                    <th style={{ padding: '0.875rem 1.25rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Quoted / Total</th>
                    <th style={{ padding: '0.875rem 1.25rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Status</th>
                    <th style={{ padding: '0.875rem 1.25rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr
                      key={o.id}
                      onClick={() => handleOpenDetailModal(o)}
                      style={{ borderBottom: '1px solid var(--border-light)', cursor: 'pointer', transition: 'background-color 0.15s ease' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-muted)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <td style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--primary)' }}>
                        #{o.order_number || String(o.id).slice(0, 8)}
                      </td>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.875rem', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {o.product_name || o.title || 'Product'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {o.merchant_name || o.merchant_domain || 'Store'}
                        </div>
                      </td>
                      <td style={{ padding: '1rem 1.25rem', fontSize: '0.875rem' }}>
                        ${Number(o.customer_estimated_price || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '1rem 1.25rem', fontWeight: 700, fontSize: '0.875rem' }}>
                        {o.quoted_total > 0 ? `$${Number(o.quoted_total).toFixed(2)}` : '—'}
                      </td>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <span className="badge badge-primary">{String(o.status).replace(/_/g, ' ')}</span>
                      </td>
                      <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                        <button className="btn btn-secondary btn-sm">
                          Process
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View (< 768px) */}
          <div className="mobile-card-view">
            {orders.map((o) => (
              <div
                key={o.id}
                className="impex-card impex-card-interactive"
                onClick={() => handleOpenDetailModal(o)}
                style={{ padding: '1rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.875rem' }}>
                    #{o.order_number || String(o.id).slice(0, 8)}
                  </span>
                  <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                    {String(o.status).replace(/_/g, ' ')}
                  </span>
                </div>

                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  {o.product_name || o.title || 'Product'}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{o.merchant_name || o.merchant_domain || 'Store'}</span>
                  <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                    {o.quoted_total > 0 ? `$${Number(o.quoted_total).toFixed(2)} USD` : `$${Number(o.customer_estimated_price || 0).toFixed(2)} (Est)`}
                  </span>
                </div>

                <button className="btn btn-secondary btn-sm" style={{ width: '100%', marginTop: '0.25rem' }}>
                  Process Order
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="impex-card" style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)' }}>
          No orders match the current filter criteria.
        </div>
      )}

      {/* COMPREHENSIVE ADMIN ORDER ACTION MODAL */}
      {selectedOrder && (
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
            onClick={() => setSelectedOrder(null)}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(3px)' }}
          />

          <div
            className="modal-responsive-card"
            style={{ maxWidth: '820px' }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span className="badge badge-primary">
                    Order #{selectedOrder.order_number || selectedOrder.id}
                  </span>
                  <span className="badge badge-muted">
                    {selectedOrder.status}
                  </span>
                </div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>
                  {selectedOrder.product_name}
                </h2>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Product Overview & Merchant Link */}
            <div
              style={{
                backgroundColor: 'var(--bg-muted)',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Merchant: <strong>{selectedOrder.merchant_name || selectedOrder.merchant_domain}</strong> • Quantity: <strong>{selectedOrder.quantity || 1}</strong>
                </div>
                {selectedOrder.customer_estimated_price > 0 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    Customer Estimated: ${Number(selectedOrder.customer_estimated_price).toFixed(2)} {selectedOrder.customer_estimated_currency || 'USD'}
                  </div>
                )}
              </div>

              {selectedOrder.product_url && (
                <a
                  href={selectedOrder.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ gap: '0.4rem' }}
                >
                  <ExternalLink size={14} />
                  <span>Open Merchant Product</span>
                </a>
              )}
            </div>

            {/* Customer Reference Screenshots (if attached) */}
            {(() => {
              const ids = selectedOrder.screenshot_attachment_ids?.length > 0
                ? selectedOrder.screenshot_attachment_ids
                : selectedOrder.product_specifications?.screenshot_attachment_ids?.length > 0
                ? selectedOrder.product_specifications.screenshot_attachment_ids
                : selectedOrder.screenshot_attachment_id
                ? [selectedOrder.screenshot_attachment_id]
                : [];
              const urls = ids.map((id) => api.getScreenshotUrl(id));
              if (urls.length === 0 && (selectedOrder.screenshot_url || selectedOrder.product_image_url)) {
                urls.push(selectedOrder.screenshot_url || selectedOrder.product_image_url);
              }
              if (urls.length === 0) return null;

              return (
                <div
                  style={{
                    backgroundColor: 'var(--bg-body)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.875rem 1rem',
                    marginBottom: '1.25rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.7rem' }}>
                    <Camera size={13} style={{ color: 'var(--primary)' }} />
                    <span>Customer Reference Screenshots ({urls.length})</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {urls.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'block',
                          position: 'relative',
                          borderRadius: 'var(--radius-md)',
                          overflow: 'hidden',
                          border: '1px solid var(--border)',
                          backgroundColor: '#f8fafc',
                        }}
                        title={`View Reference Image #${idx + 1}`}
                      >
                        <img
                          src={url}
                          alt={`Reference Screenshot ${idx + 1}`}
                          style={{
                            height: '90px',
                            width: '110px',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                        />
                        <span
                          style={{
                            position: 'absolute',
                            bottom: '3px',
                            right: '3px',
                            backgroundColor: 'rgba(15, 23, 42, 0.8)',
                            color: '#ffffff',
                            fontSize: '0.625rem',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: '3px',
                          }}
                        >
                          #{idx + 1}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Customer & Delivery Address Card */}
            {(selectedOrder.customer || selectedOrder.shipping_address_snapshot?.street) && (
              <div
                style={{
                  backgroundColor: 'var(--bg-body)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.875rem 1rem',
                  marginBottom: '1.25rem',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '1rem',
                  fontSize: '0.8125rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.7rem' }}>
                    <User size={13} style={{ color: 'var(--primary)' }} />
                    <span>Customer Details</span>
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    {selectedOrder.customer?.name || 'Customer'}
                  </div>
                  {selectedOrder.customer?.phone && (
                    <div style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.15rem' }}>
                      <Phone size={11} />
                      <span>{selectedOrder.customer.phone}</span>
                    </div>
                  )}
                  {selectedOrder.customer?.email && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      {selectedOrder.customer.email}
                    </div>
                  )}
                </div>

                {selectedOrder.shipping_address_snapshot?.street && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.7rem' }}>
                      <MapPin size={13} style={{ color: 'var(--success)' }} />
                      <span>Haiti Delivery Destination</span>
                      {selectedOrder.shipping_address_snapshot.label && (
                        <span style={{ backgroundColor: '#eff6ff', color: 'var(--primary)', padding: '0.05rem 0.4rem', borderRadius: '4px', textTransform: 'none', fontWeight: 600 }}>
                          {selectedOrder.shipping_address_snapshot.label}
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {selectedOrder.shipping_address_snapshot.recipient_name || selectedOrder.customer?.name}
                    </div>
                    <div style={{ color: 'var(--text-secondary)' }}>
                      {selectedOrder.shipping_address_snapshot.street}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      {selectedOrder.shipping_address_snapshot.city}, {selectedOrder.shipping_address_snapshot.state} {selectedOrder.shipping_address_snapshot.phone ? `• ${selectedOrder.shipping_address_snapshot.phone}` : ''}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Workflow Navigation Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => setActiveTab('verify')}
                className={`btn btn-sm ${activeTab === 'verify' ? 'btn-primary' : 'btn-secondary'}`}
              >
                {t('admin.tabs.tabVerify')}
              </button>
              <button
                onClick={() => setActiveTab('validate')}
                className={`btn btn-sm ${activeTab === 'validate' ? 'btn-primary' : 'btn-secondary'}`}
              >
                {t('admin.tabs.tabValidate')}
              </button>
              <button
                onClick={() => setActiveTab('purchase')}
                className={`btn btn-sm ${activeTab === 'purchase' ? 'btn-primary' : 'btn-secondary'}`}
              >
                {t('admin.tabs.tabPurchase')}
              </button>
              <button
                onClick={() => setActiveTab('shipping')}
                className={`btn btn-sm ${activeTab === 'shipping' ? 'btn-primary' : 'btn-secondary'}`}
              >
                {t('admin.tabs.tabLogistics')}
              </button>
              <button
                onClick={() => setActiveTab('refund')}
                className={`btn btn-sm ${activeTab === 'refund' ? 'btn-primary' : 'btn-secondary'}`}
              >
                {t('admin.tabs.tabRefund')}
              </button>
              <button
                onClick={() => setActiveTab('reject')}
                className={`btn btn-sm ${activeTab === 'reject' ? 'btn-danger' : 'btn-secondary'}`}
                style={{ color: activeTab === 'reject' ? '#ffffff' : 'var(--danger-text)' }}
              >
                {t('admin.tabs.tabReject')}
              </button>
            </div>

            {/* Computed Step Inactive/Completed Indicators */}
            {(() => {
              const isQuoteIssued = selectedOrder && !['SUBMITTED', 'UNDER_REVIEW'].includes(selectedOrder.status);
              const isValidationDone = selectedOrder && ['PURCHASE_COMPLETED', 'MERCHANT_SHIPPED', 'INTERNATIONAL_TRANSIT', 'IN_TRANSIT', 'ARRIVED_AT_IMPEX', 'READY_FOR_PICKUP', 'DELIVERED'].includes(selectedOrder.status);
              const isPurchased = selectedOrder && ['PURCHASE_COMPLETED', 'MERCHANT_SHIPPED', 'INTERNATIONAL_TRANSIT', 'IN_TRANSIT', 'ARRIVED_AT_IMPEX', 'READY_FOR_PICKUP', 'DELIVERED'].includes(selectedOrder.status);
              const isInTransit = selectedOrder && ['INTERNATIONAL_TRANSIT', 'IN_TRANSIT', 'ARRIVED_AT_IMPEX', 'READY_FOR_PICKUP', 'DELIVERED'].includes(selectedOrder.status);
              const isArrived = selectedOrder && ['ARRIVED_AT_IMPEX', 'READY_FOR_PICKUP', 'DELIVERED'].includes(selectedOrder.status);
              const isDelivered = selectedOrder && selectedOrder.status === 'DELIVERED';

              return (
                <>
                  {/* TAB 1: PRICE VERIFICATION & QUOTE CREATION */}
                  {activeTab === 'verify' && (
                    <form onSubmit={handleVerifyPriceAndQuote} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>{t('admin.verifyForm.title')}</h3>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                            {t('admin.verifyForm.itemPriceLabel')} *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            className="input"
                            value={verifiedPrice}
                            onChange={(e) => setVerifiedPrice(e.target.value)}
                            required
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                            {t('admin.verifyForm.shippingLabel')}
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            className="input"
                            value={verifiedShipping}
                            onChange={(e) => setVerifiedShipping(e.target.value)}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                            {t('admin.verifyForm.taxLabel')}
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            className="input"
                            value={verifiedTax}
                            onChange={(e) => setVerifiedTax(e.target.value)}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                            {t('admin.verifyForm.serviceFeeLabel')}
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            className="input"
                            value={serviceFee}
                            onChange={(e) => setServiceFee(e.target.value)}
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                          {t('admin.verifyForm.notesLabel')}
                        </label>
                        <textarea
                          rows={2}
                          className="input"
                          placeholder="e.g. Price verified on Amazon US with prime shipping..."
                          value={quoteNotes}
                          onChange={(e) => setQuoteNotes(e.target.value)}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                        <button
                          type="submit"
                          disabled={actionLoading || isQuoteIssued}
                          className="btn btn-primary"
                          style={{ gap: '0.4rem', opacity: isQuoteIssued ? 0.6 : 1, cursor: isQuoteIssued ? 'not-allowed' : 'pointer' }}
                        >
                          <DollarSign size={16} />
                          <span>{actionLoading ? t('admin.verifyForm.issuingQuote') : isQuoteIssued ? '✓ Quote Already Issued' : t('admin.verifyForm.issueQuoteBtn')}</span>
                        </button>
                      </div>
                    </form>
                  )}

                  {/* TAB 2: PRE-PURCHASE VALIDATION */}
                  {activeTab === 'validate' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>{t('admin.validateForm.title')}</h3>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        Mandatory check before procurement. Verify that item is in stock and price hasn't increased since quote acceptance.
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                            {t('admin.validateForm.currentPriceLabel')}
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            className="input"
                            value={currentMerchantPrice}
                            onChange={(e) => setCurrentMerchantPrice(e.target.value)}
                          />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
                          <input
                            type="checkbox"
                            id="stockCheckbox"
                            checked={isStockAvailable}
                            onChange={(e) => setIsStockAvailable(e.target.checked)}
                          />
                          <label htmlFor="stockCheckbox" style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                            {t('admin.validateForm.inStockLabel')}
                          </label>
                        </div>
                      </div>

                      {validationResult && (
                        <div
                          style={{
                            padding: '1rem',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: validationResult.result === 'VALID' ? 'var(--success-bg)' : '#fef2f2',
                            border: `1px solid ${validationResult.result === 'VALID' ? 'var(--success-border)' : 'var(--danger-border)'}`,
                            color: validationResult.result === 'VALID' ? 'var(--success-text)' : 'var(--danger-text)',
                            fontSize: '0.875rem',
                          }}
                        >
                          <strong>Validation Status: {validationResult.result}</strong>
                          <p style={{ marginTop: '0.25rem' }}>{validationResult.message}</p>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                        <button
                          type="button"
                          onClick={handlePrePurchaseValidation}
                          disabled={actionLoading || isValidationDone}
                          className="btn btn-primary"
                          style={{ opacity: isValidationDone ? 0.6 : 1, cursor: isValidationDone ? 'not-allowed' : 'pointer' }}
                        >
                          {actionLoading ? 'Validating...' : isValidationDone ? '✓ Validation Completed' : t('admin.validateForm.acceptPriceBtn')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: RECORD PURCHASE */}
                  {activeTab === 'purchase' && (
                    <form onSubmit={handleRecordPurchase} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>{t('admin.purchaseForm.title')}</h3>

                      {/* Over-authorized Protection Banner */}
                      {isOverAuthorized && (
                        <div
                          style={{
                            padding: '1rem',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: '#fef2f2',
                            border: '1px solid #fecaca',
                            color: 'var(--danger-text)',
                            fontSize: '0.875rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                          }}
                        >
                          <AlertTriangle size={18} />
                          <span>
                            <strong>Additional Customer Approval Required!</strong> Actual total (${enteredActualTotal.toFixed(2)}) exceeds authorized amount (${authorizedAmount.toFixed(2)}).
                          </span>
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                            {t('admin.purchaseForm.merchantOrderIdLabel')} *
                          </label>
                          <input
                            type="text"
                            className="input"
                            placeholder="e.g. 114-829281-291829"
                            value={merchantOrderId}
                            onChange={(e) => setMerchantOrderId(e.target.value)}
                            required
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                            {t('admin.purchaseForm.actualPriceLabel')} *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            className="input"
                            value={actualTotal}
                            onChange={(e) => setActualTotal(e.target.value)}
                            required
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                            {t('admin.purchaseForm.merchantTrackingLabel')}
                          </label>
                          <input
                            type="text"
                            className="input"
                            placeholder="TBA / Tracking Number"
                            value={merchantTrackingNo}
                            onChange={(e) => setMerchantTrackingNo(e.target.value)}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                        <button
                          type="submit"
                          disabled={actionLoading || isOverAuthorized || isPurchased}
                          className="btn btn-primary"
                          style={{ opacity: isPurchased ? 0.6 : 1, cursor: isPurchased ? 'not-allowed' : 'pointer' }}
                        >
                          {actionLoading ? t('admin.purchaseForm.markingPurchased') : isPurchased ? '✓ Purchase Already Recorded' : t('admin.purchaseForm.markPurchasedBtn')}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* TAB 4: LOGISTICS & COUNTER PICKUP */}
                  {activeTab === 'shipping' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {/* Mark Shipped Form */}
                      <form onSubmit={handleMarkShipped} style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '1.25rem' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>{t('admin.logisticsForm.title')}</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '0.75rem' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>{t('admin.logisticsForm.carrierLabel')}</label>
                            <input type="text" className="input" value={carrier} onChange={(e) => setCarrier(e.target.value)} />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>{t('admin.logisticsForm.trackingNumberLabel')}</label>
                            <input type="text" className="input" value={shippingTracking} onChange={(e) => setShippingTracking(e.target.value)} required />
                          </div>
                        </div>
                        <button
                          type="submit"
                          disabled={actionLoading || isInTransit}
                          className="btn btn-secondary btn-sm"
                          style={{ opacity: isInTransit ? 0.6 : 1, cursor: isInTransit ? 'not-allowed' : 'pointer' }}
                        >
                          {actionLoading ? t('admin.logisticsForm.updatingLogistics') : isInTransit ? '✓ In Transit Completed' : t('admin.logisticsForm.markInTransitBtn')}
                        </button>
                      </form>

                      {/* Mark Arrived in IMPEX Hub */}
                      <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '1.25rem' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.4rem' }}>{t('admin.logisticsForm.markArrivedHubBtn')}</h4>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                          Marks package arrived at central hub and notifies customer with their pickup code.
                        </p>
                        <button
                          type="button"
                          onClick={handleMarkArrived}
                          disabled={actionLoading || isArrived}
                          className="btn btn-secondary btn-sm"
                          style={{ opacity: isArrived ? 0.6 : 1, cursor: isArrived ? 'not-allowed' : 'pointer' }}
                        >
                          {actionLoading ? t('admin.logisticsForm.updatingLogistics') : isArrived ? '✓ Arrived at IMPEX (Completed)' : t('admin.logisticsForm.markArrivedHubBtn')}
                        </button>
                      </div>

                      {/* Verify Counter Pickup */}
                      <form onSubmit={handleVerifyPickup}>
                        <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.4rem' }}>{t('admin.pickupForm.title')}</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '0.75rem' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>{t('admin.pickupForm.enterSecretCodeLabel')}</label>
                            <input type="text" className="input" placeholder="e.g. IX-1234" value={pickupCodeInput} onChange={(e) => setPickupCodeInput(e.target.value)} required />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>{t('admin.pickupForm.collectorNameLabel')}</label>
                            <input type="text" className="input" placeholder="Person collecting" value={pickupCollectorName} onChange={(e) => setPickupCollectorName(e.target.value)} />
                          </div>
                        </div>
                        <button
                          type="submit"
                          disabled={actionLoading || isDelivered}
                          className="btn btn-primary btn-sm"
                          style={{ opacity: isDelivered ? 0.6 : 1, cursor: isDelivered ? 'not-allowed' : 'pointer' }}
                        >
                          {actionLoading ? t('admin.pickupForm.verifyingPickup') : isDelivered ? '✓ Package Delivered (Completed)' : t('admin.pickupForm.verifyPickupBtn')}
                        </button>
                      </form>
                    </div>
                  )}
                </>
              );
            })()}

            {/* TAB 5: REFUND */}
            {activeTab === 'refund' && (
              <form onSubmit={handleRefund} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>{t('admin.refundForm.title')}</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  Credit refund amount directly back into customer IMPEX wallet.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                      {t('admin.refundForm.amountLabel')}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      placeholder={selectedOrder.actual_purchase_total || selectedOrder.quoted_total || '0.00'}
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                      {t('admin.refundForm.reasonLabel')}
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Product out of stock on merchant store"
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button type="submit" disabled={actionLoading} className="btn btn-secondary" style={{ color: 'var(--danger-text)' }}>
                    {actionLoading ? t('admin.refundForm.processingRefund') : t('admin.refundForm.processRefundBtn')}
                  </button>
                </div>
              </form>
            )}

            {/* TAB: REJECT ORDER */}
            {activeTab === 'reject' && (
              <form onSubmit={handleRejectOrder} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--danger-text)' }}>{t('admin.rejectForm.title')}</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  Reject this order request. Any funds reserved in customer escrow will be immediately released, and the order will be marked REJECTED.
                </p>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    {t('admin.rejectForm.reasonLabel')} *
                  </label>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="e.g. Prohibited import item under Haiti customs regulations, merchant does not deliver to US warehouse, or discontinued item..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button type="submit" disabled={actionLoading} className="btn btn-danger">
                    {actionLoading ? t('admin.rejectForm.confirmingReject') : t('admin.rejectForm.confirmRejectBtn')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
