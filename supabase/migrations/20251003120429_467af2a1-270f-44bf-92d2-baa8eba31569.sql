-- Create table for storing officer contact information
CREATE TABLE IF NOT EXISTS public.officer_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  officer_id UUID NOT NULL REFERENCES public.officers(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  found BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  source TEXT,
  profile_name TEXT,
  profile_title TEXT,
  profile_employer TEXT,
  profile_location TEXT,
  searched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(officer_id)
);

-- Enable Row Level Security
ALTER TABLE public.officer_contacts ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Allow public read access to officer contacts"
  ON public.officer_contacts
  FOR SELECT
  USING (true);

-- Create policy for public insert
CREATE POLICY "Allow public insert to officer contacts"
  ON public.officer_contacts
  FOR INSERT
  WITH CHECK (true);

-- Create policy for public update
CREATE POLICY "Allow public update to officer contacts"
  ON public.officer_contacts
  FOR UPDATE
  USING (true);

-- Create index for faster lookups
CREATE INDEX idx_officer_contacts_officer_id ON public.officer_contacts(officer_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_officer_contacts_updated_at
  BEFORE UPDATE ON public.officer_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();