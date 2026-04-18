# 163 Mail Body Fallback Design

## Goal

Make the `163` and `163-vip` mailbox polling flow able to read verification codes from the opened email body when the inbox list does not expose the six-digit code.

## Existing Problem

- `content/mail-163.js` currently matches candidate emails from the inbox list only.
- It extracts the code from the row subject text and the row `aria-label`.
- If the subject line only says something like "你的临时 ChatGPT 登录代码" and the row metadata does not include the code, polling fails even when the opened email body clearly shows the code.

## Approved Scope

- Add a body-reading fallback for `163` and `163-vip`.
- Keep the current list-based fast path.
- Do not add `targetEmail` filtering in this change.
- Keep cleanup as best effort only.

## Design Summary

`content/mail-163.js` will move from a single-stage detector to a two-stage detector:

1. Scan inbox rows exactly as today.
2. If a matching row does not contain a code in its subject or `aria-label`, open that email.
3. Read visible detail text from the opened mail view, including same-origin iframe content when available.
4. Extract the six-digit code from the opened content.
5. Return to the inbox before continuing.

## Architecture Notes

### Row-first detection stays in place

The existing sender, subject, time-window, and seen-code checks stay as the first filter because they are cheap and already fit the current provider flow.

### Opened-mail fallback is local to `content/mail-163.js`

The background verification flow does not need to change. The mailbox content script already owns the provider-specific polling behavior, so the new logic should stay inside the 163 content script.

### No target-email filtering in this revision

Step 8 already passes `targetEmail` through the background payload, but this revision intentionally leaves that field unused for 163. The goal is to fix the missing body fallback without widening the scope of behavior changes.

## Error Handling

- If opening a candidate mail does not reveal readable detail text, polling should continue to the next candidate or next round.
- If the helper opens a mail successfully, it should try to return to the inbox before continuing.
- Cleanup and deletion remain best effort and must not block successful code extraction.

## Testing Strategy

Add a focused regression test for `content/mail-163.js` that proves:

- a matching 163 inbox row without an inline code does not succeed from list text alone
- the script opens the row
- the script reads the opened body text
- the code extracted from the body is returned to the background flow
