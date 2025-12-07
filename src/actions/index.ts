import type { ActionAPIContext } from "astro:actions";
import { defineAction, ActionError } from "astro:actions";
import { z } from "astro:schema";
import {
  db,
  eq,
  and,
  or,
  MemoryGames,
  MemorySessions,
  MemoryRounds,
  MemoryPerformance,
} from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

export const server = {
  createGame: defineAction({
    input: z.object({
      name: z.string().min(1, "Name is required"),
      description: z.string().optional(),
      gameType: z.string().min(1, "Game type is required"),
      difficultyLevels: z.any().optional(),
      isActive: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [game] = await db
        .insert(MemoryGames)
        .values({
          ownerId: user.id,
          name: input.name,
          description: input.description,
          gameType: input.gameType,
          difficultyLevels: input.difficultyLevels,
          isActive: input.isActive ?? true,
          createdAt: new Date(),
        })
        .returning();

      return { game };
    },
  }),

  updateGame: defineAction({
    input: z.object({
      id: z.number().int(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      gameType: z.string().optional(),
      difficultyLevels: z.any().optional(),
      isActive: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const { id, ...rest } = input;

      const [existing] = await db
        .select()
        .from(MemoryGames)
        .where(and(eq(MemoryGames.id, id), eq(MemoryGames.ownerId, user.id)))
        .limit(1);

      if (!existing) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Game not found.",
        });
      }

      const updateData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (typeof value !== "undefined") {
          updateData[key] = value;
        }
      }

      if (Object.keys(updateData).length === 0) {
        return { game: existing };
      }

      const [game] = await db
        .update(MemoryGames)
        .set(updateData)
        .where(and(eq(MemoryGames.id, id), eq(MemoryGames.ownerId, user.id)))
        .returning();

      return { game };
    },
  }),

  listMyGames: defineAction({
    input: z
      .object({
        includeInactive: z.boolean().optional(),
      })
      .optional(),
    handler: async (input, context) => {
      const user = requireUser(context);
      const includeInactive = input?.includeInactive ?? false;

      const games = await db
        .select()
        .from(MemoryGames)
        .where(eq(MemoryGames.ownerId, user.id));

      const filtered = includeInactive ? games : games.filter((g) => g.isActive);

      return { games: filtered };
    },
  }),

  startSession: defineAction({
    input: z.object({
      gameId: z.number().int(),
      difficulty: z.string().optional(),
      meta: z.any().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [game] = await db
        .select()
        .from(MemoryGames)
        .where(
          and(
            eq(MemoryGames.id, input.gameId),
            or(eq(MemoryGames.ownerId, user.id), eq(MemoryGames.ownerId, null))
          )
        )
        .limit(1);

      if (!game || !game.isActive) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Game not available.",
        });
      }

      const [session] = await db
        .insert(MemorySessions)
        .values({
          gameId: input.gameId,
          userId: user.id,
          difficulty: input.difficulty,
          status: "in_progress",
          startedAt: new Date(),
          meta: input.meta,
        })
        .returning();

      return { session };
    },
  }),

  completeSession: defineAction({
    input: z.object({
      id: z.number().int(),
      totalScore: z.number().int().nonnegative().optional(),
      difficulty: z.string().optional(),
      status: z.enum(["in_progress", "completed", "abandoned"]).optional(),
      meta: z.any().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [session] = await db
        .select()
        .from(MemorySessions)
        .where(and(eq(MemorySessions.id, input.id), eq(MemorySessions.userId, user.id)))
        .limit(1);

      if (!session) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Session not found.",
        });
      }

      const [updated] = await db
        .update(MemorySessions)
        .set({
          totalScore: input.totalScore ?? session.totalScore,
          difficulty: input.difficulty ?? session.difficulty,
          status: input.status ?? "completed",
          endedAt: new Date(),
          meta: input.meta ?? session.meta,
        })
        .where(eq(MemorySessions.id, input.id))
        .returning();

      return { session: updated };
    },
  }),

  recordRound: defineAction({
    input: z.object({
      sessionId: z.number().int(),
      roundNumber: z.number().int().positive().optional(),
      prompt: z.any(),
      response: z.any().optional(),
      isCorrect: z.boolean().optional(),
      score: z.number().int().nonnegative().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [session] = await db
        .select()
        .from(MemorySessions)
        .where(and(eq(MemorySessions.id, input.sessionId), eq(MemorySessions.userId, user.id)))
        .limit(1);

      if (!session) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Session not found.",
        });
      }

      const [round] = await db
        .insert(MemoryRounds)
        .values({
          sessionId: input.sessionId,
          roundNumber: input.roundNumber ?? 1,
          prompt: input.prompt,
          response: input.response,
          isCorrect: input.isCorrect ?? false,
          score: input.score ?? 0,
          createdAt: new Date(),
        })
        .returning();

      return { round };
    },
  }),

  upsertPerformance: defineAction({
    input: z.object({
      gameId: z.number().int(),
      totalSessions: z.number().int().nonnegative().optional(),
      averageScore: z.number().nonnegative().optional(),
      bestScore: z.number().nonnegative().optional(),
      difficultyPreference: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [game] = await db
        .select()
        .from(MemoryGames)
        .where(
          and(
            eq(MemoryGames.id, input.gameId),
            or(eq(MemoryGames.ownerId, user.id), eq(MemoryGames.ownerId, null))
          )
        )
        .limit(1);

      if (!game) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Game not found.",
        });
      }

      const [existing] = await db
        .select()
        .from(MemoryPerformance)
        .where(and(eq(MemoryPerformance.gameId, input.gameId), eq(MemoryPerformance.userId, user.id)))
        .limit(1);

      const baseValues = {
        gameId: input.gameId,
        userId: user.id,
        totalSessions: input.totalSessions ?? existing?.totalSessions ?? 0,
        averageScore: input.averageScore ?? existing?.averageScore ?? 0,
        bestScore: input.bestScore ?? existing?.bestScore ?? 0,
        difficultyPreference: input.difficultyPreference ?? existing?.difficultyPreference,
        updatedAt: new Date(),
      };

      if (existing) {
        const [performance] = await db
          .update(MemoryPerformance)
          .set(baseValues)
          .where(eq(MemoryPerformance.id, existing.id))
          .returning();

        return { performance };
      }

      const [performance] = await db.insert(MemoryPerformance).values(baseValues).returning();
      return { performance };
    },
  }),
};
