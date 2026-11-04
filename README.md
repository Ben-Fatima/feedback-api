# Feedback API

A small Node.js API that collects product feedback. No dependencies. It also
has two measured fixes: input hardening, and rate limiting.

## What it does

- `POST /api/feedback`: accepts `{ article_id, vote, comment }`. Vote is -1, 0 or 1.
- A browser form at `http://localhost:3000`. It shows API errors, including 429.

## Setup

- `node server.js` → http://localhost:3000. No install, no build.

---

## Case study 1: input hardening

**The problem.** The endpoint accepted anything. Big bodies, broken JSON, any
vote value, very long comments. It also logged raw user text, so a comment
could write fake lines into the logs.

**The fix.** Validate everything before using it:

- Reject bodies over the size limit with `413`. Stop reading early.
- Bad JSON gets a clean `400`, not a crash.
- Vote must be -1, 0 or 1. Comments have a length cap.
- Logs are structured JSON. The IP comes from the socket, not the request.
  Control characters are stripped, so a comment cannot inject log lines.

| | |
|---|---|
| Before | `task/input-hardening` branch |
| After | `solution/input-hardening` branch |

## Case study 2: rate limiting

**The problem.** Validation checked *what* a request contained. Nothing counted
*how many* requests arrived. Sending the same request many times always
returned `200`.

**The fix.** A fixed-window limiter keyed by client IP. It runs **before** the
body is read, so floods are cheap to reject. Limit: 5 requests per 10 seconds.
After that, the answer is `429` with `Retry-After: 10`.

**Measured.** Before: 8 sends → `200 200 200 200 200 200 200 200`.
After: the same 8 sends → `200 200 200 200 200 429 429 429`.
The browser form shows `Error 429: Too many requests`.

**Honest limits.** The counter lives in memory, so it only works per process,
a multi-server deploy needs a shared store like Redis. And a fixed window can
allow a burst at the window edge; a sliding window fixes that.

| | |
|---|---|
| Before | `task/rate-limit` branch |
| After | `solution/rate-limit` branch |
| Verify | `ratelimit-check.txt` the same flood command, run before and after |

## Branches

- `main` finished state (hardening + rate limiting)
- `task/input-hardening` / `solution/input-hardening` before / after
- `task/rate-limit` / `solution/rate-limit` before / after
