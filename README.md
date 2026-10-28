# BLMPay Node.js SDK

> **API V1 deprecation notice:** BLMPay API v1 is legacy and is scheduled to be retired on **15 November 2026 at 23:59 EAT**. New integrations must use **API v2 HMAC**. Migrate existing v1 integrations before the retirement date.

Official Node.js SDK for BLMPay API v2. Node.js 18+.

## Install from GitHub

```bash
npm install github:blmsoft/blmpay-sdk-node
```

The package name is `@blmsoft/blmpay`.

## API v2 quick start

Create a new API v2 key in BLMPay and save both values shown once: the public API key and HMAC secret.

```js
import BlmPay from '@blmsoft/blmpay';

const blmpay = new BlmPay({
  apiKey: process.env.BLMPAY_API_KEY,
  hmacSecret: process.env.BLMPAY_API_SECRET,
  integrationOrigin: process.env.BLMPAY_INTEGRATION_ORIGIN
});

const balance = await blmpay.getBalance();
```

API v2 signs every request using HMAC-SHA256 with a timestamp, unique nonce and SHA-256 body hash. The SDK generates these values automatically.

## Domain-bound API keys

Domain restriction remains enabled as an additional security layer. Set `integrationOrigin` to the same HTTPS integration URL configured on the key:

```http
X-BLMPay-Origin: https://example.com
```

A mismatch can return `403 integration_domain_not_allowed`; a missing origin on a restricted key can return `403 integration_origin_required`.

## Legacy API v1 migration

API v1 uses Bearer authentication and remains available only during the migration window. To use an existing v1 key temporarily:

```js
const legacy = new BlmPay({
  apiKey: process.env.BLMPAY_API_KEY,
  apiVersion: 'v1',
  integrationOrigin: process.env.BLMPAY_INTEGRATION_ORIGIN
});
```

If `hmacSecret` is supplied and `apiVersion` is omitted, the SDK selects v2. If no HMAC secret is supplied, it falls back to v1 for backward compatibility. Do not build new integrations on v1.

## API v2 signing

The SDK signs:

```text
METHOD
REQUEST_TARGET
TIMESTAMP
NONCE
SHA256(RAW_BODY)
```

and sends:

```http
Authorization: BLMPay-HMAC <PUBLIC_API_KEY>
X-BLMPay-Timestamp: <unix-seconds>
X-BLMPay-Nonce: <unique-value>
X-BLMPay-Signature: <lowercase-hmac-sha256>
```

## API coverage

Payments, balance, payment links, invoices, payouts, payout fee quotes, supported banks, recipient name lookup, webhooks and USDT.

## Security

Keep both the public API key and HMAC secret on a trusted backend. Never expose merchant credentials in browser JavaScript, APK/IPA, mobile apps or source control. Use a unique idempotency key for each new payment or payout attempt.

OpenAPI: https://github.com/blmsoft/blmpay-openapi  
MCP: https://github.com/blmsoft/blmpay-mcp

MIT License. Powered by BLMSoft.
