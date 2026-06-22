import os
import re
import urllib.request
import json
from typing import Dict, Any, Optional

GITHUB_PR_REGEX = r"^(?:https?://)?(?:www\.)?github\.com/([^/]+)/([^/]+)/pull/(\d+)"

def parse_github_pr_url(url: str) -> Optional[Dict[str, Any]]:
    cleaned_url = url.strip() if url else ""
    print(f"DEBUG: Parsing GitHub URL: '{cleaned_url}' (original: '{url}')")
    match = re.match(GITHUB_PR_REGEX, cleaned_url)
    if match:
        return {
            "owner": match.group(1),
            "repo": match.group(2),
            "number": int(match.group(3))
        }
    return None

def fetch_github_api(url: str) -> Any:
    token = os.getenv("GITHUB_TOKEN")
    req = urllib.request.Request(url)
    req.add_header("User-Agent", "PR-Reviewer-FastAPI")
    req.add_header("Accept", "application/vnd.github.v3+json")
    if token:
        req.add_header("Authorization", f"token {token}")
        
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as e:
        raise Exception(f"Failed to fetch GitHub API {url}: {str(e)}")

def fetch_pr_data(owner: str, repo: str, number: int) -> Dict[str, Any]:
    pr_url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{number}"
    commits_url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{number}/commits"
    files_url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{number}/files"
    
    pr = fetch_github_api(pr_url)
    commits = fetch_github_api(commits_url)
    files = fetch_github_api(files_url)
    
    return {
        "pr": pr,
        "commits": commits,
        "files": files
    }
