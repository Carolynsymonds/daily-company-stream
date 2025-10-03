import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, MapPin, Calendar, Hash, ExternalLink, Users, User, Mail, Search, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { useState } from "react";

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

interface Officer {
  id: string;
  company_id: string;
  name: string;
  officer_role: string;
  appointed_on: string;
  is_pre_1992_appointment: boolean | null;
  country_of_residence: string | null;
  nationality: string | null;
  occupation: string | null;
  person_number: string | null;
  address: {
    address_line_1?: string;
    country?: string;
    locality?: string;
    postal_code?: string;
    premises?: string;
  } | null;
  date_of_birth: {
    month?: number;
    year?: number;
  } | null;
  links: {
    self?: string;
    officer?: {
      appointments?: string;
    };
  } | null;
  created_at: string;
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

export const CompanyDetails = ({ runId }: CompanyDetailsProps) => {
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const [emailSearchResults, setEmailSearchResults] = useState<Record<string, EmailSearchResult>>({});
  const [searchingEmails, setSearchingEmails] = useState<Set<string>>(new Set());

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

  const { data: officers } = useQuery({
    queryKey: ["officers", runId],
    queryFn: async () => {
      if (!companies || companies.length === 0) return [];
      
      const companyIds = companies.map(c => c.id);
      const { data, error } = await supabase
        .from("officers")
        .select("*")
        .in("company_id", companyIds)
        .order("appointed_on", { ascending: false });

      if (error) throw error;
      return data as Officer[];
    },
    enabled: !!companies && companies.length > 0,
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

  const formatAppointmentDate = (date: string) => {
    const d = new Date(date);
    const day = d.getDate();
    const month = d.toLocaleDateString('en-GB', { month: 'long' });
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
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

  const formatDateOfBirth = (dob: Officer["date_of_birth"]) => {
    if (!dob) return "Not available";
    if (dob.month && dob.year) {
      const monthName = new Date(dob.year, dob.month - 1).toLocaleDateString('en-GB', { month: 'long' });
      return `${monthName} ${dob.year}`;
    }
    return "Partial date available";
  };

  const getOfficersForCompany = (companyId: string) => {
    return officers?.filter(officer => officer.company_id === companyId) || [];
  };

  const toggleCompanyExpansion = (companyId: string) => {
    const newExpanded = new Set(expandedCompanies);
    if (newExpanded.has(companyId)) {
      newExpanded.delete(companyId);
    } else {
      newExpanded.add(companyId);
    }
    setExpandedCompanies(newExpanded);
  };

  const searchEmail = async (officer: Officer) => {
    const officerId = officer.id;
    
    // Add to searching state
    setSearchingEmails(prev => new Set(prev).add(officerId));
    
    try {
      // Build location string from address or country
      let location = "";
      if (officer.address) {
        const parts = [
          officer.address.locality,
          officer.address.country
        ].filter(Boolean);
        location = parts.join(", ");
      } else if (officer.country_of_residence) {
        location = officer.country_of_residence;
      }

      const { data, error } = await supabase.functions.invoke('search-email', {
        body: {
          name: officer.name,
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
        <ScrollArea className="h-[600px] w-full">
          <div className="space-y-4">
            {companies.map((company) => {
              const companyOfficers = getOfficersForCompany(company.id);
              const isExpanded = expandedCompanies.has(company.id);
              
              return (
                <div key={company.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="space-y-2">
                    {/* Company Name and Officers Toggle */}
                    <div className="flex items-center justify-between">
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
                      
                      <Collapsible open={isExpanded} onOpenChange={() => toggleCompanyExpansion(company.id)}>
                        <CollapsibleTrigger asChild>
                          <button className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline">
                            <Users className="h-4 w-4" />
                            {companyOfficers.length} officer{companyOfficers.length !== 1 ? 's' : ''}
                            <span className="text-xs">
                              {isExpanded ? '▼' : '▶'}
                            </span>
                          </button>
                        </CollapsibleTrigger>
                      </Collapsible>
                    </div>
                    
                    {/* Status */}
                    <p className="mb-2">
                      <span className="font-semibold capitalize">
                        {company.company_status}
                      </span>
                    </p>
                    
                    {/* Company Details List */}
                    <ul className="text-sm space-y-1 list-none pl-0">
                      <li>{formatCompanyType(company.company_type)}</li>
                      <li>
                        {company.company_number} - Incorporated on {formatIncorporationDate(company.date_of_creation)}
                      </li>
                      <li>{formatAddress(company.registered_office_address)}</li>
                      {company.sic_codes && company.sic_codes.length > 0 && (
                        <li>SIC codes - {company.sic_codes.join(", ")}</li>
                      )}
                    </ul>

                    {/* Officers Section */}
                    <Collapsible open={isExpanded} onOpenChange={() => toggleCompanyExpansion(company.id)}>
                      <CollapsibleContent className="mt-4">
                        {companyOfficers.length > 0 ? (
                          <div className="border-t pt-4">
                            <h3 className="text-md font-semibold mb-3 flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              Officers & Directors
                            </h3>
                            <div className="space-y-3">
                              {companyOfficers.map((officer) => {
                                const isSearching = searchingEmails.has(officer.id);
                                const emailResult = emailSearchResults[officer.id];
                                
                                return (
                                  <div key={officer.id} className="bg-gray-50 rounded-lg p-3">
                                    <div className="flex items-start justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <User className="h-4 w-4 text-gray-600" />
                                        <h4 className="font-medium">{officer.name}</h4>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs">
                                          {officer.officer_role}
                                        </Badge>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => searchEmail(officer)}
                                          disabled={isSearching}
                                          className="h-6 px-2 text-xs"
                                        >
                                          {isSearching ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <Search className="h-3 w-3" />
                                          )}
                                          <span className="ml-1">Find Email</span>
                                        </Button>
                                      </div>
                                    </div>
                                    
                                    <div className="text-sm space-y-1 text-gray-600">
                                      <p><strong>Appointed:</strong> {formatAppointmentDate(officer.appointed_on)}</p>
                                      {officer.occupation && (
                                        <p><strong>Occupation:</strong> {officer.occupation}</p>
                                      )}
                                      {officer.nationality && (
                                        <p><strong>Nationality:</strong> {officer.nationality}</p>
                                      )}
                                      {officer.country_of_residence && (
                                        <p><strong>Country of Residence:</strong> {officer.country_of_residence}</p>
                                      )}
                                      {officer.date_of_birth && (
                                        <p><strong>Date of Birth:</strong> {formatDateOfBirth(officer.date_of_birth)}</p>
                                      )}
                                      {officer.address && (
                                        <p><strong>Address:</strong> {formatOfficerAddress(officer.address)}</p>
                                      )}
                                      
                                      {/* Contact Search Results */}
                                      {emailResult && (
                                        <div className="mt-2 p-3 bg-white rounded border space-y-1.5">
                                          {/* Email */}
                                          <div className="flex items-start gap-2">
                                            <Mail className="h-4 w-4 mt-0.5 text-gray-600" />
                                            <div className="flex-1">
                                              <span className="font-medium text-xs text-gray-700">Email: </span>
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
                                              <span className="font-medium text-xs text-gray-700">Phone: </span>
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
                                              <span className="font-medium text-xs text-gray-700">LinkedIn: </span>
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
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="border-t pt-4">
                            <p className="text-sm text-gray-500 italic">
                              No officers found for this company.
                            </p>
                          </div>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
