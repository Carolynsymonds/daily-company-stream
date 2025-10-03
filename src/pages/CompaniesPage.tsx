import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, MapPin, Calendar, Hash, ExternalLink, ArrowLeft, Mail, Search, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

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
  is_pre_1992_appointment?: boolean;
  country_of_residence?: string;
  nationality?: string;
  occupation?: string;
  person_number?: string;
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
  links?: {
    self?: string;
    officer?: {
      appointments?: string;
    };
  };
}

interface EmailSearchResult {
  email?: string;
  emails?: string[];
  phones?: string[];
  linkedin?: string;
  confidence?: number;
  source?: string;
  found: boolean;
  error?: string;
  profile?: {
    name?: string;
    title?: string;
    employer?: string;
    location?: string;
  };
}

export const CompaniesPage = () => {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [emailSearchResults, setEmailSearchResults] = useState<Record<string, EmailSearchResult>>({});
  const [searchingEmails, setSearchingEmails] = useState<Set<string>>(new Set());

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
            is_pre_1992_appointment,
            country_of_residence,
            nationality,
            occupation,
            person_number,
            address,
            date_of_birth,
            links
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

  const searchEmail = async (officer: Officer) => {
    const officerId = officer.id;
    
    // Add to searching state
    setSearchingEmails(prev => new Set(prev).add(officerId));
    
    try {
      // Extract last name and first name from "BRADTKE, Peter Edward Charles"
      let searchName = officer.name;
      if (officer.name.includes(',')) {
        const parts = officer.name.split(',');
        const lastName = parts[0].trim();
        const firstNamePart = parts[1].trim().split(' ')[0]; // Get first name only
        searchName = `${lastName}, ${firstNamePart}`;
      }

      // Use country of residence as location
      let location = "";
      if (officer.country_of_residence) {
        location = officer.country_of_residence;
      }

      console.log('Email search params:', {
        originalName: officer.name,
        searchName: searchName,
        location: location,
        occupation: officer.occupation
      });

      const { data, error } = await supabase.functions.invoke('search-email', {
        body: {
          name: searchName,
          location: location,
          occupation: officer.occupation
        }
      });

      if (error) throw error;
      const result: EmailSearchResult = data;
      
      setEmailSearchResults(prev => ({
        ...prev,
        [officerId]: result
      }));
    } catch (error) {
      setEmailSearchResults(prev => ({
        ...prev,
        [officerId]: {
          found: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        }
      }));
    } finally {
      // Remove from searching state
      setSearchingEmails(prev => {
        const newSet = new Set(prev);
        newSet.delete(officerId);
        return newSet;
      });
    }
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
                    <div className="space-y-4">
                      {company.officers.map((officer) => {
                        const isSearching = searchingEmails.has(officer.id);
                        const emailResult = emailSearchResults[officer.id];
                        
                        return (
                          <div key={officer.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="space-y-2">
                              {/* Officer Name and Email Search Button */}
                              <div className="flex items-start justify-between">
                                <h4 className="font-semibold text-lg">{officer.name}</h4>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => searchEmail(officer)}
                                  disabled={isSearching}
                                  className="h-8 px-3 text-xs"
                                >
                                  {isSearching ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  ) : (
                                    <Search className="h-3 w-3 mr-1" />
                                  )}
                                  Find Email
                                </Button>
                              </div>
                              
                              {/* Role and Appointment */}
                              <div className="flex flex-wrap gap-2">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                                  {officer.officer_role}
                                </span>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Appointed: {format(new Date(officer.appointed_on), "d MMMM yyyy")}
                                </span>
                                {officer.is_pre_1992_appointment && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                    Pre-1992 Appointment
                                  </span>
                                )}
                              </div>

                            {/* Personal Details */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                              {officer.occupation && (
                                <div>
                                  <span className="font-medium text-gray-700">Occupation:</span>
                                  <span className="ml-2 text-gray-600">{officer.occupation}</span>
                                </div>
                              )}
                              {officer.nationality && (
                                <div>
                                  <span className="font-medium text-gray-700">Nationality:</span>
                                  <span className="ml-2 text-gray-600">{officer.nationality}</span>
                                </div>
                              )}
                              {officer.country_of_residence && (
                                <div>
                                  <span className="font-medium text-gray-700">Country of Residence:</span>
                                  <span className="ml-2 text-gray-600">{officer.country_of_residence}</span>
                                </div>
                              )}
                              {officer.person_number && (
                                <div>
                                  <span className="font-medium text-gray-700">Person Number:</span>
                                  <span className="ml-2 text-gray-600 font-mono">{officer.person_number}</span>
                                </div>
                              )}
                              {officer.date_of_birth && (
                                <div>
                                  <span className="font-medium text-gray-700">Date of Birth:</span>
                                  <span className="ml-2 text-gray-600">{formatOfficerDateOfBirth(officer.date_of_birth)}</span>
                                </div>
                              )}
                            </div>

                            {/* Address */}
                            {officer.address && (
                              <div className="mt-2">
                                <span className="font-medium text-gray-700 text-sm">Address:</span>
                                <p className="text-sm text-gray-600 mt-1">{formatOfficerAddress(officer.address)}</p>
                              </div>
                            )}

                            {/* Email Search Results */}
                            {emailResult && (
                              <div className="mt-3 p-3 bg-white rounded border border-gray-200 space-y-2">
                                {/* Email */}
                                <div className="flex items-start gap-2">
                                  <Mail className="h-4 w-4 mt-0.5 text-gray-600" />
                                  <div className="flex-1">
                                    <span className="font-medium text-sm text-gray-700">Email: </span>
                                    {emailResult.emails && emailResult.emails.length > 0 ? (
                                      <div className="space-y-0.5">
                                        {emailResult.emails.map((email, idx) => (
                                          <a key={idx} href={`mailto:${email}`} className="text-sm text-blue-600 hover:underline block">
                                            {email}
                                          </a>
                                        ))}
                                      </div>
                                    ) : emailResult.email && !emailResult.email.startsWith('[Hidden') ? (
                                      <a href={`mailto:${emailResult.email}`} className="text-sm text-blue-600 hover:underline">
                                        {emailResult.email}
                                      </a>
                                    ) : (
                                      <span className="text-sm text-gray-500 italic">Not available</span>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Phone */}
                                <div className="flex items-start gap-2">
                                  <svg className="h-4 w-4 mt-0.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                  </svg>
                                  <div className="flex-1">
                                    <span className="font-medium text-sm text-gray-700">Phone: </span>
                                    {emailResult.phones && emailResult.phones.length > 0 ? (
                                      <div className="space-y-0.5">
                                        {emailResult.phones.map((phone, idx) => (
                                          <a key={idx} href={`tel:${phone}`} className="text-sm text-blue-600 hover:underline block">
                                            {phone}
                                          </a>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-sm text-gray-500 italic">Not available</span>
                                    )}
                                  </div>
                                </div>
                                
                                {/* LinkedIn */}
                                <div className="flex items-start gap-2">
                                  <ExternalLink className="h-4 w-4 mt-0.5 text-gray-600" />
                                  <div className="flex-1">
                                    <span className="font-medium text-sm text-gray-700">LinkedIn: </span>
                                    {emailResult.linkedin ? (
                                      <a 
                                        href={emailResult.linkedin} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-sm text-blue-600 hover:underline"
                                      >
                                        View Profile
                                      </a>
                                    ) : (
                                      <span className="text-sm text-gray-500 italic">Not available</span>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Error/Info message */}
                                {emailResult.error && (
                                  <div className="text-xs text-amber-600 italic pt-1 border-t">
                                    {emailResult.error}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Links */}
                            {officer.links && (
                              <div className="mt-3 pt-2 border-t border-gray-300">
                                <div className="flex flex-wrap gap-2">
                                  {officer.links.self && (
                                    <a
                                      href={`https://find-and-update.company-information.service.gov.uk${officer.links.self}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                                    >
                                      <ExternalLink className="h-3 w-3 mr-1" />
                                      View Appointment
                                    </a>
                                  )}
                                  {officer.links.officer?.appointments && (
                                    <a
                                      href={`https://find-and-update.company-information.service.gov.uk${officer.links.officer.appointments}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                                    >
                                      <ExternalLink className="h-3 w-3 mr-1" />
                                      All Appointments
                                    </a>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        );
                      })}
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
