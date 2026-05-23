-- Migration: 019_catalog_items
-- Created: 2026-05-21
-- Product/feature catalog for e-commerce and SaaS recommendations

CREATE TABLE IF NOT EXISTS public.catalog_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    price NUMERIC,
    image_url TEXT,
    url TEXT,
    metadata JSONB DEFAULT '{}',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(customer_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_items_customer_id ON catalog_items(customer_id);
CREATE INDEX IF NOT EXISTS idx_catalog_items_category ON catalog_items(category);
CREATE INDEX IF NOT EXISTS idx_catalog_items_active ON catalog_items(active) WHERE active = true;

ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can read their catalog" ON public.catalog_items;
CREATE POLICY "Customers can read their catalog"
    ON public.catalog_items FOR SELECT
    USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can insert their catalog" ON public.catalog_items;
CREATE POLICY "Customers can insert their catalog"
    ON public.catalog_items FOR INSERT
    WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can update their catalog" ON public.catalog_items;
CREATE POLICY "Customers can update their catalog"
    ON public.catalog_items FOR UPDATE
    USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can delete their catalog" ON public.catalog_items;
CREATE POLICY "Customers can delete their catalog"
    ON public.catalog_items FOR DELETE
    USING (customer_id = auth.uid());
