-- Defense-in-depth: application code is the primary guard against negative
-- balances, but a DB-level CHECK constraint protects against bugs or
-- direct SQL access from ever leaving a wallet negative.
ALTER TABLE "Wallet" ADD CONSTRAINT "wallet_balance_non_negative" CHECK ("balance" >= 0);
