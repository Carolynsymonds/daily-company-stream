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

interface SearchResponse {
  items: CompanySearchResult[];
  items_per_page: number;
  start_index: number;
  total_results: number;
}

interface RateLimitState {
  requestCount: number;
  windowStart: number;
}

const RATE_LIMIT = 600; // 600 requests per 5 minutes
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes in milliseconds
const PAGE_SIZE = 100; // Max allowed by API

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const apiKey = Deno.env.get('COMPANIES_HOUSE_API_KEY')!;

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

    await log('info', `Starting scrape for date: ${dateToFetch}`);

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

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': 'Basic ' + btoa(apiKey + ':'),
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

      if (pagesFetched === 0) {
        totalResults = data.total_results;
        await log('info', `Found ${totalResults} companies incorporated on ${dateToFetch}`);
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

      // Break if we've fetched all results
      if (allCompanies.length >= totalResults) {
        break;
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));

    } while (true);

    await log('info', `Completed fetching all ${allCompanies.length} companies. Generating exports...`);

    // Generate JSONL
    const jsonlContent = allCompanies.map(company => JSON.stringify(company)).join('\n');
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

    const csvRows = allCompanies.map(company => [
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
        total_companies: allCompanies.length,
        pages_fetched: pagesFetched,
        jsonl_file_path: jsonlFileName,
        csv_file_path: csvFileName,
      })
      .eq('id', runId);

    return new Response(
      JSON.stringify({
        success: true,
        runId,
        totalCompanies: allCompanies.length,
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
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { runId } = await req.json().catch(() => ({}));
      if (runId) {
        await supabase
          .from('scraper_runs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: error instanceof Error ? error.message : String(error),
          })
          .eq('id', runId);
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
