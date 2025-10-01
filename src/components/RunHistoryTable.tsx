import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const RunHistoryTable = () => {
  const { data: runs, isLoading } = useQuery({
    queryKey: ["scraper-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scraper_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      running: "default",
      completed: "outline",
      failed: "destructive",
    };

    return (
      <Badge variant={variants[status] || "default"} className="capitalize">
        {status}
      </Badge>
    );
  };

  const downloadFile = async (filePath: string | null, fileName: string) => {
    if (!filePath) return;

    const { data } = await supabase.storage.from("scraper-exports").getPublicUrl(filePath);

    const link = document.createElement("a");
    link.href = data.publicUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading run history...</div>;
  }

  if (!runs || runs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg">No runs yet</p>
        <p className="text-sm mt-2">Start a scrape to see results here</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Target Date</TableHead>
            <TableHead>Started</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead className="text-right">Companies</TableHead>
            <TableHead className="text-right">Pages</TableHead>
            <TableHead className="text-center">Downloads</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => {
            const duration = run.completed_at
              ? Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)
              : null;

            return (
              <TableRow key={run.id}>
                <TableCell>{getStatusBadge(run.status)}</TableCell>
                <TableCell className="font-mono text-sm">{run.target_date}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}
                </TableCell>
                <TableCell className="text-sm">
                  {duration ? `${duration}s` : run.status === "running" ? "Running..." : "-"}
                </TableCell>
                <TableCell className="text-right font-mono">{run.total_companies.toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono">{run.pages_fetched}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-2">
                    {run.jsonl_file_path && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => downloadFile(run.jsonl_file_path, `companies-${run.target_date}.jsonl`)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        JSONL
                      </Button>
                    )}
                    {run.csv_file_path && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => downloadFile(run.csv_file_path, `companies-${run.target_date}.csv`)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        CSV
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
