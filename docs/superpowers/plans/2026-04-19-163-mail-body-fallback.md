# 163 Mail Body Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the 163 mailbox provider read verification codes from opened email bodies when the inbox list does not show the code inline.

**Architecture:** Keep the existing list-first polling flow in `content/mail-163.js`, then add a provider-local fallback that opens candidate messages, reads body text, and returns to the inbox before continuing. Do not add `targetEmail` filtering in this change.

**Tech Stack:** Manifest V3 Chrome extension, plain JavaScript content scripts, Node built-in test runner

---

### Task 1: Lock the regression with a failing test

**Files:**
- Create: `D:\github\codex-oauth-automation-extension-Pro2.0\tests\mail-163-content.test.js`
- Test: `D:\github\codex-oauth-automation-extension-Pro2.0\tests\mail-163-content.test.js`

- [ ] **Step 1: Write the failing test**

```js
test('handlePollEmail opens a matching 163 message and reads the body when the list row has no inline code', async () => {
  const bundle = extractFunction('handlePollEmail');
  const api = new Function(`...`)();
  const result = await api.handlePollEmail(8, {
    senderFilters: ['openai'],
    subjectFilters: ['chatgpt'],
    maxAttempts: 1,
    intervalMs: 1,
  });
  assert.equal(result.code, '480382');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/mail-163-content.test.js`
Expected: FAIL because `handlePollEmail` never opens the message body.

### Task 2: Add the 163 opened-mail fallback

**Files:**
- Modify: `D:\github\codex-oauth-automation-extension-Pro2.0\content\mail-163.js`
- Test: `D:\github\codex-oauth-automation-extension-Pro2.0\tests\mail-163-content.test.js`

- [ ] **Step 1: Add minimal helpers**

```js
function findInboxLink() { /* find the 163 inbox entry */ }
async function returnToInbox() { /* restore inbox list view */ }
function readOpenedMailText() { /* read visible detail text and iframe text */ }
async function openMailAndGetMessageText(item) { /* open, read, return */ }
```

- [ ] **Step 2: Update `handlePollEmail`**

```js
if (!code) {
  const openedText = await openMailAndGetMessageText(item);
  const bodyCode = extractVerificationCode(openedText);
  if (bodyCode) {
    return { ok: true, code: bodyCode, emailTimestamp: Date.now(), mailId: id };
  }
}
```

- [ ] **Step 3: Run the targeted test**

Run: `node --test tests/mail-163-content.test.js`
Expected: PASS

### Task 3: Verify no regressions in adjacent polling logic

**Files:**
- Test: `D:\github\codex-oauth-automation-extension-Pro2.0\tests\mail-163-content.test.js`
- Test: `D:\github\codex-oauth-automation-extension-Pro2.0\tests\verification-flow-polling.test.js`

- [ ] **Step 1: Run the local regression slice**

Run: `node --test tests/mail-163-content.test.js tests/verification-flow-polling.test.js`
Expected: PASS

- [ ] **Step 2: Update docs only if behavior scope changed**

```md
No root docs update is required if the change stays inside existing 163 polling behavior and does not alter the documented top-level flow.
```
