import os
import base64
import io
import json
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select
from pydantic import BaseModel
import pdfplumber

# Load environment variables manually from .env if present
def load_env_file():
    curr_dir = os.path.abspath(os.path.dirname(__file__))
    for _ in range(4):
        env_path = os.path.join(curr_dir, ".env")
        if os.path.exists(env_path):
            print(f"DEBUG: Manually loading .env from {env_path}")
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        key, val = line.split("=", 1)
                        key = key.strip()
                        val = val.strip()
                        if val.startswith('"') and val.endswith('"'):
                            val = val[1:-1]
                        elif val.startswith("'") and val.endswith("'"):
                            val = val[1:-1]
                        os.environ[key] = val
            break
        curr_dir = os.path.dirname(curr_dir)

load_env_file()

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from database import init_db, get_session
from models import User, Brief, FileChunk
from auth import get_password_hash, verify_password, create_access_token, get_current_user
from github import parse_github_pr_url, fetch_pr_data
from rag import chunk_text, get_embedding, generate_rag_briefing, answer_brief_question

# Initialize FastAPI
app = FastAPI(title="Ticket Briefing API", version="0.1.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static frontend assets
current_dir = os.path.dirname(os.path.abspath(__file__))
static_dir = os.path.join(current_dir, "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
def serve_index():
    return FileResponse(os.path.join(static_dir, "index.html"))

# Startup event
@app.on_event("startup")
def on_startup():
    try:
        init_db()
    except Exception as e:
        print(f"Database initialization failed: {e}. Make sure Postgres is running.")

# Pydantic schemas
class RegisterUser(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str

class UploadedFileSchema(BaseModel):
    name: str
    content: str  # Base64 encoded content

class AskQuestionBody(BaseModel):
    question: str

class CreateBriefBody(BaseModel):
    input: Optional[str] = None
    prUrl: Optional[str] = None
    jiraUrl: Optional[str] = None
    jiraContext: Optional[str] = None
    files: Optional[List[UploadedFileSchema]] = None

class BriefSectionResponse(BaseModel):
    title: str
    content: str

class BriefResponse(BaseModel):
    id: int
    input: str
    mode: str
    title: str
    sections: List[BriefSectionResponse]
    jiraKey: Optional[str] = None
    prUrl: Optional[str] = None
    createdAt: str
    
    class Config:
        from_attributes = True

class ConfigStatusResponse(BaseModel):
    jiraConfigured: bool
    githubConfigured: bool
    allConfigured: bool
    missingVars: Optional[List[str]] = None

# Helpers for file extraction
def extract_pdf_text(base64_data: str) -> str:
    if base64_data.startswith("data:"):
        base64_data = base64_data.split(",")[1]
    pdf_bytes = base64.b64decode(base64_data)
    text = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text.append(page_text)
    return "\n".join(text)

def extract_text_file(base64_data: str) -> str:
    if base64_data.startswith("data:"):
        base64_data = base64_data.split(",")[1]
    return base64.b64decode(base64_data).decode("utf-8")

# API Endpoints
@app.get("/healthz")
def health_check():
    return {"status": "ok"}

@app.post("/api/auth/register", response_model=BriefResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: RegisterUser, session: Session = Depends(get_session)):
    # Check if user exists
    existing = session.exec(select(User).where(User.username == user_data.username)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already registered")
        
    hashed = get_password_hash(user_data.password)
    user = User(username=user_data.username, hashed_password=hashed)
    session.add(user)
    session.commit()
    return {"id": 0, "input": "", "mode": "", "title": "Registration Successful", "sections": [], "createdAt": ""}

@app.post("/api/auth/token", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.username == form_data.username)).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/config/status", response_model=ConfigStatusResponse)
def get_config_status():
    jira_configured = (
        bool(os.getenv("JIRA_EMAIL")) and 
        bool(os.getenv("JIRA_API_TOKEN")) and 
        bool(os.getenv("JIRA_BASE_URL"))
    )
    github_configured = True  # Public repos work without token
    gemini_configured = bool(os.getenv("GEMINI_API_KEY"))
    
    missing_vars = []
    if not gemini_configured:
        missing_vars.append("GEMINI_API_KEY")
        
    return {
        "jiraConfigured": jira_configured,
        "githubConfigured": github_configured,
        "allConfigured": gemini_configured,
        "missingVars": missing_vars
    }

@app.post("/api/briefs", status_code=status.HTTP_201_CREATED)
def create_brief(
    body: CreateBriefBody,
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user)
):
    input_val = body.input
    pr_url = body.prUrl
    jira_url = body.jiraUrl
    jira_context = body.jiraContext
    files = body.files or []
    
    # Handle legacy input parser
    if input_val and not pr_url and not jira_url and not jira_context:
        coords = parse_github_pr_url(input_val)
        if coords:
            pr_url = input_val
        else:
            jira_url = input_val
            
    if not pr_url and not jira_url and not jira_context and not files:
        raise HTTPException(status_code=400, detail="Please provide a GitHub PR link, JIRA ticket key/link, context text, or upload files.")

    # Process files
    processed_files = []
    for f in files:
        if f.name.endswith(".pdf"):
            try:
                txt = extract_pdf_text(f.content)
                processed_files.append({"name": f.name, "content": txt})
            except Exception as e:
                processed_files.append({"name": f.name, "content": f"[Error reading PDF: {str(e)}]"})
        else:
            try:
                txt = extract_text_file(f.content)
                processed_files.append({"name": f.name, "content": txt})
            except Exception as e:
                processed_files.append({"name": f.name, "content": f"[Error reading file: {str(e)}]"})

    # Fetch GitHub PR
    pr_data = None
    if pr_url:
        coords = parse_github_pr_url(pr_url)
        if not coords:
            raise HTTPException(status_code=400, detail="Could not parse GitHub PR URL.")
        try:
            pr_data = fetch_pr_data(coords["owner"], coords["repo"], coords["number"])
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"GitHub API Error: {str(e)}")

    # Determine mode
    mode = "pr-only"
    if pr_url and (jira_url or jira_context):
        mode = "ticket-and-pr"
    elif jira_url or jira_context:
        mode = "ticket-only"

    db_input = pr_url or jira_url or jira_context or "Custom Context"

    # Save initial Brief
    brief = Brief(
        input=db_input,
        mode=mode,
        title="Generating Briefing...",
        sections=[],
        jiraKey=jira_url,
        prUrl=pr_url,
        rawJira=jira_context,
        rawPr=json.dumps(pr_data["pr"]) if pr_data else None,
        jiraContext=jira_context,
        uploadedFiles=processed_files if processed_files else None,
        user_id=current_user.id if current_user else None
    )
    session.add(brief)
    session.commit()
    session.refresh(brief)

    relevant_chunks = []
    gemini_key = os.getenv("GEMINI_API_KEY")

    if gemini_key and processed_files:
        try:
            # Chunk and embed
            for f in processed_files:
                chunks = chunk_text(f["content"])
                for chunk in chunks:
                    vector = get_embedding(chunk)
                    db_chunk = FileChunk(
                        brief_id=brief.id,
                        file_name=f["name"],
                        content=chunk,
                        embedding=vector
                    )
                    session.add(db_chunk)
            session.commit()

            # Perform similarity query
            query_text = f"{pr_data['pr'].get('title', '') if pr_data else ''} {jira_context or ''} {jira_url or ''}".strip()
            query_vector = get_embedding(query_text)
            
            # Raw SQL Query for pgvector similarity search
            from sqlalchemy import text
            # <=> operator represents cosine distance in pgvector
            results = session.execute(
                text("SELECT file_name, content FROM file_chunks WHERE brief_id = :brief_id ORDER BY embedding <=> :query_vector LIMIT 5"),
                {"brief_id": brief.id, "query_vector": str(query_vector)}
            ).fetchall()
            
            relevant_chunks = [{"fileName": r[0], "content": r[1]} for r in results]
        except Exception as e:
            print(f"RAG failed: {str(e)}")
            relevant_chunks = processed_files
    else:
        relevant_chunks = processed_files

    # Generate Briefing
    briefing = generate_rag_briefing(pr_data, pr_url, jira_url, jira_context, relevant_chunks)

    # Save final Brief details
    brief.title = briefing.get("title", "Ticket Briefing")
    brief.sections = briefing.get("sections", [])
    session.add(brief)
    session.commit()
    session.refresh(brief)

    return {
        "id": brief.id,
        "input": brief.input,
        "mode": brief.mode,
        "title": brief.title,
        "sections": brief.sections,
        "jiraKey": brief.jiraKey,
        "prUrl": brief.prUrl,
        "createdAt": brief.createdAt.isoformat()
    }

@app.get("/api/briefs", response_model=List[BriefResponse])
def list_briefs(
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user)
):
    # Optional authentication filtering
    query = select(Brief)
    if current_user:
        query = query.where(Brief.user_id == current_user.id)
    query = query.order_by(Brief.createdAt.desc())
    rows = session.exec(query).all()
    
    return [
        {
            "id": r.id,
            "input": r.input,
            "mode": r.mode,
            "title": r.title,
            "sections": r.sections,
            "jiraKey": r.jiraKey,
            "prUrl": r.prUrl,
            "createdAt": r.createdAt.isoformat()
        }
        for r in rows
    ]

@app.get("/api/briefs/{id}", response_model=BriefResponse)
def get_brief(
    id: int,
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user)
):
    query = select(Brief).where(Brief.id == id)
    if current_user:
         query = query.where(Brief.user_id == current_user.id)
    brief = session.exec(query).first()
    if not brief:
        raise HTTPException(status_code=404, detail="Brief not found")
        
    return {
        "id": brief.id,
        "input": brief.input,
        "mode": brief.mode,
        "title": brief.title,
        "sections": brief.sections,
        "jiraKey": brief.jiraKey,
        "prUrl": brief.prUrl,
        "createdAt": brief.createdAt.isoformat()
    }

@app.delete("/api/briefs/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_brief(
    id: int,
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user)
):
    query = select(Brief).where(Brief.id == id)
    if current_user:
         query = query.where(Brief.user_id == current_user.id)
    brief = session.exec(query).first()
    if not brief:
        raise HTTPException(status_code=404, detail="Brief not found")
        
    session.delete(brief)
    session.commit()
    return

@app.post("/api/briefs/{id}/ask")
def ask_brief(
    id: int,
    body: AskQuestionBody,
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user)
):
    query = select(Brief).where(Brief.id == id)
    if current_user:
         query = query.where(Brief.user_id == current_user.id)
    brief = session.exec(query).first()
    if not brief:
        raise HTTPException(status_code=404, detail="Brief not found")
        
    pr_title = ""
    if brief.rawPr:
        try:
            pr_data = json.loads(brief.rawPr)
            pr_title = pr_data.get("title", "")
        except:
            pass

    answer = answer_brief_question(
        brief_title=brief.title,
        brief_sections=brief.sections,
        question=body.question,
        jira_context=brief.jiraContext,
        pr_title=pr_title
    )
    return {"answer": answer}

