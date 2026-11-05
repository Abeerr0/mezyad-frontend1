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
Leave the bank settings empty because the integration is postponed.

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

Create the tables using the existing schema file:

```bash
docker compose exec -T db psql -U postgres -d mezyad -v ON_ERROR_STOP=1 < database/migrations/001_schema.sql
```

After the command succeeds, add the asset categories using the existing seed file:

```bash
docker compose exec -T db psql -U postgres -d mezyad -v ON_ERROR_STOP=1 < database/seeds/001_categories.sql
```

The first command creates the project tables.
The second command adds categories to the categories table.

This is a first-time setup step. It does not need to be repeated whenever the project starts.
If an error appears, resolve it before continuing.


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
