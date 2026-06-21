import { Brief } from "@workspace/api-client-react";

export function BriefView({ brief }: { brief: Brief }) {
  return (
    <div className="max-w-4xl mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <div className="flex items-center gap-3 text-sm font-mono text-muted-foreground">
          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20">
            {brief.mode}
          </span>
          <span>{new Date(brief.createdAt).toLocaleString()}</span>
        </div>
        <h1 className="text-2xl font-bold font-mono tracking-tight text-foreground">
          {brief.title}
        </h1>
        <div className="flex flex-wrap gap-4 text-sm font-mono text-muted-foreground mt-4">
          {brief.jiraKey && (
            <div className="flex items-center gap-1.5">
              <span className="text-foreground/50">Jira:</span>
              <span className="text-primary">{brief.jiraKey}</span>
            </div>
          )}
          {brief.prUrl && (
            <div className="flex items-center gap-1.5">
              <span className="text-foreground/50">PR:</span>
              <a 
                href={brief.prUrl} 
                target="_blank" 
                rel="noreferrer" 
                className="text-primary hover:underline underline-offset-4"
              >
                {brief.prUrl}
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {brief.sections.map((section, idx) => (
          <div key={idx} className="bg-card border border-border rounded-md overflow-hidden shadow-sm">
            <div className="bg-muted px-4 py-2 border-b border-border font-mono text-sm font-semibold text-foreground">
              {section.title}
            </div>
            <div className="p-5 font-mono text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
              {section.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
