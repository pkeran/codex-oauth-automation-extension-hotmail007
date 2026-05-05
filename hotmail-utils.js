(function hotmailUtilsModule(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
    return;
  }

  root.HotmailUtils = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createHotmailUtils() {
  const HOTMAIL_MAIL_API_URL = 'https://apple.882263.xyz/api/mail-new';
  const HOTMAIL_SERVICE_MODE_REMOTE = 'remote';
  const HOTMAIL_SERVICE_MODE_LOCAL = 'local';
  const HOTMAIL007_API_BASE_URL = 'https://gapi.hotmail007.com';
  const HOTMAIL007_MAIL_TYPES = [
    'hotmail',
    'outlook',
    'hotmail-premium',
    'outlook-premium',
    'hotmail Trusted',
    'outlook Trusted',
    'hotmail Trusted Graph',
    'outlook Trusted Graph',
    'Outlook-Argentina',
    'gmail',
  ];

  function normalizeText(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function normalizeTimestamp(value) {
    if (!value) return 0;
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value > 0 ? value : 0;
    }

    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function normalizeHotmailServiceMode(rawValue = '') {
    return String(rawValue || '').trim().toLowerCase() === HOTMAIL_SERVICE_MODE_REMOTE
      ? HOTMAIL_SERVICE_MODE_REMOTE
      : HOTMAIL_SERVICE_MODE_LOCAL;
  }

  function normalizeHotmail007MailType(rawValue = '') {
    const normalizedValue = String(rawValue || '').replace(/\s+/g, ' ').trim();
    if (!normalizedValue) return 'hotmail';

    const normalized = normalizedValue.toLowerCase();
    const knownTypes = new Map(
      HOTMAIL007_MAIL_TYPES.map((value) => [String(value).toLowerCase(), value])
    );
    return knownTypes.get(normalized) || normalizedValue;
  }

  function joinHotmail007Url(path) {
    return new URL(path, `${HOTMAIL007_API_BASE_URL}/`).toString();
  }

  function buildHotmail007BalanceUrl(options = {}) {
    const url = new URL(joinHotmail007Url('/api/user/balance'));
    url.searchParams.set('clientKey', String(options.clientKey || '').trim());
    return url.toString();
  }

  function buildHotmail007MailPriceListUrl() {
    return joinHotmail007Url('/v1/mail/getMailPrice');
  }

  function buildHotmail007GetMailUrl(options = {}) {
    const url = new URL(joinHotmail007Url('/api/mail/getMail'));
    url.searchParams.set('clientKey', String(options.clientKey || '').trim());
    url.searchParams.set('mailType', normalizeHotmail007MailType(options.mailType));
    url.searchParams.set('quantity', String(Math.max(1, Number(options.quantity) || 1)));
    return url.toString();
  }

  function buildHotmail007GetStockUrl(options = {}) {
    const url = new URL(joinHotmail007Url('/api/mail/getStock'));
    url.searchParams.set('mailType', normalizeHotmail007MailType(options.mailType));
    return url.toString();
  }

  function normalizeHotmail007StockCount(payload) {
    function parseCount(value) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.max(0, Math.floor(value));
      }
      if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return Math.max(0, Math.floor(parsed));
        }
      }
      return null;
    }

    const directCount = parseCount(payload);
    if (directCount !== null) {
      return directCount;
    }

    const objectPayload = payload && typeof payload === 'object' ? payload : {};
    const directCandidates = [
      objectPayload.data,
      objectPayload.count,
      objectPayload.stock,
      objectPayload.available,
      objectPayload.total,
    ];
    for (const candidate of directCandidates) {
      const parsed = parseCount(candidate);
      if (parsed !== null) {
        return parsed;
      }
    }

    const nestedPayload = objectPayload.data && typeof objectPayload.data === 'object'
      ? objectPayload.data
      : {};
    const nestedCandidates = [
      nestedPayload.count,
      nestedPayload.stock,
      nestedPayload.available,
      nestedPayload.total,
    ];
    for (const candidate of nestedCandidates) {
      const parsed = parseCount(candidate);
      if (parsed !== null) {
        return parsed;
      }
    }

    return 0;
  }

  function normalizeHotmail007BalanceAmount(payload) {
    const directValue = Number(payload);
    if (Number.isFinite(directValue)) {
      return directValue;
    }

    const objectPayload = payload && typeof payload === 'object' ? payload : {};
    const candidates = [
      objectPayload.data,
      objectPayload.balance,
      objectPayload.amount,
      objectPayload.value,
    ];
    for (const candidate of candidates) {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return 0;
  }

  function normalizeHotmail007MailPriceList(payload) {
    const rawEntries = Array.isArray(payload)
      ? payload
      : (Array.isArray(payload?.data) ? payload.data : []);

    return rawEntries
      .map((entry) => {
        const type = normalizeHotmail007MailType(entry?.type);
        if (!type) {
          return null;
        }

        const price = Number(entry?.price);
        const stock = normalizeHotmail007StockCount(entry?.stock);
        return {
          id: String(entry?.id || '').trim(),
          type,
          price: Number.isFinite(price) ? price : 0,
          live: String(entry?.live || '').trim(),
          access: String(entry?.access ?? '').trim(),
          stock,
        };
      })
      .filter(Boolean);
  }

  function buildHotmail007StockUnavailableMessage(mailType, count = 0) {
    const normalizedMailType = normalizeHotmail007MailType(mailType);
    const normalizedCount = Math.max(0, Math.floor(Number(count) || 0));
    return `Hotmail007 \u5f53\u524d\u5e93\u5b58\u4e3a ${normalizedCount}\uff1a${normalizedMailType}\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u6216\u5207\u6362\u5176\u5b83\u91c7\u8d2d\u7c7b\u578b\u3002`;
  }

  function parseHotmail007AccountString(rawValue = '') {
    const value = String(rawValue || '').trim();
    if (!value) {
      return null;
    }

    const firstSeparator = value.indexOf(':');
    const secondSeparator = firstSeparator >= 0 ? value.indexOf(':', firstSeparator + 1) : -1;
    const lastSeparator = value.lastIndexOf(':');
    if (firstSeparator <= 0 || secondSeparator <= firstSeparator || lastSeparator <= secondSeparator) {
      return null;
    }

    const email = value.slice(0, firstSeparator).trim();
    const password = value.slice(firstSeparator + 1, secondSeparator).trim();
    const refreshToken = value.slice(secondSeparator + 1, lastSeparator).trim();
    const clientId = value.slice(lastSeparator + 1).trim();
    if (!email || !refreshToken || !clientId) {
      return null;
    }

    return {
      email,
      password,
      refreshToken,
      clientId,
    };
  }

  function extractVerificationCode(text) {
    const source = String(text || '');
    const matchCn = source.match(/(?:代码为|验证码[^0-9]*?)[\s：:]*(\d{6})/i);
    if (matchCn) return matchCn[1];

    const matchOpenAiLogin = source.match(/(?:chatgpt\s+log-?in\s+code|enter\s+this\s+code)[^0-9]{0,24}(\d{6})/i);
    if (matchOpenAiLogin) return matchOpenAiLogin[1];

    const matchEn = source.match(/code(?:\s+is|[\s:])+(\d{6})/i);
    if (matchEn) return matchEn[1];

    const matchStandalone = source.match(/\b(\d{6})\b/);
    return matchStandalone ? matchStandalone[1] : null;
  }

  function extractVerificationCodeFromMessage(message = {}) {
    const sender = firstNonEmptyString([
      message?.from?.emailAddress?.address,
      message?.sender,
      message?.from,
    ]);
    const subject = firstNonEmptyString([message?.subject]);
    const preview = firstNonEmptyString([message?.bodyPreview, message?.preview, message?.text]);
    return extractVerificationCode([subject, preview, sender].filter(Boolean).join(' '));
  }

  function getLatestHotmailMessage(messages) {
    return (Array.isArray(messages) ? messages : [])
      .slice()
      .sort((left, right) => {
        const leftTime = normalizeTimestamp(left?.receivedDateTime);
        const rightTime = normalizeTimestamp(right?.receivedDateTime);
        return rightTime - leftTime;
      })[0] || null;
  }

  function getHotmailListToggleLabel(expanded, count = 0) {
    const normalizedCount = Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0;
    const suffix = normalizedCount > 0 ? `（${normalizedCount}）` : '';
    return `${expanded ? '收起列表' : '展开列表'}${suffix}`;
  }

  function filterHotmailAccountsByUsage(accounts, mode = 'all') {
    const list = Array.isArray(accounts) ? accounts.slice() : [];
    if (mode === 'used') {
      return list.filter((account) => Boolean(account?.used));
    }
    return list;
  }

  function getHotmailBulkActionLabel(mode = 'all', count = 0) {
    const normalizedCount = Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0;
    const prefix = mode === 'used' ? '清空已用' : '全部删除';
    const suffix = normalizedCount > 0 ? `（${normalizedCount}）` : '';
    return `${prefix}${suffix}`;
  }

  function isAuthorizedHotmailAccount(account) {
    return Boolean(account)
      && account.status === 'authorized'
      && !account.used
      && Boolean(account.refreshToken);
  }

  function shouldClearHotmailCurrentSelection(account) {
    return Boolean(account) && account.used === true;
  }

  function upsertHotmailAccountInList(accounts, nextAccount) {
    const list = Array.isArray(accounts) ? accounts.slice() : [];
    if (!nextAccount?.id) return list;

    const existingIndex = list.findIndex((account) => account?.id === nextAccount.id);
    if (existingIndex === -1) {
      list.push(nextAccount);
      return list;
    }

    list[existingIndex] = nextAccount;
    return list;
  }

  function pickHotmailAccountForRun(accounts, options = {}) {
    const candidates = Array.isArray(accounts) ? accounts.filter(isAuthorizedHotmailAccount) : [];
    if (!candidates.length) return null;

    const excludeIds = new Set((options.excludeIds || []).filter(Boolean));
    const filtered = candidates.filter((account) => !excludeIds.has(account.id));
    const pool = filtered.length ? filtered : candidates;

    return pool
      .slice()
      .sort((left, right) => {
        const leftUsedAt = normalizeTimestamp(left.lastUsedAt);
        const rightUsedAt = normalizeTimestamp(right.lastUsedAt);
        if (leftUsedAt !== rightUsedAt) {
          return leftUsedAt - rightUsedAt;
        }

        return String(left.email || '').localeCompare(String(right.email || ''));
      })[0] || null;
  }

  function messageMatchesFilters(message, filters = {}) {
    const senderFilters = (filters.senderFilters || []).map(normalizeText).filter(Boolean);
    const subjectFilters = (filters.subjectFilters || []).map(normalizeText).filter(Boolean);
    const afterTimestamp = normalizeTimestamp(filters.afterTimestamp);
    const receivedAt = normalizeTimestamp(message?.receivedDateTime);
    if (afterTimestamp && receivedAt && receivedAt < afterTimestamp) {
      return null;
    }

    const sender = normalizeText(message?.from?.emailAddress?.address);
    const subject = normalizeText(message?.subject);
    const preview = String(message?.bodyPreview || '');
    const combinedText = [subject, sender, preview].filter(Boolean).join(' ');
    const code = extractVerificationCode(combinedText);
    const excludedCodes = new Set((filters.excludeCodes || []).filter(Boolean));
    if (code && excludedCodes.has(code)) {
      return null;
    }

    const senderMatch = senderFilters.length === 0
      ? true
      : senderFilters.some((item) => sender.includes(item) || normalizeText(preview).includes(item));
    const subjectMatch = subjectFilters.length === 0
      ? true
      : subjectFilters.some((item) => subject.includes(item) || normalizeText(preview).includes(item));

    if (!senderMatch && !subjectMatch) {
      return null;
    }

    if (!code) {
      return null;
    }

    return {
      code,
      message,
      receivedAt,
    };
  }

  function pickVerificationMessage(messages, filters = {}) {
    const matches = (Array.isArray(messages) ? messages : [])
      .map((message) => messageMatchesFilters(message, filters))
      .filter(Boolean)
      .sort((left, right) => right.receivedAt - left.receivedAt);

    return matches[0] || null;
  }

  function pickVerificationMessageWithFallback(messages, filters = {}) {
    const strictMatch = pickVerificationMessage(messages, filters);
    return {
      match: strictMatch || null,
      usedRelaxedFilters: false,
      usedTimeFallback: false,
    };
  }

  function pickVerificationMessageWithTimeFallback(messages, filters = {}) {
    const strictOrRelaxedResult = pickVerificationMessageWithFallback(messages, filters);
    if (strictOrRelaxedResult.match) {
      return strictOrRelaxedResult;
    }

    const timeFallbackMatch = pickVerificationMessage(messages, {
      afterTimestamp: 0,
      excludeCodes: filters.excludeCodes,
      senderFilters: filters.senderFilters,
      subjectFilters: filters.subjectFilters,
    });

    return {
      match: timeFallbackMatch || null,
      usedRelaxedFilters: false,
      usedTimeFallback: Boolean(timeFallbackMatch),
    };
    /* c8 ignore stop */
  }

  function firstNonEmptyString(values) {
    for (const value of values) {
      if (value === undefined || value === null) continue;
      const normalized = String(value).trim();
      if (normalized) return normalized;
    }
    return '';
  }

  function normalizeMailAddress(rawValue) {
    if (!rawValue) return '';
    if (typeof rawValue === 'string') {
      return rawValue.trim();
    }
    if (typeof rawValue === 'object') {
      return firstNonEmptyString([
        rawValue.emailAddress?.address,
        rawValue.address,
        rawValue.email,
        rawValue.sender,
        rawValue.from,
      ]);
    }
    return '';
  }

  function stripHtmlTags(text) {
    return String(text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function normalizeHotmailMailApiMessage(message = {}) {
    return {
      id: firstNonEmptyString([message.id, message.message_id, message.messageId, message.internetMessageId]),
      subject: firstNonEmptyString([message.subject, message.title]),
      from: {
        emailAddress: {
          address: normalizeMailAddress(
            message.from_email
            || message.sender_email
            || message.from
            || message.sender
            || message.emailAddress
          ),
        },
      },
      bodyPreview: firstNonEmptyString([
        message.bodyPreview,
        message.preview,
        message.snippet,
        message.text,
        message.body,
        stripHtmlTags(message.html || message.content || ''),
      ]),
      receivedDateTime: firstNonEmptyString([
        message.receivedDateTime,
        message.received_at,
        message.receivedAt,
        message.date,
        message.created_at,
        message.time,
      ]),
    };
  }

  function normalizeHotmailMailApiMessages(messages) {
    const list = Array.isArray(messages)
      ? messages
      : (messages ? [messages] : []);
    return list.map((message) => normalizeHotmailMailApiMessage(message));
  }

  function buildHotmailMailApiLatestUrl(options) {
    const apiUrl = String(options?.apiUrl || '').trim() || HOTMAIL_MAIL_API_URL;
    const url = new URL(apiUrl);
    url.searchParams.set('refresh_token', String(options?.refreshToken || ''));
    url.searchParams.set('client_id', String(options?.clientId || ''));
    url.searchParams.set('email', String(options?.email || ''));
    url.searchParams.set('mailbox', String(options?.mailbox || 'INBOX'));
    const responseType = options?.responseType === undefined || options?.responseType === null
      ? 'json'
      : String(options.responseType).trim();
    if (responseType) {
      url.searchParams.set('response_type', responseType);
    }
    return url.toString();
  }

  function getHotmailVerificationPollConfig(step) {
    if (step === 4 || step === 7) {
      return {
        initialDelayMs: 5000,
        maxAttempts: 12,
        intervalMs: 5000,
        requestFreshCodeFirst: false,
        ignorePersistedLastCode: true,
      };
    }

    return {
      initialDelayMs: 5000,
      maxAttempts: 8,
      intervalMs: 4000,
      requestFreshCodeFirst: false,
      ignorePersistedLastCode: true,
    };
  }

  function getHotmailVerificationRequestTimestamp(step, state = {}, options = {}) {
    const bufferMs = Number(options.bufferMs) || 15_000;
    const signupRequestedAt = normalizeTimestamp(state.signupVerificationRequestedAt);
    const loginRequestedAt = normalizeTimestamp(state.loginVerificationRequestedAt);
    const lastEmailTimestamp = normalizeTimestamp(state.lastEmailTimestamp);
    const flowStartTime = normalizeTimestamp(state.flowStartTime);

    if (step === 4 && signupRequestedAt) {
      return Math.max(0, signupRequestedAt - bufferMs);
    }

    if (step === 7 && loginRequestedAt) {
      return Math.max(0, loginRequestedAt - bufferMs);
    }

    return step === 7
      ? (lastEmailTimestamp || flowStartTime || 0)
      : (flowStartTime || 0);
  }

  function getHotmailMailApiRequestConfig() {
    return {
      timeoutMs: 15000,
    };
  }

  function parseHotmailImportText(rawText) {
    const lines = String(rawText || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    return lines
      .filter((line, index) => !(index === 0 && /^账号----密码----ID----Token$/i.test(line)))
      .map((line) => line.split('----').map((part) => part.trim()))
      .filter((parts) => parts.length >= 4 && parts[0] && parts[2])
      .map(([email, password, clientId, refreshToken]) => ({
        email,
        password,
        clientId,
        refreshToken,
      }));
  }

  return {
    buildHotmail007BalanceUrl,
    buildHotmailMailApiLatestUrl,
    buildHotmail007GetMailUrl,
    buildHotmail007GetStockUrl,
    buildHotmail007MailPriceListUrl,
    buildHotmail007StockUnavailableMessage,
    extractVerificationCodeFromMessage,
    filterHotmailAccountsByUsage,
    extractVerificationCode,
    getLatestHotmailMessage,
    getHotmailBulkActionLabel,
    getHotmailListToggleLabel,
    getHotmailMailApiRequestConfig,
    getHotmailVerificationPollConfig,
    getHotmailVerificationRequestTimestamp,
    normalizeHotmail007BalanceAmount,
    normalizeHotmail007MailPriceList,
    isAuthorizedHotmailAccount,
    normalizeHotmail007MailType,
    normalizeHotmail007StockCount,
    normalizeHotmailServiceMode,
    normalizeHotmailMailApiMessages,
    normalizeTimestamp,
    parseHotmail007AccountString,
    parseHotmailImportText,
    pickHotmailAccountForRun,
    pickVerificationMessage,
    pickVerificationMessageWithFallback,
    pickVerificationMessageWithTimeFallback,
    shouldClearHotmailCurrentSelection,
    upsertHotmailAccountInList,
  };
});
