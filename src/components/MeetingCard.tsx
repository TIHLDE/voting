import { Link } from '@tanstack/react-router';
import StatusBadge from './StatusBadge';
import { Badge } from '#/components/ui/badge';

interface MeetingCardProps {
  id: string;
  title: string;
  organization: string;
  startTime: Date;
  status: 'UPCOMING' | 'ONGOING' | 'ENDED';
  myRole: string;
  isOwner: boolean;
}

export default function MeetingCard({ id, title, organization, startTime, status, myRole, isOwner }: MeetingCardProps) {
  return (
    <Link
      to="/meetings/$meetingId"
      params={{ meetingId: id }}
      className="block rounded-xl border bg-card p-5 no-underline shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
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
      <h3 className="mb-1 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mb-1 text-sm text-muted-foreground">{organization}</p>
      <p className="text-xs text-muted-foreground">
        {new Date(startTime).toLocaleDateString('nb-NO', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>
    </Link>
  );
}
