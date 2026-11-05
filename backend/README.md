# Mezyad Backend — Local Setup

This guide explains how to run the backend locally.

The backend uses Node.js and Express.
PostgreSQL runs in Docker.


## Requirements

- Node.js 24 and npm installed.
- Docker Desktop installed and running.
- A local copy of the Mezyad repository.


## 1. Set Up the Environment File

Open a terminal in the project root, which contains
compose.yaml and the backend folder.

If backend/.env already exists, keep it and skip the copy command.
If it does not exist, copy the example file:

```bash
cp .env.example backend/.env
```

Review the values in backend/.env to match your local setup.
Set your local SMTP and Moyasar test keys to use email verification and bank commitments. Never commit secret keys.

The .env file is local to your computer and must not be uploaded to GitHub.


## 2. Start the Database

Make sure Docker Desktop is running.
From the project root, run:

```bash
docker compose up -d db
```

This command starts the database service in the background.

Check that PostgreSQL is ready to accept connections:

```bash
docker compose exec db pg_isready -h 127.0.0.1 -U postgres -d mezyad
```

Expected output:

```text
127.0.0.1:5432 - accepting connections
```

If PostgreSQL is not ready yet, wait briefly and run the readiness check again.


## 3. Set Up the Database for the First Time

After PostgreSQL is ready, run these commands from the project root.

Install the backend dependencies, then run the setup script:

```bash
cd backend
npm ci
npm run db:setup
```

The script applies all migrations, adds categories, and seeds local development data.
It adds six sample accounts, seven listings with images, and five auctions:
three active (including one private), one scheduled, and one closed without bids.
The remaining listings are pending review and rejected.

Sample emails: tala@example.com (ADMIN), abeer@example.com, ghadi@example.com,
aseel@example.com, arwa@example.com, ali@example.com.
New sample accounts use Aa112233 and are already email-verified for local testing.
Ordinary registration still uses email verification. No bank commitments are seeded.
The private sample belongs to Ghadi; another user can enter with code 112233445566778899aabbcc.

Running setup again preserves existing accounts, passwords, roles, listings, auctions,
and their dates. It does not duplicate sample records or reset auction times.
Existing accounts with the sample emails keep their current passwords and verification state.
Images are copied through the normal upload processing into the local upload folder.

Sample seeding is skipped when NODE_ENV=production, when the database host is not
local or the Docker db service, or when SEED_LOCAL_DATA=false is set in backend/.env.
Use SEED_LOCAL_DATA=false when preparing a production database through localhost.
No existing records are deleted.


## 4. Install Dependencies and Start the Backend

From the project root, enter the backend folder and install its dependencies:

```bash
cd backend
npm install
```

After the installation finishes successfully, start the backend:

```bash
npm run dev
```

With PORT=3000, the terminal displays:

```text
Mezyad API listening on 3000
```

This message means the backend is listening for requests on port 3000.

Keep this terminal running and open another terminal to send verification requests.


## 5. Verify the Setup

Keep the backend running and open another terminal.

Check that the backend responds:

```bash
curl -i http://localhost:3000/health
```

Expected result: 200 OK with:

```json
{"data":{"status":"ok"}}
```

Then check that the backend can read from the database:

```bash
curl -i http://localhost:3000/categories
```

Expected result: 200 OK and the category list.
After running the category seed file, five categories should appear,
each with an id and a name.

If the response is 200 with {"data":[]}, the database query succeeded,
but the categories table is empty. Review the category seed step.


## 6. Stop and Restart

To stop the backend, press Ctrl + C in the terminal running it.

To stop the database, run this from the project root:

```bash
docker compose stop db
```

This stops the container and keeps the database data.

To start the project again, open Docker Desktop.
From the project root, start the database:

```bash
docker compose up -d db
```

Repeat the readiness check in step 2.
After it shows accepting connections, run these commands from the project root:

```bash
cd backend
npm run dev
```

You do not need to copy the environment file or set up the tables on every restart.
Run npm install again if the dependency files change or node_modules is missing.
