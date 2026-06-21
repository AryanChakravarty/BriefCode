# Project Framework Summary (Updated with RAG Analysis)

This document provides an overview of the architecture and technical stack used in this project, evaluates its suitability in light of the newly added **Vector RAG (Retrieval-Augmented Generation)** capabilities, and proposes recommendations on whether to keep the current framework or migrate.

---

## The Existing Technical Stack

The project is structured as a **monorepo** managed with **pnpm workspaces**. It consists of:
* **Monorepo & Build Tooling**: [pnpm](https://pnpm.io/) workspaces, with TypeScript project references.
* **Frontend**: React 19 + Vite 7, styled using Tailwind CSS v4, routed via `wouter`, with api queries generated via **Orval** from the OpenAPI contract ([openapi.yaml](file:///c:/Users/epicaryan/Downloads/projects/PR-Reviewer/lib/api-spec/openapi.yaml)) and run using `@tanstack/react-query`.
* **Backend**: Express v5 on Node.js (ESM), built using `esbuild`.
* **Database**: PostgreSQL (using the `pgvector/pgvector:pg16` image) with **Drizzle ORM** for schema pushing and similarity search query mapping (`cosineDistance`).

---

## Evaluation: Is the Stack Still Ideal for RAG?

Adding Vector RAG changed the complexity profile of this application. It now involves text extraction (including PDF binaries), text chunking, embedding generation API calls, vector database persistence, and cosine similarity querying.

### Pros of Keeping the Current Stack
1. **Lightweight & High Performance**: Express + Vite + Drizzle has virtually zero framework overhead. Node.js native `fetch` handles Gemini APIs extremely fast.
2. **Native Vector Search**: Drizzle ORM compiles pgvector similarity queries (`cosineDistance`) directly to SQL without needing heavy client libraries or abstract query builders.
3. **No Lock-in**: By avoiding large framework wrappers, you retain absolute control over how chunks are stored and queried.

### Cons & Pain Points of the Current Stack
1. **Base64 Payload Overhead**: Because we use standard JSON APIs, files are read in the browser and sent as Base64 strings. This increases payload sizes by ~33% and places parsing workloads on the Express server thread.
2. **Missing AI ecosystem**: Node.js has fewer out-of-the-box RAG utilities (e.g. document loaders, chunking strategies, semantic splitters) compared to Python.
3. **Orchestration Complexity**: Coordinating typescript builds, Orval codegen, schema migrations, and monorepo scripts becomes heavier as the pipeline expands.

---

## Recommendation: Should We Change?

### Option A: Stick with the Current Stack (Recommended for current scale)
* **Verdict**: **Ideal if you want to keep the application fast, simple, and self-hosted.**
* **Why**: The current implementation of RAG in Node + Drizzle is highly performant. The database handles similarity search directly in SQL, meaning search latency is negligible (< 10ms). The monorepo guarantees frontend/backend contract synchronization.

### Option B: Migrate to Next.js (Recommended for Web/SaaS scale)
* **Verdict**: **Ideal if you want to scale the frontend, add authentication, and optimize file uploads.**
* **Why**: Next.js Server Actions and API route handlers can accept multipart files directly (no base64 serialization required). Colocating page rendering and RAG queries removes network overhead between the client and API server.

### Option C: Python-based Backend (FastAPI + LlamaIndex) (Recommended for Advanced RAG)
* **Verdict**: **Ideal if you plan to parse complex PDF layouts, perform hybrid search, or use metadata filtering.**
* **Why**: Python's `LlamaIndex` or `LangChain` offers prebuilt parsers for tables/images in PDFs, agentic query routing, and chunking strategies that would require thousands of lines of custom code to write in Node.js.
