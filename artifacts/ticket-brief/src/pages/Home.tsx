import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Terminal, ArrowRight, Loader2, Upload, FileText, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ConfigWarning } from "@/components/ui/ConfigWarning";
import { BriefView } from "@/components/brief/BriefView";
import { useToast } from "@/hooks/use-toast";
import { 
  useGetConfigStatus, 
  useCreateBrief, 
  getListBriefsQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { Brief } from "@workspace/api-client-react";

const countWords = (str: string) => {
  if (!str) return 0;
  return str.trim().split(/\s+/).filter(Boolean).length;
};

const formSchema = z.object({
  prUrl: z.string().optional(),
  jiraUrl: z.string().optional(),
  jiraContext: z.string().optional(),
}).superRefine((data, ctx) => {
  if (!data.prUrl && !data.jiraUrl && !data.jiraContext) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please fill in at least one field: GitHub PR, JIRA Ticket, or JIRA Context.",
      path: ["prUrl"],
    });
  }
  if (data.jiraContext && countWords(data.jiraContext) > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "JIRA context must be under 100 words.",
      path: ["jiraContext"],
    });
  }
});

export default function Home() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [generatedBrief, setGeneratedBrief] = useState<Brief | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; content: string }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: configStatus, isLoading: isLoadingConfig } = useGetConfigStatus();
  
  const createBrief = useCreateBrief({
    mutation: {
      onSuccess: (data) => {
        setGeneratedBrief(data);
        queryClient.invalidateQueries({ queryKey: getListBriefsQueryKey() });
        toast({
          title: "Briefing generated successfully",
          description: "Your brief is ready to review.",
        });
      },
      onError: (error) => {
        toast({
          title: "Failed to generate brief",
          description: error?.data?.error ?? error?.message ?? "An unknown error occurred.",
          variant: "destructive",
        });
      }
    }
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prUrl: "",
      jiraUrl: "",
      jiraContext: "",
    },
  });

  const jiraContextValue = form.watch("jiraContext") || "";
  const wordCount = countWords(jiraContextValue);

  function onSubmit(values: z.infer<typeof formSchema>) {
    setGeneratedBrief(null);
    createBrief.mutate({ 
      data: { 
        prUrl: values.prUrl || undefined,
        jiraUrl: values.jiraUrl || undefined,
        jiraContext: values.jiraContext || undefined,
        files: uploadedFiles.length > 0 ? uploadedFiles : undefined
      } 
    });
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const filesList = e.target.files;
    if (!filesList) return;
    processFiles(filesList);
  };

  const processFiles = (filesList: FileList) => {
    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext !== "pdf" && ext !== "md" && ext !== "txt") {
        toast({
          title: "Unsupported file type",
          description: `${file.name} is not supported. Upload PDF, MD, or TXT.`,
          variant: "destructive",
        });
        continue;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setUploadedFiles(prev => [...prev, { name: file.name, content: result }]);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {!isLoadingConfig && configStatus && !configStatus.allConfigured && (
        <ConfigWarning missingVars={configStatus.missingVars} />
      )}
      
      <div className="flex-1 overflow-auto p-6 md:p-10">
        <div className="max-w-4xl mx-auto w-full space-y-8">
          
          <div className="space-y-3">
            <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground flex items-center gap-3">
              <Terminal className="w-8 h-8 text-primary" />
              BriefCode
            </h1>
            <p className="text-muted-foreground font-mono text-sm max-w-xl">
              Provide a GitHub PR, JIRA Ticket, context text, or upload files to generate a structured briefing in seconds.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 bg-card border border-border p-6 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <FormField
                  control={form.control}
                  name="prUrl"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="font-mono text-xs text-muted-foreground">GITHUB PR LINK</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://github.com/org/repo/pull/123" 
                          className="font-mono text-sm bg-background border-border h-11 shadow-sm"
                          autoComplete="off"
                          disabled={createBrief.isPending}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage className="font-mono text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="jiraUrl"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="font-mono text-xs text-muted-foreground">JIRA TICKET LINK / KEY</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://org.atlassian.net/browse/PROJ-123 or PROJ-123" 
                          className="font-mono text-sm bg-background border-border h-11 shadow-sm"
                          autoComplete="off"
                          disabled={createBrief.isPending}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage className="font-mono text-xs" />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="jiraContext"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <div className="flex justify-between items-center">
                      <FormLabel className="font-mono text-xs text-muted-foreground">JIRA TICKET / PROJECT CONTEXT</FormLabel>
                      <span className={`text-[10px] font-mono ${wordCount > 100 ? "text-destructive font-bold" : "text-muted-foreground"}`}>
                        {wordCount} / 100 WORDS
                      </span>
                    </div>
                    <FormControl>
                      <Textarea 
                        placeholder="Paste descriptions, acceptance criteria, or JIRA ticket text context here (max 100 words)..." 
                        className="font-mono text-sm bg-background border-border min-h-[100px] shadow-sm resize-y"
                        disabled={createBrief.isPending}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage className="font-mono text-xs" />
                  </FormItem>
                )}
              />

              {/* Drag and Drop File Upload */}
              <div className="space-y-2">
                <label className="font-mono text-xs text-muted-foreground block">CODEBASE CONTEXT / EXTRA FILES (MD, PDF, TXT)</label>
                <div
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                    isDragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    multiple
                    accept=".pdf,.md,.txt"
                  />
                  <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                  <span className="font-mono text-xs text-muted-foreground">
                    Drag & drop files here, or <span className="text-primary underline">browse</span>
                  </span>
                </div>

                {uploadedFiles.length > 0 && (
                  <div className="pt-3 space-y-2">
                    {uploadedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-muted/50 border border-border p-2 rounded font-mono text-xs">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary" />
                          <span className="truncate max-w-[200px] md:max-w-[400px]">{file.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {form.formState.errors.root && (
                <div className="flex items-center gap-2 text-destructive font-mono text-xs pt-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>{form.formState.errors.root.message}</span>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button 
                  type="submit" 
                  disabled={createBrief.isPending}
                  className="h-11 px-6 font-mono font-bold bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {createBrief.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <span className="mr-2">EXECUTE BRIEFING</span>
                  )}
                  {!createBrief.isPending && <ArrowRight className="w-4 h-4" />}
                </Button>
              </div>
            </form>
          </Form>

          {createBrief.isPending && !generatedBrief && (
            <div className="border border-border rounded-md bg-card p-8 flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <div className="text-muted-foreground font-mono text-sm animate-pulse">Analyzing references and generating briefing...</div>
            </div>
          )}

          {generatedBrief && (
            <div className="pt-4 border-t border-border">
              <BriefView brief={generatedBrief} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
