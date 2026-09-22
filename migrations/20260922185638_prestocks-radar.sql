CREATE TABLE public.radar_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{2,64}$'),
  name text NOT NULL UNIQUE CHECK (char_length(name) BETWEEN 2 AND 80),
  description text NOT NULL CHECK (char_length(description) <= 180),
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL UNIQUE CHECK (display_order > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.radar_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  nonce_hash text NOT NULL UNIQUE,
  message text NOT NULL,
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > issued_at)
);
CREATE INDEX radar_challenges_wallet_time ON public.radar_challenges(wallet_address, created_at DESC);

CREATE TABLE public.radar_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX radar_sessions_wallet ON public.radar_sessions(wallet_address);

CREATE TABLE public.radar_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL UNIQUE,
  is_current_holder boolean NOT NULL,
  official_position_count integer NOT NULL CHECK (official_position_count >= 0),
  top_candidate_id uuid NOT NULL REFERENCES public.radar_candidates(id),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 220),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (is_current_holder = (official_position_count > 0))
);
CREATE INDEX radar_submissions_updated ON public.radar_submissions(updated_at DESC);

CREATE TABLE public.radar_allocations (
  submission_id uuid NOT NULL REFERENCES public.radar_submissions(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.radar_candidates(id),
  points integer NOT NULL CHECK (points BETWEEN 1 AND 100),
  PRIMARY KEY (submission_id, candidate_id)
);
CREATE INDEX radar_allocations_candidate ON public.radar_allocations(candidate_id);

ALTER TABLE public.radar_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_allocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.radar_candidates, public.radar_challenges, public.radar_sessions,
  public.radar_submissions, public.radar_allocations FROM anon, authenticated;

INSERT INTO public.radar_candidates(slug, name, description, display_order) VALUES
  ('stripe', 'Stripe', 'Payments infrastructure for online businesses.', 1),
  ('databricks', 'Databricks', 'Data and AI software for enterprises.', 2),
  ('canva', 'Canva', 'Visual design tools for teams and individuals.', 3),
  ('discord', 'Discord', 'Community communication for people and teams.', 4),
  ('epic-games', 'Epic Games', 'Games, creator tools, and interactive worlds.', 5),
  ('perplexity', 'Perplexity', 'Search and answers powered by AI.', 6),
  ('ramp', 'Ramp', 'Finance software for businesses.', 7),
  ('vercel', 'Vercel', 'Infrastructure for building and deploying websites.', 8);

CREATE FUNCTION public.radar_replace_submission(
  p_wallet_address text,
  p_is_current_holder boolean,
  p_official_position_count integer,
  p_reason text,
  p_allocations jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_top_candidate_id uuid;
  v_total integer;
BEGIN
  IF p_wallet_address IS NULL OR char_length(p_wallet_address) NOT BETWEEN 32 AND 44
    OR p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 1 AND 220
    OR p_official_position_count IS NULL OR p_official_position_count < 0
    OR p_is_current_holder IS DISTINCT FROM (p_official_position_count > 0)
    OR p_allocations IS NULL OR jsonb_typeof(p_allocations) <> 'array'
    OR jsonb_array_length(p_allocations) NOT BETWEEN 1 AND 8
  THEN RAISE EXCEPTION 'Invalid Radar submission'; END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_allocations) AS e(value)
    WHERE jsonb_typeof(e.value) <> 'object'
      OR jsonb_typeof(e.value->'candidateId') <> 'string'
      OR jsonb_typeof(e.value->'points') <> 'number'
      OR (e.value->>'points') !~ '^[1-9][0-9]*$'
      OR (e.value->>'points')::integer > 100
  ) THEN RAISE EXCEPTION 'Invalid allocation'; END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_allocations) AS e(value)
    LEFT JOIN public.radar_candidates c ON c.id::text = e.value->>'candidateId' AND c.active
    WHERE c.id IS NULL
  ) THEN RAISE EXCEPTION 'Unknown or inactive candidate'; END IF;

  IF (SELECT count(DISTINCT e.value->>'candidateId') FROM jsonb_array_elements(p_allocations) AS e(value))
     <> jsonb_array_length(p_allocations)
  THEN RAISE EXCEPTION 'Duplicate candidate'; END IF;

  SELECT sum((e.value->>'points')::integer) INTO v_total
  FROM jsonb_array_elements(p_allocations) AS e(value);
  IF v_total <> 100 THEN RAISE EXCEPTION 'Allocation must total 100'; END IF;

  SELECT c.id INTO v_top_candidate_id
  FROM jsonb_array_elements(p_allocations) AS e(value)
  JOIN public.radar_candidates c ON c.id::text = e.value->>'candidateId'
  ORDER BY (e.value->>'points')::integer DESC, c.display_order ASC
  LIMIT 1;

  INSERT INTO public.radar_submissions
    (wallet_address, is_current_holder, official_position_count, top_candidate_id, reason)
  VALUES (p_wallet_address, p_is_current_holder, p_official_position_count, v_top_candidate_id, btrim(p_reason))
  ON CONFLICT (wallet_address) DO UPDATE SET
    is_current_holder = excluded.is_current_holder,
    official_position_count = excluded.official_position_count,
    top_candidate_id = excluded.top_candidate_id,
    reason = excluded.reason,
    updated_at = now()
  RETURNING id INTO v_id;

  DELETE FROM public.radar_allocations WHERE submission_id = v_id;
  INSERT INTO public.radar_allocations(submission_id, candidate_id, points)
  SELECT v_id, (e.value->>'candidateId')::uuid, (e.value->>'points')::integer
  FROM jsonb_array_elements(p_allocations) AS e(value);
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.radar_replace_submission(text, boolean, integer, text, jsonb)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.radar_board() RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
  WITH participant_metrics AS (
    SELECT count(*)::integer AS participants,
      count(*) FILTER (WHERE is_current_holder)::integer AS holder_participants,
      max(updated_at) AS latest_update
    FROM public.radar_submissions
  ), totals AS (
    SELECT a.candidate_id,
      sum(a.points)::integer AS total_points,
      count(*)::integer AS allocating_wallets,
      coalesce(sum(a.points) FILTER (WHERE s.is_current_holder), 0)::integer AS holder_points,
      count(*) FILTER (WHERE s.is_current_holder)::integer AS holder_wallets,
      coalesce(sum(a.points) FILTER (WHERE NOT s.is_current_holder), 0)::integer AS community_points,
      count(*) FILTER (WHERE NOT s.is_current_holder)::integer AS community_wallets
    FROM public.radar_allocations a
    JOIN public.radar_submissions s ON s.id = a.submission_id
    GROUP BY a.candidate_id
  )
  SELECT jsonb_build_object(
    'metrics', (SELECT jsonb_build_object(
      'signedParticipants', participants,
      'currentHolderParticipants', holder_participants,
      'currentSubmissions', participants,
      'latestUpdate', latest_update
    ) FROM participant_metrics),
    'candidates', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', c.id, 'slug', c.slug, 'name', c.name, 'description', c.description,
      'displayOrder', c.display_order,
      'totalPoints', coalesce(t.total_points, 0),
      'allocatingWallets', coalesce(t.allocating_wallets, 0),
      'holderPoints', coalesce(t.holder_points, 0),
      'holderWallets', coalesce(t.holder_wallets, 0),
      'communityPoints', coalesce(t.community_points, 0),
      'communityWallets', coalesce(t.community_wallets, 0)
    ) ORDER BY coalesce(t.total_points, 0) DESC, c.display_order)
    FROM public.radar_candidates c LEFT JOIN totals t ON t.candidate_id = c.id WHERE c.active), '[]'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION public.radar_board() FROM PUBLIC, anon, authenticated;
