# Automated course-note collection

This directory is populated by `npm run notes:collect`. Each downloaded document is
stored under its course code. `manifest.jsonl` records its public source URL, SHA-256
hash, size, and download time. The collector only reads public web pages and public
Telegram channels; it does not bypass authentication or private-channel permissions.

The backend schedules collection daily at 01:00 in `Africa/Casablanca`. Set
`NOTES_TELEGRAM_CHANNELS` to a comma-separated list of public channel usernames.
