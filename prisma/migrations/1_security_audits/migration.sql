-- Security Audits Migration
-- Run this in your Supabase SQL Editor to add security audit tables

-- Security audit scans (partial scans are free, full audits require purchase)
CREATE TABLE IF NOT EXISTS public.security_audits (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  scan_type text NOT NULL CHECK (scan_type IN ('partial', 'full')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'complete', 'failed')),
  summary jsonb DEFAULT '{}'::jsonb,
  findings jsonb DEFAULT '[]'::jsonb,
  categories jsonb DEFAULT '[]'::jsonb,
  preview_finding jsonb,
  scanned_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Security audit purchases
CREATE TABLE IF NOT EXISTS public.security_audit_purchases (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  audit_id uuid REFERENCES public.security_audits(id) ON DELETE CASCADE NOT NULL,
  stripe_payment_intent_id text UNIQUE,
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'gbp',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for security audits
CREATE INDEX IF NOT EXISTS idx_security_audits_project_id ON public.security_audits(project_id);
CREATE INDEX IF NOT EXISTS idx_security_audits_user_id ON public.security_audits(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_purchases_user_id ON public.security_audit_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_purchases_project_id ON public.security_audit_purchases(project_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_purchases_payment_intent ON public.security_audit_purchases(stripe_payment_intent_id);

-- Enable RLS on security tables
ALTER TABLE public.security_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_purchases ENABLE ROW LEVEL SECURITY;

-- RLS Policies for security_audits
CREATE POLICY "Users can view own security audits" ON public.security_audits
  FOR SELECT USING (user_id::text = auth.uid()::text);

CREATE POLICY "Service role full access security_audits" ON public.security_audits
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for security_audit_purchases
CREATE POLICY "Users can view own audit purchases" ON public.security_audit_purchases
  FOR SELECT USING (user_id::text = auth.uid()::text);

CREATE POLICY "Service role full access security_audit_purchases" ON public.security_audit_purchases
  FOR ALL USING (auth.role() = 'service_role');

-- Trigger for updated_at
CREATE TRIGGER security_audit_purchases_updated_at
  BEFORE UPDATE ON public.security_audit_purchases
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
