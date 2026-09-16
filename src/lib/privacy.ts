/**
 * Integritetstyper för aggregerad data.
 *
 * Ren fil utan serverberoenden — den importeras av både frågelagret och
 * gränssnittet. Tröskelvärdet självt läses bara på servern; förklaringstexten
 * byggs där och följer med i objektet, så att klienten aldrig behöver veta
 * vilken gräns som gäller.
 */

export type SuppressReason = 'too_few_responses' | 'too_few_members' | 'no_data';

export type Guarded<T> =
  | { ok: true; data: T; responders: number; eligible: number }
  | {
      ok: false;
      reason: SuppressReason;
      /** Färdig svensk förklaring till varför siffran inte visas. */
      message: string;
      responders: number;
      eligible: number;
    };

/**
 * Avgör om ett aggregat får visas.
 *
 * Två trösklar, båda nödvändiga:
 *  - för få SVAR → medelvärdet röjer de fåtal som faktiskt svarade
 *  - för få MEDLEMMAR → även 100 % svarsfrekvens röjer varje individ
 *
 * Diskriminerad union på `ok` gör att TypeScript vägrar kompilera en
 * komponent som läser `.data` utan att först kontrollera. Undanhållandet
 * upprätthålls alltså av kompilatorn, inte av att någon kommer ihåg det.
 */
export function guard<T>(
  data: T | null,
  responders: number,
  eligible: number,
  k: number,
): Guarded<T> {
  if (eligible < k) {
    return {
      ok: false,
      reason: 'too_few_members',
      message: `Enheten är för liten för att visa sammanställd data (minst ${k} värnpliktiga krävs).`,
      responders,
      eligible,
    };
  }

  if (responders === 0 || data === null) {
    return {
      ok: false,
      reason: 'no_data',
      message: 'Ingen rapportering för perioden.',
      responders,
      eligible,
    };
  }

  if (responders < k) {
    return {
      ok: false,
      reason: 'too_few_responses',
      message: `Underlag saknas — ${responders} av ${eligible} har rapporterat. Minst ${k} svar krävs för att visa gruppdata.`,
      responders,
      eligible,
    };
  }

  return { ok: true, data, responders, eligible };
}

/**
 * Tillåtna perioder.
 *
 * Fria datumväljare är medvetet bortvalda. Kan ett befäl begära godtyckliga
 * intervall går det att ta ut ett 7-dagarssnitt och ett 6-dagarssnitt för
 * samma enhet och räkna fram en enskild dag ur skillnaden — och därmed
 * kringgå tröskeln ovan. Ett fast fönster som alltid slutar idag stänger
 * den vägen.
 */
export const ALLOWED_PERIODS = [7, 14, 21] as const;
export type Period = (typeof ALLOWED_PERIODS)[number];

export function parsePeriod(raw: unknown): Period {
  const n = Number(raw);
  return (ALLOWED_PERIODS as readonly number[]).includes(n) ? (n as Period) : 7;
}
