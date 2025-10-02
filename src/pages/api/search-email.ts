import { NextApiRequest, NextApiResponse } from 'next';

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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<EmailSearchResult>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      found: false,
      error: 'Method not allowed'
    });
  }

  const { name, location, occupation }: EmailSearchRequest = req.body;

  if (!name) {
    return res.status(400).json({
      found: false,
      error: 'Name is required'
    });
  }

  const apiKey = process.env.RR_API_KEY;
  if (!apiKey) {
    console.error('RocketReach API key not configured');
    return res.status(500).json({
      found: false,
      error: 'RocketReach API key not configured. Please set RR_API_KEY environment variable.'
    });
  }

  try {
    // Build the search URL with query parameters
    const searchUrl = new URL('https://api.rocketreach.co/v1/api/search');
    searchUrl.searchParams.set('name', name);
    searchUrl.searchParams.set('page', '1');
    searchUrl.searchParams.set('per_page', '10');
    
    if (location) {
      searchUrl.searchParams.set('location', location);
    }

    console.log('RocketReach API Request:', {
      url: searchUrl.toString(),
      name,
      location,
      occupation
    });

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
      return res.status(response.status).json({
        found: false,
        error: `RocketReach API error: ${response.status} ${response.statusText}`
      });
    }

    // Check if response has content
    const responseText = await response.text();
    console.log('RocketReach API Raw Response:', responseText);
    
    if (!responseText || responseText.trim() === '') {
      console.error('Empty response from RocketReach API');
      return res.status(200).json({
        found: false,
        error: 'Empty response from RocketReach API'
      });
    }

    let data: RocketReachResponse;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse RocketReach API response as JSON:', parseError);
      console.error('Response text:', responseText);
      return res.status(200).json({
        found: false,
        error: 'Invalid JSON response from RocketReach API'
      });
    }
    
    console.log('RocketReach API Response Data:', data);

    // Check if we have results
    if (data.results && data.results.length > 0) {
      // Find the best match (highest confidence or first result with email)
      const bestMatch = data.results.find(result => result.email) || data.results[0];
      
      return res.status(200).json({
        found: true,
        email: bestMatch.email,
        confidence: bestMatch.confidence,
        source: bestMatch.source || 'RocketReach'
      });
    } else {
      return res.status(200).json({
        found: false,
        error: data.error || 'No results found'
      });
    }

  } catch (error) {
    console.error('Email search error:', error);
    return res.status(500).json({
      found: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
}
