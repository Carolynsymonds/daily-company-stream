import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScraperControls } from "@/components/ScraperControls";
import { RunHistoryTable } from "@/components/RunHistoryTable";
import { LogViewer } from "@/components/LogViewer";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 space-y-8">
        {/* Header */}
        <div className="space-y-2 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Companies House Scraper</h1>
            <p className="text-muted-foreground text-lg">
              Daily data pipeline for newly incorporated UK companies
            </p>
          </div>
          <Button onClick={handleSignOut} variant="outline" size="sm">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>

        {/* Controls */}
        <div className="max-w-2xl mx-auto">
          <ScraperControls />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="history" className="space-y-4">
          <TabsList>
            <TabsTrigger value="history">Run History</TabsTrigger>
            <TabsTrigger value="logs">Live Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Runs</CardTitle>
                <CardDescription>View all scraper executions and download exports</CardDescription>
              </CardHeader>
              <CardContent>
                <RunHistoryTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Live Logs</CardTitle>
                <CardDescription>Real-time scraper execution logs</CardDescription>
              </CardHeader>
              <CardContent>
                <LogViewer />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
