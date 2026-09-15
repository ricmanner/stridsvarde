import { type Status, statusColor, statusBg, statusLabel } from '@/lib/data';

interface Props {
  status: Status;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: Props) {
  const fontSize = size === 'sm' ? 10 : 11;
  const padding = size === 'sm' ? '2px 6px' : '3px 8px';

  return (
    <span style={{
      background: statusBg(status),
      color: statusColor(status),
      fontSize,
      fontWeight: 700,
      letterSpacing: '0.06em',
      padding,
      borderRadius: 3,
      display: 'inline-block',
    }}>
      {statusLabel(status)}
    </span>
  );
}
