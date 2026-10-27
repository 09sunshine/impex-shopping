/**
 * IMPEX International Shopping Centralized API Client
 * Built for https://shopping.impexht.com and local development.
 * Handles HttpOnly cookie credential passing across .impexht.com subdomains
 * with automatic fallback to localStorage Authorization Bearer token.
 */

// In browser on local dev, route through Vite proxy (empty base URL) to eliminate cross-origin preflights
const isLocalDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const rawConfiguredUrl = (import.meta.env.VITE_API_URL || import.meta.env.VITE_IMPEX_API_BASE_URL || '').trim().replace(/\/$/, '');
const API_BASE_URL = isLocalDev && !import.meta.env.VITE_FORCE_DIRECT_API ? '' : (rawConfiguredUrl || 'https://impex-shopping-backend.onrender.com');

class ApiClient {
  constructor() {
    this.baseUrl = API_BASE_URL;
    this.inFlightRequests = new Map();
    this.cache = new Map();
  }

  getToken() {
    try {
      return localStorage.getItem('impex_token') || sessionStorage.getItem('impex_token') || '';
    } catch {
      return '';
    }
  }

  setToken(token) {
    try {
      if (token) {
        localStorage.setItem('impex_token', token);
      } else {
        localStorage.removeItem('impex_token');
        sessionStorage.removeItem('impex_token');
      }
      // Clear user-specific cache on token change
      this.cache.clear();
    } catch (e) {
      console.warn('Storage access failed:', e);
    }
  }

  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const method = (options.method || 'GET').toUpperCase();
    const token = this.getToken();

    // Invalidate cache on mutations
    if (method !== 'GET') {
      this.cache.clear();
    }

    // Cache hit for semi-static GET endpoints (e.g. merchants, exchange rate)
    const isCacheable = method === 'GET' && (
      endpoint.includes('/shopping/merchants') ||
      (endpoint.includes('/wallet/exchange-rate') && !endpoint.includes('refresh=true'))
    );

    if (isCacheable) {
      const cached = this.cache.get(url);
      if (cached && Date.now() - cached.timestamp < 30000) { // 30s TTL
        return cached.data;
      }
    }

    // In-flight deduplication for concurrent identical GET requests
    if (method === 'GET') {
      const inFlightKey = `${url}::${token}`;
      if (this.inFlightRequests.has(inFlightKey)) {
        return this.inFlightRequests.get(inFlightKey);
      }
      const promise = this._executeRequest(url, options, token).finally(() => {
        this.inFlightRequests.delete(inFlightKey);
      });
      this.inFlightRequests.set(inFlightKey, promise);
      const data = await promise;
      if (isCacheable) {
        this.cache.set(url, { data, timestamp: Date.now() });
      }
      return data;
    }

    return this._executeRequest(url, options, token);
  }

  async _executeRequest(url, options, token) {
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const headers = {
      Accept: 'application/json',
      ...options.headers,
    };

    if (!isFormData && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers,
      credentials: 'include', // Sends cross-subdomain .impexht.com cookies
    };

    if (options.body && typeof options.body === 'object' && !isFormData) {
      config.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, config);

      if (response.status === 204) {
        return null;
      }

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const error = new Error(
          (data && (data.detail || data.message || data.error)) ||
          `Request failed with status ${response.status}`
        );
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        const networkError = new Error('Cannot connect to IMPEX server. Please check your internet connection.');
        networkError.status = 0;
        throw networkError;
      }
      throw err;
    }
  }

  /* ---------------- Auth Endpoints ---------------- */
  async login(email, password) {
    try {
      const res = await this.request('/api/auth/login', {
        method: 'POST',
        body: { identifier: email, email, password },
      });
      if (res && res.access_token) {
        this.setToken(res.access_token);
      }
      return res;
    } catch (err) {
      throw this._formatAuthError(err);
    }
  }

  _formatAuthError(err) {
    const msg = (err && (err.message || '')) || '';
    if (msg.includes('déjà utilisé') || msg.includes('already in use') || msg.includes('already exists')) {
      if (msg.toLowerCase().includes('phone') || msg.toLowerCase().includes('téléphone')) {
        const error = new Error('This phone number is already registered to another account.');
        error.status = 400;
        return error;
      }
      const error = new Error('This email address is already registered. Please sign in or use another email.');
      error.status = 400;
      return error;
    }
    if (msg.toLowerCase().includes('incorrect') || msg.toLowerCase().includes('invalid credential')) {
      const error = new Error('Invalid email or password. Please try again.');
      error.status = 401;
      return error;
    }
    return err;
  }

  async register(data) {
    const customerPayload = {
      first_name: data.first_name || '',
      last_name: data.last_name || '',
      gender: data.gender || 'M',
      email: data.email,
      password: data.password,
      phone: data.phone || null,
      country_code: data.country_code || 'HT',
      country_name: data.country_name || 'Haiti',
      state_code: data.state_code || 'OU',
      state_name: data.state_name || 'Ouest',
      city: data.city || 'Port-au-Prince',
      street: data.street || 'Logistics Depot Delivery',
      postal_code: data.postal_code || 'HT6110',
    };

    try {
      const res = await this.request('/api/auth/register', {
        method: 'POST',
        body: customerPayload,
      });
      return res;
    } catch (err) {
      throw this._formatAuthError(err);
    }
  }

  async verifyOtp(email, otp, purpose) {
    try {
      const res = await this.request('/api/auth/verify-otp', {
        method: 'POST',
        body: { email, otp, purpose },
      });
      if (res && res.access_token) {
        this.setToken(res.access_token);
      }
      return res;
    } catch (err) {
      throw this._formatAuthError(err);
    }
  }

  async resendOtp(email, purpose) {
    try {
      return await this.request('/api/auth/resend-otp', {
        method: 'POST',
        body: { email, purpose },
      });
    } catch (err) {
      throw this._formatAuthError(err);
    }
  }

  async getMe() {
    try {
      return await this.request('/api/auth/me');
    } catch (err) {
      if (err.status === 404) {
        return await this.request('/api/me');
      }
      throw err;
    }
  }

  async logout() {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    } finally {
      this.setToken(null);
      this.cache.clear();
      this.inFlightRequests.clear();
      if (typeof document !== 'undefined') {
        const cookies = ['access_token', 'impex_token', 'better-auth.session_token', 'better-auth.session_data', 'better-auth.csrf_token'];
        cookies.forEach((c) => {
          document.cookie = `${c}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
        });
      }
    }
  }

  /* ---------------- Customer Commerce Endpoints ---------------- */
  async searchProducts({ query = '', merchant = '', category = '', minPrice = null, maxPrice = null, sort = 'featured', page = 1, limit = 20 } = {}) {
    const params = new URLSearchParams();
    if (query) {
      params.append('q', query);
      params.append('query', query);
    }
    if (merchant) params.append('merchant', merchant);
    if (category) params.append('category', category);
    if (minPrice !== null && minPrice !== undefined) params.append('min_price', minPrice);
    if (maxPrice !== null && maxPrice !== undefined) params.append('max_price', maxPrice);
    if (sort) params.append('sort', sort);
    params.append('page', page);
    params.append('limit', limit);

    return this.request(`/api/commerce/search?${params.toString()}`);
  }

  _normalizeProduct(data) {
    if (!data) return data;
    const price = Number(data.base_price_usd ?? data.price ?? data.price_usd ?? 0.0);
    const primaryImg = data.primary_image_url || (Array.isArray(data.images) && data.images[0]) || data.image_url || data.image || null;
    return {
      ...data,
      id: data.id || `custom:${data.external_product_id || Date.now()}`,
      price: price,
      base_price_usd: price,
      image: primaryImg,
      image_url: primaryImg,
      primary_image_url: primaryImg,
      images: Array.isArray(data.images) && data.images.length > 0 ? data.images : (primaryImg ? [primaryImg] : []),
      merchant: data.merchant_name || data.merchant || 'International Store',
      merchant_name: data.merchant_name || data.merchant || 'International Store',
      title: data.title || data.name || 'Imported International Product',
      name: data.title || data.name || 'Imported International Product',
      variants: Array.isArray(data.variants) && data.variants.length > 0 ? data.variants : [
        { id: 'standard', name: 'Standard Model', price_usd: price, attributes: { Option: 'Standard' } }
      ],
    };
  }

  async getProductById(productId) {
    try {
      const data = await this.request(`/api/commerce/product-by-id/${encodeURIComponent(productId)}`);
      const normalized = this._normalizeProduct(data);
      try {
        sessionStorage.setItem(`impex_prod_${productId}`, JSON.stringify(normalized));
      } catch {}
      return normalized;
    } catch (err) {
      try {
        const cached = sessionStorage.getItem(`impex_prod_${productId}`);
        if (cached) return JSON.parse(cached);
      } catch {}
      throw err;
    }
  }

  async quoteProductUrl(url) {
    const data = await this.request('/api/commerce/quote-url', {
      method: 'POST',
      body: { url },
    });
    const normalized = this._normalizeProduct(data);
    try {
      sessionStorage.setItem(`impex_prod_${normalized.id}`, JSON.stringify(normalized));
      sessionStorage.setItem(`impex_prod_${url}`, JSON.stringify(normalized));
    } catch {}
    return normalized;
  }

  async getCart() {
    return this.request('/api/commerce/cart');
  }

  async addToCart(itemData) {
    const rawId = itemData.external_product_id || itemData.product_id || itemData.id || `prod-${Date.now()}`;
    const extId = String(rawId).includes(':') ? String(rawId).split(':').slice(1).join(':') : String(rawId);
    const mId = itemData.merchant_id || itemData.merchant || (String(rawId).includes(':') ? String(rawId).split(':')[0] : 'international');
    const unitPrice = parseFloat(itemData.unit_price_usd ?? itemData.unit_price ?? itemData.price ?? itemData.base_price_usd ?? 1.0);

    let variantsDict = {};
    if (itemData.selected_variants && typeof itemData.selected_variants === 'object' && !Array.isArray(itemData.selected_variants)) {
      variantsDict = itemData.selected_variants;
    } else if (itemData.selected_variant) {
      if (typeof itemData.selected_variant === 'object') {
        variantsDict = itemData.selected_variant.attributes || { Option: itemData.selected_variant.name || 'Selected' };
      } else {
        variantsDict = { Option: String(itemData.selected_variant) };
      }
    }

    const payload = {
      merchant_id: String(mId).toLowerCase(),
      external_product_id: String(extId),
      title: itemData.title || itemData.name || 'Imported Product',
      product_url: itemData.product_url || itemData.url || null,
      image_url: itemData.image_url || itemData.image || itemData.primary_image_url || null,
      selected_variants: variantsDict,
      quantity: Math.max(1, parseInt(itemData.quantity || 1, 10)),
      unit_price_usd: unitPrice > 0 ? unitPrice : 1.0,
      weight_lbs: parseFloat(itemData.weight_lbs ?? itemData.estimated_weight_lbs ?? 1.25),
    };

    return this.request('/api/commerce/cart/items', {
      method: 'POST',
      body: payload,
    });
  }

  async updateCartItem(itemId, { quantity, selectedVariant }) {
    return this.request(`/api/commerce/cart/items/${itemId}`, {
      method: 'PATCH',
      body: {
        quantity,
        selected_variant: selectedVariant,
      },
    });
  }

  async removeCartItem(itemId) {
    return this.request(`/api/commerce/cart/items/${itemId}`, {
      method: 'DELETE',
    });
  }

  async clearCart() {
    return this.request('/api/commerce/cart', {
      method: 'DELETE',
    });
  }

  async checkout({ deliveryMethod = 'PICKUP', deliveryAddressId = null, paymentMethod = 'WALLET', customerNotes = '', idempotencyKey = '' }) {
    return this.request('/api/commerce/checkout', {
      method: 'POST',
      body: {
        delivery_method: deliveryMethod,
        delivery_address_id: deliveryAddressId,
        payment_method: paymentMethod,
        customer_notes: customerNotes,
        idempotency_key: idempotencyKey || `chk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      },
    });
  }

  /* ---------------- International Shopping (Unified Product Engine) Endpoints ---------------- */
  async getShoppingMerchants() {
    return this.request('/api/shopping/merchants');
  }

  async getCatalog({ query = '', merchant = '', category = '', minPrice = null, maxPrice = null, freshOnly = false, page = 1, limit = 20 } = {}) {
    const offset = Math.max(0, (page - 1) * limit);
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (merchant) params.append('merchant', merchant);
    if (category) params.append('category', category);
    if (minPrice !== null && minPrice !== undefined && minPrice !== '') params.append('min_price', minPrice);
    if (maxPrice !== null && maxPrice !== undefined && maxPrice !== '') params.append('max_price', maxPrice);
    if (freshOnly) params.append('fresh_only', 'true');
    params.append('limit', limit);
    params.append('offset', offset);
    return this.request(`/api/shopping/catalog?${params.toString()}`);
  }

  async uploadScreenshot(file) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request('/api/shopping/screenshots/upload', {
      method: 'POST',
      body: formData,
    });
  }

  getScreenshotUrl(attachmentId) {
    if (!attachmentId) return '';
    const token = this.getToken();
    return `${this.baseUrl}/api/shopping/screenshots/${attachmentId}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  }

  async submitScreenshotOrder(payload) {
    return this.request('/api/shopping/orders/screenshot', {
      method: 'POST',
      body: payload,
    });
  }

  async resolveUrl(url) {
    return this.request('/api/shopping/resolve-url', {
      method: 'POST',
      body: { url },
    });
  }

  async submitProductRequest(payload) {
    try {
      return await this.request('/api/product-requests', {
        method: 'POST',
        body: payload,
      });
    } catch (err) {
      // Fallback to /api/shopping/orders
      return await this.request('/api/shopping/orders', {
        method: 'POST',
        body: payload,
      });
    }
  }

  async submitOrder(payload) {
    return this.submitProductRequest(payload);
  }

  async getOrders({ status = '', page = 1, limit = 20 } = {}) {
    const offset = Math.max(0, (page - 1) * limit);
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    params.append('limit', limit);
    params.append('offset', offset);

    try {
      const res = await this.request(`/api/shopping/orders?${params.toString()}`);
      return res;
    } catch (err) {
      // Fallback for legacy orders if route differs
      return this.request(`/api/commerce/orders?page=${page}&limit=${limit}`);
    }
  }

  async getOrder(orderId) {
    try {
      return await this.request(`/api/shopping/orders/${orderId}`);
    } catch (err) {
      // Fallback to legacy commerce orders
      return await this.request(`/api/commerce/orders/${orderId}`);
    }
  }

  async confirmQuote(orderId, { quoteId = null, idempotencyKey = '' } = {}) {
    return this.request(`/api/shopping/orders/${orderId}/confirm-quote`, {
      method: 'POST',
      body: {
        quote_id: quoteId,
        idempotency_key: idempotencyKey || `quote_conf_${Date.now()}`,
      },
    });
  }

  async confirmPriceChange(orderId, { quoteId = null, idempotencyKey = '' } = {}) {
    return this.request(`/api/shopping/orders/${orderId}/confirm-price-change`, {
      method: 'POST',
      body: {
        quote_id: quoteId,
        idempotency_key: idempotencyKey || `price_chg_${Date.now()}`,
      },
    });
  }

  async declineQuote(orderId, { quoteId = null, reason = '' } = {}) {
    return this.request(`/api/shopping/orders/${orderId}/decline-quote`, {
      method: 'POST',
      body: {
        quote_id: quoteId,
        reason: reason || 'Customer declined quote',
      },
    });
  }

  async cancelOrder(orderId, reason = '') {
    try {
      return await this.request(`/api/shopping/orders/${orderId}/cancel`, {
        method: 'POST',
        body: { reason: reason || 'Cancelled by customer' },
      });
    } catch (err) {
      return await this.request(`/api/commerce/orders/${orderId}/cancel`, {
        method: 'POST',
      });
    }
  }

  async getOrderEvents(orderId) {
    return this.request(`/api/shopping/orders/${orderId}/events`);
  }

  async requestHomeDelivery(orderId, { deliveryAddressId = null, deliveryNotes = '', addressId = null, notes = '' } = {}) {
    const addrId = deliveryAddressId || addressId;
    const noteText = deliveryNotes || notes;
    try {
      return await this.request(`/api/shopping/orders/${orderId}/delivery-request`, {
        method: 'POST',
        body: {
          delivery_address_id: addrId,
          delivery_notes: noteText,
        },
      });
    } catch (err) {
      return await this.request(`/api/commerce/orders/${orderId}/request-delivery`, {
        method: 'POST',
        body: {
          address_id: addrId,
          notes: noteText,
        },
      });
    }
  }

  /* ---------------- Address Management Endpoints ---------------- */
  async getUserAddresses(userId = '') {
    const url = userId ? `/api/addresses/?user_id=${encodeURIComponent(userId)}` : '/api/addresses/';
    return this.request(url);
  }

  async getCompanyAddresses() {
    return this.request('/api/addresses/company');
  }

  async createAddress(addressData) {
    return this.request('/api/addresses/', {
      method: 'POST',
      body: addressData,
    });
  }

  /* ---------------- Wallet Endpoints ---------------- */
  async getWallet() {
    return this.request('/api/wallet/balance');
  }

  async getWalletTransactions({ page = 1, limit = 20 } = {}) {
    return this.request(`/api/wallet/transactions?page=${page}&limit=${limit}`);
  }

  async requestTopUp(data) {
    return this.request('/api/wallet/topup-request', {
      method: 'POST',
      body: data,
    });
  }

  async getExchangeRate(refresh = false) {
    return this.request(`/api/wallet/exchange-rate${refresh ? '?refresh=true' : ''}`);
  }

  /* ---------------- Admin Shopping Management Endpoints ---------------- */
  async getAdminStats() {
    try {
      return await this.request('/api/admin/shopping/stats');
    } catch {
      return await this.request('/api/admin/commerce/stats');
    }
  }

  async getAdminOrders({ status = '', merchant = '', search = '', page = 1, limit = 20 } = {}) {
    const offset = Math.max(0, (page - 1) * limit);
    const params = new URLSearchParams();
    if (status) params.append('status_filter', status);
    if (merchant) params.append('merchant_filter', merchant);
    if (search) params.append('search', search);
    params.append('limit', limit);
    params.append('offset', offset);

    try {
      return await this.request(`/api/admin/shopping/orders?${params.toString()}`);
    } catch (err) {
      return await this.request(`/api/admin/commerce/orders?status=${status}&merchant=${merchant}&page=${page}&limit=${limit}`);
    }
  }

  async getAdminOrder(orderId) {
    try {
      return await this.request(`/api/admin/shopping/orders/${orderId}`);
    } catch {
      return await this.request(`/api/commerce/orders/${orderId}`);
    }
  }

  async verifyPriceAndQuote(orderId, payload) {
    return this.request(`/api/admin/shopping/orders/${orderId}/verify-price`, {
      method: 'POST',
      body: payload,
    });
  }

  async prePurchaseValidation(orderId, payload) {
    return this.request(`/api/admin/shopping/orders/${orderId}/pre-purchase-validation`, {
      method: 'POST',
      body: payload,
    });
  }

  async recordPurchase(orderId, payload) {
    return this.request(`/api/admin/shopping/orders/${orderId}/purchase`, {
      method: 'POST',
      body: payload,
    });
  }

  async markOrderShipped(orderId, payload) {
    return this.request(`/api/admin/shopping/orders/${orderId}/mark-shipped`, {
      method: 'POST',
      body: payload,
    });
  }

  async markOrderArrived(orderId, notes = '') {
    const query = notes ? `?notes=${encodeURIComponent(notes)}` : '';
    return this.request(`/api/admin/shopping/orders/${orderId}/mark-arrived${query}`, {
      method: 'POST',
    });
  }

  async verifyAdminPickup(orderId, { pickupCode, pickedUpByName = '' }) {
    return this.request(`/api/admin/shopping/orders/${orderId}/verify-pickup`, {
      method: 'POST',
      body: {
        pickup_code: pickupCode,
        picked_up_by_name: pickedUpByName,
      },
    });
  }

  async refundAdminOrder(orderId, { amountUsd = null, reason = 'Administrative refund' } = {}) {
    const params = new URLSearchParams();
    if (amountUsd !== null && amountUsd !== undefined) params.append('amount_usd', amountUsd);
    if (reason) params.append('reason', reason);
    return this.request(`/api/admin/shopping/orders/${orderId}/refund?${params.toString()}`, {
      method: 'POST',
    });
  }

  async updateAdminOrderStatus(orderId, { status, trackingNumber = '', notes = '' }) {
    return this.request(`/api/admin/commerce/orders/${orderId}/status`, {
      method: 'PATCH',
      body: {
        status,
        tracking_number: trackingNumber,
        notes,
      },
    });
  }

  async getAdminPurchaseTasks({ status = '', page = 1, limit = 20 } = {}) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    params.append('page', page);
    params.append('limit', limit);
    return this.request(`/api/admin/commerce/purchase-tasks?${params.toString()}`);
  }

  async updateAdminPurchaseTask(taskId, data) {
    return this.request(`/api/admin/commerce/purchase-tasks/${taskId}`, {
      method: 'PATCH',
      body: data,
    });
  }

  async verifyPickupCode(code) {
    return this.request('/api/admin/commerce/verify-pickup', {
      method: 'POST',
      body: { pickup_code: code },
    });
  }

  async getAdminMerchants() {
    try {
      const res = await this.request('/api/admin/shopping/integrations/status');
      return res?.merchants || res;
    } catch {
      try {
        return await this.request('/api/shopping/merchants');
      } catch {
        return await this.request('/api/admin/commerce/merchants');
      }
    }
  }

  async getAdminIntegrationsStatus() {
    return this.request('/api/admin/shopping/integrations/status');
  }

  async triggerAwinSync(merchantSlug = null) {
    return this.request('/api/admin/shopping/integrations/awin/sync', {
      method: 'POST',
      body: { merchant_slug: merchantSlug },
    });
  }

  async getAwinLogs({ page = 1, limit = 20 } = {}) {
    const offset = Math.max(0, (page - 1) * limit);
    return this.request(`/api/admin/shopping/integrations/awin/logs?limit=${limit}&offset=${offset}`);
  }

  async getAdminCatalog({ query = '', merchant = '', category = '', page = 1, limit = 20 } = {}) {
    const offset = Math.max(0, (page - 1) * limit);
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (merchant) params.append('merchant', merchant);
    if (category) params.append('category', category);
    params.append('limit', limit);
    params.append('offset', offset);
    return this.request(`/api/admin/shopping/catalog?${params.toString()}`);
  }

  async rejectAdminOrder(orderId, { reason = '' } = {}) {
    return this.request(`/api/admin/shopping/orders/${orderId}/reject`, {
      method: 'POST',
      body: { reason: reason || 'Rejected by administration' },
    });
  }

  /* ---------------- Address Book Endpoints ---------------- */
  async getAddresses(userId = null) {
    const url = userId ? `/api/addresses?user_id=${encodeURIComponent(userId)}` : '/api/addresses';
    const res = await this.request(url);
    return res?.addresses || [];
  }

  async createAddress(addressData) {
    return this.request('/api/addresses', {
      method: 'POST',
      body: addressData,
    });
  }

  async updateAddress(addressId, addressData) {
    return this.request(`/api/addresses/${addressId}`, {
      method: 'PUT',
      body: addressData,
    });
  }

  async deleteAddress(addressId) {
    return this.request(`/api/addresses/${addressId}`, {
      method: 'DELETE',
    });
  }

  async setDefaultAddress(addressId) {
    return this.request(`/api/addresses/${addressId}/primary`, {
      method: 'PATCH',
    });
  }

  /* ---------------- Wallet Top-Up (Pay'm Gateway) ---------------- */
  async requestTopUp(data) {
    return this.request('/api/wallet/topup-request', {
      method: 'POST',
      body: data,
    });
  }

  async confirmTopUp(paymentReference) {
    return this.request('/api/wallet/topup/confirm', {
      method: 'POST',
      body: { payment_reference: paymentReference },
    });
  }
}

export const api = new ApiClient();
export default api;
