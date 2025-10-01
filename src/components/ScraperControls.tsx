import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Play, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const ScraperControls = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [targetDate, setTargetDate] = useState("");

  const handleRunScraper = async () => {
    setIsRunning(true);
    toast.info("Starting scraper...");

    try {
      const { data, error } = await supabase.functions.invoke("scrape-companies", {
        body: { targetDate: targetDate || undefined },
      });

      if (error) throw error;

      toast.success(`Scraper completed! Fetched ${data.totalCompanies} companies.`);
    } catch (error: any) {
      console.error("Scraper error:", error);
      toast.error(`Scraper failed: ${error.message || "Unknown error"}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Calculate yesterday in Europe/London
  const getYesterday = () => {
    const londonTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/London" }));
    londonTime.setDate(londonTime.getDate() - 1);
    return londonTime.toISOString().split("T")[0];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Scraper Controls
        </CardTitle>
        <CardDescription>
          Fetch newly incorporated companies from Companies House API
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="target-date">Target Date (optional)</Label>
          <Input
            id="target-date"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            placeholder={`Leave empty for yesterday (${getYesterday()})`}
          />
          <p className="text-xs text-muted-foreground">
            Defaults to yesterday in Europe/London timezone
          </p>
        </div>

        <Button onClick={handleRunScraper} disabled={isRunning} className="w-full" size="lg">
          <Play className="h-4 w-4 mr-2" />
          {isRunning ? "Running..." : "Start Scraper"}
        </Button>

        <div className="bg-muted/50 rounded-lg p-3 space-y-1">
          <p className="text-sm font-medium">Rate Limits:</p>
          <p className="text-xs text-muted-foreground">
            • 600 requests per 5 minutes
          </p>
          <p className="text-xs text-muted-foreground">
            • Automatic handling of 429 errors with Retry-After
          </p>
          <p className="text-xs text-muted-foreground">
            • Full pagination support (100 companies per page)
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
