-- Create SIC codes table to store code descriptions
CREATE TABLE public.sic_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.sic_codes ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Allow public read access to sic_codes"
ON public.sic_codes FOR SELECT
USING (true);

-- Create indexes for better performance
CREATE INDEX idx_sic_codes_code ON public.sic_codes(code);
CREATE INDEX idx_sic_codes_description ON public.sic_codes(description);

-- Insert the provided SIC code
INSERT INTO public.sic_codes (code, description) VALUES 
('01110', 'Growing of cereals (except rice), leguminous crops and oil seeds')
ON CONFLICT (code) DO NOTHING;
