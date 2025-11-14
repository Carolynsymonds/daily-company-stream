import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Download, Search, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CompanySearchResult {
  company_number: string;
  company_name: string;
  company_status: string;
  date_of_creation: string;
  registered_office_address?: {
    address_line_1?: string;
    address_line_2?: string;
    locality?: string;
    postal_code?: string;
    region?: string;
  };
  sic_codes?: string[];
}

export const QuickSearch = () => {
  const { toast } = useToast();
  const [sicCode, setSicCode] = useState("47710");
  const [incorporatedFrom, setIncorporatedFrom] = useState("2025-10-14");
  const [incorporatedTo, setIncorporatedTo] = useState("2025-11-14");
  const [location, setLocation] = useState("England");
  const [size, setSize] = useState("20");
  const [results, setResults] = useState<CompanySearchResult[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('quick-search-companies', {
        body: {
          sic_codes: sicCode,
          incorporated_from: incorporatedFrom,
          incorporated_to: incorporatedTo,
          location,
          size: parseInt(size),
        },
      });

      if (error) throw error;

      if (data.error) {
        if (data.retry_after) {
          toast({
            title: "Rate Limit Reached",
            description: data.message,
            variant: "destructive",
          });
        } else {
          throw new Error(data.error);
        }
        return;
      }

      setResults(data.items || []);
      setTotalResults(data.total_results || 0);
      
      toast({
        title: "Search Complete",
        description: `Found ${data.total_results || 0} companies`,
      });
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Search Failed",
        description: error.message || "Failed to search companies",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setSicCode("");
    setIncorporatedFrom("");
    setIncorporatedTo("");
    setLocation("England");
    setSize("20");
    setResults([]);
    setTotalResults(0);
  };

  const handleDownloadCSV = () => {
    if (results.length === 0) {
      toast({
        title: "No Data",
        description: "No results to download",
        variant: "destructive",
      });
      return;
    }

    const headers = ["Company Number", "Company Name", "Status", "Date of Creation", "Address", "SIC Codes"];
    const csvRows = [headers.join(",")];

    results.forEach(company => {
      const address = company.registered_office_address
        ? [
            company.registered_office_address.address_line_1,
            company.registered_office_address.address_line_2,
            company.registered_office_address.locality,
            company.registered_office_address.postal_code,
            company.registered_office_address.region,
          ].filter(Boolean).join(", ")
        : "";

      const sicCodes = company.sic_codes?.join(";") || "";

      const row = [
        company.company_number,
        `"${company.company_name}"`,
        company.company_status,
        company.date_of_creation,
        `"${address}"`,
        sicCodes,
      ];

      csvRows.push(row.join(","));
    });

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `companies-search-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "CSV Downloaded",
      description: `Downloaded ${results.length} companies`,
    });
  };

  const formatAddress = (address?: CompanySearchResult['registered_office_address']) => {
    if (!address) return "N/A";
    return [
      address.address_line_1,
      address.address_line_2,
      address.locality,
      address.postal_code,
      address.region,
    ].filter(Boolean).join(", ");
  };

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sicCode">SIC Code</Label>
          <Input
            id="sicCode"
            value={sicCode}
            onChange={(e) => setSicCode(e.target.value)}
            placeholder="e.g., 47710"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="incorporatedFrom">Incorporated From</Label>
          <Input
            id="incorporatedFrom"
            type="date"
            value={incorporatedFrom}
            onChange={(e) => setIncorporatedFrom(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="incorporatedTo">Incorporated To</Label>
          <Input
            id="incorporatedTo"
            type="date"
            value={incorporatedTo}
            onChange={(e) => setIncorporatedTo(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Select value={location} onValueChange={setLocation}>
            <SelectTrigger id="location">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="England">England</SelectItem>
              <SelectItem value="Wales">Wales</SelectItem>
              <SelectItem value="Scotland">Scotland</SelectItem>
              <SelectItem value="Northern Ireland">Northern Ireland</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="size">Results Limit</Label>
          <Input
            id="size"
            type="number"
            min="1"
            max="100"
            value={size}
            onChange={(e) => setSize(e.target.value)}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button onClick={handleSearch} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              Search
            </>
          )}
        </Button>
        <Button onClick={handleDownloadCSV} variant="secondary" disabled={results.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Download CSV
        </Button>
        <Button onClick={handleClear} variant="outline">
          <X className="mr-2 h-4 w-4" />
          Clear
        </Button>
      </div>

      {/* Results Summary */}
      {totalResults > 0 && (
        <div className="text-sm text-muted-foreground">
          Showing {results.length} of {totalResults} total results
        </div>
      )}

      {/* Results Table */}
      {results.length > 0 && (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company Number</TableHead>
                <TableHead>Company Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date of Creation</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>SIC Codes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((company) => (
                <TableRow key={company.company_number}>
                  <TableCell className="font-medium">{company.company_number}</TableCell>
                  <TableCell>{company.company_name}</TableCell>
                  <TableCell className="capitalize">{company.company_status}</TableCell>
                  <TableCell>{company.date_of_creation}</TableCell>
                  <TableCell className="text-sm">{formatAddress(company.registered_office_address)}</TableCell>
                  <TableCell className="text-sm">{company.sic_codes?.join(", ") || "N/A"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && results.length === 0 && totalResults === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          Enter search criteria and click Search to find companies
        </div>
      )}
    </div>
  );
};
