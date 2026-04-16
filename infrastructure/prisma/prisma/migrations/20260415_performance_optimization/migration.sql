-- Performance Optimization: Adding History Board Index
-- This is a manual migration to bypass shadow DB drift.

CREATE INDEX "Order_history_board_idx" ON "Order"("tenantId", "status", "createdAt" DESC);
