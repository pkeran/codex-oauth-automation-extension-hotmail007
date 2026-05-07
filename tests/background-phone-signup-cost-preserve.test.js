const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background.js', 'utf8');

function extractFunction(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => source.indexOf(marker))
    .find((index) => index >= 0);
  if (start < 0) {
    throw new Error(`missing function ${name}`);
  }

  let parenDepth = 0;
  let signatureEnded = false;
  let braceStart = -1;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '(') {
      parenDepth += 1;
    } else if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        signatureEnded = true;
      }
    } else if (ch === '{' && signatureEnded) {
      braceStart = i;
      break;
    }
  }

  let depth = 0;
  let end = braceStart;
  for (; end < source.length; end += 1) {
    const ch = source[end];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }

  return source.slice(start, end);
}

test('setEmailStateSilently keeps completed signup phone activation for phone signup runs', async () => {
  const bundle = [
    extractFunction('setEmailStateSilently'),
  ].join('\n');

  const api = new Function(`
let currentState = {
  accountIdentifierType: 'phone',
  accountIdentifier: '66959916439',
  signupMethod: 'phone',
  resolvedSignupMethod: 'phone',
  signupPhoneNumber: '66959916439',
  signupPhoneCompletedActivation: {
    activationId: 'signup-123',
    phoneNumber: '66959916439',
    provider: 'hero-sms',
    price: 0.05,
    priceCurrency: 'USD',
    priceStatus: 'exact',
    costOutcome: 'consumed',
  },
};
const setStateCalls = [];
const broadcastCalls = [];
async function getState() {
  return currentState;
}
async function setState(updates) {
  setStateCalls.push(updates);
  currentState = { ...currentState, ...updates };
}
function broadcastDataUpdate(updates) {
  broadcastCalls.push(updates);
}
${bundle}
return {
  setEmailStateSilently,
  getStateSnapshot: () => currentState,
  getSetStateCalls: () => setStateCalls,
  getBroadcastCalls: () => broadcastCalls,
};
`)();

  await api.setEmailStateSilently('trusted-graph@hotmail.com');

  const snapshot = api.getStateSnapshot();
  assert.equal(snapshot.email, 'trusted-graph@hotmail.com');
  assert.equal(snapshot.accountIdentifierType, 'email');
  assert.equal(snapshot.accountIdentifier, 'trusted-graph@hotmail.com');
  assert.equal(snapshot.signupPhoneCompletedActivation?.activationId, 'signup-123');
  assert.equal(snapshot.signupPhoneCompletedActivation?.costOutcome, 'consumed');
  assert.equal(snapshot.signupPhoneNumber, '66959916439');
  assert.equal(api.getSetStateCalls()[0]?.signupPhoneCompletedActivation?.activationId || 'missing', 'signup-123');
  assert.equal(api.getBroadcastCalls()[0]?.signupPhoneCompletedActivation?.activationId || 'missing', 'signup-123');
});
