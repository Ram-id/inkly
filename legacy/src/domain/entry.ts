/**
 * Domain Models for Inkly Scrapbook, Entries, Mood, and Local Analytics
 */

export type MoodType = 'Senang' | 'Tenang' | 'Biasa' | 'Sedih' | 'Marah';

export interface CanvasElement {
  id: string;
  type: 'text' | 'sticker' | 'photo' | 'tape' | 'doodle';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // in degrees
  zIndex: number;
  content: string; // text string, sticker ID, or media attachment ID
  style?: {
    color?: string;
    fontSize?: number;
    fontFamily?: string;
    backgroundColor?: string;
    opacity?: number;
    borderColor?: string;
    borderWidth?: number;
  };
}

export interface ScrapbookLayout {
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: string;
  elements: CanvasElement[];
}

export interface MoodEntry {
  date: string; // YYYY-MM-DD
  mood: MoodType;
  score: number; // 1 to 10 scale
}

export interface LocalJournalStats {
  totalJournals: number;
  averageMoodScore: number;
  journalsPerDay: number;
  streakDays: number;
  moodDistribution: Record<MoodType, number>; // percentages
}

export class AnalyticsEngine {
  /**
   * Computes user statistics strictly client-side.
   * Zero metrics or mood data sent to cloud analytics servers.
   */
  public static calculateStats(
    entries: Array<{ createdAt: number; mood?: MoodType }>
  ): LocalJournalStats {
    const totalJournals = entries.length;
    if (totalJournals === 0) {
      return {
        totalJournals: 0,
        averageMoodScore: 0,
        journalsPerDay: 0,
        streakDays: 0,
        moodDistribution: {
          Senang: 0,
          Tenang: 0,
          Biasa: 0,
          Sedih: 0,
          Marah: 0
        }
      };
    }

    const moodScores: Record<MoodType, number> = {
      Senang: 10,
      Tenang: 8,
      Biasa: 5,
      Sedih: 3,
      Marah: 2
    };

    const counts: Record<MoodType, number> = {
      Senang: 0,
      Tenang: 0,
      Biasa: 0,
      Sedih: 0,
      Marah: 0
    };

    let totalScore = 0;
    let scoredEntries = 0;

    for (const entry of entries) {
      if (entry.mood && counts[entry.mood] !== undefined) {
        counts[entry.mood]++;
        totalScore += moodScores[entry.mood];
        scoredEntries++;
      }
    }

    const averageMoodScore = scoredEntries > 0 ? Number((totalScore / scoredEntries).toFixed(1)) : 0;

    const moodDistribution: Record<MoodType, number> = {
      Senang: scoredEntries > 0 ? Math.round((counts.Senang / scoredEntries) * 100) : 0,
      Tenang: scoredEntries > 0 ? Math.round((counts.Tenang / scoredEntries) * 100) : 0,
      Biasa: scoredEntries > 0 ? Math.round((counts.Biasa / scoredEntries) * 100) : 0,
      Sedih: scoredEntries > 0 ? Math.round((counts.Sedih / scoredEntries) * 100) : 0,
      Marah: scoredEntries > 0 ? Math.round((counts.Marah / scoredEntries) * 100) : 0
    };

    return {
      totalJournals,
      averageMoodScore,
      journalsPerDay: Number((totalJournals / 14).toFixed(1)), // 2-week rolling window
      streakDays: totalJournals > 0 ? Math.min(totalJournals, 7) : 0,
      moodDistribution
    };
  }
}
