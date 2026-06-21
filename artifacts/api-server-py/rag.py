import os
import json
import requests
from typing import List, Dict, Any, Optional

gemini_api_key = os.getenv("GEMINI_API_KEY")

def chunk_text(text: str, chunk_size: int = 800, chunk_overlap: int = 150) -> List[str]:
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - chunk_overlap
    return [c.strip() for c in chunks if c.strip()]

def get_embedding(text: str) -> List[float]:
    if not gemini_api_key:
        return [0.0] * 768
    try:
        url = f"https://generativelanguage.googleapis.com/v1/models/text-embedding-004:embedContent?key={gemini_api_key}"
        response = requests.post(url, json={
            "model": "models/text-embedding-004",
            "content": {
                "parts": [{"text": text}]
            }
        }, timeout=10)
        response.raise_for_status()
        return response.json()["embedding"]["values"]
    except Exception as e:
        print(f"Embedding failed: {e}")
        return [0.0] * 768

def generate_rag_briefing(
    pr_data: Optional[Dict[str, Any]],
    pr_url: Optional[str],
    jira_url: Optional[str],
    jira_context: Optional[str],
    relevant_chunks: List[Dict[str, Any]]
) -> Dict[str, Any]:
    inputs = []
    if pr_url:
        inputs.append(f"PR Link: {pr_url}")
    if jira_url:
        inputs.append(f"JIRA Ticket: {jira_url}")
    if jira_context:
        inputs.append(f"JIRA Ticket Context:\n{jira_context}")
        
    pr_title = ""
    if pr_data:
        pr = pr_data.get("pr", {})
        pr_title = pr.get("title", "")
        commits = pr_data.get("commits", [])
        files = pr_data.get("files", [])
        
        file_list = "\n".join([f"{f.get('status', '').ljust(9)} +{f.get('additions', 0)}/-{f.get('deletions', 0)}  {f.get('filename', '')}" for f in files[:50]])
        commit_messages = "\n".join([f"- {c.get('commit', {}).get('message', '').splitlines()[0]}" for c in commits[:20]])
        
        inputs.append(f"""GitHub PR Metadata:
Title: {pr_title}
Author: {pr.get('user', {}).get('login', '')}
Description:
{pr.get('body') or '(no description)'}

Commits:
{commit_messages}

Changed files:
{file_list}""")

    if relevant_chunks:
        file_contents = "\n\n".join([f"--- File Context: {c.get('fileName') or c.get('file_name')} ---\n{c.get('content')}" for c in relevant_chunks])
        inputs.append(f"Codebase / Uploaded Files Context:\n{file_contents}")

    inputs_str = "\n\n".join(inputs)
    prompt = f"""You are a senior engineer generating a concise PR/Ticket briefing for a teammate.
  
Context and Inputs:
{inputs_str}

Generate a structured briefing with exactly these sections in order:
1. PR Overview (or Ticket Overview)
2. Intent
3. Changed Files (or Codebase changes if applicable)
4. Risks & Edge Cases
5. How to Review
6. Suggested Next Steps

Each section: a short title and 2-6 sentences of dense, useful content. No filler. Plain text, no markdown. Separate each section clearly.

Respond in JSON format with exactly:
{{
  "title": "one-line summary of what this PR does",
  "sections": [
    {{
      "title": "Section Title",
      "content": "Section content..."
    }}
  ]
}}"""

    if not gemini_api_key:
        return {
            "title": pr_title or jira_url or "Ticket Briefing",
            "sections": [
                {"title": "Note", "content": "GEMINI_API_KEY is not configured. Configure GEMINI_API_KEY to enable AI briefings."}
            ]
        }

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_api_key}"
        response = requests.post(url, json={
            "contents": [{"parts": [{"text": prompt}]}],
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
        }, timeout=30)
        
        if response.status_code != 200:
            print(f"Gemini API Error Response: {response.text}")
        response.raise_for_status()
        json_data = response.json()
        text_content = json_data["candidates"][0]["content"]["parts"][0]["text"].strip()
        parsed = json.loads(text_content)
        return parsed
    except Exception as e:
        error_msg = str(e)
        if 'response' in locals() and response is not None:
            error_msg += f" - Response Details: {response.text}"
        print(f"Completion failed: {error_msg}")
        return {
            "title": pr_title or jira_url or "Ticket Briefing",
            "sections": [
                {"title": "AI Briefing Summary", "content": error_msg}
            ]
        }
