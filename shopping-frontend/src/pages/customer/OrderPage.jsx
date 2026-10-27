import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../api/client';
import AddressModal from '../../components/modals/AddressModal';
import { useTranslation } from '../../context/LanguageContext';
import {
  Link2,
  Globe,
  Camera,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  MapPin,
  UploadCloud,
  X,
  Clock,
  ExternalLink,
  ShieldAlert,
  Info,
  Layers,
  Sparkles,
  Store,
  RefreshCw,
  Plus,
  Minus,
  User,
  Phone,
  Tag,
  Home,
  Briefcase,
  Building,
  Check,
  Eye,
  Image as ImageIcon,
} from 'lucide-react';

const SUPPORTED_MERCHANTS = [
  { slug: 'amazon', name: 'Amazon US', domain: 'amazon.com', icon: '🛒' },
  { slug: 'shein', name: 'SHEIN US', domain: 'shein.com', icon: '👗' },
  { slug: 'aliexpress', name: 'AliExpress', domain: 'aliexpress.com', icon: '📦' },
  { slug: 'ebay', name: 'eBay US', domain: 'ebay.com', icon: '🏷️' },
  { slug: 'fashionnova', name: 'Fashion Nova', domain: 'fashionnova.com', icon: '✨' },
  { slug: 'hm', name: 'H&M US', domain: 'hm.com', icon: '🧥' },
  { slug: 'temu', name: 'Temu', domain: 'temu.com', icon: '⚡' },
  { slug: 'walmart', name: 'Walmart US', domain: 'walmart.com', icon: '🏬' },
  { slug: 'other', name: 'Other store', domain: '', icon: '🌐' },
];

export default function OrderPage() {
  const { navigate, queryParams } = useRouter();
  const { user, wallet, isAuthenticated } = useAuth();
  const toast = useToast();
  const { t } = useTranslation();
  const fileInputRef = useRef(null);

  // Form Fields
  const [productUrl, setProductUrl] = useState(queryParams.get('url') || '');
  const [selectedMerchant, setSelectedMerchant] = useState(queryParams.get('merchant') || 'amazon');
  const [customMerchantName, setCustomMerchantName] = useState('');
  const [productName, setProductName] = useState(queryParams.get('name') || '');
  const [productDescription, setProductDescription] = useState('');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [modelOption, setModelOption] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [estimatedPrice, setEstimatedPrice] = useState('');
  const [reserveFromWallet, setReserveFromWallet] = useState(false);
  const [additionalInstructions, setAdditionalInstructions] = useState('');

  // Screenshot Upload State (Supports up to 3 reference images)
  const [screenshots, setScreenshots] = useState([]);
  const [modalPreviewImage, setModalPreviewImage] = useState(null);
  const [uploadingScreenshots, setUploadingScreenshots] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Recipient & Address State
  const [recipientName, setRecipientName] = useState(
    user?.name || (user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : '')
  );
  const [contactPhone, setContactPhone] = useState(user?.phone || '');
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);

  // Sync recipient contact with user profile when loaded
  useEffect(() => {
    if (user) {
      if (!recipientName && (user.name || user.first_name)) {
        setRecipientName((user.name || `${user.first_name || ''} ${user.last_name || ''}`).trim());
      }
      if (!contactPhone && user.phone) {
        setContactPhone(user.phone);
      }
    }
  }, [user]);

  // URL Inspection & Validation
  const [resolvingUrl, setResolvingUrl] = useState(false);
  const [urlInfo, setUrlInfo] = useState(null);
  const [urlError, setUrlError] = useState('');

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState(null);

  // Load user saved addresses
  const loadAddresses = async () => {
    if (!isAuthenticated) return;
    try {
      const list = await api.getAddresses();
      const addrs = Array.isArray(list) ? list : (list?.addresses || []);
      setAddresses(addrs);
      if (addrs.length > 0 && !selectedAddressId) {
        const primary = addrs.find((a) => a.is_primary) || addrs[0];
        setSelectedAddressId(primary.id);
      }
    } catch {
      setAddresses([]);
    }
  };

  useEffect(() => {
    loadAddresses();
  }, [isAuthenticated, user?.id]);

  const handleAddressSaved = async (savedAddr) => {
    if (savedAddr && savedAddr.id) {
      setAddresses((prev) => {
        const filtered = prev.filter((a) => a.id !== savedAddr.id);
        return [savedAddr, ...filtered];
      });
      setSelectedAddressId(savedAddr.id);
      if (savedAddr.recipient_name && !recipientName) {
        setRecipientName(savedAddr.recipient_name);
      }
      if (savedAddr.phone && !contactPhone) {
        setContactPhone(savedAddr.phone);
      }
    }
    setIsAddressModalOpen(false);
    setEditingAddress(null);
    try {
      await loadAddresses();
      if (savedAddr?.id) {
        setSelectedAddressId(savedAddr.id);
      }
    } catch {
      // non-blocking
    }
  };

  // If a URL was provided via query params upon mount, inspect it
  useEffect(() => {
    const initialUrl = queryParams.get('url');
    if (initialUrl && initialUrl.trim()) {
      handleInspectUrl(initialUrl.trim());
    }
    const initialMerchant = queryParams.get('merchant');
    if (initialMerchant) {
      setSelectedMerchant(initialMerchant);
    }
  }, []);

  // Inspect and validate URL
  const handleInspectUrl = async (rawUrl) => {
    const targetUrl = (rawUrl !== undefined ? rawUrl : productUrl).trim();
    if (!targetUrl) {
      setUrlInfo(null);
      setUrlError('');
      return;
    }

    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      setUrlError('Please enter a valid link starting with http:// or https://');
      setUrlInfo(null);
      return;
    }

    setUrlError('');
    setResolvingUrl(true);

    try {
      const data = await api.resolveUrl(targetUrl);
      setUrlInfo(data);
      if (data?.merchant_slug && SUPPORTED_MERCHANTS.some((m) => m.slug === data.merchant_slug)) {
        setSelectedMerchant(data.merchant_slug);
      } else {
        setSelectedMerchant('other');
        if (data?.merchant_name && data.merchant_name !== 'Custom Merchant') {
          setCustomMerchantName(data.merchant_name);
        }
      }
    } catch {
      // Non-blocking fallback: never block user submission if automatic lookup fails
      try {
        const domain = targetUrl.replace(/^https?:\/\//i, '').split('/')[0].toLowerCase();
        let matchedSlug = 'other';
        for (const m of SUPPORTED_MERCHANTS) {
          if (m.domain && domain.includes(m.domain)) {
            matchedSlug = m.slug;
            break;
          }
        }
        setSelectedMerchant(matchedSlug);
        setUrlInfo({
          domain,
          merchant_name: matchedSlug !== 'other' ? SUPPORTED_MERCHANTS.find((m) => m.slug === matchedSlug)?.name : domain,
          is_supported: matchedSlug !== 'other',
        });
      } catch {
        setUrlInfo(null);
      }
    } finally {
      setResolvingUrl(false);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const trimmed = (text || '').trim();
      if (trimmed && (trimmed.startsWith('http://') || trimmed.startsWith('https://'))) {
        setProductUrl(trimmed);
        handleInspectUrl(trimmed);
        toast.info('Pasted link from clipboard');
      } else {
        toast.error('Clipboard content does not appear to be a valid URL.');
      }
    } catch {
      toast.info('Please paste your product URL manually into the link field.');
    }
  };

  // Upload optional reference screenshots (up to 3 images total)
  const handleFilesUpload = async (files) => {
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);

    const availableSlots = 3 - screenshots.length;
    if (availableSlots <= 0) {
      toast.info(t('orderForm.screenshotLimitReached', 'Maximum 3 reference images reached.'));
      return;
    }

    const filesToUpload = fileList.slice(0, availableSlots);
    if (fileList.length > availableSlots) {
      toast.info(`You can attach up to 3 images in total. Adding ${availableSlots} image(s).`);
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];

    setUploadingScreenshots(true);
    for (const file of filesToUpload) {
      if (!allowedTypes.includes(file.type)) {
        toast.error(`${file.name}: Only PNG, JPEG, and WEBP image formats are supported.`);
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name}: Image file must be under 10MB.`);
        continue;
      }

      // Generate instant client-side preview URL via ObjectURL (never fails with 401!)
      const localPreviewUrl = URL.createObjectURL(file);
      const tempId = `ss_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      setScreenshots((prev) => [
        ...prev,
        {
          tempId,
          id: null,
          file,
          previewUrl: localPreviewUrl,
          name: file.name,
          size: file.size,
          uploading: true,
          error: null,
        },
      ]);

      try {
        const res = await api.uploadScreenshot(file);
        if (res && res.attachment_id) {
          setScreenshots((prev) =>
            prev.map((s) =>
              s.tempId === tempId
                ? {
                    ...s,
                    id: res.attachment_id,
                    uploading: false,
                    previewUrl: localPreviewUrl || res.preview_url,
                  }
                : s
            )
          );
          toast.success(t('orderForm.screenshotAttached', 'Reference screenshot attached.'));
        }
      } catch (err) {
        setScreenshots((prev) =>
          prev.map((s) =>
            s.tempId === tempId
              ? {
                  ...s,
                  uploading: false,
                  error: err.message || 'Upload failed',
                }
              : s
          )
        );
        toast.error(`Failed to upload ${file.name}: ${err.message}`);
      }
    }
    setUploadingScreenshots(false);
  };

  const handleRemoveScreenshot = (indexToRemove) => {
    setScreenshots((prev) => {
      const item = prev[indexToRemove];
      if (item?.previewUrl && item.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((_, idx) => idx !== indexToRemove);
    });
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesUpload(e.dataTransfer.files);
    }
  };

  // Form Validation
  const validateForm = () => {
    const trimmedUrl = productUrl.trim();
    if (!trimmedUrl) {
      toast.error('Please enter the product URL from the merchant website.');
      setUrlError('Product URL is required.');
      return false;
    }

    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      toast.error('Please enter a valid URL starting with http:// or https://');
      setUrlError('URL must start with http:// or https://');
      return false;
    }

    if (isNaN(quantity) || parseInt(quantity, 10) < 1) {
      toast.error('Quantity must be at least 1.');
      return false;
    }

    if (!recipientName.trim()) {
      toast.error('Please enter the recipient full name for this order.');
      return false;
    }

    if (!contactPhone.trim()) {
      toast.error('Please enter a contact phone number for delivery updates.');
      return false;
    }

    setUrlError('');
    return true;
  };

  // Submit URL Request
  const handleSubmitRequest = async (e) => {
    if (e) e.preventDefault();
    if (submitting) return;

    if (!validateForm()) return;

    if (screenshots.some((s) => s.uploading)) {
      toast.info('Please wait for reference screenshots to finish uploading.');
      return;
    }

    setSubmitting(true);
    try {
      const activeMerchantObj = SUPPORTED_MERCHANTS.find((m) => m.slug === selectedMerchant);
      const merchantNameFinal =
        selectedMerchant === 'other'
          ? (customMerchantName.trim() || urlInfo?.merchant_name || 'Other store')
          : (activeMerchantObj?.name || 'International Store');

      const screenshotIds = screenshots.map((s) => s.id).filter(Boolean);

      const payload = {
        product_url: productUrl.trim(),
        merchant_name: merchantNameFinal,
        merchant: selectedMerchant,
        product_name: productName.trim() || productDescription.trim() || `${merchantNameFinal} Item`,
        quantity: Math.max(1, parseInt(quantity, 10)),
        recipient_name: recipientName.trim(),
        contact_phone: contactPhone.trim(),
        customer_name: recipientName.trim(),
        phone: contactPhone.trim(),
        variant_details: {
          size: size.trim() || undefined,
          color: color.trim() || undefined,
          model: modelOption.trim() || undefined,
          notes: additionalInstructions.trim() || undefined,
        },
        specifications: {
          size: size.trim() || undefined,
          color: color.trim() || undefined,
          model: modelOption.trim() || undefined,
        },
        size: size.trim() || undefined,
        color: color.trim() || undefined,
        variant: modelOption.trim() || undefined,
        notes: (additionalInstructions || productDescription).trim() || undefined,
        additional_instructions: additionalInstructions.trim() || undefined,
        screenshot_attachment_id: screenshotIds[0] || undefined,
        reference_screenshot: screenshotIds[0] || undefined,
        screenshot_attachment_ids: screenshotIds,
        selected_address_id: selectedAddressId || undefined,
        customer_estimated_price: estimatedPrice ? parseFloat(estimatedPrice) : 0,
        customer_estimated_currency: 'USD',
        reserve_funds: reserveFromWallet,
        idempotency_key: `req_url_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      };

      const result = await api.submitProductRequest(payload);
      setSubmittedOrder(result);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (reserveFromWallet && result?.status === 'FUNDS_RESERVED') {
        toast.success('Order placed and funds reserved in your IMPEX wallet!');
      } else {
        toast.success('Product request submitted! Our team will verify and prepare your quote.');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to submit product request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSubmittedOrder(null);
    setProductUrl('');
    setProductName('');
    setProductDescription('');
    setSize('');
    setColor('');
    setModelOption('');
    setQuantity(1);
    setEstimatedPrice('');
    setReserveFromWallet(false);
    setAdditionalInstructions('');
    screenshots.forEach((s) => {
      if (s.previewUrl && s.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(s.previewUrl);
      }
    });
    setScreenshots([]);
    setUrlInfo(null);
    setUrlError('');
  };

  // ---------------------------------------------------------------------------
  // CONFIRMATION SCREEN
  // ---------------------------------------------------------------------------
  if (submittedOrder) {
    const referenceNumber =
      submittedOrder.request_reference ||
      submittedOrder.order_number ||
      submittedOrder.public_order_id ||
      `REQ-${String(submittedOrder.id).slice(0, 8).toUpperCase()}`;

    return (
      <div style={{ maxWidth: '780px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Success Card */}
        <div
          className="impex-card"
          style={{
            padding: '2.5rem 2rem',
            textAlign: 'center',
            backgroundColor: '#ffffff',
            boxShadow: 'var(--shadow-md)',
            border: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              backgroundColor: '#ecfdf5',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
            }}
          >
            <CheckCircle2 size={40} />
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: '#eff6ff',
              color: '#3b82f6',
              padding: '0.3rem 0.85rem',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.8125rem',
              fontWeight: 700,
              marginBottom: '1rem',
            }}
          >
            <Clock size={15} />
            <span>Request Under Verification</span>
          </div>

          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            Product Request Submitted
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '540px', margin: '0 auto 1.5rem', lineHeight: 1.5 }}>
            Thank you! Your product link has been securely received by the IMPEX operations team in Port-au-Prince.
          </p>

          {/* Reference Badge */}
          <div
            style={{
              display: 'inline-block',
              backgroundColor: 'var(--bg-muted)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 1.5rem',
              marginBottom: '2rem',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
              Reference Number
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.02em', fontFamily: 'monospace' }}>
              {referenceNumber}
            </div>
          </div>

          {/* Request Summary Box */}
          <div
            style={{
              backgroundColor: 'var(--bg-body)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              textAlign: 'left',
              marginBottom: '2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Submitted Request Details
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '1rem', fontSize: '0.875rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Store / Merchant</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  {submittedOrder.merchant_name || 'International Merchant'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Quantity</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  {submittedOrder.quantity || 1} unit(s)
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Product Name / Title</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {submittedOrder.product_name || 'Requested Product'}
                </span>
              </div>
              {submittedOrder.product_url && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Product Link</span>
                  <a
                    href={submittedOrder.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: 'var(--primary)',
                      wordBreak: 'break-all',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontWeight: 600,
                      fontSize: '0.8125rem',
                    }}
                  >
                    <span>{submittedOrder.product_url}</span>
                    <ExternalLink size={13} />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Workflow Explanation Banner */}
          <div
            style={{
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              textAlign: 'left',
              marginBottom: '2rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#b45309', fontWeight: 700, fontSize: '0.9rem' }}>
              <Info size={18} />
              <span>What happens next?</span>
            </div>
            <ol style={{ margin: '0 0 0 1.25rem', padding: 0, color: '#92400e', fontSize: '0.85rem', lineHeight: 1.6 }}>
              <li>
                <strong>Price & Availability Verification:</strong> Our team checks the exact merchant website to confirm real-time stock, domestic shipping, and US taxes.
              </li>
              <li>
                <strong>Official Quotation:</strong> We calculate international air freight to Haiti and issue an official quotation in your dashboard.
              </li>
              <li>
                <strong>Accept & Reserve Funds:</strong> You can review and accept the quotation. Only upon your explicit approval are funds reserved from your IMPEX wallet.
              </li>
              <li>
                <strong>Purchasing & Shipping:</strong> We execute the purchase on the merchant site and manage customs clearance directly to Port-au-Prince.
              </li>
            </ol>
          </div>

          {/* Next Action Buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
            <button
              onClick={() => navigate(`/orders/${submittedOrder.id}`)}
              className="btn btn-primary"
              style={{ gap: '0.5rem', padding: '0.75rem 1.75rem' }}
            >
              <span>View Request & Quotation</span>
              <ArrowRight size={16} />
            </button>
            <button
              onClick={() => navigate('/')}
              className="btn btn-secondary"
              style={{ padding: '0.75rem 1.5rem' }}
            >
              Go to Dashboard
            </button>
            <button
              onClick={handleResetForm}
              className="btn btn-secondary"
              style={{ padding: '0.75rem 1.5rem' }}
            >
              Submit Another Product Link
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // MAIN FORM: ORDER BY PRODUCT URL
  // ---------------------------------------------------------------------------
  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header Banner */}
      <div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            backgroundColor: 'var(--primary-light)',
            color: 'var(--primary)',
            padding: '0.25rem 0.75rem',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.75rem',
            fontWeight: 700,
            marginBottom: '0.75rem',
          }}
        >
          <Globe size={14} />
          <span>{t('orderForm.conciergeBadge')}</span>
        </div>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
          {t('orderForm.title')}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5 }}>
          {t('orderForm.subtitle')}
        </p>
      </div>

      {/* Important Safety Notice */}
      <div
        style={{
          display: 'flex',
          gap: '0.85rem',
          padding: '1rem 1.25rem',
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 'var(--radius-md)',
          color: '#1e40af',
          fontSize: '0.85rem',
          lineHeight: 1.5,
        }}
      >
        <Info size={20} style={{ flexShrink: 0, marginTop: '2px', color: '#3b82f6' }} />
        <div>
          <strong>{t('orderForm.summaryTitle')}:</strong> {t('orderForm.shippingDisclaimer')}
        </div>
      </div>

      {/* Primary Form Card */}
      <form
        onSubmit={handleSubmitRequest}
        className="impex-card"
        style={{
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.75rem',
          backgroundColor: '#ffffff',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Field 1: Product URL (Required) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              1. {t('orderForm.urlLabel')} <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {t('common.required')}
            </span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
            {t('orderForm.subtitle')}
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="url"
                className="input"
                placeholder={t('orderForm.urlPlaceholder')}
                value={productUrl}
                onChange={(e) => {
                  setProductUrl(e.target.value);
                  if (urlError) setUrlError('');
                }}
                onBlur={() => handleInspectUrl()}
                style={{
                  paddingRight: resolvingUrl ? '2.5rem' : '0.95rem',
                  borderColor: urlError ? 'var(--danger)' : undefined,
                  fontSize: '0.9rem',
                }}
              />
              {resolvingUrl && (
                <span
                  className="spinner"
                  style={{
                    position: 'absolute',
                    right: '0.875rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '18px',
                    height: '18px',
                  }}
                />
              )}
            </div>

            <button
              type="button"
              onClick={handlePasteClipboard}
              className="btn btn-secondary"
              title="Paste link from clipboard"
              style={{
                gap: '0.4rem',
                flexShrink: 0,
                height: '42px',
                padding: '0 1.1rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
              }}
            >
              <Globe size={15} />
              <span>{t('orderForm.pasteLinkBtn')}</span>
            </button>
          </div>

          {urlError && (
            <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <ShieldAlert size={14} />
              <span>{urlError}</span>
            </div>
          )}

          {/* URL Detection Banner */}
          {urlInfo && (
            <div
              style={{
                marginTop: '0.75rem',
                padding: '0.6rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-body)',
                border: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8125rem',
              }}
            >
              <Globe size={16} style={{ color: 'var(--primary)' }} />
              <span>
                {t('orderForm.detectedMerchant')} <strong>{urlInfo.merchant_name || urlInfo.domain}</strong>
                {urlInfo.domain && <span style={{ color: 'var(--text-muted)' }}> ({urlInfo.domain})</span>}
              </span>
            </div>
          )}
        </div>

        {/* Field 2: Merchant Dropdown */}
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
            2. {t('orderForm.merchantLabel')} <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
            {t('orderForm.merchantHelp')}
          </p>

          <select
            className="input"
            value={selectedMerchant}
            onChange={(e) => setSelectedMerchant(e.target.value)}
            style={{ fontSize: '0.9rem', cursor: 'pointer' }}
          >
            {SUPPORTED_MERCHANTS.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.icon} {m.name} {m.domain ? `(${m.domain})` : ''}
              </option>
            ))}
          </select>

          {selectedMerchant === 'other' && (
            <div style={{ marginTop: '0.6rem' }}>
              <input
                type="text"
                className="input"
                placeholder={t('orderForm.otherMerchantPlaceholder')}
                value={customMerchantName}
                onChange={(e) => setCustomMerchantName(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Field 3: Product Name or Description (Optional) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              3. {t('orderForm.productNameLabel')} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({t('common.optional', 'Optional')})</span>
            </label>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
            {t('orderForm.productNameHelp')}
          </p>
          <input
            type="text"
            className="input"
            placeholder={t('orderForm.productNamePlaceholder')}
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
          />
        </div>

        {/* Field 4: Variant Details (Size, Color, Model) */}
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
            4. {t('orderForm.variantsTitle')} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({t('common.optional', 'Optional')})</span>
          </label>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            {t('orderForm.variantsHelp')}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                {t('orderForm.sizeLabel')}
              </label>
              <input
                type="text"
                className="input"
                placeholder={t('orderForm.sizePlaceholder')}
                value={size}
                onChange={(e) => setSize(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                {t('orderForm.colorLabel')}
              </label>
              <input
                type="text"
                className="input"
                placeholder={t('orderForm.colorPlaceholder')}
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                {t('orderForm.modelLabel')}
              </label>
              <input
                type="text"
                className="input"
                placeholder={t('orderForm.modelPlaceholder')}
                value={modelOption}
                onChange={(e) => setModelOption(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Field 5: Quantity (Required) */}
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
            5. {t('orderForm.quantityLabel')} <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
            {t('orderForm.quantityHelp')}
          </p>

          <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
              disabled={quantity <= 1}
              style={{
                width: '42px',
                height: '42px',
                border: 'none',
                backgroundColor: 'var(--bg-body)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: quantity <= 1 ? 'not-allowed' : 'pointer',
                color: 'var(--text-primary)',
              }}
            >
              <Minus size={16} />
            </button>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
              style={{
                width: '60px',
                height: '42px',
                border: 'none',
                textAlign: 'center',
                fontSize: '1rem',
                fontWeight: 700,
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={() => setQuantity((prev) => prev + 1)}
              style={{
                width: '42px',
                height: '42px',
                border: 'none',
                backgroundColor: 'var(--bg-body)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-primary)',
              }}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Field 6: Estimated Price & Wallet Escrow Hold (Optional) */}
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
            6. {t('orderForm.estPriceTitle')} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({t('common.optional', 'Optional')})</span>
          </label>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
            {t('orderForm.estPriceHelp')}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '1rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                {t('orderForm.estimatedPriceLabel')}
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--text-muted)' }}>$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input"
                  style={{ paddingLeft: '1.85rem' }}
                  placeholder={t('orderForm.estimatedPricePlaceholder')}
                  value={estimatedPrice}
                  onChange={(e) => setEstimatedPrice(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                {t('orderForm.spendableBalanceLabel')}
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>
                ${Number(wallet?.spendable_balance ?? wallet?.spendable_balance_usd ?? 0).toFixed(2)} USD
              </div>
            </div>
          </div>

          {estimatedPrice && parseFloat(estimatedPrice) > 0 && isAuthenticated && (
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem',
                padding: '0.85rem 1rem',
                backgroundColor: 'var(--primary-lighter)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #c7d2fe',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={reserveFromWallet}
                onChange={(e) => setReserveFromWallet(e.target.checked)}
                style={{ width: '18px', height: '18px', marginTop: '2px', accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              <div style={{ fontSize: '0.8125rem', lineHeight: 1.45 }}>
                <strong style={{ color: 'var(--text-primary)', display: 'block' }}>
                  {t('orderForm.reserveWalletCheckbox')}
                </strong>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {t('orderForm.reserveWalletDesc')}
                </span>
              </div>
            </label>
          )}
        </div>

        {/* Field 7: Reference Screenshots (Optional, up to 3 images) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              7. {t('orderForm.screenshotTitle')} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({t('common.optional', 'Optional')})</span>
            </label>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: screenshots.length >= 3 ? 'var(--primary)' : 'var(--text-muted)' }}>
              {t('orderForm.screenshotCountLabel', { count: screenshots.length })}
            </span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
            {t('orderForm.screenshotHelp')}
          </p>

          {/* Uploaded Images Gallery Grid */}
          {screenshots.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '0.85rem',
                marginBottom: '0.85rem',
              }}
            >
              {screenshots.map((item, idx) => (
                <div
                  key={item.tempId || idx}
                  style={{
                    position: 'relative',
                    borderRadius: 'var(--radius-md)',
                    border: '1.5px solid var(--border)',
                    backgroundColor: 'var(--bg-body)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  }}
                >
                  {/* Thumbnail with Click-to-preview */}
                  <div
                    onClick={() => setModalPreviewImage(item)}
                    style={{
                      height: '130px',
                      width: '100%',
                      backgroundColor: '#f1f5f9',
                      position: 'relative',
                      cursor: 'pointer',
                      overflow: 'hidden',
                    }}
                    title="Click to view full preview"
                  >
                    <img
                      src={item.previewUrl}
                      alt={item.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                        transition: 'transform 0.2s ease',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0,
                        transition: 'opacity 0.2s ease',
                        color: '#ffffff',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                    >
                      <Eye size={24} />
                    </div>

                    <span
                      style={{
                        position: 'absolute',
                        top: '6px',
                        left: '6px',
                        backgroundColor: 'rgba(15, 23, 42, 0.75)',
                        color: '#ffffff',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backdropFilter: 'blur(2px)',
                      }}
                    >
                      #{idx + 1}
                    </span>

                    {item.uploading && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          backgroundColor: 'rgba(255, 255, 255, 0.85)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        <RefreshCw size={20} className="spin" style={{ color: 'var(--primary)' }} />
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          {t('orderForm.screenshotUploading')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Image Info & Delete Button */}
                  <div style={{ padding: '0.55rem 0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.name}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        {(item.size / 1024).toFixed(0)} KB
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveScreenshot(idx)}
                      style={{
                        background: 'none',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        color: 'var(--danger)',
                        cursor: 'pointer',
                        padding: '4px 6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                      }}
                      title={t('orderForm.screenshotRemove')}
                    >
                      <X size={13} />
                      <span>{t('orderForm.screenshotRemove')}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Dropzone (Visible if < 3 images) */}
          {screenshots.length < 3 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              style={{
                border: dragActive ? '2px dashed var(--primary)' : '2px dashed var(--border)',
                backgroundColor: dragActive ? 'var(--primary-light)' : 'var(--bg-body)',
                borderRadius: 'var(--radius-md)',
                padding: screenshots.length > 0 ? '1rem' : '1.5rem 1rem',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <UploadCloud size={screenshots.length > 0 ? 22 : 28} style={{ color: 'var(--primary)', marginBottom: '0.35rem' }} />
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.15rem' }}>
                {screenshots.length > 0
                  ? t('orderForm.screenshotAddMore', { count: 3 - screenshots.length })
                  : t('orderForm.screenshotDrop')}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {t('orderForm.screenshotSupport')}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/png, image/jpeg, image/webp"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFilesUpload(e.target.files);
                    e.target.value = '';
                  }
                }}
                style={{ display: 'none' }}
              />
            </div>
          ) : (
            <div
              style={{
                padding: '0.65rem 0.85rem',
                backgroundColor: 'var(--primary-lighter)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #c7d2fe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.78rem',
              }}
            >
              <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                ✓ {t('orderForm.screenshotLimitReached')}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                Click Remove on any image above to replace it.
              </span>
            </div>
          )}
        </div>

        {/* Field 8: Additional Instructions (Optional) */}
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
            8. {t('orderForm.notesTitle')} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({t('common.optional', 'Optional')})</span>
          </label>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
            {t('orderForm.notesHelp')}
          </p>
          <textarea
            className="input"
            rows={3}
            placeholder={t('orderForm.notesPlaceholder')}
            value={additionalInstructions}
            onChange={(e) => setAdditionalInstructions(e.target.value)}
          />
        </div>

        {/* Recipient Contact Information (Name & Phone) */}
        <div
          style={{
            backgroundColor: 'var(--bg-muted)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <User size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                {t('orderForm.recipientSectionTitle')}
              </h3>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', backgroundColor: '#eff6ff', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)' }}>
              {t('orderForm.recipientRequiredBadge')}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>
                {t('orderForm.recipientNameLabel')} *
              </label>
              <input
                type="text"
                className="input"
                placeholder={t('orderForm.recipientNamePlaceholder')}
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>
                {t('orderForm.recipientPhoneLabel')} *
              </label>
              <div style={{ position: 'relative' }}>
                <Phone size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="tel"
                  className="input"
                  style={{ paddingLeft: '2.25rem' }}
                  placeholder={t('orderForm.recipientPhonePlaceholder')}
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* Address Selection with Active Add Delivery Address Button */}
        <div
          style={{
            backgroundColor: 'var(--bg-body)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MapPin size={18} style={{ color: 'var(--primary)' }} />
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  {t('orderForm.addressBookTitle')}
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                  {t('orderForm.addressBookSubtitle')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingAddress(null);
                setIsAddressModalOpen(true);
              }}
              className="btn btn-secondary btn-sm"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontWeight: 700,
                color: 'var(--primary)',
                borderColor: 'var(--primary)',
              }}
            >
              <Plus size={15} />
              <span>{t('orderForm.addNewAddressBtn')}</span>
            </button>
          </div>

          {addresses.length === 0 ? (
            <div
              style={{
                padding: '1.5rem',
                textAlign: 'center',
                backgroundColor: 'var(--bg-muted)',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--border)',
              }}
            >
              <MapPin size={24} style={{ color: 'var(--text-muted)', margin: '0 auto 0.5rem' }} />
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                {t('orderForm.noAddressesSaved')}
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingAddress(null);
                  setIsAddressModalOpen(true);
                }}
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Plus size={14} />
                <span>{t('orderForm.addAddressNowBtn')}</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
              {addresses.map((addr) => {
                const isSelected = selectedAddressId === addr.id;
                return (
                  <div
                    key={addr.id}
                    onClick={() => setSelectedAddressId(addr.id)}
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                      backgroundColor: isSelected ? 'rgba(79, 70, 229, 0.04)' : 'var(--bg-body)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.5rem',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: addr.label === 'Work' ? '#fef3c7' : addr.label === 'Office' ? '#e0e7ff' : '#dcfce7',
                            color: addr.label === 'Work' ? '#92400e' : addr.label === 'Office' ? '#3730a3' : '#166534',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          <Tag size={11} />
                          <span>{addr.label || 'Home'}</span>
                          {addr.is_primary && ' • Primary'}
                        </span>
                        <div
                          style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            border: isSelected ? '5px solid var(--primary)' : '2px solid var(--border)',
                            backgroundColor: '#ffffff',
                          }}
                        />
                      </div>

                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                        {addr.recipient_name || recipientName || 'Recipient'}
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {addr.street}
                      </div>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.4rem' }}>
                      {addr.city}, {addr.state} • {addr.phone || contactPhone || 'Haiti'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Verification Notice */}
        <div
          style={{
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-muted)',
            border: '1px solid var(--border)',
            fontSize: '0.8125rem',
            color: 'var(--text-muted)',
            lineHeight: 1.5,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            <Info size={15} style={{ color: 'var(--primary)' }} />
            <span>{t('orderForm.verificationNoticeTitle')}</span>
          </div>
          {t('orderForm.verificationNoticeText')}
        </div>

        {/* Submit Button */}
        <div>
          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary btn-lg"
            style={{
              width: '100%',
              justifyContent: 'center',
              gap: '0.5rem',
              fontSize: '1rem',
              padding: '0.875rem',
            }}
          >
            {submitting ? (
              <>
                <span className="spinner" style={{ width: '18px', height: '18px' }} />
                <span>{t('orderForm.submittingBtn')}</span>
              </>
            ) : (
              <>
                <Link2 size={18} />
                <span>{t('orderForm.submitBtn')}</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Address Book Modal for Adding / Editing Delivery Address on the Fly */}
      <AddressModal
        isOpen={isAddressModalOpen}
        onClose={() => {
          setIsAddressModalOpen(false);
          setEditingAddress(null);
        }}
        onSuccess={handleAddressSaved}
        onAddressSaved={handleAddressSaved}
        initialData={editingAddress}
        initialAddress={editingAddress}
      />

      {/* Lightbox Modal for Full Image Preview */}
      {modalPreviewImage && (
        <div
          onClick={() => setModalPreviewImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '92vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#0f172a',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                <ImageIcon size={18} style={{ color: 'var(--primary-light)', flexShrink: 0 }} />
                <span
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '350px',
                  }}
                >
                  {modalPreviewImage.name || 'Reference Screenshot'}
                </span>
                {modalPreviewImage.size && (
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', flexShrink: 0 }}>
                    ({(modalPreviewImage.size / 1024).toFixed(0)} KB)
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setModalPreviewImage(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.12)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.25)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)')}
                title="Close preview"
              >
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                maxHeight: 'calc(90vh - 60px)',
                overflow: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#020617',
                padding: '0.5rem',
              }}
            >
              <img
                src={modalPreviewImage.previewUrl}
                alt={modalPreviewImage.name || 'Preview'}
                style={{
                  maxWidth: '100%',
                  maxHeight: 'calc(90vh - 80px)',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
