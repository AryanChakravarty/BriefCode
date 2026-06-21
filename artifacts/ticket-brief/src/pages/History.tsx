import { Link } from "wouter";
import { Trash2, FileText, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  useListBriefs, 
  useDeleteBrief, 
  getListBriefsQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

export default function History() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: briefs, isLoading } = useListBriefs();
  
  const deleteBrief = useDeleteBrief({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBriefsQueryKey() });
        toast({
          title: "Briefing deleted",
          description: "The briefing has been removed from history.",
        });
      },
      onError: (error) => {
        toast({
          title: "Failed to delete briefing",
          description: error.message ?? "An unknown error occurred.",
          variant: "destructive",
        });
      }
    }
  });

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this briefing?")) {
      deleteBrief.mutate({ id });
    }
  };

  return (
    <div className="p-6 md:p-10 h-full overflow-auto">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-mono font-bold tracking-tight text-foreground">
            History
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-2">
            Past generated briefings
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-md bg-card/50" />
            ))}
          </div>
        ) : briefs?.length === 0 ? (
          <div className="border border-border border-dashed rounded-md p-12 text-center flex flex-col items-center">
            <FileText className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="font-mono font-bold text-foreground text-lg mb-2">No briefings yet</h3>
            <p className="text-muted-foreground font-mono text-sm max-w-sm">
              Generate your first ticket briefing to see it appear here in your history.
            </p>
            <Link href="/">
              <Button className="mt-6 font-mono text-sm">Generate Briefing</Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {briefs?.map((brief) => (
              <Link key={brief.id} href={`/briefs/${brief.id}`}>
                <div className="group border border-border bg-card hover:bg-muted/50 rounded-md p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors cursor-pointer">
                  <div className="space-y-2 flex-1 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded shrink-0">
                        {brief.mode}
                      </span>
                      <h3 className="font-mono font-semibold text-foreground truncate" title={brief.title}>
                        {brief.title}
                      </h3>
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(brief.createdAt).toLocaleDateString()}
                      </div>
                      
                      {brief.jiraKey && (
                        <div className="truncate">
                          <span className="opacity-50">Jira: </span>
                          <span className="text-primary/80">{brief.jiraKey}</span>
                        </div>
                      )}
                      
                      {brief.prUrl && (
                        <div className="truncate">
                          <span className="opacity-50">PR: </span>
                          <span className="text-primary/80">{brief.input.split('/').pop()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="shrink-0 flex items-center justify-end">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => handleDelete(e, brief.id)}
                      disabled={deleteBrief.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
