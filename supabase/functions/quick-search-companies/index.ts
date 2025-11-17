import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to fetch officers for a company
async function fetchOfficers(companyNumber: string, apiKey: string): Promise<string[]> {
  const officersUrl = `https://api.company-information.service.gov.uk/company/${companyNumber}/officers`;
  
  try {
    const response = await fetch(officersUrl, {
      headers: {
        'Authorization': `Basic ${btoa(apiKey + ':')}`,
        'Accept': 'application/json',
      },
    });

    // Handle 429 rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || '60';
      console.warn(`Rate limited on officers API for ${companyNumber}, retrying after ${retryAfter}s`);
      await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter) * 1000));
      return fetchOfficers(companyNumber, apiKey); // Retry
    }

    if (!response.ok) {
      console.error(`Officers API error for ${companyNumber}: ${response.status}`);
      return []; // Return empty array on error
    }

    const data = await response.json();
    
    // Extract officer names from items array
    const officerNames = data.items?.map((officer: any) => officer.name) || [];
    console.log(`Found ${officerNames.length} officers for company ${companyNumber}`);
    return officerNames;
  } catch (error) {
    console.error(`Error fetching officers for ${companyNumber}:`, error);
    return [];
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sic_codes, incorporated_from, incorporated_to, location, size = 20 } = await req.json();

    // Get Companies House API key
    const apiKey = Deno.env.get('COMPANIES_HOUSE_API_KEY');
    if (!apiKey) {
      throw new Error('COMPANIES_HOUSE_API_KEY not configured');
    }

    // Build query parameters
    const params = new URLSearchParams();
    if (sic_codes) params.append('sic_codes', sic_codes);
    if (incorporated_from) params.append('incorporated_from', incorporated_from);
    if (incorporated_to) params.append('incorporated_to', incorporated_to);
    if (location) params.append('location', location);
    params.append('size', String(size));

    const url = `https://api.company-information.service.gov.uk/advanced-search/companies?${params.toString()}`;

    console.log(`Making request to Companies House API: ${url}`);

    // Make request with Basic Auth
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${btoa(apiKey + ':')}`,
      },
    });

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || '60';
      console.warn(`Rate limited, retry after ${retryAfter} seconds`);
      
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          retry_after: parseInt(retryAfter),
          message: `Please wait ${retryAfter} seconds before trying again`
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error: ${response.status} - ${errorText}`);
      throw new Error(`Companies House API error: ${response.status}`);
    }

    const data = await response.json();

    console.log(`Successfully fetched ${data.items?.length || 0} companies`);

    // Fetch officers for each company sequentially to avoid rate limiting
    const companiesWithOfficers = [];
    for (const company of (data.items || [])) {
      const officers = await fetchOfficers(company.company_number, apiKey);
      companiesWithOfficers.push({
        ...company,
        officers: officers
      });
    }

    console.log(`Enriched ${companiesWithOfficers.length} companies with officer data`);

    return new Response(
      JSON.stringify({
        items: companiesWithOfficers,
        total_results: data.total_results || 0,
        query_params: { sic_codes, incorporated_from, incorporated_to, location, size }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in quick-search-companies:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    const errorDetails = error instanceof Error ? error.toString() : String(error);
    
    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: errorDetails
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
