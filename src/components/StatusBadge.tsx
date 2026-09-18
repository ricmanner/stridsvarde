import { type Status, statusTextColor, statusBg, statusLabel } from '@/lib/data';

interface Props {
  status: Status;
  size?: 'sm' | 'md';
}

/**
 * Märkena har fast bredd, trots att "GRÖN" är längre än "GUL" och "RÖD".
 *
 * Utan den hoppade allt till vänster om märket i sidled mellan raderna: i
 * listan över dagens kategorier stod siffrorna inte under varandra, utan
 * förflyttade sig beroende på vilken färg raden hade. Nu ligger de i en rak
 * kolumn och går att jämföra med ögat.
 */
export default function StatusBadge({ status, size = 'md' }: Props) {
  const fontSize = size === 'sm' ? 10 : 11;
  const padding = size === 'sm' ? '2px 6px' : '3px 8px';
  const minWidth = size === 'sm' ? 48 : 56;

  return (
    <span style={{
      background: statusBg(status),
      color: statusTextColor(status),
      fontSize,
      fontWeight: 700,
      letterSpacing: '0.06em',
      padding,
      borderRadius: 3,
      display: 'inline-block',
      minWidth,
      textAlign: 'center',
      boxSizing: 'border-box',
    }}>
      {statusLabel(status)}
    </span>
  );
}
