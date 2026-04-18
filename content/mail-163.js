// content/mail-163.js - Content script for 163 Mail (steps 4, 7)
// Injected on: mail.163.com / webmail.vip.163.com

const MAIL163_PREFIX = '[MultiPage:mail-163]';
const isTopFrame = window === window.top;

console.log(MAIL163_PREFIX, 'Content script loaded on', location.href, 'frame:', isTopFrame ? 'top' : 'child');

if (!isTopFrame) {
  console.log(MAIL163_PREFIX, 'Skipping child frame');
} else {
  let seenCodes = new Set();

  async function loadSeenCodes() {
    try {
      const data = await chrome.storage.session.get('seenCodes');
      if (data.seenCodes && Array.isArray(data.seenCodes)) {
        seenCodes = new Set(data.seenCodes);
        console.log(MAIL163_PREFIX, `Loaded ${seenCodes.size} previously seen codes`);
      }
    } catch (err) {
      console.warn(MAIL163_PREFIX, 'Session storage unavailable, using in-memory seen codes:', err?.message || err);
    }
  }

  loadSeenCodes();

  async function persistSeenCodes() {
    try {
      await chrome.storage.session.set({ seenCodes: [...seenCodes] });
    } catch (err) {
      console.warn(MAIL163_PREFIX, 'Could not persist seen codes, continuing in-memory only:', err?.message || err);
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type !== 'POLL_EMAIL') {
      return undefined;
    }

    resetStopState();
    handlePollEmail(message.step, message.payload)
      .then((result) => {
        sendResponse(result);
      })
      .catch((err) => {
        if (isStopError(err)) {
          log(`步骤 ${message.step}：已被用户停止。`, 'warn');
          sendResponse({ stopped: true, error: err.message });
          return;
        }

        log(`步骤 ${message.step}：邮箱轮询失败：${err.message}`, 'warn');
        sendResponse({ error: err.message });
      });

    return true;
  });

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function findMailItems() {
    return document.querySelectorAll('div[sign="letter"]');
  }

  function getCurrentMailIds(items = findMailItems()) {
    const ids = new Set();
    Array.from(items).forEach((item) => {
      const id = item.getAttribute('id') || '';
      if (id) ids.add(id);
    });
    return ids;
  }

  function normalizeMinuteTimestamp(timestamp) {
    if (!Number.isFinite(timestamp) || timestamp <= 0) return 0;
    const date = new Date(timestamp);
    date.setSeconds(0, 0);
    return date.getTime();
  }

  function parseMail163Timestamp(rawText) {
    const text = normalizeText(rawText);
    if (!text) return null;

    let match = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日\s+(\d{1,2}):(\d{2})/);
    if (match) {
      const [, year, month, day, hour, minute] = match;
      return new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        0,
        0
      ).getTime();
    }

    match = text.match(/\b(\d{1,2}):(\d{2})\b/);
    if (match) {
      const [, hour, minute] = match;
      const now = new Date();
      return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        Number(hour),
        Number(minute),
        0,
        0
      ).getTime();
    }

    return null;
  }

  function getMailTimestamp(item) {
    const candidates = [];
    const timeCell = item.querySelector('.e00[title], [title*="年"][title*=":"]');
    if (timeCell?.getAttribute('title')) candidates.push(timeCell.getAttribute('title'));
    if (timeCell?.textContent) candidates.push(timeCell.textContent);

    item.querySelectorAll('[title]').forEach((node) => {
      const title = node.getAttribute('title');
      if (title) candidates.push(title);
    });

    for (const candidate of candidates) {
      const parsed = parseMail163Timestamp(candidate);
      if (parsed) return parsed;
    }

    return null;
  }

  function scheduleEmailCleanup(item, step) {
    setTimeout(() => {
      Promise.resolve(deleteEmail(item, step)).catch(() => {
        // Cleanup is best effort only and must never affect the main verification flow.
      });
    }, 0);
  }

  function findInboxLink() {
    const direct = document.querySelector('.nui-tree-item-text[title="收件箱"]');
    if (direct) return direct;

    const inboxPattern = /(?:Inbox|\u6536\u4ef6\u7bb1)/i;
    const candidates = document.querySelectorAll('.nui-tree-item-text, .nui-tree-item, a, span, div');
    for (const node of candidates) {
      const text = normalizeText([
        node.getAttribute?.('title') || '',
        node.getAttribute?.('aria-label') || '',
        node.textContent || '',
      ].join(' '));
      if (inboxPattern.test(text)) {
        return node;
      }
    }

    return null;
  }

  function getMailPreviewText(item) {
    return normalizeText([
      item.querySelector('.nui-user')?.textContent || '',
      item.querySelector('span.da0')?.textContent || '',
      item.getAttribute('aria-label') || '',
    ].join(' '));
  }

  function readOpenedMailText() {
    const texts = [];
    const seenTexts = new Set();

    const pushText = (value) => {
      const normalized = normalizeText(value);
      if (!normalized || normalized.length < 20 || seenTexts.has(normalized)) {
        return;
      }
      seenTexts.add(normalized);
      texts.push(normalized);
    };

    const detailSelectors = [
      '.nui-iframe-body',
      '.nui-msgbox',
      '.mail-view',
      '.mail-detail',
      '.mail-reader',
      '.reader-main',
      '.reader-body',
      '.readMainWrap',
      '.mD0',
      '.oD0',
      '.nui-scroll',
    ];

    detailSelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => {
        pushText(node.innerText || node.textContent || '');
      });
    });

    document.querySelectorAll('iframe, frame').forEach((frame) => {
      try {
        const frameDoc = frame.contentDocument || frame.contentWindow?.document;
        if (!frameDoc) return;
        pushText(frameDoc.body?.innerText || frameDoc.body?.textContent || '');
      } catch (_) {
        // Ignore inaccessible frames.
      }
    });

    if (!texts.length) {
      pushText(document.body?.innerText || document.body?.textContent || '');
    }

    texts.sort((left, right) => right.length - left.length);
    return texts[0] || '';
  }

  async function returnToInbox() {
    if (findMailItems().length > 0) {
      return true;
    }

    const inboxLink = findInboxLink();
    if (inboxLink) {
      simulateClick(inboxLink);
    }

    for (let i = 0; i < 20; i += 1) {
      if (findMailItems().length > 0) {
        return true;
      }
      await sleep(250);
    }

    return false;
  }

  async function openMailAndGetMessageText(item) {
    const previewText = getMailPreviewText(item);

    simulateClick(item);

    let openedText = '';
    for (let i = 0; i < 24; i += 1) {
      const candidateText = readOpenedMailText();
      if (candidateText && candidateText !== previewText && candidateText.length >= previewText.length) {
        openedText = candidateText;
        if (extractVerificationCode(candidateText) || candidateText.length > previewText.length + 20) {
          break;
        }
      }
      await sleep(250);
    }

    await returnToInbox();
    return openedText;
  }

  async function handlePollEmail(step, payload) {
    const {
      senderFilters,
      subjectFilters,
      maxAttempts,
      intervalMs,
      excludeCodes = [],
      filterAfterTimestamp = 0,
    } = payload;
    const excludedCodeSet = new Set(excludeCodes.filter(Boolean));
    const filterAfterMinute = normalizeMinuteTimestamp(Number(filterAfterTimestamp) || 0);

    log(`步骤 ${step}：开始轮询 163 邮箱（最多 ${maxAttempts} 次）`);
    if (filterAfterMinute) {
      log(`步骤 ${step}：仅尝试 ${new Date(filterAfterMinute).toLocaleString('zh-CN', { hour12: false })} 及之后时间的邮件。`);
    }

    log(`步骤 ${step}：正在等待侧边栏加载...`);
    try {
      const inboxLink = await waitForElement('.nui-tree-item-text[title="收件箱"]', 5000);
      inboxLink.click();
      log(`步骤 ${step}：已点击收件箱`);
    } catch {
      log(`步骤 ${step}：未找到收件箱入口，继续尝试后续流程...`, 'warn');
    }

    log(`步骤 ${step}：正在等待邮件列表加载...`);
    let items = [];
    for (let i = 0; i < 20; i += 1) {
      items = findMailItems();
      if (items.length > 0) break;
      await sleep(500);
    }

    if (items.length === 0) {
      await refreshInbox();
      await sleep(2000);
      items = findMailItems();
    }

    if (items.length === 0) {
      throw new Error('163 邮箱列表未加载完成，请确认当前已打开收件箱。');
    }

    log(`步骤 ${step}：邮件列表已加载，共 ${items.length} 封邮件`);

    const existingMailIds = getCurrentMailIds(items);
    log(`步骤 ${step}：已记录当前 ${existingMailIds.size} 封旧邮件快照`);

    const FALLBACK_AFTER = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      log(`步骤 ${step}：正在轮询 163 邮箱，第 ${attempt}/${maxAttempts} 次`);

      if (attempt > 1) {
        await refreshInbox();
        await sleep(1000);
      }

      const allItems = findMailItems();
      const useFallback = attempt > FALLBACK_AFTER;

      for (const item of allItems) {
        const id = item.getAttribute('id') || '';
        const mailTimestamp = getMailTimestamp(item);
        const mailMinute = normalizeMinuteTimestamp(mailTimestamp || 0);
        const passesTimeFilter = !filterAfterMinute || (mailMinute && mailMinute >= filterAfterMinute);
        const shouldBypassOldSnapshot = Boolean(filterAfterMinute && passesTimeFilter && mailMinute > 0);

        if (!passesTimeFilter) {
          continue;
        }

        if (!useFallback && !shouldBypassOldSnapshot && existingMailIds.has(id)) {
          continue;
        }

        const sender = normalizeText(item.querySelector('.nui-user')?.textContent || '').toLowerCase();
        const subject = normalizeText(item.querySelector('span.da0')?.textContent || '');
        const ariaLabel = normalizeText(item.getAttribute('aria-label') || '').toLowerCase();

        const senderMatch = senderFilters.some((filter) => sender.includes(String(filter || '').toLowerCase()) || ariaLabel.includes(String(filter || '').toLowerCase()));
        const subjectMatch = subjectFilters.some((filter) => subject.toLowerCase().includes(String(filter || '').toLowerCase()) || ariaLabel.includes(String(filter || '').toLowerCase()));

        if (!senderMatch && !subjectMatch) {
          continue;
        }

        const previewCode = extractVerificationCode(`${subject} ${ariaLabel}`);
        if (previewCode) {
          if (excludedCodeSet.has(previewCode)) {
            log(`步骤 ${step}：跳过排除的验证码：${previewCode}`, 'info');
            continue;
          }
          if (seenCodes.has(previewCode)) {
            log(`步骤 ${step}：跳过已处理过的验证码：${previewCode}`, 'info');
            continue;
          }

          seenCodes.add(previewCode);
          persistSeenCodes();
          const source = useFallback && existingMailIds.has(id) ? '回退匹配邮件' : '新邮件';
          const timeLabel = mailTimestamp ? `，时间：${new Date(mailTimestamp).toLocaleString('zh-CN', { hour12: false })}` : '';
          log(`步骤 ${step}：已找到验证码：${previewCode}（来源：${source}${timeLabel}，主题：${subject.slice(0, 40)}）`, 'ok');

          scheduleEmailCleanup(item, step);
          return { ok: true, code: previewCode, emailTimestamp: Date.now(), mailId: id };
        }

        const openedText = await openMailAndGetMessageText(item);
        const bodyCode = extractVerificationCode(openedText);
        if (!bodyCode) {
          continue;
        }
        if (excludedCodeSet.has(bodyCode)) {
          log(`步骤 ${step}：跳过排除的验证码：${bodyCode}`, 'info');
          continue;
        }
        if (seenCodes.has(bodyCode)) {
          log(`步骤 ${step}：跳过已处理过的验证码：${bodyCode}`, 'info');
          continue;
        }

        seenCodes.add(bodyCode);
        persistSeenCodes();
        const source = useFallback && existingMailIds.has(id) ? '回退匹配邮件正文' : '新邮件正文';
        const timeLabel = mailTimestamp ? `，时间：${new Date(mailTimestamp).toLocaleString('zh-CN', { hour12: false })}` : '';
        log(`步骤 ${step}：已从 163 邮件正文中找到验证码：${bodyCode}（来源：${source}${timeLabel}，主题：${subject.slice(0, 40)}）`, 'ok');

        scheduleEmailCleanup(item, step);
        return { ok: true, code: bodyCode, emailTimestamp: Date.now(), mailId: id };
      }

      if (attempt === FALLBACK_AFTER + 1) {
        log(`步骤 ${step}：连续 ${FALLBACK_AFTER} 次未发现新邮件，开始回退到首封匹配邮件。`, 'warn');
      }

      if (attempt < maxAttempts) {
        await sleep(intervalMs);
      }
    }

    throw new Error(
      `${(maxAttempts * intervalMs / 1000).toFixed(0)} 秒后仍未在 163 邮箱中找到新的匹配邮件。` +
      '请手动检查收件箱。'
    );
  }

  async function deleteEmail(item, step) {
    try {
      log(`步骤 ${step}：正在删除邮件...`);

      item.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      item.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      await sleep(300);

      const trashIcon = item.querySelector('[sign="trash"], .nui-ico-delete, [title="删除邮件"]');
      if (trashIcon) {
        simulateClick(trashIcon);
        log(`步骤 ${step}：已点击删除图标`, 'ok');
        await sleep(1500);

        const stillExists = item.id ? document.getElementById(item.id) : item;
        if (!stillExists || stillExists.style?.display === 'none') {
          log(`步骤 ${step}：邮件已成功删除`);
        } else {
          log(`步骤 ${step}：邮件可能尚未删除，列表中仍可见`, 'warn');
        }
        return;
      }

      log(`步骤 ${step}：未找到删除图标，尝试使用复选框加工具栏删除...`);
      const checkbox = item.querySelector('[sign="checkbox"], .nui-chk');
      if (checkbox) {
        simulateClick(checkbox);
        await sleep(300);

        const toolbarBtns = document.querySelectorAll('.nui-btn .nui-btn-text');
        for (const btn of toolbarBtns) {
          if (normalizeText(btn.textContent || '').includes('删除')) {
            simulateClick(btn.closest('.nui-btn') || btn);
            log(`步骤 ${step}：已点击工具栏删除`, 'ok');
            await sleep(1500);
            return;
          }
        }
      }

      log(`步骤 ${step}：无法删除邮件（未找到删除按钮）`, 'warn');
    } catch (err) {
      log(`步骤 ${step}：删除邮件失败：${err.message}`, 'warn');
    }
  }

  async function refreshInbox() {
    const toolbarBtns = document.querySelectorAll('.nui-btn .nui-btn-text');
    for (const btn of toolbarBtns) {
      if (normalizeText(btn.textContent || '') === '刷新') {
        simulateClick(btn.closest('.nui-btn') || btn);
        console.log(MAIL163_PREFIX, 'Clicked refresh button');
        await sleep(800);
        return;
      }
    }

    const receiveButtons = document.querySelectorAll('.ra0');
    for (const btn of receiveButtons) {
      if (normalizeText(btn.textContent || '').includes('收信')) {
        simulateClick(btn);
        console.log(MAIL163_PREFIX, 'Clicked receive button');
        await sleep(800);
        return;
      }
    }

    const inboxLink = findInboxLink();
    if (inboxLink) {
      simulateClick(inboxLink);
      await sleep(800);
      return;
    }

    console.log(MAIL163_PREFIX, 'Could not find refresh button');
  }

  function extractVerificationCode(text) {
    const matchCn = String(text || '').match(/(?:代码为|验证码[^0-9]*?)[\s：:]*(\d{6})/);
    if (matchCn) return matchCn[1];

    const matchEn = String(text || '').match(/code[:\s]+is[:\s]+(\d{6})|code[:\s]+(\d{6})/i);
    if (matchEn) return matchEn[1] || matchEn[2];

    const match6 = String(text || '').match(/\b(\d{6})\b/);
    if (match6) return match6[1];

    return null;
  }
}
