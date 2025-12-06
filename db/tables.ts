import { column, defineTable, NOW } from "astro:db";

/**
 * Types of memory games.
 * Example: "Number Recall", "Pattern Match", "Word Sequence".
 */
export const MemoryGames = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),

    ownerId: column.text({ optional: true }), // system = null

    name: column.text(),
    description: column.text({ optional: true }),

    // "sequence", "pattern", "words", etc.
    gameType: column.text(),

    difficultyLevels: column.json({ optional: true }),

    isActive: column.boolean({ default: true }),

    createdAt: column.date({ default: NOW }),
  },
});

/**
 * User session of a game.
 */
export const MemorySessions = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),

    gameId: column.number({ references: () => MemoryGames.columns.id }),
    userId: column.text(),

    status: column.text({
      enum: ["in_progress", "completed", "abandoned"],
      default: "in_progress",
    }),

    totalScore: column.number({ default: 0 }),
    difficulty: column.text({ optional: true }),

    startedAt: column.date({ default: NOW }),
    endedAt: column.date({ optional: true }),

    meta: column.json({ optional: true }),
  },
});

/**
 * Individual rounds inside a memory game session.
 */
export const MemoryRounds = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),

    sessionId: column.number({
      references: () => MemorySessions.columns.id,
    }),

    roundNumber: column.number({ default: 1 }),

    // The prompt: sequence, pattern, word list, etc.
    prompt: column.json(),

    // The user's attempt
    response: column.json({ optional: true }),

    isCorrect: column.boolean({ default: false }),
    score: column.number({ default: 0 }),

    createdAt: column.date({ default: NOW }),
  },
});

/**
 * Historical performance tracking for adaptive difficulty.
 */
export const MemoryPerformance = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),

    userId: column.text(),
    gameId: column.number({ references: () => MemoryGames.columns.id }),

    // Aggregated stats
    totalSessions: column.number({ default: 0 }),
    averageScore: column.number({ default: 0 }),
    bestScore: column.number({ default: 0 }),

    difficultyPreference: column.text({ optional: true }),

    updatedAt: column.date({ default: NOW }),
  },
});

export const memoryTrainerTables = {
  MemoryGames,
  MemorySessions,
  MemoryRounds,
  MemoryPerformance,
} as const;
