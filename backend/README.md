# Mezyad — Run locally

The existing frontend lives in `Frontend` (capital F). The API prefix is `/api/v1`.
Use Node.js 24, npm and Docker Desktop. No real payment keys are accepted.

## First run (PowerShell, project root)

```powershell
Copy-Item backend/.env.example backend/.env
code backend/.env
```

If `backend/.env` already exists, keep it and add the missing fields instead of overwriting it.
Fill in the PostgreSQL connection, your SMTP sending account and sender address, and your Moyasar **test** keys (`pk_test_...` and `sk_test_...`). The SMTP sender must be authorized by your email provider. A Gmail account needs an App Password, not the normal password. Generate the email-code secret locally:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Put that value in `EMAIL_OTP_SECRET`. Never commit `.env`, passwords, OTPs or secret keys. The default commitment authorization is 10000 halalas = SAR 100, configurable in `MOYASAR_COMMITMENT_HALALAS`; this is a project test amount, not a settlement of the asset price.

```powershell
docker compose up -d db
npm --prefix backend ci
npm --prefix Frontend ci
npm --prefix backend run db:setup
npm --prefix Frontend run build
npm --prefix backend start
```

Open `http://localhost:3000`. This serves the built frontend and API together. `db:setup` applies all three migrations and category seeds in a transaction; rerunning it does not delete existing accounts, listings, bids or images. Uploaded images stay in `backend/uploads`.

For frontend development instead, keep the backend running and use a second terminal:

```powershell
npm --prefix Frontend run dev
```

Open the Vite address printed in the terminal (normally `http://localhost:5173`). Its proxy forwards `/api` and `/uploads` to port 3000. Do not use Live Server or `PREVIEW.html` for real API operations.

## Email verification and password recovery

- `POST /api/v1/auth/signup/request` accepts name, email and password, sends a code and returns 202. `/auth/register` uses the same verification flow.
- `POST /api/v1/auth/signup/complete` accepts email and code. Only this creates the account.
- `/auth/password/request`, `/auth/password/verify`, `/auth/password/confirm` implement recovery using a single-use reset token. Confirmation revokes previous sessions.
- Codes last 10 minutes, are stored as keyed hashes and allow at most five wrong attempts. Resend has a 30-second cooldown. SMTP accepting a message is not a guarantee of inbox delivery; check provider delivery logs/spam if needed.
- Existing accounts remain available; no accounts are created automatically as administrators.

## Moyasar test authorization

Start from the auction's commitment page. The existing payment page loads Moyasar's card form with `credit_card.manual: true`. Card details are submitted directly to Moyasar; they never reach this backend. The backend fetches the payment by ID with the secret test key and matches the amount, currency and commitment metadata. Only `authorized` is accepted; a redirect or browser-supplied status is never approval. Bids require a valid, unexpired commitment, and the provider status is checked again before each bid. No capture, settlement or real-money operation is implemented.

A pending checkout expires after 30 minutes; a verified project authorization is locally usable for no more than 24 hours from initiation. An old successful fixture without a provider/payment reference cannot authorize bids.

This is a **Moyasar card-authorization sandbox**, not Open Banking bank-account consent or a bank guarantee. Test cards and test keys are required. The actual external email and Moyasar flow must be checked with your configured accounts; isolated automated provider fixtures are not evidence of a real sandbox transaction.

Official references:
- https://docs.moyasar.com/guides/card-payments/basic-integration
- https://docs.moyasar.com/guides/references/form-configuration
- https://docs.moyasar.com/guides/card-payments/test-cards

## Checks

```powershell
npm --prefix backend run check
npm --prefix Frontend run build
$env:TEST_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/mezyad_test"
npm --prefix backend run test:postgres
```

Create a separate disposable database ending in `_test` first. Never point tests at `mezyad`. Tests use isolated schemas, local SMTP capture and clearly marked simulated provider responses. They do not charge cards or send messages to real inboxes.
