-- Create SIC codes lookup table
CREATE TABLE public.sic_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create junction table for many-to-many relationship
CREATE TABLE public.company_sic_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sic_code_id UUID NOT NULL REFERENCES public.sic_codes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, sic_code_id)
);

-- Enable Row Level Security
ALTER TABLE public.sic_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_sic_codes ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Allow public read access to sic_codes"
ON public.sic_codes
FOR SELECT
USING (true);

CREATE POLICY "Allow public read access to company_sic_codes"
ON public.company_sic_codes
FOR SELECT
USING (true);

-- Create indexes for better performance
CREATE INDEX idx_company_sic_codes_company_id ON public.company_sic_codes(company_id);
CREATE INDEX idx_company_sic_codes_sic_code_id ON public.company_sic_codes(sic_code_id);
CREATE INDEX idx_sic_codes_code ON public.sic_codes(code);