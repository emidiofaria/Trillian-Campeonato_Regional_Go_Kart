import { z } from 'zod';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor tem de ser #rrggbb');
/** Lap times are stored in seconds (e.g. 52.341). */
const lapTime = z.number().positive().finite();

export const pilotSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1),
    number: z.number().int().min(1),
    color: hexColor,
    initials: z.string().min(1).max(3),
    /** Optional photo file name in src/assets/pilots/ (e.g. "torres.jpg"). */
    photo: z
      .string()
      .regex(/^[a-z0-9-]+\.(jpe?g|png|webp|avif)$/, 'Foto: nome de ficheiro inválido')
      .optional(),
  })
  .strict();

export const MIN_PILOTS = 2;
export const MAX_PILOTS = 12;
export const pilotsSchema = z.array(pilotSchema).min(MIN_PILOTS).max(MAX_PILOTS);

export const raceStatusSchema = z.enum(['scheduled', 'next', 'completed']);

export const raceSchema = z
  .object({
    id: z.string().regex(/^gp[1-7]$/),
    round: z.number().int().min(1).max(7),
    circuit: z.string().min(1),
    type: z.enum(['Indoor', 'Outdoor']),
    location: z.string().min(1),
    date: z.string().date().optional(),
    timesheetUrl: z.string().url().optional(),
    status: raceStatusSchema,
  })
  .strict();

export const racesSchema = z.array(raceSchema).length(7);

export const resultEntrySchema = z
  .object({
    pilotId: z.string().min(1),
    attended: z.boolean(),
    avgLapTime: lapTime.nullable(),
    bestLap: lapTime.nullable(),
    secondBestLap: lapTime.nullable(),
  })
  .strict()
  .superRefine((e, ctx) => {
    const times = [e.avgLapTime, e.bestLap, e.secondBestLap];
    if (!e.attended) {
      if (times.some((t) => t !== null)) {
        ctx.addIssue({ code: 'custom', message: `${e.pilotId}: ausente não pode ter tempos` });
      }
      return;
    }
    if (times.some((t) => t === null)) {
      ctx.addIssue({
        code: 'custom',
        message: `${e.pilotId}: presente tem de ter tempo médio, melhor volta e 2.ª melhor volta`,
      });
      return;
    }
    const [avg, best, second] = times as number[];
    if (best > second) {
      ctx.addIssue({
        code: 'custom',
        message: `${e.pilotId}: melhor volta (${best}) maior que a 2.ª melhor (${second})`,
      });
    }
    if (best > avg) {
      ctx.addIssue({
        code: 'custom',
        message: `${e.pilotId}: melhor volta (${best}) maior que o tempo médio (${avg})`,
      });
    }
  });

export const raceResultSchema = z
  .object({
    raceId: z.string().min(1),
    /**
     * Registered pilots when the GP was run (defines its points table). Optional: defaults to
     * the number of entries. Keeps past GPs frozen when a pilot joins mid-season.
     */
    pilotCount: z.number().int().min(2).optional(),
    entries: z.array(resultEntrySchema).min(1),
  })
  .strict();

export const resultsSchema = z.array(raceResultSchema);

export type Pilot = z.infer<typeof pilotSchema>;
export type Race = z.infer<typeof raceSchema>;
export type RaceStatus = z.infer<typeof raceStatusSchema>;
export type ResultEntry = z.infer<typeof resultEntrySchema>;
export type RaceResult = z.infer<typeof raceResultSchema>;
