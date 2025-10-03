import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompanySearchResult {
  company_number: string;
  company_name: string;
  company_status: string;
  date_of_creation: string;
  registered_office_address: {
    address_line_1?: string;
    address_line_2?: string;
    locality?: string;
    postal_code?: string;
    country?: string;
  };
  company_type?: string;
  sic_codes?: string[];
}

interface Officer {
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

interface OfficersResponse {
  items: Officer[];
  total_results?: number;
  start_index?: number;
  items_per_page?: number;
}

interface SearchResponse {
  items: CompanySearchResult[];
  total_results?: number;
  start_index?: number;
  items_per_page?: number;
  // Alternative field names that might be used
  totalResults?: number;
  startIndex?: number;
  itemsPerPage?: number;
}

interface RateLimitState {
  requestCount: number;
  windowStart: number;
}

const RATE_LIMIT = 600; // 600 requests per 5 minutes
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes in milliseconds
const PAGE_SIZE = 100; // Max allowed by API
const MAX_COMPANIES = 5; // Limit to 5 companies for demo purposes

// Helper function to fetch and store officers for a company
async function fetchAndStoreOfficers(
  companyId: string, 
  companyNumber: string, 
  apiKey: string, 
  supabase: any, 
  log: (level: string, message: string, metadata?: any) => Promise<void>
) {
  const officersUrl = `https://api.company-information.service.gov.uk/company/${companyNumber}/officers`;
  
  // Create Basic Auth header
  const authString = `${apiKey}:`;
  const encodedAuth = btoa(authString);
  
  await log('debug', `Fetching officers for company ${companyNumber}`, {
    url: officersUrl,
    headers: {
      'Authorization': `Basic ${encodedAuth.substring(0, 20)}...`,
      'Accept': 'application/json',
    }
  });
  
  const response = await fetch(officersUrl, {
    headers: {
      'Authorization': `Basic ${encodedAuth}`,
      'Accept': 'application/json',
    },
  });

  // Log response headers and status
  await log('debug', `Officers API response status for company ${companyNumber}:`, {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    url: response.url
  });

  // Handle 429 with Retry-After
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    const waitSeconds = retryAfter ? parseInt(retryAfter) : 60;
    await log('warning', `Received 429 for officers API. Retrying after ${waitSeconds}s...`);
    await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
    return fetchAndStoreOfficers(companyId, companyNumber, apiKey, supabase, log);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Officers API request failed (${response.status}): ${errorText}`);
  }

  const data: OfficersResponse = await response.json();
  
  // Log the raw response for debugging
  await log('debug', `Raw officers API response for company ${companyNumber}:`, data);
  
  // Log detailed officers API response
  await log('info', `Officers API Response for company ${companyNumber}:`, {
    total_results: data.total_results,
    start_index: data.start_index,
    items_per_page: data.items_per_page,
    items_count: data.items.length,
    full_response_keys: Object.keys(data),
    all_officers: data.items.map(officer => ({
      name: officer.name,
      officer_role: officer.officer_role,
      appointed_on: officer.appointed_on,
      is_pre_1992_appointment: officer.is_pre_1992_appointment,
      country_of_residence: officer.country_of_residence,
      nationality: officer.nationality,
      occupation: officer.occupation,
      person_number: officer.person_number,
      has_address: !!officer.address,
      has_date_of_birth: !!officer.date_of_birth,
      has_links: !!officer.links,
      address_details: officer.address ? {
        premises: officer.address.premises,
        address_line_1: officer.address.address_line_1,
        locality: officer.address.locality,
        postal_code: officer.address.postal_code,
        country: officer.address.country
      } : null,
      date_of_birth_details: officer.date_of_birth ? {
        month: officer.date_of_birth.month,
        year: officer.date_of_birth.year
      } : null
    }))
  });

  if (data.items.length > 0) {
    const officersToInsert = data.items.map(officer => ({
      company_id: companyId,
      name: officer.name,
      officer_role: officer.officer_role,
      appointed_on: officer.appointed_on,
      is_pre_1992_appointment: officer.is_pre_1992_appointment || false,
      country_of_residence: officer.country_of_residence,
      nationality: officer.nationality,
      occupation: officer.occupation,
      person_number: officer.person_number,
      address: officer.address,
      date_of_birth: officer.date_of_birth,
      links: officer.links,
    }));

    // Log the data we're about to insert
    await log('debug', `Preparing to insert officers for company ${companyNumber}:`, {
      officers_count: officersToInsert.length,
      sample_officer_data: officersToInsert[0] || null,
      all_officer_names: officersToInsert.map(o => o.name)
    });

    const { data: insertedOfficers, error: officersInsertError } = await supabase
      .from('officers')
      .insert(officersToInsert)
      .select('id, name, officer_role');

    if (officersInsertError) {
      await log('error', `Failed to store officers for company ${companyNumber}:`, {
        error: officersInsertError.message,
        error_details: officersInsertError,
        attempted_officers: officersToInsert.length
      });
    } else {
      await log('info', `Successfully stored ${insertedOfficers?.length || officersToInsert.length} officers for company ${companyNumber}:`, {
        inserted_officers: insertedOfficers?.map((o: { id: string; name: string; officer_role: string }) => ({
          id: o.id,
          name: o.name,
          role: o.officer_role
        })) || [],
        total_inserted: insertedOfficers?.length || officersToInsert.length
      });
    }
  } else {
    await log('info', `No officers found for company ${companyNumber}`);
  }

  // Small delay between officer requests
  await new Promise(resolve => setTimeout(resolve, 200));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const apiKey = Deno.env.get('COMPANIES_HOUSE_API_KEY');

    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL environment variable is not set');
    }
    if (!supabaseServiceKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
    }
    if (!apiKey) {
      throw new Error('COMPANIES_HOUSE_API_KEY environment variable is not set');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get target date from request or use yesterday (Europe/London)
    const { targetDate } = await req.json().catch(() => ({}));
    
    // Calculate yesterday in Europe/London timezone
    const londonTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/London' }));
    londonTime.setDate(londonTime.getDate() - 1);
    const yesterday = londonTime.toISOString().split('T')[0];
    
    const dateToFetch = targetDate || yesterday;

    // Create a new run record
    const { data: run, error: runError } = await supabase
      .from('scraper_runs')
      .insert({
        status: 'running',
        target_date: dateToFetch,
      })
      .select()
      .single();

    if (runError || !run) {
      throw new Error(`Failed to create run: ${runError?.message}`);
    }

    const runId = run.id;

    // Helper to log messages
    const log = async (level: string, message: string, metadata?: any) => {
      console.log(`[${level.toUpperCase()}] ${message}`, metadata || '');
      await supabase.from('scraper_logs').insert({
        run_id: runId,
        level,
        message,
        metadata,
      });
    };

    await log('info', `Starting scrape for date: ${dateToFetch} (limited to ${MAX_COMPANIES} companies)`);

    const allCompanies: CompanySearchResult[] = [];
    let startIndex = 0;
    let totalResults = 0;
    let pagesFetched = 0;

    // Rate limiting state
    const rateLimitState: RateLimitState = {
      requestCount: 0,
      windowStart: Date.now(),
    };

    // Helper to handle rate limiting
    const checkRateLimit = async () => {
      const now = Date.now();
      
      // Reset window if 5 minutes have passed
      if (now - rateLimitState.windowStart >= WINDOW_MS) {
        rateLimitState.requestCount = 0;
        rateLimitState.windowStart = now;
      }

      // If we're at the limit, wait until the window resets
      if (rateLimitState.requestCount >= RATE_LIMIT) {
        const waitTime = WINDOW_MS - (now - rateLimitState.windowStart);
        await log('info', `Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s before continuing...`);
        await new Promise(resolve => setTimeout(resolve, waitTime + 1000)); // Add 1s buffer
        rateLimitState.requestCount = 0;
        rateLimitState.windowStart = Date.now();
      }
    };

    // Fetch all pages
    do {
      await checkRateLimit();

      const url = new URL('https://api.company-information.service.gov.uk/advanced-search/companies');
      url.searchParams.set('incorporated_from', dateToFetch);
      url.searchParams.set('incorporated_to', dateToFetch);
      url.searchParams.set('size', PAGE_SIZE.toString());
      url.searchParams.set('start_index', startIndex.toString());

      await log('debug', `Fetching page at start_index: ${startIndex}`);

      // Create Basic Auth header - API key is username, password is empty
      const authString = `${apiKey}:`;
      const encodedAuth = btoa(authString);
      
      await log('debug', `Auth header (first 20 chars): Basic ${encodedAuth.substring(0, 20)}...`);

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Basic ${encodedAuth}`,
          'Accept': 'application/json',
        },
      });

      rateLimitState.requestCount++;

      // Handle 429 with Retry-After
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitSeconds = retryAfter ? parseInt(retryAfter) : 60;
        await log('warning', `Received 429. Retrying after ${waitSeconds}s...`);
        await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
        continue; // Retry the same request
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed (${response.status}): ${errorText}`);
      }

      const data: SearchResponse = await response.json();

      // Log the API response with more detailed information
      await log('info', `API Response for page ${pagesFetched + 1}:`, {
        total_results: data.total_results || data.totalResults,
        start_index: data.start_index || data.startIndex,
        items_per_page: data.items_per_page || data.itemsPerPage,
        items_count: data.items.length,
        response_keys: Object.keys(data),
        sample_company: data.items[0] ? {
          company_number: data.items[0].company_number,
          company_name: data.items[0].company_name,
          company_status: data.items[0].company_status,
          date_of_creation: data.items[0].date_of_creation
        } : null
      });

      if (pagesFetched === 0) {
        totalResults = data.total_results || data.totalResults || data.items.length;
        await log('info', `Found ${totalResults} companies incorporated on ${dateToFetch} (estimated from first page)`);
      }

      allCompanies.push(...data.items);
      pagesFetched++;
      startIndex += PAGE_SIZE;

      // Update progress
      await supabase
        .from('scraper_runs')
        .update({
          total_companies: allCompanies.length,
          pages_fetched: pagesFetched,
        })
        .eq('id', runId);

      await log('info', `Fetched page ${pagesFetched}. Total companies: ${allCompanies.length}/${totalResults}`);

      // Break if we've reached the limit or if we got fewer items than requested (indicating last page)
      if (allCompanies.length >= MAX_COMPANIES || data.items.length < PAGE_SIZE) {
        break;
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));

    } while (true);

    // Limit to MAX_COMPANIES if we fetched more
    const limitedCompanies = allCompanies.slice(0, MAX_COMPANIES);
    
    await log('info', `Completed fetching ${allCompanies.length} companies. Limited to ${limitedCompanies.length} for storage. Generating exports...`);

    // Store companies in database
    if (limitedCompanies.length > 0) {
      const companiesToInsert = limitedCompanies.map(company => ({
        run_id: runId,
        company_number: company.company_number,
        company_name: company.company_name,
        company_status: company.company_status,
        company_type: company.company_type,
        date_of_creation: company.date_of_creation,
        registered_office_address: company.registered_office_address,
        sic_codes: company.sic_codes,
      }));

      try {
        const { data: insertedCompanies, error: insertError } = await supabase
          .from('companies')
          .insert(companiesToInsert)
          .select('id, company_number');

        if (insertError) {
          await log('error', `Failed to store companies in database: ${insertError.message}`);
          // Continue execution even if database storage fails
        } else {
          await log('info', `Stored ${companiesToInsert.length} companies in database`);
          
          // Fetch officers for each company
          if (insertedCompanies && insertedCompanies.length > 0) {
            await log('info', `Starting to fetch officers for ${insertedCompanies.length} companies...`);
            
            for (const company of insertedCompanies) {
              try {
                await fetchAndStoreOfficers(company.id, company.company_number, apiKey, supabase, log);
              } catch (officerError) {
                await log('error', `Failed to fetch officers for company ${company.company_number}: ${officerError}`);
                // Continue with other companies even if one fails
              }
            }
          }
        }
      } catch (dbError) {
        await log('error', `Database error while storing companies: ${dbError}`);
        // Continue execution even if database storage fails
      }
    }

    // Generate JSONL
    const jsonlContent = limitedCompanies.map(company => JSON.stringify(company)).join('\n');
    const jsonlFileName = `companies-${dateToFetch}.jsonl`;
    
    const { error: jsonlUploadError } = await supabase.storage
      .from('scraper-exports')
      .upload(jsonlFileName, new Blob([jsonlContent], { type: 'application/jsonl' }), {
        upsert: true,
      });

    if (jsonlUploadError) {
      throw new Error(`Failed to upload JSONL: ${jsonlUploadError.message}`);
    }

    // Generate CSV
    const csvHeaders = [
      'company_number',
      'company_name',
      'company_status',
      'date_of_creation',
      'company_type',
      'address_line_1',
      'address_line_2',
      'locality',
      'postal_code',
      'country',
      'sic_codes',
    ];

    const csvRows = limitedCompanies.map(company => [
      company.company_number,
      `"${(company.company_name || '').replace(/"/g, '""')}"`,
      company.company_status,
      company.date_of_creation,
      company.company_type || '',
      `"${(company.registered_office_address?.address_line_1 || '').replace(/"/g, '""')}"`,
      `"${(company.registered_office_address?.address_line_2 || '').replace(/"/g, '""')}"`,
      `"${(company.registered_office_address?.locality || '').replace(/"/g, '""')}"`,
      company.registered_office_address?.postal_code || '',
      company.registered_office_address?.country || '',
      `"${(company.sic_codes || []).join('; ')}"`,
    ].join(','));

    const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');
    const csvFileName = `companies-${dateToFetch}.csv`;

    const { error: csvUploadError } = await supabase.storage
      .from('scraper-exports')
      .upload(csvFileName, new Blob([csvContent], { type: 'text/csv' }), {
        upsert: true,
      });

    if (csvUploadError) {
      throw new Error(`Failed to upload CSV: ${csvUploadError.message}`);
    }

    await log('info', `Exports generated successfully: ${jsonlFileName}, ${csvFileName}`);

    // Update run as completed
    await supabase
      .from('scraper_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        total_companies: limitedCompanies.length,
        pages_fetched: pagesFetched,
        jsonl_file_path: jsonlFileName,
        csv_file_path: csvFileName,
      })
      .eq('id', runId);

    return new Response(
      JSON.stringify({
        success: true,
        runId,
        totalCompanies: limitedCompanies.length,
        pagesFetched,
        jsonlFile: jsonlFileName,
        csvFile: csvFileName,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in scraper:', error);

    // Try to update run status if we have runId
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (!supabaseUrl || !supabaseServiceKey) {
        console.error('Missing Supabase credentials for error handler');
        throw error;
      }
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Get runId from the request body
      const { targetDate } = await req.json().catch(() => ({}));
      
      // Find the most recent run for this target date to update its status
      const { data: recentRun } = await supabase
        .from('scraper_runs')
        .select('id')
        .eq('target_date', targetDate || new Date().toISOString().split('T')[0])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (recentRun) {
        await supabase
          .from('scraper_runs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: error instanceof Error ? error.message : String(error),
          })
          .eq('id', recentRun.id);
      }
    } catch (updateError) {
      console.error('Failed to update run status:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
