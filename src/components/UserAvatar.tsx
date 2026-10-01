import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar';

interface UserAvatarProps extends Omit<
    React.ComponentProps<typeof Avatar>,
    'children'
> {
    user: { name?: string | null; image?: string | null };
}

export default function UserAvatar({ user, ...props }: UserAvatarProps) {
    return (
        <Avatar {...props}>
            {user.image && (
                <AvatarImage src={user.image} alt={user.name ?? ''} />
            )}
            <AvatarFallback className="font-medium">
                {user.name?.charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
        </Avatar>
    );
}
