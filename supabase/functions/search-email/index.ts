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
}

interface RocketReachResponse {
  profiles?: Array<{
    id?: number;
    name?: string;
    linkedin_url?: string;
    location?: string;
    current_title?: string;
    current_employer?: string;
    teaser?: {
      emails?: string[];
      phones?: string[];
      preview?: string[];
      personal_emails?: string[];
      professional_emails?: string[];
    };
    [key: string]: any;
  }>;
  pagination?: {
    total: number;
    thisPage: number;
    nextPage?: number;
  };
  error?: string;
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
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        found: false,
        error: 'Method not allowed'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      }
    );
  }

  try {
    const { name, location, company_sic_code }: EmailSearchRequest = await req.json();
    
    console.log('=== Email Search Function Invoked ===');
    console.log('Request body:', { name, location, company_sic_code });

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
      console.error('RocketReach API key not configured');
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

    // Build the search URL with query parameters matching RocketReach format
    const searchUrl = new URL('https://api.rocketreach.co/v1/api/search');
    searchUrl.searchParams.set('name', name);
    searchUrl.searchParams.set('start', '1');
    searchUrl.searchParams.set('pageSize', '10');
    
    if (location) {
      searchUrl.searchParams.set('geo[]', `"${location}"`);
    }

    // Add company SIC code if available
    if (company_sic_code) {
      // Extract just the SIC code number if it includes description
      const companySicNumber = company_sic_code.split(' - ')[0];
      searchUrl.searchParams.set('company_sic_code[]', companySicNumber);
    }

    console.log('RocketReach API Request Parameters:', {
      name: name,
      location: location || 'not provided',
      company_sic_code: company_sic_code || 'not provided',
      start: '1',
      pageSize: '10',
      finalUrl: searchUrl.toString()
    });

    console.log('=== RocketReach Search URL ===');
    console.log('Full URL:', searchUrl.toString());
    console.log('Base URL:', searchUrl.origin + searchUrl.pathname);
    console.log('Query Parameters:', Object.fromEntries(searchUrl.searchParams));
    console.log('==============================');
    
    console.log('Making RocketReach API request...');

    const response = await fetch(searchUrl.toString(), {
      method: 'GET',
      headers: {
        'Api-Key': apiKey,
        'Accept': 'application/json',
      },
    });

    console.log('RocketReach API Response Status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('RocketReach API Error:', errorText);
      return new Response(
        JSON.stringify({
          found: false,
          error: `RocketReach API error: ${response.status} ${response.statusText}`
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: response.status,
        }
      );
    }

    // Check if response has content
    const responseText = await response.text();
    console.log('RocketReach API Raw Response:', responseText);
    
    if (!responseText || responseText.trim() === '') {
      console.error('Empty response from RocketReach API');
      return new Response(
        JSON.stringify({
          found: false,
          error: 'Empty response from RocketReach API'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    let data: RocketReachResponse;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse RocketReach API response as JSON:', parseError);
      console.error('Response text:', responseText);
      return new Response(
        JSON.stringify({
          found: false,
          error: 'Invalid JSON response from RocketReach API'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
    
    console.log('RocketReach API Response Data:', data);
    console.log('Number of profiles found:', data.profiles?.length || 0);

    // Check if we have profiles
    if (data.profiles && data.profiles.length > 0) {
      console.log('Processing first profile...');
      const profile = data.profiles[0];
      
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
      
      // Always return if we found a profile (even if some data requires credits)
      return new Response(
        JSON.stringify({
          found: true,
          email: allEmails.length > 0 ? allEmails[0] : (preview.length > 0 ? `[Hidden - ${preview[0]}]` : undefined),
          emails: allEmails.length > 0 ? allEmails : undefined,
          phones: phones.length > 0 ? phones : undefined,
          linkedin: profile.linkedin_url,
          source: 'RocketReach',
          error: allEmails.length === 0 && preview.length > 0 ? 'Email/phone requires RocketReach credits to reveal' : undefined,
          profile: {
            name: profile.name,
            title: profile.current_title,
            employer: profile.current_employer,
            location: profile.location
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else {
      console.log('No profiles found in initial search');
      
      // If no results found and we used company_sic_code, try without it
      if (company_sic_code) {
        console.log('No results with company_sic_code, trying fallback search without it...');
        
        // Build search URL without company_sic_code
        const fallbackSearchUrl = new URL('https://api.rocketreach.co/v1/api/search');
        fallbackSearchUrl.searchParams.set('name', name);
        fallbackSearchUrl.searchParams.set('start', '1');
        fallbackSearchUrl.searchParams.set('pageSize', '10');
        
        if (location) {
          fallbackSearchUrl.searchParams.set('geo[]', `"${location}"`);
        }

        console.log('Fallback search URL:', fallbackSearchUrl.toString());
        console.log('Making fallback RocketReach API request...');

        const fallbackResponse = await fetch(fallbackSearchUrl.toString(), {
          method: 'GET',
          headers: {
            'Api-Key': apiKey,
            'Accept': 'application/json',
          },
        });

        if (fallbackResponse.ok) {
          console.log('Fallback response status:', fallbackResponse.status);
          const fallbackResponseText = await fallbackResponse.text();
          
          if (fallbackResponseText && fallbackResponseText.trim() !== '') {
            try {
              const fallbackData: RocketReachResponse = JSON.parse(fallbackResponseText);
              console.log('Fallback search results:', fallbackData);
              console.log('Fallback profiles found:', fallbackData.profiles?.length || 0);

              if (fallbackData.profiles && fallbackData.profiles.length > 0) {
                console.log('Processing fallback profile...');
                const profile = fallbackData.profiles[0];
                
                // Extract all contact information
                const emails = profile.teaser?.emails || [];
                const professionalEmails = profile.teaser?.professional_emails || [];
                const personalEmails = profile.teaser?.personal_emails || [];
                const phones = profile.teaser?.phones || [];
                const preview = profile.teaser?.preview || [];
                
                // Combine all available emails
                const allEmails = [...emails, ...professionalEmails, ...personalEmails];
                
                console.log('Fallback contact info extracted:', {
                  emails: allEmails.length,
                  phones: phones.length,
                  hasLinkedIn: !!profile.linkedin_url
                });
                
                return new Response(
                  JSON.stringify({
                    found: true,
                    email: allEmails.length > 0 ? allEmails[0] : (preview.length > 0 ? `[Hidden - ${preview[0]}]` : undefined),
                    emails: allEmails.length > 0 ? allEmails : undefined,
                    phones: phones.length > 0 ? phones : undefined,
                    linkedin: profile.linkedin_url,
                    source: 'RocketReach (fallback search)',
                    error: allEmails.length === 0 && preview.length > 0 ? 'Email/phone requires RocketReach credits to reveal' : undefined,
                    profile: {
                      name: profile.name,
                      title: profile.current_title,
                      employer: profile.current_employer,
                      location: profile.location
                    }
                  }),
                  {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200,
                  }
                );
              }
            } catch (parseError) {
              console.error('Failed to parse fallback response:', parseError);
            }
          }
        }
      }

      console.log('Returning: No profiles found after all attempts');
      return new Response(
        JSON.stringify({
          found: false,
          error: data.error || 'No profiles found'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

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
