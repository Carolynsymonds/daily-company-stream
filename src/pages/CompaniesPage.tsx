import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, MapPin, Calendar, Hash, ExternalLink, ArrowLeft } from "lucide-react";
import { format } from "date-fns";

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

interface Officer {
  id: string;
  name: string;
  officer_role: string;
  appointed_on: string;
  nationality?: string;
  occupation?: string;
  address?: {
    address_line_1?: string;
    country?: string;
    locality?: string;
    postal_code?: string;
    premises?: string;
  };
  date_of_birth?: {
    month?: number;
    year?: number;
  };
}

export const CompaniesPage = () => {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();

  const { data: companies, isLoading } = useQuery({
    queryKey: ["companies", runId],
    queryFn: async () => {
      if (!runId) throw new Error("Run ID is required");
      
      const { data, error } = await supabase
        .from("companies")
        .select(`
          *,
          officers (
            id,
            name,
            officer_role,
            appointed_on,
            nationality,
            occupation,
            address,
            date_of_birth
          )
        `)
        .eq("run_id", runId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as (Company & { officers: Officer[] })[];
    },
    enabled: !!runId,
  });

  const { data: runInfo } = useQuery({
    queryKey: ["run-info", runId],
    queryFn: async () => {
      if (!runId) throw new Error("Run ID is required");
      
      const { data, error } = await supabase
        .from("scraper_runs")
        .select("target_date, started_at, total_companies")
        .eq("id", runId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!runId,
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

  const formatOfficerAddress = (address: Officer["address"]) => {
    if (!address) return "No address available";
    
    const parts = [
      address.premises,
      address.address_line_1,
      address.locality,
      address.postal_code,
      address.country,
    ].filter(Boolean);
    
    return parts.join(", ");
  };

  const formatOfficerDateOfBirth = (dateOfBirth: Officer["date_of_birth"]) => {
    if (!dateOfBirth || !dateOfBirth.month || !dateOfBirth.year) return "Not available";
    
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    
    return `${monthNames[dateOfBirth.month - 1]} ${dateOfBirth.year}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="text-center py-8 text-muted-foreground">Loading companies...</div>
        </div>
      </div>
    );
  }

  if (!companies || companies.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => navigate("/")}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">Company Details</h1>
            <p className="text-muted-foreground text-lg">
              {companies.length} companies found for {runInfo?.target_date && format(new Date(runInfo.target_date), "PPP")}
            </p>
            {runInfo && (
              <p className="text-sm text-muted-foreground">
                Scraped on {format(new Date(runInfo.started_at), "PPP 'at' p")}
              </p>
            )}
          </div>
        </div>

        {/* Companies List */}
        <div className="space-y-6">
          {companies.map((company) => (
            <div key={company.id} className="border border-gray-200 rounded-lg p-4">
              <div className="space-y-4">
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
                  <li>{company.company_type === "ltd" ? "Private limited company" : company.company_type || ""}</li>
                  <li></li>
                  <li>
                    {company.company_number} - Incorporated on {format(new Date(company.date_of_creation), "d MMMM yyyy")}
                  </li>
                  <li></li>
                  <li>{formatAddress(company.registered_office_address)}</li>
                  {company.sic_codes && company.sic_codes.length > 0 && (
                    <li>SIC codes - {company.sic_codes.join(", ")}</li>
                  )}
                </ul>

                {/* Officers Section */}
                {company.officers && company.officers.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h3 className="text-md font-semibold mb-3">Officers</h3>
                    <div className="space-y-3">
                      {company.officers.map((officer) => (
                        <div key={officer.id} className="bg-gray-50 rounded p-3">
                          <div className="space-y-1">
                            <p className="font-medium">{officer.name}</p>
                            <p className="text-sm text-gray-600 capitalize">{officer.officer_role}</p>
                            <p className="text-sm text-gray-600">
                              Appointed: {format(new Date(officer.appointed_on), "d MMMM yyyy")}
                            </p>
                            {officer.occupation && (
                              <p className="text-sm text-gray-600">Occupation: {officer.occupation}</p>
                            )}
                            {officer.nationality && (
                              <p className="text-sm text-gray-600">Nationality: {officer.nationality}</p>
                            )}
                            {officer.address && (
                              <p className="text-sm text-gray-600">Address: {formatOfficerAddress(officer.address)}</p>
                            )}
                            {officer.date_of_birth && (
                              <p className="text-sm text-gray-600">Date of Birth: {formatOfficerDateOfBirth(officer.date_of_birth)}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
