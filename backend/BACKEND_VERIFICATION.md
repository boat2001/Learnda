# Backend verification

Verified on 10 October 2026 against the configured development PostgreSQL database.

## Completed

- Signup enrolls users in the free Basic Student plan. Paid plans were not seeded.
- Corrected double password hashing during OTP signup; subsequent password login passes.
- Initialized the curriculum catalogue from the project's curriculum specification.
- Restored the unified content view for the current lesson schema.
- Connected class placement, promotion notices, subject practice, reports, and ratings.
- Applied class and pathway checks to direct academic content links and content feeds.
- Added Express 4 asynchronous error forwarding, request validation, and graceful shutdown.
- Replaced retired college group selectors with class groups in admin notifications.
- Local frontend development uses the real API rather than placeholder mode.

## Checks

Run from `backend`:

```powershell
npm run lint
node node_modules/jest/bin/jest.js --runInBand --silent --coverage=false
node src/scripts/verify_api_readonly.js
node src/scripts/verify_api_transactional.js
```

The transactional check exercises signup with simulated email OTP delivery, login,
free enrollment, KG/Primary/JHS/SHS placement, subject access, future-class guards,
temporary lessons and practice, report saves, and rating saves. It rolls back all
fixtures and verifies that its users were not retained. Run it in an isolated
process against a development database; it temporarily binds queries to one
transaction. It does not deliver messages or call payment/storage providers.

The test suite passed 137 tests across 10 suites. Backend lint and the frontend
production build passed. Normal server initialization and HTTP health/plan checks
passed on an isolated local port.

## Remaining integration work

- Live email/SMS OTP delivery, Google sign-in, payments, and object-storage uploads
  require configured provider credentials and separate integration checks.
- The catalogue is populated; production lessons and practice content still need
  to be published. Verification fixtures are not published content.
- Deployment settings must provide the API origin and disable placeholder mode.
- Some administrative content remains backed by local JSON files; persistent
  storage must be reviewed for deployments with ephemeral filesystems.
- Legacy authoring and optional gamification interfaces need a further audit
  before claiming every platform feature is production ready.

Keep `DB_SYNC=none` for the configured database. Apply reviewed migrations rather
than enabling Sequelize's automatic schema alteration against shared data.
