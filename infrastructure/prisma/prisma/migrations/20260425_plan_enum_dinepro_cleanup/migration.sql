DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'Plan'
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'Plan'
      AND e.enumlabel = 'DINEPRO'
  ) THEN
    RETURN;
  END IF;

  ALTER TYPE "Plan" RENAME TO "Plan_legacy_20260425";

  CREATE TYPE "Plan" AS ENUM (
    'FREE',
    'STARTER',
    'GOLD',
    'PLATINUM',
    'MINI',
    'CAFE',
    'BHOJPRO',
    'PREMIUM'
  );

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Tenant'
      AND column_name = 'plan'
  ) THEN
    ALTER TABLE "Tenant" ALTER COLUMN "plan" DROP DEFAULT;
    ALTER TABLE "Tenant"
      ALTER COLUMN "plan" TYPE "Plan"
      USING (
        CASE
          WHEN "plan"::text = 'DINEPRO' THEN 'BHOJPRO'
          ELSE "plan"::text
        END
      )::"Plan";
    ALTER TABLE "Tenant" ALTER COLUMN "plan" SET DEFAULT 'MINI';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Subscription'
      AND column_name = 'plan'
  ) THEN
    ALTER TABLE "Subscription" ALTER COLUMN "plan" DROP DEFAULT;
    ALTER TABLE "Subscription"
      ALTER COLUMN "plan" TYPE "Plan"
      USING (
        CASE
          WHEN "plan"::text = 'DINEPRO' THEN 'BHOJPRO'
          ELSE "plan"::text
        END
      )::"Plan";
    ALTER TABLE "Subscription" ALTER COLUMN "plan" SET DEFAULT 'MINI';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'PaymentAttempt'
      AND column_name = 'targetPlan'
  ) THEN
    ALTER TABLE "PaymentAttempt"
      ALTER COLUMN "targetPlan" TYPE "Plan"
      USING (
        CASE
          WHEN "targetPlan"::text = 'DINEPRO' THEN 'BHOJPRO'
          ELSE "targetPlan"::text
        END
      )::"Plan";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'SubscriptionInvoice'
      AND column_name = 'plan'
  ) THEN
    ALTER TABLE "SubscriptionInvoice"
      ALTER COLUMN "plan" TYPE "Plan"
      USING (
        CASE
          WHEN "plan"::text = 'DINEPRO' THEN 'BHOJPRO'
          ELSE "plan"::text
        END
      )::"Plan";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'PlanHistory'
      AND column_name = 'fromPlan'
  ) THEN
    ALTER TABLE "PlanHistory"
      ALTER COLUMN "fromPlan" TYPE "Plan"
      USING (
        CASE
          WHEN "fromPlan" IS NULL THEN NULL
          WHEN "fromPlan"::text = 'DINEPRO' THEN 'BHOJPRO'
          ELSE "fromPlan"::text
        END
      )::"Plan";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'PlanHistory'
      AND column_name = 'toPlan'
  ) THEN
    ALTER TABLE "PlanHistory"
      ALTER COLUMN "toPlan" TYPE "Plan"
      USING (
        CASE
          WHEN "toPlan"::text = 'DINEPRO' THEN 'BHOJPRO'
          ELSE "toPlan"::text
        END
      )::"Plan";
  END IF;

  DROP TYPE "Plan_legacy_20260425";
END $$;
