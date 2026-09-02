CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NULL REFERENCES plans(id) ON DELETE SET NULL,
  provider VARCHAR(40) NOT NULL DEFAULT 'paystack',
  status VARCHAR(20) NOT NULL DEFAULT 'success',
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'GHS',
  transaction_reference VARCHAR(255) NOT NULL,
  provider_transaction_id VARCHAR(255) NULL,
  paid_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_transactions_user_created_idx
  ON payment_transactions (user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_provider_reference_uq
  ON payment_transactions (provider, transaction_reference);

CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_provider_txn_uq
  ON payment_transactions (provider, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_transactions_status_check'
  ) THEN
    ALTER TABLE payment_transactions
      ADD CONSTRAINT payment_transactions_status_check
      CHECK (status IN ('success', 'pending', 'failed', 'refunded'));
  END IF;
END $$;
