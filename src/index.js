import { createHash, createHmac, randomBytes } from 'node:crypto';

export class BlmPayError extends Error {
  constructor(message, {status = 0, errorCode = null, response = null} = {}) {
    super(message); this.name = 'BlmPayError'; this.status = status; this.errorCode = errorCode; this.response = response;
  }
}

export class BlmPay {
  constructor({
    apiKey,
    hmacSecret = null,
    apiVersion = null,
    baseUrl = null,
    timeoutMs = 30000,
    integrationOrigin = null
  } = {}) {
    if (!apiKey) throw new TypeError('BLMPay apiKey is required');
    this.apiKey = String(apiKey).trim();
    this.hmacSecret = hmacSecret ? String(hmacSecret).trim() : null;
    this.apiVersion = String(apiVersion || (this.hmacSecret ? 'v2' : 'v1')).toLowerCase();
    if (!['v1','v2'].includes(this.apiVersion)) throw new TypeError('BLMPay apiVersion must be v1 or v2.');
    if (this.apiVersion === 'v2' && !this.hmacSecret) throw new TypeError('BLMPay hmacSecret is required for API v2.');
    this.baseUrl = String(baseUrl || `https://pay.blmtec.co.tz/api/${this.apiVersion}`).replace(/\/$/, '');
    this.timeoutMs = timeoutMs;
    this.integrationOrigin = this.#normalizeIntegrationOrigin(integrationOrigin);
  }

  setIntegrationOrigin(origin) { this.integrationOrigin = this.#normalizeIntegrationOrigin(origin); return this; }
  listPayments = q => this.request('GET', '/payments', {query:q});
  getPayment = ref => this.request('GET', `/payments/${encodeURIComponent(ref)}`);
  createPayment = (body, idempotencyKey) => this.request('POST', '/payments', {body, idempotencyKey});
  getBalance = () => this.request('GET', '/balance');
  listPaymentLinks = () => this.request('GET', '/payment-links');
  createPaymentLink = body => this.request('POST', '/payment-links', {body});
  listInvoices = () => this.request('GET', '/invoices');
  createInvoice = body => this.request('POST', '/invoices', {body});
  listPayouts = q => this.request('GET', '/payouts', {query:q});
  getPayout = ref => this.request('GET', `/payouts/${encodeURIComponent(ref)}`);
  getPayoutFee = (amount, channel='mobile') => this.request('GET', '/payouts/fee', {query:{amount,channel}});
  listPayoutBanks = () => this.request('GET', '/payouts/banks');
  lookupPayoutName = body => this.request('POST', '/payouts/name-lookup', {body});
  createPayout = (body, idempotencyKey) => this.request('POST', '/payouts/send', {body,idempotencyKey});
  listWebhooks = () => this.request('GET', '/webhooks');
  createWebhook = body => this.request('POST', '/webhooks', {body});
  deleteWebhook = id => this.request('DELETE', `/webhooks/${Number(id)}`);
  activateUsdt = () => this.request('POST', '/usdt/activate', {body:{}});
  getUsdtAddress = () => this.request('GET', '/usdt/address');
  listUsdtTransfers = q => this.request('GET', '/usdt/transfers', {query:q});
  quoteUsdtWithdrawal = (address, amount, idempotencyKey) => this.request('POST', '/usdt/withdrawals/quote', {body:{address,amount},idempotencyKey});
  confirmUsdtWithdrawal = quoteReference => this.request('POST', '/usdt/withdrawals', {body:{quote_reference:quoteReference}});

  async request(method, path, {body, query, idempotencyKey} = {}) {
    const httpMethod = String(method || 'GET').toUpperCase();
    const url = new URL(this.baseUrl + path);
    for (const [k,v] of Object.entries(query || {})) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }

    const rawBody = body === undefined ? '' : JSON.stringify(body);
    const headers = {Accept:'application/json'};
    if (this.apiVersion === 'v2') {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = randomBytes(24).toString('hex');
      const target = url.pathname + url.search;
      const bodyHash = createHash('sha256').update(rawBody, 'utf8').digest('hex');
      const canonical = `${httpMethod}\n${target}\n${timestamp}\n${nonce}\n${bodyHash}`;
      const signature = createHmac('sha256', this.hmacSecret).update(canonical, 'utf8').digest('hex');
      headers.Authorization = `BLMPay-HMAC ${this.apiKey}`;
      headers['X-BLMPay-Timestamp'] = timestamp;
      headers['X-BLMPay-Nonce'] = nonce;
      headers['X-BLMPay-Signature'] = signature;
    } else {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    if (this.integrationOrigin) headers['X-BLMPay-Origin'] = this.integrationOrigin;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        method:httpMethod,
        headers,
        body: body === undefined ? undefined : rawBody,
        signal:controller.signal
      });
      const text = await res.text(); let data;
      try { data = JSON.parse(text); } catch { throw new BlmPayError('BLMPay returned invalid JSON.', {status:res.status,response:text}); }
      if (!res.ok) throw new BlmPayError(data?.message || 'BLMPay request failed.', {status:res.status,errorCode:data?.error_code,response:data});
      return data;
    } catch (e) {
      if (e instanceof BlmPayError) throw e;
      throw new BlmPayError(e?.name === 'AbortError' ? 'BLMPay request timed out.' : 'BLMPay connection failed.', {response:e});
    } finally { clearTimeout(timer); }
  }

  #normalizeIntegrationOrigin(origin) {
    if (origin === undefined || origin === null || String(origin).trim() === '') return null;
    let url;
    try { url = new URL(String(origin).trim()); } catch { throw new TypeError('BLMPay integrationOrigin must be a valid HTTPS URL.'); }
    if (url.protocol !== 'https:' || !url.hostname) throw new TypeError('BLMPay integrationOrigin must use HTTPS, for example https://example.com.');
    return String(origin).trim();
  }
}

export default BlmPay;
