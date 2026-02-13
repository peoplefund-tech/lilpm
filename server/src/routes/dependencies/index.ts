
import type { FastifyPluginAsync } from 'fastify';
import { eq, and, or, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { issueDependencies, issues } from '../../db/schema.js';
import { requireAuth } from '../../plugins/auth.js';

export const dependencyRoutes: FastifyPluginAsync = async (fastify) => {
    // ── GET /:teamId/dependencies — List all dependencies for a team ────────────────
    fastify.get<{ Params: { teamId: string } }>(
        '/:teamId/dependencies',
        { preHandler: [requireAuth] },
        async (request) => {
            const { teamId } = request.params;

            // Find all issues in the team
            const teamIssues = await db
                .select({ id: issues.id })
                .from(issues)
                .where(eq(issues.teamId, teamId));

            const issueIds = teamIssues.map((i) => i.id);

            if (issueIds.length === 0) {
                return [];
            }

            // Find dependencies where source or target is in the team
            // (This assumes we want dependencies *within* the team, or involving team issues)
            const deps = await db
                .select()
                .from(issueDependencies)
                .where(
                    or(
                        inArray(issueDependencies.issueId, issueIds),
                        inArray(issueDependencies.dependsOnId, issueIds)
                    )
                );

            // Transform to match expected frontend format
            // Frontend expects: { id, source_issue_id, target_issue_id, created_at }
            // DB has: { id, issueId, dependsOnId, ... }
            // Drizzle usually returns camelCase if defined that way, or snake_case if raw.
            // Based on schema.ts: issueId, dependsOnId maps to issue_id, depends_on_id columns.
            // The return type should probably match what the frontend expects.
            // Let's check store.ts mapping:
            // .map((d: any) => ({
            //   id: d.id,
            //   sourceIssueId: d.source_issue_id,
            //   targetIssueId: d.target_issue_id,
            //   createdAt: d.created_at,
            // }))

            // So frontend expects snake_case for properties in the response object
            return deps.map(d => ({
                id: d.id,
                source_issue_id: d.issueId,
                target_issue_id: d.dependsOnId,
                created_at: d.createdAt,
                dependency_type: d.dependencyType,
            }));
        }
    );

    // ── POST /issues/:issueId/dependencies — Create dependency ──────────────────────
    fastify.post<{ Params: { issueId: string }; Body: { depends_on_id: string } }>(
        '/issues/:issueId/dependencies',
        { preHandler: [requireAuth] },
        async (request, reply) => {
            const { issueId } = request.params;
            const { depends_on_id } = request.body;

            if (!depends_on_id) {
                return reply.status(400).send({ error: 'depends_on_id is required' });
            }

            // Check if already exists
            const existing = await db
                .select()
                .from(issueDependencies)
                .where(
                    and(
                        eq(issueDependencies.issueId, issueId),
                        eq(issueDependencies.dependsOnId, depends_on_id)
                    )
                )
                .limit(1);

            if (existing.length > 0) {
                return existing[0];
            }

            const [newDep] = await db
                .insert(issueDependencies)
                .values({
                    issueId,
                    dependsOnId: depends_on_id,
                    createdBy: request.userId,
                })
                .returning();

            return {
                id: newDep.id,
                source_issue_id: newDep.issueId,
                target_issue_id: newDep.dependsOnId,
                created_at: newDep.createdAt,
                dependency_type: newDep.dependencyType,
            };
        }
    );

    // ── DELETE /issues/:issueId/dependencies/:targetIssueId — Delete dependency ─────
    fastify.delete<{ Params: { issueId: string; targetIssueId: string } }>(
        '/issues/:issueId/dependencies/:targetIssueId',
        { preHandler: [requireAuth] },
        async (request) => {
            const { issueId, targetIssueId } = request.params;

            await db
                .delete(issueDependencies)
                .where(
                    and(
                        eq(issueDependencies.issueId, issueId),
                        eq(issueDependencies.dependsOnId, targetIssueId)
                    )
                );

            return { success: true };
        }
    );
};
