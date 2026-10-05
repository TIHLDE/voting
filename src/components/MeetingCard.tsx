import { Link } from '@tanstack/react-router';
import StatusBadge from './StatusBadge';
import { Badge } from '#/components/ui/badge';

interface MeetingCardProps {
    id: string;
    title: string;
    status: 'UPCOMING' | 'ONGOING' | 'ENDED';
    myRole: string;
    isOwner: boolean;
}

export default function MeetingCard({
    id,
    title,
    status,
    myRole,
    isOwner,
}: MeetingCardProps) {
    return (
        <Link
            to="/meetings/$meetingId"
            params={{ meetingId: id }}
            className="block rounded-xl border border-card-border bg-card p-5 no-underline shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
            <div className="mb-2 flex items-center gap-2">
                <StatusBadge status={status} />
                {myRole === 'ADMIN' && (
                    <Badge variant="secondary" className="text-xs">
                        Admin
                    </Badge>
                )}
                {isOwner && (
                    <Badge variant="outline" className="text-xs">
                        Eier
                    </Badge>
                )}
            </div>
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        </Link>
    );
}
