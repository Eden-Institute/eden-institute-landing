-- Homeschool kit orders (preorders) recorded by stripe-webhook on
-- checkout.session.completed for the physical Eden's Table products.
-- Source of truth for fulfillment + the Founders 500-unit counter.
-- Stripe still holds payment + address; this is the queryable mirror.
-- RLS service-role only (the webhook writes; /founder can read via RPC later).

CREATE TABLE IF NOT EXISTS public.homeschool_orders (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  stripe_session_id  text UNIQUE NOT NULL,        -- idempotency key for webhook retries
  stripe_customer_id text,
  email              text,
  lookup_key         text NOT NULL,               -- sprouts_complete | seedlings_complete | two_band_bundle | nb_addon
  product_label      text,
  amount_total       integer,                     -- cents, as charged (incl. shipping/tax)
  currency           text,
  quantity           integer NOT NULL DEFAULT 1,
  payment_status     text,
  shipping_name      text,
  shipping_address   jsonb,
  status             text NOT NULL DEFAULT 'preorder', -- preorder | fulfilled | refunded | cancelled
  raw                jsonb
);

COMMENT ON TABLE public.homeschool_orders IS
  'Eden''s Table kit orders (preorders) recorded by stripe-webhook. Fulfillment list + Founders 500-unit counter. RLS service-role only.';

ALTER TABLE public.homeschool_orders ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS homeschool_orders_created_at_idx
  ON public.homeschool_orders (created_at DESC);
CREATE INDEX IF NOT EXISTS homeschool_orders_lookup_key_idx
  ON public.homeschool_orders (lookup_key);
