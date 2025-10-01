import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface LogViewerProps {
  runId?: string;
}

export const LogViewer = ({ runId }: LogViewerProps) => {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["scraper-logs", runId],
    queryFn: async () => {
      let query = supabase.from("scraper_logs").select("*").order("timestamp", { ascending: false }).limit(100);

      if (runId) {
        query = query.eq("run_id", runId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    refetchInterval: 3000, // Refresh every 3 seconds
    enabled: !!runId || true, // Always enabled to show latest logs
  });

  const getLevelBadge = (level: string) => {
    const colors: Record<string, string> = {
      info: "bg-primary/10 text-primary hover:bg-primary/20",
      warning: "bg-warning/10 text-warning hover:bg-warning/20",
      error: "bg-destructive/10 text-destructive hover:bg-destructive/20",
      debug: "bg-muted text-muted-foreground",
    };

    return (
      <Badge variant="outline" className={`${colors[level]} font-mono text-xs`}>
        {level.toUpperCase()}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground font-mono text-sm">Loading logs...</div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground font-mono text-sm">
        No logs available yet
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px] w-full rounded-lg border bg-code-bg p-4">
      <div className="space-y-2">
        {logs.map((log) => (
          <div key={log.id} className="flex gap-3 items-start text-sm font-mono">
            <span className="text-muted-foreground text-xs whitespace-nowrap">
              {format(new Date(log.timestamp), "HH:mm:ss")}
            </span>
            {getLevelBadge(log.level)}
            <span className="text-code-text flex-1">{log.message}</span>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};
