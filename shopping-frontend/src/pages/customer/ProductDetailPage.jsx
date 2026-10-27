import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useExchangeRate } from '../../context/ExchangeRateContext';
import { useTranslation } from '../../context/LanguageContext';
import api from '../../api/client';
import LoginModal from '../../components/modals/LoginModal';
import {
  ArrowLeft,
  Star,
  ShoppingCart,
  Zap,
  ShieldCheck,
  Truck,
  CheckCircle2,
  ExternalLink,
  Info,
} from 'lucide-react';

export default function ProductDetailPage() {
  const { currentPath, navigate } = useRouter();
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();
  const { toHtg } = useExchangeRate();
  const { t } = useTranslation();

  // Extract ID from /product/:id
  const productId = decodeURIComponent(currentPath.replace(/^\/product\//, ''));

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('description');
  const [addingToCart, setAddingToCart] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    api.getProductById(productId)
      .then((data) => {
        if (mounted) {
          setProduct(data);
          if (data?.variants && data.variants.length > 0) {
            setSelectedVariant(data.variants[0]);
          }
        }
      })
      .catch((err) => {
        if (mounted) setError(err.message || 'Product could not be loaded.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [productId]);

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      setLoginModalOpen(true);
      return;
    }
    setAddingToCart(true);
    try {
      const activePrice = selectedVariant?.price_usd && parseFloat(selectedVariant.price_usd) > 0
        ? parseFloat(selectedVariant.price_usd)
        : parseFloat(product.price || product.base_price_usd || 1.0);

      await addToCart({
        merchant_id: product.merchant_id || product.merchant || 'international',
        external_product_id: product.external_product_id || (product.id?.includes(':') ? product.id.split(':').slice(1).join(':') : product.id),
        title: product.title || product.name,
        product_url: product.product_url || product.url,
        image_url: selectedVariant?.image_url || (product.images && product.images[0]) || product.primary_image_url || product.image,
        unit_price_usd: activePrice,
        quantity,
        selected_variants: selectedVariant?.attributes || (selectedVariant?.name ? { Option: selectedVariant.name } : {}),
        weight_lbs: parseFloat(product.estimated_weight_lbs || product.weight_lbs || 1.25),
      });
    } finally {
      setAddingToCart(false);
    }
  };

  const handleBuyNow = async () => {
    if (!isAuthenticated) {
      setLoginModalOpen(true);
      return;
    }
    const activePrice = selectedVariant?.price_usd && parseFloat(selectedVariant.price_usd) > 0
      ? parseFloat(selectedVariant.price_usd)
      : parseFloat(product.price || product.base_price_usd || 1.0);

    const success = await addToCart({
      merchant_id: product.merchant_id || product.merchant || 'international',
      external_product_id: product.external_product_id || (product.id?.includes(':') ? product.id.split(':').slice(1).join(':') : product.id),
      title: product.title || product.name,
      product_url: product.product_url || product.url,
      image_url: selectedVariant?.image_url || (product.images && product.images[0]) || product.primary_image_url || product.image,
      unit_price_usd: activePrice,
      quantity,
      selected_variants: selectedVariant?.attributes || (selectedVariant?.name ? { Option: selectedVariant.name } : {}),
      weight_lbs: parseFloat(product.estimated_weight_lbs || product.weight_lbs || 1.25),
    });
    if (success) {
      navigate('/checkout');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="skeleton" style={{ height: '36px', width: '120px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '2rem' }}>
          <div className="skeleton" style={{ height: '420px', borderRadius: 'var(--radius-lg)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="skeleton" style={{ height: '32px', width: '80%' }} />
            <div className="skeleton" style={{ height: '24px', width: '40%' }} />
            <div className="skeleton" style={{ height: '40px', width: '50%' }} />
            <div className="skeleton" style={{ height: '120px', width: '100%' }} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="impex-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          Product Not Found
        </h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          {error || 'The product you requested is currently unavailable or has expired.'}
        </p>
        <button onClick={() => navigate('/order')} className="btn btn-primary">
          Order by Product URL
        </button>
      </div>
    );
  }

  const price = selectedVariant?.price_usd && parseFloat(selectedVariant.price_usd) > 0
    ? parseFloat(selectedVariant.price_usd)
    : parseFloat(product.price || product.base_price_usd || 0);
  const htgPrice = toHtg(price);
  const rawImages = (product.images && product.images.length > 0)
    ? product.images
    : [product.primary_image_url || product.image_url || product.image].filter(Boolean);
  const images = rawImages.length > 0 ? rawImages : [];

  // Fee estimations based on authoritative IMPEX formula
  const weight = product.estimated_weight_lbs || product.weight_lbs || 1.25;
  const estimatedFreight = Number((weight * 4.50).toFixed(2));
  const estimatedServiceFee = Number((price * 0.05).toFixed(2));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Back to Shop */}
      <button
        onClick={() => navigate('/shop')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          fontSize: '0.875rem',
          fontWeight: 600,
          cursor: 'pointer',
          width: 'fit-content',
        }}
      >
        <ArrowLeft size={16} />
        <span>Back to International Stores</span>
      </button>

      {/* Main Product Showcase */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '2rem', alignItems: 'start' }}>
        {/* Left Column: Image Gallery */}
        <div className="impex-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div
            style={{
              height: '400px',
              backgroundColor: '#ffffff',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {images.length > 0 ? (
              <img
                src={images[activeImageIndex] || images[0]}
                alt={product.title}
                style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--text-muted)' }}>
                <ShoppingCart size={48} style={{ opacity: 0.25, marginBottom: '0.5rem' }} />
                <span style={{ fontSize: '0.85rem' }}>No direct image preview available</span>
              </div>
            )}
          </div>

          {images.length > 1 && (
            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImageIndex(idx)}
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: 'var(--radius-sm)',
                    border: `2px solid ${activeImageIndex === idx ? 'var(--primary)' : 'var(--border)'}`,
                    backgroundColor: '#ffffff',
                    padding: '2px',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  <img src={img} alt="thumb" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Product Info & Purchase Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="impex-card">
            {/* Merchant Badge, Brand, Rating & Original Store Link */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    backgroundColor: 'var(--bg-muted)',
                    padding: '0.25rem 0.65rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <span>Store:</span>
                  <span style={{ color: 'var(--primary)' }}>{product.merchant_name || product.merchant || 'International Store'}</span>
                </div>

                {product.brand && (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      backgroundColor: 'rgba(239, 68, 68, 0.08)',
                      padding: '0.25rem 0.65rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: 'var(--primary)',
                    }}
                  >
                    <span>{product.brand}</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#f59e0b', fontSize: '0.8125rem', fontWeight: 600 }}>
                  <Star size={15} fill="#f59e0b" />
                  <span>{product.rating ? Number(product.rating).toFixed(1) : '4.8'}</span>
                  <span style={{ color: 'var(--text-light)', fontWeight: 400 }}>({product.review_count || '150+'} reviews)</span>
                </div>

                {product.product_url && (
                  <a
                    href={product.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      textDecoration: 'none',
                    }}
                    title="View original product page on merchant website"
                  >
                    <span>Original Store</span>
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </div>

            {/* Product Title */}
            <h1 style={{ fontSize: '1.35rem', fontWeight: 700, lineHeight: '1.35', marginBottom: '1rem', color: 'var(--text-primary)' }}>
              {product.title || product.name}
            </h1>

            {/* Price Box */}
            <div
              style={{
                backgroundColor: 'var(--bg-muted)',
                padding: '1rem 1.25rem',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginBottom: '1.25rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                    ${price.toFixed(2)} USD
                  </div>
                  {product.original_price_usd && Number(product.original_price_usd) > price && (
                    <div style={{ fontSize: '1rem', color: 'var(--text-light)', textDecoration: 'line-through' }}>
                      ${Number(product.original_price_usd).toFixed(2)}
                    </div>
                  )}
                  {product.original_price_usd && Number(product.original_price_usd) > price && (
                    <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>
                      Save ${(Number(product.original_price_usd) - price).toFixed(2)}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  ≈ {htgPrice.toLocaleString()} HTG at live marketplace rate
                </div>
              </div>

              <span className="badge badge-success">
                Available to Order
              </span>
            </div>

            {/* Dynamic Product Variants */}
            {product.variants && product.variants.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  {t('orderForm.variantsTitle', 'Select Option / Variant:')}
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {product.variants.map((v, idx) => {
                    const isSelected = selectedVariant?.name === v.name || selectedVariant?.title === v.title;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedVariant(v)}
                        style={{
                          padding: '0.5rem 0.85rem',
                          borderRadius: 'var(--radius-md)',
                          border: `1.5px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                          backgroundColor: isSelected ? 'var(--primary-light)' : '#ffffff',
                          color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: '0.8125rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {v.name || v.title || v}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {t('common.quantity', 'Quantity')}:
              </span>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  style={{ width: '36px', height: '36px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-secondary)' }}
                >
                  -
                </button>
                <span style={{ width: '40px', textAlign: 'center', fontWeight: 700, fontSize: '0.875rem' }}>
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  style={{ width: '36px', height: '36px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-secondary)' }}
                >
                  +
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <button
                onClick={handleAddToCart}
                disabled={addingToCart}
                className="btn btn-secondary btn-lg"
              >
                {addingToCart ? <span className="spinner" /> : (
                  <>
                    <ShoppingCart size={18} />
                    <span>{t('shop.addToCart', 'Add to Cart')}</span>
                  </>
                )}
              </button>

              <button
                onClick={handleBuyNow}
                className="btn btn-primary btn-lg"
              >
                <Zap size={18} />
                <span>{t('common.buyNow', 'Buy Now')}</span>
              </button>
            </div>

            {/* International Logistics Estimation Box */}
            <div
              style={{
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                backgroundColor: '#fafbfc',
                fontSize: '0.8125rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                <Truck size={15} style={{ color: 'var(--primary)' }} />
                <span>IMPEX Air Cargo to Port-au-Prince, Haiti</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Weight:</span>
                <span>~{weight} lbs</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Est. Freight to Haiti:</span>
                <span>${estimatedFreight.toFixed(2)} USD</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>IMPEX Procurement & Customs Service:</span>
                <span>${estimatedServiceFee.toFixed(2)} USD</span>
              </div>
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                <Info size={12} />
                <span>Final authoritative fees will be calculated at checkout based on actual destination.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Details & Policy Tabs */}
      <div className="impex-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
          {[
            { id: 'description', label: 'Product Description' },
            { id: 'specifications', label: 'Specifications & Features' },
            { id: 'shipping', label: 'Haiti Delivery Guarantee' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '0.925rem',
                fontWeight: activeTab === tab.id ? 700 : 500,
                color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                position: 'relative',
                paddingBottom: '0.5rem',
              }}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div style={{ position: 'absolute', bottom: '-0.85rem', left: 0, right: 0, height: '2px', backgroundColor: 'var(--primary)' }} />
              )}
            </button>
          ))}
        </div>

        {activeTab === 'description' && (
          <div style={{ fontSize: '0.875rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
            {product.description || (
              <p>
                Authentic product procured directly from official authorized distributors and merchants. Each order is received at our secure Florida logistics depot, inspected for quality, and dispatched via priority air freight to Haiti.
              </p>
            )}
          </div>
        )}

        {activeTab === 'specifications' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Structured Specifications Grid */}
            {product.source_metadata?.specifications && Object.keys(product.source_metadata.specifications).length > 0 ? (
              <div>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                  Product Specifications & Attributes
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  {Object.entries(product.source_metadata.specifications).map(([key, val]) => (
                    <div key={key} style={{ padding: '0.75rem', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>{key}</span>
                      <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{val}</strong>
                    </div>
                  ))}
                  <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Estimated Package Weight</span>
                    <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{product.estimated_weight_lbs || product.weight_lbs || 1.25} lbs</strong>
                  </div>
                  <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Condition</span>
                    <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>Brand New, Original Packaging</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Merchant Source</span>
                  <strong style={{ fontSize: '0.875rem' }}>{product.merchant_name || product.merchant || 'International Store'}</strong>
                </div>
                <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Brand</span>
                  <strong style={{ fontSize: '0.875rem' }}>{product.brand || 'Original Brand'}</strong>
                </div>
                <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Package Weight</span>
                  <strong style={{ fontSize: '0.875rem' }}>{product.estimated_weight_lbs || product.weight_lbs || 1.25} lbs</strong>
                </div>
                <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Condition</span>
                  <strong style={{ fontSize: '0.875rem' }}>Brand New, Original Packaging</strong>
                </div>
              </div>
            )}

            {/* Real Feature Bullets from Scraped Site */}
            {((product.source_metadata && Array.isArray(product.source_metadata.features) && product.source_metadata.features.length > 0) || (Array.isArray(product.features) && product.features.length > 0)) && (
              <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                  Product Features & Highlights
                </h4>
                <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  {(product.source_metadata?.features || product.features).map((feat, idx) => (
                    <li key={idx}>{feat}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === 'shipping' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
              <span>Full customs clearance and import tax processing handled by IMPEX Haiti.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
              <span>Package tracking from Florida facility to Port-au-Prince arrival.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
              <span>Pick up for free at our central depot or request home delivery to your doorstep.</span>
            </div>
          </div>
        )}
      </div>

      <LoginModal isOpen={loginModalOpen} onClose={() => setLoginModalOpen(false)} />
    </div>
  );
}
