import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface EmailSearchRequest {
  name: string;
  location?: string;
  company_sic_code?: string;
  detailed_location?: string;
}

interface RocketReachResponse {
  profiles?: Array<{
    id?: number;
    name?: string;
    current_title?: string;
    current_employer?: string;
    location?: string;
    linkedin_url?: string;
    teaser?: {
      emails?: string[];
      professional_emails?: string[];
      personal_emails?: string[];
      phones?: Array<string | { number: string; is_premium?: boolean }>;
      preview?: string[];
    };
  }>;
  total?: number;
  page?: number;
  nextPage?: number;
  error?: string;
}

interface EmailSearchResult {
  email?: string;
  emails?: string[];
  phones?: Array<string | { number: string; is_premium?: boolean }>;
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        found: false,
        error: 'Method not allowed. Use POST.'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      }
    );
  }

  try {
    const { name, location, company_sic_code, detailed_location }: EmailSearchRequest = await req.json();
    
    console.log('=== Email Search Function Invoked ===');
    console.log('Request body:', { name, location, company_sic_code, detailed_location });

    if (!name) {
      return new Response(
        JSON.stringify({
          found: false,
          error: 'Name is required'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const apiKey = Deno.env.get('RR_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          found: false,
          error: 'RocketReach API key not configured. Please set RR_API_KEY environment variable.'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    // Helper function to perform a search
    const performSearch = async (searchParams: Record<string, string>, searchName: string): Promise<RocketReachResponse | null> => {
      const searchUrl = new URL('https://api.rocketreach.co/v1/api/search');
      searchUrl.searchParams.set('name', name);
      searchUrl.searchParams.set('start', '1');
      searchUrl.searchParams.set('pageSize', '10');
      
      // Add all search parameters
      Object.entries(searchParams).forEach(([key, value]) => {
        if (value) {
          searchUrl.searchParams.set(key, value);
        }
      });

      console.log(`=== ${searchName} ===`);
      console.log('Search URL:', searchUrl.toString());
      console.log('Search Parameters:', Object.fromEntries(searchUrl.searchParams));
      console.log('==============================');

      const response = await fetch(searchUrl.toString(), {
        method: 'GET',
        headers: {
          'Api-Key': apiKey,
          'Accept': 'application/json',
        },
      });

      console.log(`${searchName} Response Status:`, response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`${searchName} API Error:`, errorText);
        return null;
      }

      const responseText = await response.text();
      if (!responseText || responseText.trim() === '') {
        console.error(`${searchName}: Empty response`);
        return null;
      }

      try {
        const data: RocketReachResponse = JSON.parse(responseText);
        console.log(`${searchName} Response Data:`, data);
        console.log(`${searchName} Profiles Found:`, data.profiles?.length || 0);
        return data;
      } catch (parseError) {
        console.error(`${searchName}: Failed to parse response:`, parseError);
        return null;
      }
    };

    // Helper function to process search results
    const processResults = (data: RocketReachResponse, source: string): Response | null => {
      console.log(`Processing results from ${source}...`);
      console.log('Profiles in response:', data.profiles?.length || 0);
      
      if (data.profiles && data.profiles.length > 0) {
        const profile = data.profiles[0];
        console.log('Selected profile:', {
          id: profile.id,
          name: profile.name,
          title: profile.current_title,
          employer: profile.current_employer,
          location: profile.location
        });
        
        // Extract all contact information
        const emails = profile.teaser?.emails || [];
        const professionalEmails = profile.teaser?.professional_emails || [];
        const personalEmails = profile.teaser?.personal_emails || [];
        const phones = profile.teaser?.phones || [];
        const preview = profile.teaser?.preview || [];
        
        // Combine all available emails
        const allEmails = [...emails, ...professionalEmails, ...personalEmails];
        
        console.log('Contact info extracted:', {
          emails: allEmails.length,
          phones: phones.length,
          hasLinkedIn: !!profile.linkedin_url,
          preview: preview.length
        });
        console.log('Email details:', { allEmails, preview });
        console.log('Phone details:', phones);
        
        const responseData = {
          found: true,
          email: allEmails.length > 0 ? allEmails[0] : (preview.length > 0 ? `[Hidden - ${preview[0]}]` : undefined),
          emails: allEmails.length > 0 ? allEmails : undefined,
          phones: phones.length > 0 ? phones : undefined,
          linkedin: profile.linkedin_url,
          source: source,
          error: allEmails.length === 0 && preview.length > 0 ? 'Email/phone requires RocketReach credits to reveal' : undefined,
          profile: {
            name: profile.name,
            title: profile.current_title,
            employer: profile.current_employer,
            location: profile.location
          }
        };
        
        console.log('Returning successful response:', responseData);
        
        return new Response(
          JSON.stringify(responseData),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }
      console.log(`No profiles found in ${source}`);
      return null;
    };

    console.log('=== Three-Tier Search Strategy ===');
    console.log('Search 1: name + location + company_sic_code');
    console.log('Search 2: name + detailed_location (if available)');
    console.log('Search 3: name + location');
    console.log('==================================');

    // SEARCH 1: name + location + company_sic_code
    if (location && company_sic_code) {
      console.log('Starting Search 1...');
      const companySicNumber = company_sic_code.split(' - ')[0];
      console.log('Extracted SIC number:', companySicNumber);
      
      const search1Data = await performSearch({
        'geo[]': `"${location}"`,
        'company_sic_code[]': companySicNumber
      }, 'Search 1 (name + location + company_sic_code)');

      if (search1Data) {
        const result = processResults(search1Data, 'RocketReach (Search 1: name + location + company_sic_code)');
        if (result) {
          console.log('Search 1 succeeded, returning result');
          return result;
        }
      }
      console.log('Search 1 did not return a result, continuing to Search 2...');
    } else {
      console.log('Skipping Search 1 (missing location or company_sic_code)');
    }

    // SEARCH 2: name + detailed_location (if available)
    if (detailed_location) {
      console.log('Starting Search 2 with detailed_location:', detailed_location);
      
      const search2Data = await performSearch({
        'geo[]': `"${detailed_location}"`
      }, 'Search 2 (name + detailed_location)');

      if (search2Data) {
        const result = processResults(search2Data, 'RocketReach (Search 2: name + detailed_location)');
        if (result) {
          console.log('Search 2 succeeded, returning result');
          return result;
        }
      }
      console.log('Search 2 did not return a result, continuing to Search 3...');
    } else {
      console.log('Skipping Search 2 (no detailed_location provided)');
    }

    // SEARCH 3: name + location (only if location is available)
    if (location) {
      console.log('Starting Search 3 with location:', location);
      
      const search3Data = await performSearch({
        'geo[]': `"${location}"`
      }, 'Search 3 (name + location)');

      if (search3Data) {
        const result = processResults(search3Data, 'RocketReach (Search 3: name + location)');
        if (result) {
          console.log('Search 3 succeeded, returning result');
          return result;
        }
      }
      console.log('Search 3 did not return a result');
    } else {
      console.log('Skipping Search 3 (no location provided)');
    }

    // No results found after all searches
    console.log('No profiles found after all search attempts');
    return new Response(
      JSON.stringify({
        found: false,
        error: 'No profiles found after all search attempts'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('=== Email Search Function Error ===');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('===================================');
    return new Response(
      JSON.stringify({
        found: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});