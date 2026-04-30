-- Dedicated read-only role for AI-generated natural language queries.
-- Queries execute inside BEGIN READ ONLY...ROLLBACK so writes are impossible
-- at the transaction level regardless of role grants.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'relayops_nl_query') THEN
    CREATE ROLE relayops_nl_query NOLOGIN BYPASSRLS;
  END IF;
END
$$;

GRANT SELECT ON TABLE
  warehouses,
  products,
  dealers,
  containers,
  container_items,
  warehouse_stock,
  stock_movements,
  messages,
  message_parse_results,
  dealer_orders,
  dealer_order_items,
  shipments,
  shipment_items,
  status_events,
  receipts,
  receipt_extractions,
  payments,
  audit_log
TO relayops_nl_query;

-- Allow the postgres superuser (used by DATABASE_URL) to SET ROLE
GRANT relayops_nl_query TO postgres;
