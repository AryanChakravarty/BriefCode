import { useState } from "react";
import { X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function ConfigWarning({ missingVars }: { missingVars?: string[] }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const message = missingVars?.includes("OPENAI_API_KEY") 
    ? "OPENAI_API_KEY not set — briefings will use raw data without AI formatting"
    : "Configuration incomplete. Briefings may be limited.";

  return (
    <Alert variant="destructive" className="rounded-none border-t-0 border-l-0 border-r-0 border-b border-destructive/50 bg-destructive/10 text-destructive-foreground font-mono flex items-center justify-between py-3">
      <AlertDescription className="text-xs">
        {message}
      </AlertDescription>
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-6 w-6 text-destructive-foreground hover:bg-destructive/20 hover:text-destructive-foreground -my-1 -mr-2"
        onClick={() => setDismissed(true)}
      >
        <X className="h-4 w-4" />
      </Button>
    </Alert>
  );
}
