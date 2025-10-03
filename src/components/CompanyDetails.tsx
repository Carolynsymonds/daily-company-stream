import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, MapPin, Calendar, Hash, ExternalLink, Users, User, Mail, Search, Loader2, Filter, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
  const [emailSearchResults, setEmailSearchResults] = useState<Record<string, EmailSearchResult>>({});
  const [searchingEmails, setSearchingEmails] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [filterByEmail, setFilterByEmail] = useState(false);
  const [filterByPhone, setFilterByPhone] = useState(false);
  const [filterByLinkedIn, setFilterByLinkedIn] = useState(false);
  const [isFindingAllContacts, setIsFindingAllContacts] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");

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
      
      // Fetch contact details for all officers
      const officerIds = data?.map(o => o.id) || [];
      
      if (officerIds.length > 0) {
        const { data: contacts, error: contactsError } = await supabase
          .from('officer_contacts')
          .select('*')
          .in('officer_id', officerIds);
        
        if (!contactsError && contacts) {
          // Convert contacts to the format expected by the component
          const contactsMap: Record<string, EmailSearchResult> = {};
          contacts.forEach(contact => {
            contactsMap[contact.officer_id] = {
              found: contact.found,
              email: contact.email || undefined,
              emails: contact.email ? [contact.email] : undefined,
              phones: contact.phone ? [contact.phone] : undefined,
              linkedin: contact.linkedin_url || undefined,
              source: contact.source || undefined,
              error: contact.error_message || undefined,
              profile: {
                name: contact.profile_name || undefined,
                title: contact.profile_title || undefined,
                employer: contact.profile_employer || undefined,
                location: contact.profile_location || undefined
              }
            };
          });
          
          // Update the state with pre-loaded contacts
          setEmailSearchResults(contactsMap);
        }
      }
      
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
    if (!officers) return [];
    return officers.filter(officer => officer.company_id === companyId);
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
      
      // Save to database
      await supabase
        .from('officer_contacts')
        .upsert({
          officer_id: officerId,
          email: result.emails && result.emails.length > 0 ? result.emails[0] : 
                 (result.email && !result.email.startsWith('[Hidden') ? result.email : null),
          phone: result.phones && result.phones.length > 0 ? result.phones[0] : null,
          linkedin_url: result.linkedin || null,
          found: result.found,
          error_message: result.error || null,
          source: result.source || null,
          profile_name: result.profile?.name || null,
          profile_title: result.profile?.title || null,
          profile_employer: result.profile?.employer || null,
          profile_location: result.profile?.location || null,
          searched_at: new Date().toISOString()
        }, {
          onConflict: 'officer_id'
        });
      
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

  const findAllContactDetails = async () => {
    if (!companies || !officers) return;
    
    setIsFindingAllContacts(true);
    const allOfficers = officers;
    const totalOfficers = allOfficers.length;
    let completed = 0;
    
    setProgressMessage(`Finding contact details for ${totalOfficers} officers...`);
    
    for (const officer of allOfficers) {
      // Skip if already searched
      if (emailSearchResults[officer.id]) {
        completed++;
        continue;
      }
      
      await searchEmail(officer);
      completed++;
      setProgressMessage(`Progress: ${completed}/${totalOfficers} officers processed`);
      
      // Add a small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setProgressMessage(`Completed! Found contact details for ${completed} officers.`);
    setTimeout(() => {
      setProgressMessage("");
      setIsFindingAllContacts(false);
    }, 3000);
  };

  const hasContactInfo = (companyId: string, type?: 'email' | 'phone' | 'linkedin') => {
    const companyOfficers = getOfficersForCompany(companyId);
    
    return companyOfficers.some(officer => {
      const result = emailSearchResults[officer.id];
      if (!result) return false;
      
      if (!type) {
        // Any contact info
        return (result.emails && result.emails.length > 0) ||
               (result.email && !result.email.startsWith('[Hidden')) ||
               (result.phones && result.phones.length > 0) ||
               result.linkedin;
      }
      
      if (type === 'email') {
        return (result.emails && result.emails.length > 0) ||
               (result.email && !result.email.startsWith('[Hidden'));
      }
      
      if (type === 'phone') {
        return result.phones && result.phones.length > 0;
      }
      
      if (type === 'linkedin') {
        return !!result.linkedin;
      }
      
      return false;
    });
  };

  const filteredCompanies = companies?.filter(company => {
    // If no filters are active, show all companies
    if (!filterByEmail && !filterByPhone && !filterByLinkedIn) {
      return true;
    }
    
    // Check if company has the filtered contact types
    const matchesEmail = !filterByEmail || hasContactInfo(company.id, 'email');
    const matchesPhone = !filterByPhone || hasContactInfo(company.id, 'phone');
    const matchesLinkedIn = !filterByLinkedIn || hasContactInfo(company.id, 'linkedin');
    
    return matchesEmail && matchesPhone && matchesLinkedIn;
  });

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            <CardTitle>Company Details</CardTitle>
          </div>
          <div className="flex gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={findAllContactDetails}
              disabled={isFindingAllContacts}
              className="gap-2"
            >
              {isFindingAllContacts ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Finding...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Find Contact Details for All
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              Filter by Contact
            </Button>
          </div>
        </div>
        {progressMessage && (
          <div className="mt-2 text-sm text-muted-foreground">
            {progressMessage}
          </div>
        )}
        {showFilters && (
          <div className="flex flex-wrap gap-4 mt-3 p-3 bg-gray-50 rounded-lg border">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="filter-email"
                checked={filterByEmail}
                onCheckedChange={(checked) => setFilterByEmail(!!checked)}
              />
              <Label htmlFor="filter-email" className="text-sm cursor-pointer">
                Has Email
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="filter-phone"
                checked={filterByPhone}
                onCheckedChange={(checked) => setFilterByPhone(!!checked)}
              />
              <Label htmlFor="filter-phone" className="text-sm cursor-pointer">
                Has Phone
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="filter-linkedin"
                checked={filterByLinkedIn}
                onCheckedChange={(checked) => setFilterByLinkedIn(!!checked)}
              />
              <Label htmlFor="filter-linkedin" className="text-sm cursor-pointer">
                Has LinkedIn
              </Label>
            </div>
          </div>
        )}
        <CardDescription>
          {filteredCompanies?.length || 0} {filteredCompanies?.length === 1 ? 'company' : 'companies'} found
          {(filterByEmail || filterByPhone || filterByLinkedIn) && ' (filtered)'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] w-full">
          <Accordion type="single" collapsible className="space-y-2">
            {filteredCompanies?.map((company) => {
              const companyOfficers = getOfficersForCompany(company.id);
              
              return (
                <AccordionItem key={company.id} value={company.id} className="border rounded-lg">
                  <AccordionTrigger className="hover:no-underline px-4">
                    <div className="flex items-center justify-between w-full">
                      <h2 className="text-lg font-semibold text-left">
                        {company.company_name}
                      </h2>
                      <Badge variant="outline" className="text-xs ml-2">
                        {companyOfficers.length} officer{companyOfficers.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  
                  <AccordionContent className="px-4">
                    <div className="space-y-4 pt-2 pb-4">
                      {/* Company Details */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <a 
                            className="text-sm text-blue-600 hover:text-blue-800 hover:underline" 
                            href={`https://find-and-update.company-information.service.gov.uk/company/${company.company_number}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View on Companies House
                            <ExternalLink className="h-3 w-3 inline ml-1" />
                          </a>
                        </div>
                        
                        <p className="text-sm">
                          <span className="font-semibold">Status: </span>
                          <span className="capitalize">{company.company_status}</span>
                        </p>
                        
                        <ul className="text-sm space-y-1 list-none pl-0 text-muted-foreground">
                          <li>{formatCompanyType(company.company_type)}</li>
                          <li>
                            {company.company_number} - Incorporated on {formatIncorporationDate(company.date_of_creation)}
                          </li>
                          <li>{formatAddress(company.registered_office_address)}</li>
                          {company.sic_codes && company.sic_codes.length > 0 && (
                            <li>SIC codes - {company.sic_codes.join(", ")}</li>
                          )}
                        </ul>
                      </div>

                      {/* Officers Section */}
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
                                <div key={officer.id} className="bg-muted/50 rounded-lg p-3">
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <User className="h-4 w-4 text-muted-foreground" />
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
                                  
                                  <div className="text-sm space-y-1 text-muted-foreground">
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
                                      <div className="mt-2 p-3 bg-background rounded border space-y-1.5">
                                        {/* Email */}
                                        <div className="flex items-start gap-2">
                                          <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                          <div className="flex-1">
                                            <span className="font-medium text-xs">Email: </span>
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
                                              <span className="text-sm text-muted-foreground italic">Not available</span>
                                            )}
                                          </div>
                                        </div>
                                        
                                        {/* Phone */}
                                        <div className="flex items-start gap-2">
                                          <svg className="h-4 w-4 mt-0.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                          </svg>
                                          <div className="flex-1">
                                            <span className="font-medium text-xs">Phone: </span>
                                            {emailResult.phones && emailResult.phones.length > 0 ? (
                                              <div className="space-y-0.5">
                                                {emailResult.phones.map((phone, idx) => (
                                                  <a key={idx} href={`tel:${phone}`} className="text-sm text-blue-600 hover:underline block">
                                                    {phone}
                                                  </a>
                                                ))}
                                              </div>
                                            ) : (
                                              <span className="text-sm text-muted-foreground italic">Not available</span>
                                            )}
                                          </div>
                                        </div>
                                        
                                        {/* LinkedIn */}
                                        <div className="flex items-start gap-2">
                                          <ExternalLink className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                          <div className="flex-1">
                                            <span className="font-medium text-xs">LinkedIn: </span>
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
                                              <span className="text-sm text-muted-foreground italic">Not available</span>
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
                          <p className="text-sm text-muted-foreground italic">
                            No officers found for this company.
                          </p>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
