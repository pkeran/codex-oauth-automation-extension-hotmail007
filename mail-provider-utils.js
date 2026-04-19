const HOTMAIL_PROVIDER = 'hotmail-api';
const NETEASE_LIST_PATH = '/js6/main.jsp?df=mail163_letter#module=mbox.ListModule%7C%7B%22fid%22%3A1%2C%22order%22%3A%22date%22%2C%22desc%22%3Atrue%7D';

function normalizeMailProvider(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  switch (normalized) {
    case HOTMAIL_PROVIDER:
    case '163':
    case '163-vip':
    case '126':
    case 'qq':
    case 'inbucket':
      return normalized;
    default:
      return '163';
  }
}

function getMailProviderConfig(state = {}, options = {}) {
  const provider = normalizeMailProvider(state.mailProvider);
  const normalizeInbucketOrigin = options.normalizeInbucketOrigin || (() => '');

  if (provider === HOTMAIL_PROVIDER) {
    return { provider: HOTMAIL_PROVIDER, label: 'Hotmail（微软 Graph）' };
  }
  if (provider === '163') {
    return {
      source: 'mail-163',
      url: `https://mail.163.com${NETEASE_LIST_PATH}`,
      label: '163 邮箱',
    };
  }
  if (provider === '163-vip') {
    return {
      source: 'mail-163',
      url: `https://webmail.vip.163.com${NETEASE_LIST_PATH}`,
      label: '163 VIP 邮箱',
    };
  }
  if (provider === '126') {
    return {
      source: 'mail-163',
      url: `https://mail.126.com${NETEASE_LIST_PATH}`,
      label: '126 邮箱',
    };
  }
  if (provider === 'inbucket') {
    const host = normalizeInbucketOrigin(state.inbucketHost);
    const mailbox = String(state.inbucketMailbox || '').trim();
    if (!host) {
      return { error: 'Inbucket 主机地址为空或无效。' };
    }
    if (!mailbox) {
      return { error: 'Inbucket 邮箱名称为空。' };
    }
    return {
      source: 'inbucket-mail',
      url: `${host}/m/${encodeURIComponent(mailbox)}/`,
      label: `Inbucket 邮箱（${mailbox}）`,
      navigateOnReuse: true,
      inject: ['content/activation-utils.js', 'content/utils.js', 'content/inbucket-mail.js'],
      injectSource: 'inbucket-mail',
    };
  }
  return { source: 'qq-mail', url: 'https://wx.mail.qq.com/', label: 'QQ 邮箱' };
}

const api = {
  HOTMAIL_PROVIDER,
  getMailProviderConfig,
  normalizeMailProvider,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}

if (typeof self !== 'undefined') {
  self.MailProviderUtils = api;
}
