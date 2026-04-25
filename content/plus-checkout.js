// content/plus-checkout.js — ChatGPT Plus checkout helper.

console.log('[MultiPage:plus-checkout] Content script loaded on', location.href);

const PLUS_CHECKOUT_LISTENER_SENTINEL = 'data-multipage-plus-checkout-listener';
const PLUS_CHECKOUT_PAYLOAD = {
  entry_point: 'all_plans_pricing_modal',
  plan_name: 'chatgptplusplan',
  billing_details: {
    country: 'DE',
    currency: 'EUR',
  },
  checkout_ui_mode: 'custom',
  promo_campaign: {
    promo_campaign_id: 'plus-1-month-free',
    is_coupon_from_query_param: false,
  },
};

if (document.documentElement.getAttribute(PLUS_CHECKOUT_LISTENER_SENTINEL) !== '1') {
  document.documentElement.setAttribute(PLUS_CHECKOUT_LISTENER_SENTINEL, '1');

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (
      message.type === 'CREATE_PLUS_CHECKOUT'
      || message.type === 'FILL_PLUS_BILLING_AND_SUBMIT'
      || message.type === 'PLUS_CHECKOUT_GET_STATE'
    ) {
      resetStopState();
      handlePlusCheckoutCommand(message).then((result) => {
        sendResponse({ ok: true, ...(result || {}) });
      }).catch((err) => {
        if (isStopError(err)) {
          sendResponse({ stopped: true, error: err.message });
          return;
        }
        sendResponse({ error: err.message });
      });
      return true;
    }
  });
} else {
  console.log('[MultiPage:plus-checkout] 消息监听已存在，跳过重复注册');
}

async function handlePlusCheckoutCommand(message) {
  switch (message.type) {
    case 'CREATE_PLUS_CHECKOUT':
      return createPlusCheckoutSession();
    case 'FILL_PLUS_BILLING_AND_SUBMIT':
      return fillPlusBillingAndSubmit(message.payload || {});
    case 'PLUS_CHECKOUT_GET_STATE':
      return inspectPlusCheckoutState();
    default:
      throw new Error(`plus-checkout.js 不处理消息：${message.type}`);
  }
}

async function waitUntil(predicate, options = {}) {
  const intervalMs = Math.max(50, Math.floor(Number(options.intervalMs) || 250));
  const label = String(options.label || '条件').trim() || '条件';
  while (true) {
    throwIfStopped();
    const value = await predicate();
    if (value) {
      return value;
    }
    await sleep(intervalMs);
  }
}

async function waitForDocumentComplete() {
  await waitUntil(() => document.readyState === 'complete', {
    label: '页面加载完成',
    intervalMs: 200,
  });
  await sleep(1000);
}

function isVisibleElement(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return style.display !== 'none'
    && style.visibility !== 'hidden'
    && Number(rect.width) > 0
    && Number(rect.height) > 0;
}

function normalizeText(text = '') {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function getActionText(el) {
  return normalizeText([
    el?.textContent,
    el?.value,
    el?.getAttribute?.('aria-label'),
    el?.getAttribute?.('title'),
    el?.getAttribute?.('placeholder'),
    el?.getAttribute?.('name'),
    el?.id,
  ].filter(Boolean).join(' '));
}

function getFieldText(el) {
  const id = el?.id || '';
  const labels = [];
  if (id) {
    labels.push(...Array.from(document.querySelectorAll(`label[for="${CSS.escape(id)}"]`)).map((label) => label.textContent));
  }
  const wrappingLabel = el?.closest?.('label');
  if (wrappingLabel) {
    labels.push(wrappingLabel.textContent);
  }
  const container = el?.closest?.('[data-testid], [class], div, section, fieldset');
  if (container) {
    labels.push(container.textContent);
  }
  return normalizeText([
    getActionText(el),
    ...labels,
  ].filter(Boolean).join(' '));
}

function getVisibleControls(selector) {
  return Array.from(document.querySelectorAll(selector)).filter(isVisibleElement);
}

function findClickableByText(patterns) {
  const normalizedPatterns = (Array.isArray(patterns) ? patterns : [patterns])
    .filter(Boolean);
  const candidates = getVisibleControls('button, a, [role="button"], input[type="button"], input[type="submit"], [tabindex]');
  return candidates.find((el) => {
    const text = getActionText(el);
    return normalizedPatterns.some((pattern) => pattern.test(text));
  }) || null;
}

function isEnabledControl(el) {
  return Boolean(el)
    && !el.disabled
    && el.getAttribute?.('aria-disabled') !== 'true';
}

function getVisibleTextInputs() {
  return getVisibleControls('input, textarea')
    .filter((el) => {
      const type = String(el.getAttribute('type') || el.type || '').trim().toLowerCase();
      return !['hidden', 'checkbox', 'radio', 'submit', 'button', 'file'].includes(type);
    });
}

function findInputByFieldText(patterns, options = {}) {
  const inputs = getVisibleTextInputs();
  const excluded = options.exclude || (() => false);
  return inputs.find((input) => {
    if (excluded(input)) return false;
    const text = getFieldText(input);
    return patterns.some((pattern) => pattern.test(text));
  }) || null;
}

async function createPlusCheckoutSession() {
  await waitForDocumentComplete();
  log('Plus：正在读取 ChatGPT 登录会话...');

  const sessionResponse = await fetch('/api/auth/session', {
    credentials: 'include',
  });
  const session = await sessionResponse.json().catch(() => ({}));
  const accessToken = session?.accessToken;
  if (!accessToken) {
    throw new Error('请先登录 ChatGPT，当前页面未返回可用 accessToken。');
  }

  log('Plus：正在创建 checkout 会话...');
  const response = await fetch('https://chatgpt.com/backend-api/payments/checkout', {
    method: 'POST',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(PLUS_CHECKOUT_PAYLOAD),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.checkout_session_id) {
    const detail = data?.detail || data?.message || `HTTP ${response.status}`;
    throw new Error(`创建 Plus Checkout 失败：${detail}`);
  }

  return {
    checkoutUrl: `https://chatgpt.com/checkout/openai_ie/${data.checkout_session_id}`,
    country: PLUS_CHECKOUT_PAYLOAD.billing_details.country,
    currency: PLUS_CHECKOUT_PAYLOAD.billing_details.currency,
  };
}

async function selectPayPalPaymentMethod() {
  const paypalPattern = /paypal/i;
  const existingSelected = findClickableByText([/paypal/i]);
  if (existingSelected) {
    simulateClick(existingSelected);
    await sleep(600);
    return true;
  }

  const radios = getVisibleControls('input[type="radio"], [role="radio"]');
  const paypalRadio = radios.find((el) => paypalPattern.test(getFieldText(el)));
  if (paypalRadio) {
    simulateClick(paypalRadio);
    await sleep(600);
    return true;
  }

  throw new Error('Plus Checkout：未找到 PayPal 付款方式。');
}

async function fillFullName(fullName) {
  const value = normalizeText(fullName);
  if (!value) return false;
  const input = findInputByFieldText([
    /full\s*name|name\s*on|cardholder|billing\s*name/i,
    /姓名|全名|持卡人/i,
  ]);
  if (!input) {
    return false;
  }
  fillInput(input, value);
  await sleep(300);
  return true;
}

function readCountryText() {
  const countryInput = findInputByFieldText([
    /country|region/i,
    /国家|地区/i,
  ]);
  if (countryInput?.value) {
    return countryInput.value;
  }
  const countrySelect = getVisibleControls('select').find((select) => /country|region|国家|地区/i.test(getFieldText(select)));
  if (countrySelect) {
    const option = countrySelect.selectedOptions?.[0];
    return option?.textContent || countrySelect.value || '';
  }
  return '';
}

function isLikelyAddressSearchInput(input) {
  const text = getFieldText(input);
  if (/name|email|e-mail|phone|tel|password|coupon|promo|country|region|postal|zip|city|state|province|全名|姓名|邮箱|电话|密码|国家|地区|邮编|城市|省|州/i.test(text)) {
    return false;
  }
  if (/address|street|billing|search|line\s*1|地址|街道|账单/i.test(text)) {
    return true;
  }
  return false;
}

async function findAddressSearchInput() {
  return waitUntil(() => {
    const direct = findInputByFieldText([
      /address|street|billing|search|line\s*1/i,
      /地址|街道|账单/i,
    ], {
      exclude: (input) => /city|state|province|postal|zip|country|城市|省|州|邮编|国家|地区/i.test(getFieldText(input)),
    });
    if (direct) return direct;
    const candidates = getVisibleTextInputs().filter(isLikelyAddressSearchInput);
    return candidates[0] || null;
  }, {
    label: '地址搜索输入框',
    intervalMs: 250,
  });
}

function getAddressSuggestions() {
  const selectors = [
    '[role="listbox"] [role="option"]',
    '[role="option"]',
    '.pac-container .pac-item',
    '[data-testid*="address" i] [role="option"]',
    'li',
  ];
  const seen = new Set();
  const results = [];
  for (const selector of selectors) {
    for (const el of Array.from(document.querySelectorAll(selector))) {
      if (!isVisibleElement(el)) continue;
      const text = normalizeText(el.textContent || el.getAttribute?.('aria-label') || '');
      if (!text || text.length < 3) continue;
      const key = `${selector}:${text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(el);
    }
  }
  return results;
}

async function selectAddressSuggestion(seed) {
  const addressInput = await findAddressSearchInput();
  fillInput(addressInput, seed.query || 'Berlin Mitte');
  await sleep(800);

  const suggestions = await waitUntil(() => {
    const options = getAddressSuggestions();
    return options.length ? options : null;
  }, {
    label: '地址推荐列表',
    intervalMs: 250,
  });

  const suggestionIndex = Math.max(0, Math.min(
    suggestions.length - 1,
    Math.floor(Number(seed.suggestionIndex) || 0)
  ));
  const target = suggestions[suggestionIndex] || suggestions[0];
  simulateClick(target);
  await sleep(1200);
  return {
    selectedText: normalizeText(target.textContent || ''),
    suggestionIndex,
  };
}

function getStructuredAddressFields() {
  const address1 = findInputByFieldText([
    /address\s*(?:line)?\s*1|street/i,
    /地址\s*1|街道|详细地址/i,
  ]);
  const address2 = findInputByFieldText([
    /address\s*(?:line)?\s*2|apt|suite|unit/i,
    /地址\s*2|公寓|单元|门牌/i,
  ]);
  const city = findInputByFieldText([
    /city|town|suburb/i,
    /城市|市区/i,
  ]);
  const region = findInputByFieldText([
    /state|province|region|county/i,
    /省|州|地区/i,
  ]);
  const postalCode = findInputByFieldText([
    /postal|zip|postcode/i,
    /邮编|邮政/i,
  ]);
  return { address1, address2, city, region, postalCode };
}

function fillIfEmpty(input, value) {
  if (!input || !value) return false;
  if (String(input.value || '').trim()) return false;
  fillInput(input, value);
  return true;
}

async function ensureStructuredAddress(seed) {
  const fallback = seed?.fallback || {};
  const fields = await waitUntil(() => {
    const currentFields = getStructuredAddressFields();
    if (currentFields.address1 || currentFields.city || currentFields.postalCode) {
      return currentFields;
    }
    return null;
  }, {
    label: '结构化账单地址字段',
    intervalMs: 250,
  });

  fillIfEmpty(fields.address1, fallback.address1);
  fillIfEmpty(fields.city, fallback.city);
  fillIfEmpty(fields.region, fallback.region);
  fillIfEmpty(fields.postalCode, fallback.postalCode);
  await sleep(500);

  const latest = getStructuredAddressFields();
  const missing = [];
  if (!String(latest.address1?.value || '').trim()) missing.push('地址1');
  if (!String(latest.city?.value || '').trim()) missing.push('城市');
  if (!String(latest.postalCode?.value || '').trim()) missing.push('邮编');
  if (missing.length) {
    throw new Error(`Plus Checkout：账单地址字段未填写完整：${missing.join('、')}。`);
  }

  return {
    address1: latest.address1?.value || '',
    city: latest.city?.value || '',
    region: latest.region?.value || '',
    postalCode: latest.postalCode?.value || '',
  };
}

function findSubscribeButton() {
  return findClickableByText([
    /订阅|继续|确认|支付/i,
    /subscribe|continue|confirm|pay|start\s*subscription|place\s*order/i,
  ]);
}

async function fillPlusBillingAndSubmit(payload = {}) {
  await waitForDocumentComplete();
  await selectPayPalPaymentMethod();
  await fillFullName(payload.fullName || '');

  const countryText = readCountryText();
  const seed = payload.addressSeed || {
    query: 'Berlin Mitte',
    suggestionIndex: 1,
    fallback: {
      address1: 'Unter den Linden',
      city: 'Berlin',
      region: 'Berlin',
      postalCode: '10117',
    },
  };
  const selected = await selectAddressSuggestion(seed);
  const structuredAddress = await ensureStructuredAddress(seed);

  const subscribeButton = await waitUntil(() => {
    const button = findSubscribeButton();
    return button && isEnabledControl(button) ? button : null;
  }, {
    label: '订阅按钮',
    intervalMs: 250,
  });

  simulateClick(subscribeButton);
  return {
    countryText,
    selectedAddressText: selected.selectedText,
    structuredAddress,
  };
}

function inspectPlusCheckoutState() {
  const structuredAddress = getStructuredAddressFields();
  return {
    url: location.href,
    readyState: document.readyState,
    countryText: readCountryText(),
    hasPayPal: Boolean(findClickableByText([/paypal/i])),
    hasSubscribeButton: Boolean(findSubscribeButton()),
    addressFieldValues: {
      address1: structuredAddress.address1?.value || '',
      city: structuredAddress.city?.value || '',
      region: structuredAddress.region?.value || '',
      postalCode: structuredAddress.postalCode?.value || '',
    },
  };
}
