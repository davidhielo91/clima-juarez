import { describe, expect, it } from "vitest";
import { TONE_RANK, compareTone, type Tone } from "@/lib/derive/tone";

const ALL_TONES: Tone[] = ["good", "info", "caution", "warn", "danger", "extreme"];

describe("tone", () => {
  it("ordena los tonos de menor a mayor gravedad", () => {
    for (let i = 1; i < ALL_TONES.length; i += 1) {
      expect(TONE_RANK[ALL_TONES[i]]).toBeGreaterThan(TONE_RANK[ALL_TONES[i - 1]]);
      expect(compareTone(ALL_TONES[i], ALL_TONES[i - 1])).toBeGreaterThan(0);
    }
  });

  it("considera iguales dos veces el mismo tono", () => {
    for (const tone of ALL_TONES) expect(compareTone(tone, tone)).toBe(0);
  });
});
