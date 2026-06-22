// BriefCode Client-Side Single Page Application

// --- App State ---
const state = {
  token: localStorage.getItem("token") || null,
  isLoginMode: true,
  route: window.location.hash || "#/",
  briefs: [],
  activeBrief: null,
  uploadedFiles: [],
  isGenerating: false,
  configStatus: null,
  wordCount: 0,
  toastId: 0
};

// --- Toast System ---
function showToast(title, description, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const id = ++state.toastId;
  const isDestructive = type === "destructive";
  
  const toastHTML = `
    <div id="toast-${id}" class="flex flex-col gap-1 p-4 border rounded-md shadow-lg min-w-[300px] pointer-events-auto bg-card animate-in fade-in slide-in-from-bottom-2 duration-300 ${
      isDestructive 
        ? "border-red-900/50 bg-red-950/20 text-red-200" 
        : "border-emerald-900/50 bg-emerald-950/20 text-emerald-200"
    }">
      <div class="flex items-center justify-between">
        <span class="font-mono text-xs font-bold uppercase tracking-wider">${title}</span>
        <button onclick="removeToast(${id})" class="text-muted-foreground hover:text-foreground text-xs opacity-75 hover:opacity-100 font-mono">×</button>
      </div>
      ${description ? `<p class="font-mono text-[11px] text-muted-foreground/80 mt-1">${description}</p>` : ""}
    </div>
  `;
  
  container.insertAdjacentHTML("beforeend", toastHTML);
  
  setTimeout(() => {
    removeToast(id);
  }, 5000);
}

function removeToast(id) {
  const toast = document.getElementById(`toast-${id}`);
  if (toast) {
    toast.classList.add("animate-out", "fade-out", "duration-300");
    setTimeout(() => toast.remove(), 300);
  }
}

// --- API Request Helper ---
async function fetchAPI(endpoint, options = {}) {
  const headers = { ...options.headers };
  
  if (state.token) {
    headers["Authorization"] = `Bearer ${state.token}`;
  }

  // Handle Form Data vs JSON
  if (options.body && !(options.body instanceof URLSearchParams)) {
    headers["Content-Type"] = "application/json";
    if (typeof options.body === "object") {
      options.body = JSON.stringify(options.body);
    }
  }

  try {
    const response = await fetch(endpoint, { ...options, headers });
    
    if (response.status === 401) {
      // Clear token and redirect to auth on auth failure
      localStorage.removeItem("token");
      state.token = null;
      showToast("Authentication Error", "Session expired or invalid. Please login again.", "destructive");
      render();
      return null;
    }

    if (!response.ok) {
      let errorDetail = `HTTP ${response.status} error`;
      try {
        const errJson = await response.json();
        errorDetail = errJson.detail || errorDetail;
      } catch (_) {}
      throw new Error(errorDetail);
    }

    if (response.status === 204) {
      return true;
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error on ${endpoint}:`, error);
    throw error;
  }
}

// --- Fetch Configurations & History Data ---
async function loadConfigStatus() {
  try {
    const config = await fetchAPI("/api/config/status");
    if (config) {
      state.configStatus = config;
    }
  } catch (err) {
    console.error("Failed to load config status:", err);
  }
}

async function loadBriefsHistory() {
  try {
    const list = await fetchAPI("/api/briefs");
    if (list) {
      state.briefs = list;
    }
  } catch (err) {
    console.error("Failed to load briefs history:", err);
  }
}

// --- Helper Functions ---
function countWords(str) {
  if (!str) return 0;
  return str.trim().split(/\s+/).filter(Boolean).length;
}

// --- Render Core views ---
function render() {
  const appContainer = document.getElementById("app");
  if (!appContainer) return;

  // 1. Auth Gate Check
  if (!state.token) {
    appContainer.className = "flex min-h-screen w-full items-center justify-center bg-background text-foreground p-6";
    appContainer.innerHTML = renderAuthGate();
    lucide.createIcons();
    return;
  }

  // 2. Setup Layout
  appContainer.className = "flex h-screen w-full bg-background text-foreground overflow-hidden selection:bg-primary/20 selection:text-primary-foreground";
  
  // Match Route
  let pageHTML = "";
  const briefMatch = state.route.match(/^#\/briefs\/(\d+)$/);
  
  if (state.route === "#/" || state.route === "") {
    pageHTML = renderHome();
  } else if (state.route === "#/history") {
    pageHTML = renderHistory();
  } else if (briefMatch) {
    const id = parseInt(briefMatch[1], 10);
    pageHTML = renderBriefPage(id);
  } else {
    pageHTML = renderNotFound();
  }

  appContainer.innerHTML = renderLayout(pageHTML);
  lucide.createIcons();
}

// --- View Templates ---

function renderAuthGate() {
  return `
    <div class="w-full max-w-md bg-card border border-border p-8 rounded-lg shadow-lg space-y-6">
      <!-- Header -->
      <div class="text-center space-y-2">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 mb-2">
          <i data-lucide="terminal" class="w-6 h-6"></i>
        </div>
        <h1 class="text-2xl font-mono font-bold tracking-tight">BRIEF_CODE</h1>
        <p class="text-xs font-mono text-emerald-500/80 uppercase tracking-wider">
          Instant PR & Ticket Intelligence
        </p>
        <p class="text-[11px] font-mono text-muted-foreground">
          ${state.isLoginMode ? "AUTHENTICATION REQUIRED" : "CREATE NEW OPERATOR KEY"}
        </p>
      </div>

      <!-- Form -->
      <form id="auth-form" onsubmit="handleAuthSubmit(event)" class="space-y-4">
        <div class="space-y-1">
          <label class="font-mono text-[10px] text-muted-foreground block">USERNAME</label>
          <input
            type="text"
            required
            id="auth-username"
            placeholder="e.g. operator_01"
            class="w-full font-mono text-sm bg-background border border-muted hover:border-emerald-500/40 focus:border-emerald-500 focus:outline-none px-3 h-11 rounded-md text-foreground placeholder:text-muted-foreground/60 transition-colors"
            autocomplete="username"
          />
        </div>

        <div class="space-y-1">
          <label class="font-mono text-[10px] text-muted-foreground block">PASSWORD</label>
          <input
            type="password"
            required
            id="auth-password"
            placeholder="••••••••"
            class="w-full font-mono text-sm bg-background border border-muted hover:border-emerald-500/40 focus:border-emerald-500 focus:outline-none px-3 h-11 rounded-md text-foreground placeholder:text-muted-foreground/60 transition-colors"
            autocomplete="current-password"
          />
        </div>

        <button
          type="submit"
          class="w-full h-11 font-mono font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md flex items-center justify-center transition-colors mt-6"
        >
          <span class="mr-2">${state.isLoginMode ? "ACCESS TERMINAL" : "INITIALIZE KEY"}</span>
          <i data-lucide="${state.isLoginMode ? "log-in" : "user-plus"}" class="w-4 h-4"></i>
        </button>
      </form>

      <!-- Toggle -->
      <div class="text-center pt-2">
        <button
          type="button"
          onclick="toggleAuthMode()"
          class="font-mono text-xs text-muted-foreground hover:text-emerald-500 underline transition-colors"
        >
          ${state.isLoginMode ? "Initialize new key" : "Access existing key"}
        </button>
      </div>
    </div>
  `;
}

function renderLayout(contentHTML) {
  return `
    <!-- Sidebar -->
    <aside class="w-64 border-r border-muted bg-card flex flex-col hidden md:flex shrink-0">
      <div class="h-14 flex items-center px-4 border-b border-muted">
        <i data-lucide="file-text" class="w-5 h-5 text-emerald-500 mr-2"></i>
        <span class="font-mono font-bold tracking-tight">BriefCode</span>
      </div>
      <div class="flex-1 py-4 flex flex-col gap-1 px-3">
        <a href="#/" class="flex items-center gap-2 px-3 py-2 text-sm font-mono rounded-md cursor-pointer transition-colors ${
          state.route === "#/" || state.route === "" 
            ? "bg-emerald-950/30 text-emerald-400 border border-emerald-900/30" 
            : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
        }">
          <i data-lucide="activity" class="w-4 h-4"></i>
          <span>Generate</span>
        </a>
        <a href="#/history" class="flex items-center gap-2 px-3 py-2 text-sm font-mono rounded-md cursor-pointer transition-colors ${
          state.route === "#/history" || state.route.startsWith("#/briefs/")
            ? "bg-emerald-950/30 text-emerald-400 border border-emerald-900/30" 
            : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
        }">
          <i data-lucide="list" class="w-4 h-4"></i>
          <span>History</span>
        </a>
      </div>
      <div class="p-4 border-t border-muted flex flex-col gap-2">
        <button 
          onclick="handleLogout()"
          class="w-full text-xs font-mono border border-red-950 hover:bg-red-950/20 text-red-400 hover:text-red-300 py-2 rounded-md transition-colors font-semibold"
        >
          LOG OUT
        </button>
        <div class="text-center text-[10px] font-mono text-muted-foreground">v1.0.0-rc.1</div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 flex flex-col h-full overflow-hidden relative">
      <div class="flex-1 overflow-auto bg-background">
        ${contentHTML}
      </div>
    </main>
  `;
}

function renderHome() {
  // Show warning if Gemini key is missing
  const showWarning = state.configStatus && !state.configStatus.allConfigured;
  const missingVars = state.configStatus ? state.configStatus.missingVars || [] : [];
  
  const warningHTML = showWarning ? `
    <div class="bg-amber-950/20 border border-amber-900/50 p-4 rounded-lg flex gap-3 text-amber-200 font-mono text-xs max-w-4xl mx-auto mb-6">
      <i data-lucide="alert-triangle" class="w-5 h-5 text-amber-500 shrink-0"></i>
      <div>
        <h4 class="font-bold uppercase tracking-wider mb-1">Missing Configuration</h4>
        <p class="text-muted-foreground leading-relaxed">
          The following environment variables are missing from your configuration: <span class="text-amber-400">${missingVars.join(", ")}</span>. 
          AI briefing generation is disabled. BriefCode will fall back to extracting and showing raw metadata details.
        </p>
      </div>
    </div>
  ` : "";

  const filesHTML = state.uploadedFiles.map((file, idx) => `
    <div class="flex items-center justify-between bg-muted/40 border border-muted p-2 rounded font-mono text-xs">
      <div class="flex items-center gap-2">
        <i data-lucide="file-text" class="w-4 h-4 text-emerald-500"></i>
        <span class="truncate max-w-[200px] md:max-w-[400px] text-foreground">${file.name}</span>
      </div>
      <button
        type="button"
        onclick="removeUploadedFile(${idx})"
        class="text-muted-foreground hover:text-red-500 transition-colors p-1"
      >
        <i data-lucide="x" class="w-4 h-4"></i>
      </button>
    </div>
  `).join("");

  return `
    <div class="flex flex-col h-full">
      ${warningHTML}
      
      <div class="flex-1 p-6 md:p-10">
        <div class="max-w-4xl mx-auto w-full space-y-8">
          <!-- Title Section -->
          <div class="space-y-3">
            <h1 class="text-3xl font-mono font-bold tracking-tight text-foreground flex items-center gap-3">
              <i data-lucide="terminal" class="w-8 h-8 text-emerald-500"></i>
              BriefCode
            </h1>
            <p class="text-muted-foreground font-mono text-sm max-w-xl">
              Provide a GitHub PR, JIRA Ticket, context text, or upload files to generate a structured briefing in seconds.
            </p>
          </div>

          <!-- Main Input Form -->
          <form id="brief-form" onsubmit="handleBriefSubmit(event)" class="space-y-6 bg-card border border-muted p-6 rounded-lg">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="space-y-2">
                <label class="font-mono text-xs text-muted-foreground block">GITHUB PR LINK</label>
                <input 
                  type="url"
                  id="pr-url"
                  placeholder="https://github.com/org/repo/pull/123" 
                  class="w-full font-mono text-sm bg-background border border-muted hover:border-emerald-500/40 focus:border-emerald-500 focus:outline-none px-3 h-11 rounded-md text-foreground placeholder:text-muted-foreground/60 transition-colors"
                  autocomplete="off"
                  ${state.isGenerating ? "disabled" : ""}
                />
              </div>

              <div class="space-y-2">
                <label class="font-mono text-xs text-muted-foreground block">JIRA TICKET LINK / KEY</label>
                <input 
                  type="text"
                  id="jira-url"
                  placeholder="e.g. PROJ-123" 
                  class="w-full font-mono text-sm bg-background border border-muted hover:border-emerald-500/40 focus:border-emerald-500 focus:outline-none px-3 h-11 rounded-md text-foreground placeholder:text-muted-foreground/60 transition-colors"
                  autocomplete="off"
                  ${state.isGenerating ? "disabled" : ""}
                />
              </div>
            </div>

            <div class="space-y-2">
              <div class="flex justify-between items-center">
                <label class="font-mono text-xs text-muted-foreground">JIRA TICKET / PROJECT CONTEXT</label>
                <span id="word-counter" class="text-[10px] font-mono text-muted-foreground">
                  0 / 100 WORDS
                </span>
              </div>
              <textarea 
                id="jira-context"
                placeholder="Paste descriptions, acceptance criteria, or JIRA ticket text context here (max 100 words)..." 
                class="w-full font-mono text-sm bg-background border border-muted hover:border-emerald-500/40 focus:border-emerald-500 focus:outline-none p-3 min-h-[100px] rounded-md text-foreground placeholder:text-muted-foreground/60 transition-colors resize-y"
                oninput="updateWordCounter(this.value)"
                ${state.isGenerating ? "disabled" : ""}
              ></textarea>
            </div>

            <!-- Drag and Drop File Upload -->
            <div class="space-y-2">
              <label class="font-mono text-xs text-muted-foreground block">CODEBASE CONTEXT / EXTRA FILES (MD, PDF, TXT)</label>
              <div
                id="drop-zone"
                ondragover="handleDragOver(event)"
                ondragleave="handleDragLeave(event)"
                ondrop="handleDrop(event)"
                onclick="triggerFileSelect()"
                class="border border-dashed border-muted rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors hover:bg-muted/10"
              >
                <input
                  type="file"
                  id="file-selector"
                  onchange="handleFilesSelected(event)"
                  class="hidden"
                  multiple
                  accept=".pdf,.md,.txt"
                />
                <i data-lucide="upload" class="w-8 h-8 text-muted-foreground mb-2"></i>
                <span class="font-mono text-xs text-muted-foreground">
                  Drag & drop files here, or <span class="text-emerald-500 underline">browse</span>
                </span>
              </div>

              <div id="file-list-container" class="pt-3 space-y-2">
                ${filesHTML}
              </div>
            </div>

            <div class="flex justify-end pt-2">
              <button 
                type="submit" 
                id="brief-submit-btn"
                ${state.isGenerating ? "disabled" : ""}
                class="h-11 px-6 font-mono font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md flex items-center justify-center transition-colors"
              >
                <span class="mr-2">${state.isGenerating ? "GENERATING BRIEF..." : "EXECUTE BRIEFING"}</span>
                <i data-lucide="${state.isGenerating ? "loader-2" : "arrow-right"}" class="w-4 h-4 ${state.isGenerating ? "animate-spin" : ""}"></i>
              </button>
            </div>
          </form>

          <!-- Status Indicator or Output -->
          <div id="brief-result-container">
            ${state.isGenerating ? `
              <div class="border border-muted rounded-md bg-card p-8 flex flex-col items-center justify-center space-y-4">
                <i data-lucide="loader-2" class="w-8 h-8 text-emerald-500 animate-spin"></i>
                <div class="text-muted-foreground font-mono text-sm animate-pulse">Analyzing references and generating briefing...</div>
              </div>
            ` : ""}
            
            ${state.activeBrief && !state.isGenerating ? renderBriefView(state.activeBrief) : ""}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderHistory() {
  if (state.briefs.length === 0) {
    return `
      <div class="p-6 md:p-10 h-full overflow-auto">
        <div class="max-w-5xl mx-auto space-y-8">
          <div>
            <h1 class="text-2xl font-mono font-bold tracking-tight text-foreground">History</h1>
            <p class="text-muted-foreground font-mono text-sm mt-2">Past generated briefings</p>
          </div>
          <div class="border border-dashed border-muted rounded-md p-12 text-center flex flex-col items-center">
            <i data-lucide="file-text" class="w-12 h-12 text-muted-foreground mb-4 opacity-50"></i>
            <h3 class="font-mono font-bold text-foreground text-lg mb-2">No briefings yet</h3>
            <p class="text-muted-foreground font-mono text-sm max-w-sm">
              Generate your first ticket briefing to see it appear here in your history.
            </p>
            <a href="#/" class="mt-6 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs rounded-md transition-colors">
              Generate Briefing
            </a>
          </div>
        </div>
      </div>
    `;
  }

  const itemsHTML = state.briefs.map((brief) => {
    const dateStr = new Date(brief.createdAt).toLocaleDateString();
    const inputDisplay = brief.prUrl ? brief.prUrl.split('/').pop() : brief.input;
    
    return `
      <div onclick="navigateToBrief(${brief.id})" class="group border border-muted bg-card hover:bg-muted/20 rounded-md p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors cursor-pointer">
        <div class="space-y-2 flex-1 overflow-hidden">
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-mono px-2 py-0.5 bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 rounded shrink-0">
              ${brief.mode}
            </span>
            <h3 class="font-mono font-semibold text-foreground truncate" title="${brief.title}">
              ${brief.title}
            </h3>
          </div>
          
          <div class="flex items-center gap-4 text-[11px] font-mono text-muted-foreground">
            <div class="flex items-center gap-1.5 shrink-0">
              <i data-lucide="calendar" class="w-3.5 h-3.5"></i>
              ${dateStr}
            </div>
            
            ${brief.jiraKey ? `
              <div class="truncate">
                <span class="opacity-50">Jira: </span>
                <span class="text-emerald-400/80">${brief.jiraKey}</span>
              </div>
            ` : ""}
            
            ${brief.prUrl ? `
              <div class="truncate">
                <span class="opacity-50">PR: </span>
                <span class="text-emerald-400/80">${inputDisplay}</span>
              </div>
            ` : ""}
          </div>
        </div>
        
        <div class="shrink-0 flex items-center justify-end">
          <button 
            onclick="handleDeleteBrief(event, ${brief.id})"
            class="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500 hover:bg-red-950/20 p-2 rounded-md"
          >
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="p-6 md:p-10 h-full overflow-auto">
      <div class="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 class="text-2xl font-mono font-bold tracking-tight text-foreground">History</h1>
          <p class="text-muted-foreground font-mono text-sm mt-2">Past generated briefings</p>
        </div>
        <div class="grid gap-4">
          ${itemsHTML}
        </div>
      </div>
    </div>
  `;
}

function renderBriefPage(id) {
  const brief = state.briefs.find(b => b.id === id);
  if (!brief) {
    // If not found in memory, try to load it
    loadBriefDetail(id);
    return `
      <div class="h-full flex items-center justify-center">
        <i data-lucide="loader-2" class="w-8 h-8 text-emerald-500 animate-spin"></i>
      </div>
    `;
  }

  return `
    <div class="p-6 md:p-10 h-full overflow-auto">
      <div class="max-w-4xl mx-auto w-full mb-8">
        <a href="#/history" class="inline-flex items-center font-mono text-muted-foreground hover:text-foreground group mb-6 text-sm">
          <i data-lucide="arrow-left" class="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform"></i>
          Back to History
        </a>
      </div>
      
      ${renderBriefView(brief)}
    </div>
  `;
}

function renderBriefView(brief) {
  const dateStr = new Date(brief.createdAt).toLocaleString();
  
  const sectionsHTML = brief.sections.map((section) => `
    <div class="bg-card border border-muted rounded-md overflow-hidden shadow-sm">
      <div class="bg-muted/40 px-4 py-2 border-b border-muted font-mono text-sm font-semibold text-foreground">
        ${section.title}
      </div>
      <div class="p-5 font-mono text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
        ${section.content}
      </div>
    </div>
  `).join("");

  return `
    <div class="max-w-4xl mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div class="space-y-2">
        <div class="flex items-center gap-3 text-sm font-mono text-muted-foreground">
          <span class="bg-emerald-950/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-900/30">
            ${brief.mode}
          </span>
          <span>${dateStr}</span>
        </div>
        <h1 class="text-2xl font-bold font-mono tracking-tight text-foreground">
          ${brief.title}
        </h1>
        <div class="flex flex-wrap gap-4 text-sm font-mono text-muted-foreground mt-4">
          ${brief.jiraKey ? `
            <div class="flex items-center gap-1.5">
              <span class="text-foreground/50">Jira:</span>
              <span class="text-emerald-400">${brief.jiraKey}</span>
            </div>
          ` : ""}
          ${brief.prUrl ? `
            <div class="flex items-center gap-1.5">
              <span class="text-foreground/50">PR:</span>
              <a 
                href="${brief.prUrl}" 
                target="_blank" 
                rel="noreferrer" 
                class="text-emerald-400 hover:underline underline-offset-4"
              >
                ${brief.prUrl}
              </a>
            </div>
          ` : ""}
        </div>
      </div>

      <div class="space-y-6">
        ${sectionsHTML}
      </div>
    </div>
  `;
}

function renderNotFound() {
  return `
    <div class="p-10 max-w-2xl mx-auto text-center space-y-4">
      <h2 class="text-2xl font-mono font-bold">404 — SYSTEM UNKNOWN PATH</h2>
      <p class="text-muted-foreground font-mono text-sm">The route you requested does not exist.</p>
      <a href="#/" class="inline-block mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs rounded-md">
        Return Home
      </a>
    </div>
  `;
}

// --- Interaction Handlers ---

function toggleAuthMode() {
  state.isLoginMode = !state.isLoginMode;
  render();
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const username = document.getElementById("auth-username").value.trim();
  const password = document.getElementById("auth-password").value;

  if (!username || !password) return;

  const endpoint = state.isLoginMode ? "/api/auth/token" : "/api/auth/register";

  try {
    if (state.isLoginMode) {
      // OAuth2 Password Request Form format: urlencoded
      const params = new URLSearchParams();
      params.append("username", username);
      params.append("password", password);

      const data = await fetchAPI(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: params
      });

      if (data && data.access_token) {
        localStorage.setItem("token", data.access_token);
        state.token = data.access_token;
        showToast("Access Granted", "Operator key verified successfully.");
        await initializeApp();
      }
    } else {
      // Register format: JSON
      await fetchAPI(endpoint, {
        method: "POST",
        body: { username, password }
      });

      showToast("Key Initialized", "Registration successful. Please login with your new credentials.");
      state.isLoginMode = true;
      render();
    }
  } catch (err) {
    showToast("Auth Failure", err.message, "destructive");
  }
}

function handleLogout() {
  localStorage.removeItem("token");
  state.token = null;
  state.briefs = [];
  state.activeBrief = null;
  showToast("Logged Out", "Terminal session cleared.");
  render();
}

function updateWordCounter(val) {
  const counter = document.getElementById("word-counter");
  const count = countWords(val);
  state.wordCount = count;
  if (counter) {
    counter.innerText = `${count} / 100 WORDS`;
    if (count > 100) {
      counter.className = "text-[10px] font-mono text-red-500 font-bold";
    } else {
      counter.className = "text-[10px] font-mono text-muted-foreground";
    }
  }
}

// File Handlers
function triggerFileSelect() {
  const input = document.getElementById("file-selector");
  if (input) input.click();
}

function handleFilesSelected(e) {
  if (e.target.files) {
    processFiles(e.target.files);
  }
}

function handleDragOver(e) {
  e.preventDefault();
  const zone = document.getElementById("drop-zone");
  if (zone) zone.className = "border border-dashed border-emerald-500 bg-emerald-950/10 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors";
}

function handleDragLeave(e) {
  e.preventDefault();
  const zone = document.getElementById("drop-zone");
  if (zone) zone.className = "border border-dashed border-muted rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors hover:bg-muted/10";
}

function handleDrop(e) {
  e.preventDefault();
  const zone = document.getElementById("drop-zone");
  if (zone) zone.className = "border border-dashed border-muted rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors hover:bg-muted/10";
  
  if (e.dataTransfer.files) {
    processFiles(e.dataTransfer.files);
  }
}

function processFiles(filesList) {
  for (let i = 0; i < filesList.length; i++) {
    const file = filesList[i];
    const ext = file.name.split(".").pop().toLowerCase();
    
    if (ext !== "pdf" && ext !== "md" && ext !== "txt") {
      showToast("Unsupported Format", `${file.name} is invalid. Upload PDF, MD, or TXT.`, "destructive");
      continue;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      state.uploadedFiles.push({
        name: file.name,
        content: event.target.result
      });
      render();
    };
    reader.readAsDataURL(file);
  }
}

function removeUploadedFile(index) {
  state.uploadedFiles = state.uploadedFiles.filter((_, i) => i !== index);
  render();
}

// Brief Actions
async function handleBriefSubmit(e) {
  e.preventDefault();
  
  const prUrl = document.getElementById("pr-url").value.trim();
  const jiraUrl = document.getElementById("jira-url").value.trim();
  const jiraContext = document.getElementById("jira-context").value.trim();

  if (!prUrl && !jiraUrl && !jiraContext && state.uploadedFiles.length === 0) {
    showToast("Input Required", "Fill in at least one input field or upload codebase context files.", "destructive");
    return;
  }

  if (countWords(jiraContext) > 100) {
    showToast("Validation Error", "Jira context exceeds the 100-word limit.", "destructive");
    return;
  }

  state.isGenerating = true;
  state.activeBrief = null;
  render();

  try {
    const brief = await fetchAPI("/api/briefs", {
      method: "POST",
      body: {
        prUrl: prUrl || undefined,
        jiraUrl: jiraUrl || undefined,
        jiraContext: jiraContext || undefined,
        files: state.uploadedFiles.length > 0 ? state.uploadedFiles : undefined
      }
    });

    if (brief) {
      state.activeBrief = brief;
      state.uploadedFiles = []; // Clear uploaded files on success
      showToast("Generation Complete", "Your structured briefing is ready.");
      // Reload history in background
      loadBriefsHistory();
    }
  } catch (err) {
    showToast("Generation Failed", err.message, "destructive");
  } finally {
    state.isGenerating = false;
    render();
  }
}

async function handleDeleteBrief(e, id) {
  e.preventDefault();
  e.stopPropagation();
  
  if (!confirm("Are you sure you want to delete this briefing?")) return;

  try {
    const ok = await fetchAPI(`/api/briefs/${id}`, {
      method: "DELETE"
    });
    
    if (ok) {
      state.briefs = state.briefs.filter(b => b.id !== id);
      showToast("Briefing Deleted", "The briefing has been removed.");
      if (state.activeBrief && state.activeBrief.id === id) {
        state.activeBrief = null;
      }
      render();
    }
  } catch (err) {
    showToast("Delete Failed", err.message, "destructive");
  }
}

async function navigateToBrief(id) {
  window.location.hash = `#/briefs/${id}`;
}

async function loadBriefDetail(id) {
  try {
    const brief = await fetchAPI(`/api/briefs/${id}`);
    if (brief) {
      const idx = state.briefs.findIndex(b => b.id === id);
      if (idx !== -1) {
        state.briefs[idx] = brief;
      } else {
        state.briefs.push(brief);
      }
      render();
    }
  } catch (err) {
    showToast("Load Failed", "Could not load briefing details.", "destructive");
    window.location.hash = "#/history";
  }
}

// --- App Initialization ---
async function initializeApp() {
  if (state.token) {
    await Promise.all([
      loadConfigStatus(),
      loadBriefsHistory()
    ]);
  }
  render();
}

// Router Event Listener
window.addEventListener("hashchange", () => {
  state.route = window.location.hash || "#/";
  render();
});

// Start app
initializeApp();
