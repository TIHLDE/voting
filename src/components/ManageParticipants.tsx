import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getParticipants,
    addParticipants,
    updateParticipant,
    deleteParticipants,
} from '#/server/participants.ts';
import { Button } from '#/components/ui/button';
import { Input } from '#/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '#/components/ui/select';
import { Switch } from '#/components/ui/switch';
import { Checkbox } from '#/components/ui/checkbox';
import { Textarea } from '#/components/ui/textarea';

const ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Admin',
    COUNTER: 'Teller',
    PARTICIPANT: 'Deltaker',
};

export interface ParticipantInput {
    email: string;
    role: 'ADMIN' | 'COUNTER' | 'PARTICIPANT';
    isVotingEligible: boolean;
}

interface ManageParticipantsProps {
    meetingId?: string;
    participants?: ParticipantInput[];
    onChange?: (participants: ParticipantInput[]) => void;
}

export default function ManageParticipants({
    meetingId,
    participants: localParticipants,
    onChange,
}: ManageParticipantsProps) {
    const isLocal = !meetingId;
    const [newEmail, setNewEmail] = useState('');
    const [newRole, setNewRole] = useState<'ADMIN' | 'COUNTER' | 'PARTICIPANT'>(
        'PARTICIPANT',
    );
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [csvText, setCsvText] = useState('');
    const [csvErrors, setCsvErrors] = useState<string[]>([]);
    const queryClient = useQueryClient();

    const { data } = useQuery({
        queryKey: ['participants', meetingId],
        queryFn: () => getParticipants({ data: { meetingId: meetingId! } }),
        enabled: !!meetingId,
    });

    const addMutation = useMutation({
        mutationFn: (participants: ParticipantInput[]) =>
            addParticipants({
                data: { meetingId: meetingId!, participants },
            }),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ['participants', meetingId],
            });
        },
    });

    const updateMutation = useMutation({
        mutationFn: (params: {
            participantId: string;
            role?: 'ADMIN' | 'COUNTER' | 'PARTICIPANT';
            isVotingEligible?: boolean;
        }) =>
            updateParticipant({
                data: { meetingId: meetingId!, ...params },
            }),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ['participants', meetingId],
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: () =>
            deleteParticipants({
                data: {
                    meetingId: meetingId!,
                    participantIds: Array.from(selected),
                },
            }),
        onSuccess: () => {
            setSelected(new Set());
            void queryClient.invalidateQueries({
                queryKey: ['participants', meetingId],
            });
        },
    });

    function handleAddParticipant() {
        if (!newEmail) return;

        const p: ParticipantInput = {
            email: newEmail,
            role: newRole,
            isVotingEligible: true,
        };

        if (isLocal) {
            onChange?.([...(localParticipants ?? []), p]);
        } else {
            addMutation.mutate([p]);
        }

        setNewEmail('');
    }

    function handleCSVUpload() {
        const lines = csvText.trim().split('\n');
        const parsed: ParticipantInput[] = [];
        const errors: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const parts = lines[i].split(',').map((s) => s.trim());
            if (parts.length < 1) continue;

            const email = parts[0];
            if (!email.includes('@')) {
                errors.push(`Linje ${i + 1}: Ugyldig e-post "${email}"`);
                continue;
            }

            const roleStr = (parts[1] || 'PARTICIPANT').toUpperCase();
            if (!['ADMIN', 'COUNTER', 'PARTICIPANT'].includes(roleStr)) {
                errors.push(`Linje ${i + 1}: Ugyldig rolle "${parts[1]}"`);
                continue;
            }

            parsed.push({
                email,
                role: roleStr as 'ADMIN' | 'COUNTER' | 'PARTICIPANT',
                isVotingEligible: true,
            });
        }

        setCsvErrors(errors);

        if (parsed.length > 0) {
            if (isLocal) {
                onChange?.([...(localParticipants ?? []), ...parsed]);
            } else {
                addMutation.mutate(parsed);
            }
            setCsvText('');
        }
    }

    const displayParticipants = isLocal
        ? (localParticipants ?? []).map((p, i) => ({
              id: String(i),
              email: p.email,
              name: undefined as string | undefined,
              role: p.role,
              isVotingEligible: p.isVotingEligible,
              isParticipant: false,
              isOwner: false,
          }))
        : [
              ...(data?.participants ?? []).map((p) => ({
                  id: p.id,
                  email: p.user.email,
                  name: p.user.name as string | undefined,
                  role: p.role,
                  isVotingEligible: p.isVotingEligible,
                  isParticipant: true,
                  isOwner: p.userId === data?.ownerId,
              })),
              ...(data?.invites ?? []).map((inv) => ({
                  id: `invite-${inv.email}`,
                  email: inv.email,
                  name: undefined as string | undefined,
                  role: inv.role,
                  isVotingEligible: inv.isVotingEligible,
                  isParticipant: false,
                  isOwner: false,
              })),
          ];

    const filtered = search
        ? displayParticipants.filter((p) => {
              const term = search.toLowerCase();
              const name = p.name ? p.name.toLowerCase() : '';
              return (
                  name.includes(term) || p.email.toLowerCase().includes(term)
              );
          })
        : displayParticipants;

    return (
        <div className="space-y-6">
            <div>
                <h3 className="mb-3 text-lg font-semibold text-foreground">
                    Legg til deltaker
                </h3>
                <div className="flex gap-2">
                    <Input
                        placeholder="E-postadresse"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        type="email"
                        className="flex-1"
                    />
                    <Select
                        value={newRole}
                        onValueChange={(v) =>
                            setNewRole(v as 'ADMIN' | 'COUNTER' | 'PARTICIPANT')
                        }
                    >
                        <SelectTrigger className="w-40">
                            <SelectValue>{ROLE_LABELS[newRole]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ADMIN">Admin</SelectItem>
                            <SelectItem value="COUNTER">Teller</SelectItem>
                            <SelectItem value="PARTICIPANT">
                                Deltaker
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <Button type="button" onClick={handleAddParticipant}>
                        Legg til
                    </Button>
                </div>
            </div>

            <div>
                <h3 className="mb-3 text-lg font-semibold text-foreground">
                    Last opp CSV
                </h3>
                <Textarea
                    rows={4}
                    placeholder="epost@eksempel.no, PARTICIPANT&#10;epost2@eksempel.no, ADMIN"
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                />
                {csvErrors.length > 0 && (
                    <div className="mt-2 space-y-1">
                        {csvErrors.map((err) => (
                            <p key={err} className="text-sm text-destructive">
                                {err}
                            </p>
                        ))}
                    </div>
                )}
                <Button
                    type="button"
                    variant="outline"
                    className="mt-2"
                    onClick={handleCSVUpload}
                    disabled={!csvText.trim()}
                >
                    Last opp
                </Button>
            </div>

            <div>
                <div className="mb-3 flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-foreground">
                        Deltakere ({displayParticipants.length})
                    </h3>
                    <Input
                        placeholder="Sok..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="max-w-xs"
                    />
                    {selected.size > 0 && !isLocal && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteMutation.mutate()}
                        >
                            Slett valgte ({selected.size})
                        </Button>
                    )}
                </div>

                <div className="space-y-2">
                    {filtered.map((p) => (
                        <div
                            key={p.id}
                            className="flex items-center gap-3 rounded-lg border bg-card p-3"
                        >
                            {!isLocal && (
                                <Checkbox
                                    checked={selected.has(p.id)}
                                    onCheckedChange={(checked) => {
                                        const next = new Set(selected);
                                        if (checked) next.add(p.id);
                                        else next.delete(p.id);
                                        setSelected(next);
                                    }}
                                />
                            )}
                            <div className="flex-1">
                                <p className="text-sm font-medium text-foreground">
                                    {p.name ?? p.email}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {p.email}
                                </p>
                                {!p.isParticipant && (
                                    <span className="text-xs text-muted-foreground">
                                        Invitert
                                    </span>
                                )}
                            </div>
                            {!isLocal && p.isParticipant ? (
                                <>
                                    {p.isOwner ? (
                                        <span className="text-xs font-medium text-muted-foreground">
                                            {ROLE_LABELS[p.role]}
                                        </span>
                                    ) : (
                                        <Select
                                            value={p.role}
                                            onValueChange={(role) =>
                                                updateMutation.mutate({
                                                    participantId: p.id,
                                                    role: role as
                                                        | 'ADMIN'
                                                        | 'COUNTER'
                                                        | 'PARTICIPANT',
                                                })
                                            }
                                        >
                                            <SelectTrigger className="w-32">
                                                <SelectValue>
                                                    {ROLE_LABELS[p.role]}
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ADMIN">
                                                    Admin
                                                </SelectItem>
                                                <SelectItem value="COUNTER">
                                                    Teller
                                                </SelectItem>
                                                <SelectItem value="PARTICIPANT">
                                                    Deltaker
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <Switch
                                            checked={p.isVotingEligible}
                                            onCheckedChange={(checked) =>
                                                updateMutation.mutate({
                                                    participantId: p.id,
                                                    isVotingEligible: checked,
                                                })
                                            }
                                        />
                                        <span className="text-xs text-muted-foreground">
                                            Stemmerett
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <span className="text-xs font-medium text-muted-foreground">
                                    {p.role === 'ADMIN'
                                        ? 'Admin'
                                        : p.role === 'COUNTER'
                                          ? 'Teller'
                                          : 'Deltaker'}
                                </span>
                            )}
                        </div>
                    ))}
                    {filtered.length === 0 && (
                        <p className="py-4 text-center text-sm text-muted-foreground">
                            Ingen deltakere enna.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
