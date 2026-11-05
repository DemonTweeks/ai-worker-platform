# Agnes health correction — 2026-11-05

The same key worked in AIDA with `agnes-2.5-flash`, but the platform's `agnes-2.0-flash` request returned HTTP 429. This does not establish key-wide exhaustion. Production now selects `agnes-2.5-flash` in its private environment file.

The previous 8-token probe on model 2.5 could exhaust its budget on reasoning and return empty visible content despite HTTP 200. Agnes health probes now request 64 tokens and set `chat_template_kwargs.enable_thinking=false`. Qwen probes retain their 8-token budget and no Agnes-specific fields. Normal Agnes requests retain existing thinking behavior. Timeout (at most 8 seconds), zero health retries, and 60-second result cache are unchanged.

HTTP failures expose only a safe status-based explanation (including explicit HTTP 429 rate-limit information), never raw upstream bodies or credentials. Blank visible answers are rejected. Production model/key remain private and are not committed. No database, queue, skill, or business-rule changes.
