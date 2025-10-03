import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface EmailSearchRequest {
  name: string;
  location?: string;
  occupation?: string;
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
    const { name, location, occupation }: EmailSearchRequest = await req.json();

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

    // Build the search URL with query parameters
    const searchUrl = new URL('https://api.rocketreach.co/v1/api/search');
    searchUrl.searchParams.set('name', name);
    searchUrl.searchParams.set('page', '1');
    searchUrl.searchParams.set('per_page', '10');
    
    if (location) {
      searchUrl.searchParams.set('location', location);
    }

    console.log('RocketReach API Request Parameters:', {
      name: name,
      location: location || 'not provided',
      page: '1',
      per_page: '10',
      finalUrl: searchUrl.toString()
    });

    console.log('=== RocketReach Search URL ===');
    console.log('Full URL:', searchUrl.toString());
    console.log('Base URL:', searchUrl.origin + searchUrl.pathname);
    console.log('Query Parameters:', Object.fromEntries(searchUrl.searchParams));
    console.log('==============================');

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

    // Check if we have profiles
    if (data.profiles && data.profiles.length > 0) {
      const profile = data.profiles[0];
      
      // Extract all contact information
      const emails = profile.teaser?.emails || [];
      const professionalEmails = profile.teaser?.professional_emails || [];
      const personalEmails = profile.teaser?.personal_emails || [];
      const phones = profile.teaser?.phones || [];
      const preview = profile.teaser?.preview || [];
      
      // Combine all available emails
      const allEmails = [...emails, ...professionalEmails, ...personalEmails];
      
      const hasContactInfo = allEmails.length > 0 || phones.length > 0 || profile.linkedin_url;
      
      if (hasContactInfo) {
        return new Response(
          JSON.stringify({
            found: true,
            email: allEmails.length > 0 ? allEmails[0] : (preview.length > 0 ? `[Hidden - ${preview[0]}]` : undefined),
            emails: allEmails.length > 0 ? allEmails : undefined,
            phones: phones.length > 0 ? phones : undefined,
            linkedin: profile.linkedin_url,
            source: 'RocketReach',
            error: allEmails.length === 0 && preview.length > 0 ? 'Email found but requires RocketReach credits to reveal' : undefined,
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
        // Profile found but no contact info available
        return new Response(
          JSON.stringify({
            found: false,
            error: 'Profile found but no contact information available',
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
    } else {
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
    console.error('Email search error:', error);
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
