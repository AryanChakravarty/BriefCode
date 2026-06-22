# BriefCode

Generate structured developer briefings from GitHub PR URLs and Jira tickets in under a minute. Paste a link, upload context files, and get an overview, intent, changed files list, risks, and review guidance — with Gemini AI-powered intelligence.

Now rebuilt as a **pure Python application**, eliminating all Node.js and TypeScript overhead.

## Prerequisites

- [Python 3.10+](https://www.python.org/)
- [Docker](https://www.docker.com/) (for running Postgres database)

## Quick Start

### 1. Start Postgres with pgvector
Ensure Docker is running, then start the database container:
```bash
docker compose up -d
```

### 2. Configure Environment
Copy `.env.example` to `.env` and fill in your details:
```bash
cp .env.example .env
```
*(Make sure to set your `GEMINI_API_KEY` inside `.env`).*

### 3. Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 4. Run the Application
Start the FastAPI server:
```bash
python -m uvicorn main:app --port 3001 --reload
```

Open **http://localhost:3001** in your browser.

## Project Structure

```
static/         # Frontend single-page app (HTML, CSS, JS)
main.py         # FastAPI application and routing
database.py     # SQLModel connection and initialization
models.py       # SQLModel database schemas (User, Brief, FileChunk)
auth.py         # JWT generation and security utilities
github.py       # GitHub API integration client
rag.py          # Document chunking, embedding, and Gemini LLM interface
requirements.txt # Python dependencies list
```

## Features

1. **AI Briefings**: Uses Gemini 2.5 Flash to synthesize PR data and documentation.
2. **Context Document RAG**: Drag-and-drop text/PDF files to enable similarity searches using pgvector matching.
3. **Secure Operator Access**: Local user registration and token authentication (JWT).
