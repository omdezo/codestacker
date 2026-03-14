-- B-tree index for ORDER BY "createdAt" DESC (cursor pagination + sorting)
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt" DESC);

-- B-tree indexes for actorId and targetId filter queries
CREATE INDEX "audit_logs_actorId_idx"  ON "audit_logs"("actorId");
CREATE INDEX "audit_logs_targetId_idx" ON "audit_logs"("targetId");
