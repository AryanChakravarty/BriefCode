import { useParams, Link } from "wouter";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BriefView } from "@/components/brief/BriefView";
import { useGetBrief, getGetBriefQueryKey } from "@workspace/api-client-react";

export default function BriefPage() {
  const params = useParams();
  const id = params.id ? parseInt(params.id, 10) : 0;

  const { data: brief, isLoading, error } = useGetBrief(id, {
    query: {
      enabled: !!id,
      queryKey: getGetBriefQueryKey(id)
    }
  });

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !brief) {
    return (
      <div className="p-10 max-w-2xl mx-auto">
        <div className="border border-destructive/50 bg-destructive/10 rounded-md p-6 flex flex-col items-center text-center space-y-4">
          <AlertCircle className="w-8 h-8 text-destructive" />
          <div className="font-mono">
            <h3 className="text-lg font-bold text-destructive-foreground">Briefing Not Found</h3>
            <p className="text-sm text-destructive-foreground/80 mt-2">
              The requested briefing could not be loaded or doesn't exist.
            </p>
          </div>
          <Link href="/history">
            <Button variant="outline" className="font-mono text-sm mt-4 border-destructive/30 hover:bg-destructive/20">
              Return to History
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 h-full overflow-auto">
      <div className="max-w-4xl mx-auto w-full mb-8">
        <Link href="/history">
          <Button variant="ghost" className="font-mono text-muted-foreground hover:text-foreground pl-0 group mb-6">
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to History
          </Button>
        </Link>
      </div>
      
      <BriefView brief={brief} />
    </div>
  );
}
