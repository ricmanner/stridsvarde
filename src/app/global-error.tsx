'use client';

/**
 * Sista utvägen: ett fel i själva ramen runt sidan.
 *
 * Måste rendera egna html- och body-element — vid det här laget finns ingen
 * layout kvar att luta sig mot, och därför inga formatmallar heller. Därav
 * inline-stilarna.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="sv">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, background: '#F8FAFC' }}>
        <main style={{ maxWidth: 420, margin: '0 auto', padding: '25vh 24px 0', textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, color: '#0F172A', margin: 0 }}>Något gick fel</h1>
          <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6 }}>
            Appen kunde inte starta sidan. Ingenting du har rapporterat har gått förlorat.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              cursor: 'pointer', border: 0, borderRadius: 6, background: '#0F172A',
              color: 'white', fontSize: 14, fontWeight: 600, padding: '10px 18px',
            }}
          >
            Försök igen
          </button>
        </main>
      </body>
    </html>
  );
}
