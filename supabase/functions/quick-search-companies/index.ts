import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    return new Response(
      JSON.stringify({
        items: data.items || [],
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
