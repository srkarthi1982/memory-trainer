import { defineDb } from "astro:db";
import {
  MemoryGames,
  MemorySessions,
  MemoryRounds,
  MemoryPerformance,
} from "./tables";

export default defineDb({
  tables: {
    MemoryGames,
    MemorySessions,
    MemoryRounds,
    MemoryPerformance,
  },
});
