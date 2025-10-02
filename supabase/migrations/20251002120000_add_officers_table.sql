-- Create officers table to store officer data
CREATE TABLE public.officers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  officer_role TEXT NOT NULL,
  appointed_on DATE NOT NULL,
  is_pre_1992_appointment BOOLEAN DEFAULT false,
  country_of_residence TEXT,
  nationality TEXT,
  occupation TEXT,
  person_number TEXT,
  address JSONB,
  date_of_birth JSONB,
  links JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.officers ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Allow public read access to officers"
ON public.officers FOR SELECT
USING (true);

-- Create indexes for better performance
CREATE INDEX idx_officers_company_id ON public.officers(company_id);
CREATE INDEX idx_officers_name ON public.officers(name);
CREATE INDEX idx_officers_officer_role ON public.officers(officer_role);
CREATE INDEX idx_officers_appointed_on ON public.officers(appointed_on);
CREATE INDEX idx_officers_created_at ON public.officers(created_at DESC);
