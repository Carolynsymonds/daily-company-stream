-- Create enum for run status
CREATE TYPE run_status AS ENUM ('pending', 'running', 'completed', 'failed');

-- Create enum for log levels
CREATE TYPE log_level AS ENUM ('info', 'warning', 'error', 'debug');

-- Create scraper_runs table
CREATE TABLE public.scraper_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status run_status NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  target_date DATE NOT NULL,
  total_companies INTEGER DEFAULT 0,
  pages_fetched INTEGER DEFAULT 0,
  error_message TEXT,
  jsonl_file_path TEXT,
  csv_file_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create scraper_logs table
CREATE TABLE public.scraper_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.scraper_runs(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  level log_level NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  metadata JSONB
);

-- Enable Row Level Security
ALTER TABLE public.scraper_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraper_logs ENABLE ROW LEVEL SECURITY;

-- Create policies (public read for now - you can add auth later)
CREATE POLICY "Allow public read access to runs"
ON public.scraper_runs FOR SELECT
USING (true);

CREATE POLICY "Allow public read access to logs"
ON public.scraper_logs FOR SELECT
USING (true);

-- Create indexes for better performance
CREATE INDEX idx_scraper_runs_status ON public.scraper_runs(status);
CREATE INDEX idx_scraper_runs_started_at ON public.scraper_runs(started_at DESC);
CREATE INDEX idx_scraper_logs_run_id ON public.scraper_logs(run_id);
CREATE INDEX idx_scraper_logs_timestamp ON public.scraper_logs(timestamp DESC);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_scraper_runs_updated_at
BEFORE UPDATE ON public.scraper_runs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for exports
INSERT INTO storage.buckets (id, name, public)
VALUES ('scraper-exports', 'scraper-exports', true);

-- Create storage policy for public read access
CREATE POLICY "Public read access to exports"
ON storage.objects FOR SELECT
USING (bucket_id = 'scraper-exports');

-- Create storage policy for service role writes
CREATE POLICY "Service role can upload exports"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'scraper-exports');