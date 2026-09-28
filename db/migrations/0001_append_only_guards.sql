-- Append-only guards for ledgers and the audit log.
--
-- Financial, inventory and audit history must never be edited or removed. These triggers reject
-- UPDATE and DELETE row by row and TRUNCATE at statement level, whatever the calling role.
-- Corrections are always new, compensating entries (e.g. a BID_REFUND or ADMIN_ADJUSTMENT).

CREATE OR REPLACE FUNCTION esb_forbid_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only: % is not allowed', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'integrity_constraint_violation',
          HINT = 'Record a new compensating entry instead of changing history.';
END;
$$;
--> statement-breakpoint
DO $$
DECLARE
  append_only text[] := ARRAY[
    'audit_events',
    'bids',
    'bid_ledger_entries',
    'inventory_events',
    'order_events',
    'payment_events',
    'reward_ledger_entries',
    'auction_transitions'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY append_only LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_no_update_delete', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION esb_forbid_mutation()',
      t || '_no_update_delete', t
    );
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_no_truncate', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION esb_forbid_mutation()',
      t || '_no_truncate', t
    );
  END LOOP;
END;
$$;
--> statement-breakpoint
-- An auction result is written exactly once by the engine and can never be changed.
CREATE OR REPLACE FUNCTION esb_forbid_result_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Auction results cannot be deleted' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW.outcome IS DISTINCT FROM OLD.outcome
     OR NEW.winner_id IS DISTINCT FROM OLD.winner_id
     OR NEW.final_price_minor IS DISTINCT FROM OLD.final_price_minor
     OR NEW.closed_at IS DISTINCT FROM OLD.closed_at THEN
    RAISE EXCEPTION 'Auction results are immutable (only order_id may be linked later)' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS auction_results_immutable ON auction_results;
--> statement-breakpoint
CREATE TRIGGER auction_results_immutable BEFORE UPDATE OR DELETE ON auction_results
  FOR EACH ROW EXECUTE FUNCTION esb_forbid_result_change();
--> statement-breakpoint
-- Bids can only be recorded while the auction row says it is LIVE (defence in depth: the engine
-- already checks this while holding the auction row lock).
CREATE OR REPLACE FUNCTION esb_bid_requires_live_auction() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  current_status auction_status;
BEGIN
  SELECT status INTO current_status FROM auctions WHERE id = NEW.auction_id;
  IF current_status IS DISTINCT FROM 'LIVE' THEN
    RAISE EXCEPTION 'Bids can only be recorded on LIVE auctions (auction %, status %)', NEW.auction_id, current_status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS bids_require_live_auction ON bids;
--> statement-breakpoint
CREATE TRIGGER bids_require_live_auction BEFORE INSERT ON bids
  FOR EACH ROW EXECUTE FUNCTION esb_bid_requires_live_auction();
