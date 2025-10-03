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
  results?: Array<{
    email?: string;
    confidence?: number;
    source?: string;
    [key: string]: any;
  }>;
  pagination?: {
    page: number;
    per_page: number;
    total: number;
  };
  error?: string;
}

interface EmailSearchResult {
  email?: string;
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

    // Check if we have results
    if (data.results && data.results.length > 0) {
      // Find the best match (highest confidence or first result with email)
      const bestMatch = data.results.find(result => result.email) || data.results[0];
      
      return new Response(
        JSON.stringify({
          found: true,
          email: bestMatch.email,
          confidence: bestMatch.confidence,
          source: bestMatch.source || 'RocketReach'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          found: false,
          error: data.error || 'No results found'
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
