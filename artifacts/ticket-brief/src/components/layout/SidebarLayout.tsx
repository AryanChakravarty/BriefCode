import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { List, FileText, Settings, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen w-full bg-background text-foreground dark overflow-hidden selection:bg-primary selection:text-primary-foreground">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col hidden md:flex shrink-0">
        <div className="h-14 flex items-center px-4 border-b border-border">
          <FileText className="w-5 h-5 text-primary mr-2" />
          <span className="font-mono font-bold tracking-tight">BriefCode</span>
        </div>
        <div className="flex-1 py-4 flex flex-col gap-1 px-3">
          <Link href="/">
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm font-mono rounded-md cursor-pointer transition-colors",
                location === "/"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Activity className="w-4 h-4" />
              <span>Generate</span>
            </div>
          </Link>
          <Link href="/history">
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm font-mono rounded-md cursor-pointer transition-colors",
                location.startsWith("/history") || location.startsWith("/briefs/")
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <List className="w-4 h-4" />
              <span>History</span>
            </div>
          </Link>
        </div>
        <div className="p-4 border-t border-border flex flex-col gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              localStorage.removeItem("token");
              window.location.reload();
            }}
            className="w-full text-xs font-mono border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
          >
            LOG OUT
          </Button>
          <div className="text-center text-[10px] font-mono text-muted-foreground">v1.0.0-rc.1</div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
