import { Badge } from '#/components/ui/badge';

const statusConfig = {
  UPCOMING: { label: 'Kommende', variant: 'secondary' as const },
  ONGOING: { label: 'Pågående', variant: 'default' as const },
  ENDED: { label: 'Avsluttet', variant: 'outline' as const },
} as const;

export default function StatusBadge({ status }: { status: 'UPCOMING' | 'ONGOING' | 'ENDED' }) {
  const config = statusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
