# BriefCode — System Architecture & Implementation Guide

Welcome to **BriefCode** (formerly *Ticket Brief*). This document provides an exhaustive, end-to-end breakdown of the application. It is designed to give any developer, engineer, or architect a complete understanding of how the system is built, the rationale behind the design choices, and how components interact.

---

## Table of Contents
1. [System Overview & Goal](#1-system-overview--goal)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Component Walkthrough](#4-component-walkthrough)
5. [Data Flow & Core Workflows](#5-data-flow--core-workflows)
6. [Vector RAG Pipeline (Deep Dive)](#6-vector-rag-pipeline-deep-dive)
7. [Database Schema & Persistent Models](#7-database-schema--persistent-models)
8. [Configuration & Environment Variables](#8-configuration--environment-variables)
9. [Setup & Running Locally](#9-setup--running-locally)

---

## 1. System Overview & Goal

When software engineers pick up a Jira ticket or review a Pull Request (PR), they face a significant context-switching cost:
*   Reading lengthy descriptions and comment threads.
*   Determining what parts of the codebase are touched.
*   Finding files that need debugging or verification.
*   Checking if the PR matches the ticket requirements.

**BriefCode** solves this by automating the creation of structured, AI-enhanced **developer briefings**. It takes a GitHub PR URL, a Jira ticket reference, or raw text description (along with optional PDF/text documentation files) and compiles them into a clean, 6-section briefing:
1.  **Overview**: What this change/ticket is about.
2.  **Intent**: The business or technical motivation.
3.  **Changed Files**: Codebase modifications.
4.  **Risks & Edge Cases**: Potential regressions or overlooked spots.
5.  **How to Review**: Specific instructions for the code reviewer.
6.  **Suggested Next Steps**: Follow-up actions.

---

## 2. High-Level Architecture

BriefCode is organized as a lightweight single-directory Python application served via FastAPI:

```mermaid
flowchart TD
    subgraph Frontend Assets
        HTML["index.html / app.js (static/)"]
    end

    subgraph Backend Application (FastAPI)
        API["FastAPI App (main.py)"]
        AUTH["JWT Security (auth.py)"]
        RAG["RAG Engine (rag.py)"]
        GH["GitHub API (github.py)"]
    end

    subgraph Database
        DB["Postgres + pgvector"]
    end

    HTML -->|HTTP requests| API
    API -->|Authenticate| AUTH
    API -->|Process Context| RAG
    API -->|Fetch Code| GH
    API -->|Read/Write Vectors| DB
```

### Directory Structure

*   **`static/`**: Holds the frontend assets (`index.html` and `app.js`) served statically by the backend.
*   **`main.py`**: The API routing engine.
*   **`auth.py`**: JWT credential security.
*   **`database.py`**: SQLModel connection management.
*   **`models.py`**: Database table schemas.
*   **`github.py`**: GitHub integration client.
*   **`rag.py`**: Document vector search pipelines.

---

## 3. Technology Stack

### Frontend (Vanilla SPA)
1.  **Tailwind CSS v4 (CDN)**: Style sheets and layout grids.
2.  **Lucide Icons (CDN)**: Icon typography rendering.
3.  **JetBrains Mono (Google Fonts)**: Custom monospace type family.
4.  **Vanilla JS Router**: A hash-based client-side router running in `app.js`.

### Backend (Python)
1.  **FastAPI**: Web API routing and static asset hosting.
2.  **Uvicorn**: ASGI web server.
3.  **SQLModel**: Table layout declarations and sessions.
4.  **python-jose & passlib**: Secure JWT logins.

### Database
1.  **PostgreSQL 16**: Relational storage.
2.  **pgvector**: High-speed vector similarity searching.

---

## 4. Component Walkthrough

### 4.1 Static Asset Routing
FastAPI mounts the `/static` directory and exposes the root URL to return our single-page application:
```python
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
def serve_index():
    return FileResponse(os.path.join(static_dir, "index.html"))
```

### 4.2 Client Routing & AuthGate (`app.js`)
The JavaScript client manages routing using the URL hash (`#/`, `#/history`, `#/briefs/:id`). 
A local authentication check enforces that the user provides a valid operator token before showing any of the core briefing generation options.
All credentials and active state variables (e.g. uploaded documents, briefing outputs) are managed in a central memory store within `app.js`.

---

## 5. Data Flow & Core Workflows

### 5.1 User Registration and Authentication
1.  **Register**: The user submits credentials. The backend hashes the password using `bcrypt` and inserts a new `User` row.
2.  **Login**: The user sends their username and password via Form Data (`application/x-www-form-urlencoded`). The backend verifies the hash and issues an HS256-signed JWT token containing the username and an expiration timestamp (`exp`).

### 5.2 Creating a Briefing (No Files)
```mermaid
sequenceDiagram
    participant User as Frontend Client
    participant API as FastAPI Server
    participant GH as GitHub API
    participant Gem as Gemini API
    participant DB as PostgreSQL

    User->>API: POST /api/briefs { prUrl, jiraUrl }
    API->>DB: Create initial Brief ("Generating Briefing...")
    alt GitHub URL present
        API->>GH: Fetch PR metadata, commits, and diff files
        GH-->>API: Return PR data
    end
    API->>Gem: Send structured prompt (PR + Jira context)
    Gem-->>API: Return JSON Briefing (Title + 6 Sections)
    API->>DB: Update Brief in database
    API-->>User: Return completed briefing
```

---

## 6. Vector RAG Pipeline (Deep Dive)

When creating a briefing, users can upload PDF or text files (such as documentation, software specifications, or architectural guides). BriefCode processes these using **Retrieval-Augmented Generation (RAG)**:

```
[Uploaded Files] 
       │
       ▼
[Text Extraction] ──► [Chunking] ──► [Embeddings] ──► [pgvector DB]
                                                          │
                                                          ▼
                                                  [Similarity Search]
                                                  (Using cosine distance
                                                   against PR metadata)
                                                          │
                                                          ▼
                                                  [Top 5 Chunks]
                                                          │
                                                          ▼
                                                  [Gemini Context]
                                                          │
                                                          ▼
                                                  [Final Briefing]
```

### 6.1 Text Extraction
Files are sent as Base64 strings:
*   **PDF files** are parsed using `pdfplumber` to extract layout-aware textual content.
*   **Text/source code files** are decoded from UTF-8.

### 6.2 Chunking (`rag.py`)
To fit text context windows and improve search relevance, documents are split into overlapping blocks:
*   **Chunk Size**: 800 characters.
*   **Overlap**: 150 characters.

```python
def chunk_text(text: str, chunk_size: int = 800, chunk_overlap: int = 150) -> List[str]:
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - chunk_overlap
    return [c.strip() for c in chunks if c.strip()]
```

### 6.3 Embedding Generation (`text-embedding-004`)
Each text chunk is converted into a 768-dimensional float vector by calling the Gemini Embedding API:
*   **API Model**: `models/text-embedding-004`
*   **Endpoint**: `https://generativelanguage.googleapis.com/v1/models/text-embedding-004:embedContent`

### 6.4 Similarity Search (pgvector)
When a briefing request with a PR or ticket is made, the query string (PR Title + Jira context) is converted into an embedding. The backend queries the database using pgvector's cosine distance operator (`<=>`):
```sql
SELECT file_name, content 
FROM file_chunks 
WHERE brief_id = :brief_id 
ORDER BY embedding <=> :query_vector 
LIMIT 5;
```
This extracts the **5 most relevant passages** across all uploaded documents.

### 6.5 Prompt Construction & LLM Generation (`gemini-2.5-flash`)
The system feeds the PR details, commits, changed file names, and retrieved document passages into `gemini-2.5-flash`. The model is instructed to output JSON matching a strict schema definition:
```python
"generationConfig": {
    "responseMimeType": "application/json",
    "responseSchema": {
        "type": "OBJECT",
        "properties": {
            "title": {"type": "STRING"},
            "sections": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "title": {"type": "STRING"},
                        "content": {"type": "STRING"}
                    },
                    "required": ["title", "content"]
                }
            }
        },
        "required": ["title", "sections"]
    }
}
```

---

## 7. Database Schema & Persistent Models

The application uses three core tables mapped via `SQLModel`:

```mermaid
erDiagram
    users ||--o{ briefs : owns
    briefs ||--o{ file_chunks : has

    users {
        int id PK
        string username UNIQUE
        string hashed_password
    }

    briefs {
        int id PK
        string input
        string mode
        string title
        jsonb sections
        string jira_key
        string pr_url
        string raw_jira
        string raw_pr
        string jira_context
        jsonb uploaded_files
        datetime created_at
        int user_id FK
    }

    file_chunks {
        int id PK
        int brief_id FK
        string file_name
        string content
        vector embedding
    }
```

*Design Choice:* The `embedding` column in `file_chunks` is defined using pgvector's `Vector(768)` type. The table has a `CASCADE` delete constraint on `brief_id` so that deleting a briefing automatically cleans up its text chunks.

---

## 8. Configuration & Environment Variables

All settings are configured inside the `.env` file at the root:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string (e.g., `postgresql://postgres:postgres@localhost:5432/ticket_brief`). |
| `PORT` | Optional. Specifies the API port (defaults to `3001`). |
| `GEMINI_API_KEY` | **Required** for AI-generated briefings and text embeddings. |
| `GITHUB_TOKEN` | Optional. Used for higher rate limits on public repos and accessing private repos. |
| `JIRA_EMAIL` / `JIRA_API_TOKEN` / `JIRA_BASE_URL` | Optional. Configurations for Jira integrations. |

---

## 9. Setup & Running Locally

### 1. Run the database container:
```bash
docker compose up -d
```
*This starts a PostgreSQL instance with `pgvector` pre-enabled on port `5432`.*

### 2. Configure variables:
Copy `.env.example` to `.env` and fill in your `GEMINI_API_KEY`.

### 3. Install packages:
```bash
pip install -r requirements.txt
```

### 4. Run the app:
```bash
python -m uvicorn main:app --port 3001 --reload
```
Open **http://localhost:3001** to access the application.

---

## 10. Future Improvements, Scalability & Design Enhancement

To scale BriefCode to enterprise levels or add advanced functionality, the following areas can be targeted:

### 10.1 AI & RAG Pipeline Optimization
*   **Semantic Chunking**: Instead of fixed-character parsing (e.g., 800 chars), chunk documents by semantic structure (such as AST parsing for source code, or header-aware parsing for markdown and PDFs) to maintain code context integrity.
*   **Hybrid Search**: Combine pgvector similarity search (for semantic meaning) with BM25 lexical keyword matching (for matching specific function names, variables, or error codes) to drastically increase retrieval accuracy.
*   **Metadata Filtering**: Tag document chunks with file metadata (e.g., directory, author, date, type). When a PR touches `src/components/`, query only chunks corresponding to the frontend documentation using SQL metadata filters.

### 10.2 Architectural Scalability
*   **Asynchronous Database Queries**: Migrate SQLModel operations to run on async engines (using `asyncpg` driver) to prevent blocking the FastAPI execution thread during heavy database transactions.
*   **Task Queues & Background Workers**: Briefing generation relies on external APIs (GitHub + Gemini) which can take up to 10–20 seconds. Move this work off the main request-response thread using background task systems (like Celery, RQ, or FastAPI's native `BackgroundTasks`) and notify the user via WebSockets or polling.
*   **Vector Indexing**: Once database files grow large, add HNSW (Hierarchical Navigable Small World) indices on the embedding columns in PostgreSQL to perform vector searches in logarithmic time.

### 10.3 UI/UX & Design Enhancements
*   **Real-time Streaming**: Stream Gemini responses to the UI token-by-token (using Server-Sent Events or WebSockets) so that users see briefings generate live rather than waiting for a full JSON payload.
*   **Interactive Briefing Chat**: Allow developers to ask follow-up questions directly on the briefing (e.g., "Summarize the changes in auth.py only" or "Where does this PR handle token expiration?"), pulling context dynamically from the database.
*   **Interactive Code Diff Viewer**: Provide a syntax-highlighted side-by-side diff comparison within the briefing view to let users inspect code changes directly without leaving the application.

