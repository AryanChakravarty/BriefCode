import React, { useState } from "react";
import { Terminal, Shield, ArrowRight, Loader2, UserPlus, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setAuthTokenGetter } from "@workspace/api-client-react";

// Initialize the token getter from localStorage
setAuthTokenGetter(() => {
  return localStorage.getItem("token");
});

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (token) {
    return <>{children}</>;
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const endpoint = isLogin ? "/api/auth/token" : "/api/auth/register";
    
    try {
      if (isLogin) {
        // OAuth2 Password Request Form format: application/x-www-form-urlencoded
        const params = new URLSearchParams();
        params.append("username", username);
        params.append("password", password);

        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params,
        });

        if (!res.ok) {
          let errorMsg = "Authentication failed";
          const rawText = await res.text();
          try {
            const errData = JSON.parse(rawText);
            errorMsg = errData.detail || errorMsg;
          } catch (e) {
            errorMsg = rawText || `HTTP ${res.status} error`;
          }
          throw new Error(errorMsg);
        }

        const data = await res.json();
        localStorage.setItem("token", data.access_token);
        setToken(data.access_token);
      } else {
        // Register format: application/json
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username, password }),
        });

        if (!res.ok) {
          let errorMsg = "Registration failed";
          const rawText = await res.text();
          try {
            const errData = JSON.parse(rawText);
            errorMsg = errData.detail || errorMsg;
          } catch (e) {
            errorMsg = rawText || `HTTP ${res.status} error`;
          }
          throw new Error(errorMsg);
        }

        // Auto login after registration
        setIsLogin(true);
        setPassword("");
        setError("Registration successful! Please login.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during authentication");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background text-foreground dark selection:bg-primary selection:text-primary-foreground p-6">
      <div className="w-full max-w-md bg-card border border-border p-8 rounded-lg shadow-lg space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary mb-2">
            <Terminal className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-mono font-bold tracking-tight">BRIEF_CODE</h1>
          <p className="text-xs font-mono text-primary/80 uppercase tracking-wider">
            Instant PR & Ticket Intelligence
          </p>
          <p className="text-[11px] font-mono text-muted-foreground">
            {isLogin ? "AUTHENTICATION REQUIRED" : "CREATE NEW OPERATOR KEY"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-1">
            <label className="font-mono text-[10px] text-muted-foreground block">USERNAME</label>
            <Input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. operator_01"
              className="font-mono text-sm bg-background border-border h-11"
              autoComplete="username"
            />
          </div>

          <div className="space-y-1">
            <label className="font-mono text-[10px] text-muted-foreground block">PASSWORD</label>
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="font-mono text-sm bg-background border-border h-11"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className={`p-3 border rounded font-mono text-xs ${
              error.includes("successful") 
                ? "border-primary/30 bg-primary/5 text-primary" 
                : "border-destructive/30 bg-destructive/5 text-destructive"
            }`}>
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 font-mono font-bold bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : isLogin ? (
              <>
                <LogIn className="w-4 h-4 mr-2" />
                <span>ACCESS TERMINAL</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                <span>INITIALIZE KEY</span>
              </>
            )}
          </Button>
        </form>

        {/* Toggle */}
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
            }}
            className="font-mono text-xs text-muted-foreground hover:text-primary underline transition-colors"
          >
            {isLogin ? "Initialize new key" : "Access existing key"}
          </button>
        </div>
        
      </div>
    </div>
  );
}
