import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, MapPin, Calendar, Hash, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface CompanyDetailsProps {
  runId: string;
}

interface Company {
  id: string;
  company_number: string;
  company_name: string;
  company_status: string;
  company_type: string | null;
  date_of_creation: string;
  registered_office_address: {
    address_line_1?: string;
    address_line_2?: string;
    locality?: string;
    postal_code?: string;
    country?: string;
  } | null;
  sic_codes: string[] | null;
  created_at: string;
}

export const CompanyDetails = ({ runId }: CompanyDetailsProps) => {
  const { data: companies, isLoading } = useQuery({
    queryKey: ["companies", runId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("run_id", runId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as Company[];
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "outline",
      dissolved: "destructive",
      liquidation: "secondary",
    };

    return (
      <Badge variant={variants[status] || "default"} className="capitalize">
        {status}
      </Badge>
    );
  };

  const formatAddress = (address: Company["registered_office_address"]) => {
    if (!address) return "No address available";
    
    const parts = [
      address.address_line_1,
      address.address_line_2,
      address.locality,
      address.postal_code,
      address.country,
    ].filter(Boolean);
    
    return parts.join(", ");
  };

  const formatCompanyType = (type: string | null) => {
    if (!type) return "";
    return type === "ltd" ? "Private limited company" : type;
  };

  const formatIncorporationDate = (date: string) => {
    const d = new Date(date);
    const day = d.getDate();
    const month = d.toLocaleDateString('en-GB', { month: 'long' });
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Details
          </CardTitle>
          <CardDescription>Loading companies...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (!companies || companies.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Details
          </CardTitle>
          <CardDescription>No companies found for this run</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No companies were found for this run.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Company Details
        </CardTitle>
        <CardDescription>
          {companies.length} companies found for this run
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] w-full">
          <div className="space-y-4">
            {companies.map((company) => (
              <div key={company.id} className="border border-gray-200 rounded-lg p-4">
                <div className="space-y-2">
                  {/* Company Name */}
                  <h2 className="text-lg font-semibold mb-1">
                    <a 
                      className="text-blue-600 hover:text-blue-800 hover:underline" 
                      href={`https://find-and-update.company-information.service.gov.uk/company/${company.company_number}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {company.company_name}
                      <span className="sr-only">(link opens a new window)</span>
                    </a>
                  </h2>
                  
                  {/* Status */}
                  <p className="mb-2">
                    <span className="font-semibold capitalize">
                      {company.company_status}
                    </span>
                  </p>
                  
                  {/* Company Details List */}
                  <ul className="text-sm space-y-1 list-none pl-0">
                    <li>{formatCompanyType(company.company_type)}</li>
                    <li></li>
                    <li>
                      {company.company_number} - Incorporadddted on {formatIncorporationDate(company.date_of_creation)}
                    </li>
                    <li></li>
                    <li>{formatAddress(company.registered_office_address)}</li>
                    {company.sic_codes && company.sic_codes.length > 0 && (
                      <li>SIC codes - {company.sic_codes.join(", ")}</li>
                    )}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
