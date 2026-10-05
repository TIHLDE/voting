import { Badge } from '#/components/ui/badge';

// Meetings have no start time, so "upcoming" carries no information and
// gets no badge.
const statusConfig = {
    ONGOING: { label: 'Pågående', variant: 'default' as const },
    ENDED: { label: 'Avsluttet', variant: 'outline' as const },
} as const;

export default function StatusBadge({
    status,
}: {
    status: 'UPCOMING' | 'ONGOING' | 'ENDED';
}) {
    if (status === 'UPCOMING') return null;

    const config = statusConfig[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
}
