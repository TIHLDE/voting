import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getParticipants,
    addParticipant,
    updateParticipant,
    deleteParticipants,
    bulkUpdateVotingEligibility,
} from '#/server/participants';
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
    const queryClient = useQueryClient();

    const { data } = useQuery({
        queryKey: ['participants', meetingId],
        queryFn: () => getParticipants({ data: { meetingId: meetingId! } }),
        enabled: !!meetingId,
    });

    const addMutation = useMutation({
        mutationFn: (participant: ParticipantInput) =>
            addParticipant({
                data: { meetingId: meetingId!, ...participant },
            }),
        onSuccess: () => {
            setNewEmail('');
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

    function handleAddParticipant() {
        if (!newEmail) return;

        const p: ParticipantInput = {
            email: newEmail,
            role: newRole,
            isVotingEligible: true,
        };

        if (isLocal) {
            onChange?.([...(localParticipants ?? []), p]);
            setNewEmail('');
        } else {
            addMutation.mutate(p);
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
                  name: p.user.name,
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

    return (
        <div className="space-y-6">
            <AddParticipantSection
                email={newEmail}
                role={newRole}
                onEmailChange={setNewEmail}
                onRoleChange={setNewRole}
                onAdd={handleAddParticipant}
                isAdding={addMutation.isPending}
                error={addMutation.error?.message}
            />
            <ParticipantDirectory
                participants={displayParticipants}
                meetingId={meetingId}
                onUpdate={(params) => updateMutation.mutate(params)}
            />
        </div>
    );
}

type Role = ParticipantInput['role'];
type ParticipantFilter = 'all' | 'eligible' | 'not_eligible';
type DisplayParticipant = {
    id: string;
    email: string;
    name?: string;
    role: Role;
    isVotingEligible: boolean;
    isParticipant: boolean;
    isOwner: boolean;
};

function AddParticipantSection({
    email,
    role,
    onEmailChange,
    onRoleChange,
    onAdd,
    isAdding,
    error,
}: {
    email: string;
    role: Role;
    onEmailChange: (email: string) => void;
    onRoleChange: (role: Role) => void;
    onAdd: () => void;
    isAdding: boolean;
    error?: string;
}) {
    return (
        <div>
            <h3 className="mb-3 text-lg font-semibold text-foreground">
                Legg til deltaker
            </h3>
            <div className="flex gap-2">
                <Input
                    placeholder="E-postadresse"
                    value={email}
                    onChange={(event) => onEmailChange(event.target.value)}
                    type="email"
                    className="flex-1"
                />
                <Select
                    value={role}
                    onValueChange={(value) => onRoleChange(value as Role)}
                >
                    <SelectTrigger className="w-40">
                        <SelectValue>{ROLE_LABELS[role]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="COUNTER">Teller</SelectItem>
                        <SelectItem value="PARTICIPANT">Deltaker</SelectItem>
                    </SelectContent>
                </Select>
                <Button type="button" onClick={onAdd} disabled={isAdding}>
                    Legg til
                </Button>
            </div>
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </div>
    );
}

function ParticipantDirectory({
    participants,
    meetingId,
    onUpdate,
}: {
    participants: DisplayParticipant[];
    meetingId?: string;
    onUpdate: (params: {
        participantId: string;
        role?: Role;
        isVotingEligible?: boolean;
    }) => void;
}) {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<ParticipantFilter>('all');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const isLocal = !meetingId;

    const deleteMutation = useMutation({
        mutationFn: (participantIds: string[]) =>
            deleteParticipants({
                data: {
                    meetingId: meetingId!,
                    participantIds,
                },
            }),
        onSuccess: () => {
            setSelected(new Set());
            void queryClient.invalidateQueries({
                queryKey: ['participants', meetingId],
            });
        },
    });
    const bulkVotingMutation = useMutation({
        mutationFn: (params: {
            participantIds: string[];
            isVotingEligible: boolean;
        }) =>
            bulkUpdateVotingEligibility({
                data: { meetingId: meetingId!, ...params },
            }),
        onSuccess: () => {
            setSelected(new Set());
            void queryClient.invalidateQueries({
                queryKey: ['participants', meetingId],
            });
        },
    });

    const staff = participants.filter(
        (participant) => participant.role !== 'PARTICIPANT',
    );
    const members = participants.filter(
        (participant) => participant.role === 'PARTICIPANT',
    );
    // Ignore selections of people who have since become admin or counter.
    const selectedIds = members
        .filter((participant) => selected.has(participant.id))
        .map((participant) => participant.id);

    const filtered = members.filter((participant) => {
        if (filter === 'eligible' && !participant.isVotingEligible)
            return false;
        if (filter === 'not_eligible' && participant.isVotingEligible)
            return false;
        const term = search.toLowerCase();
        return (
            !term ||
            participant.name?.toLowerCase().includes(term) ||
            participant.email.toLowerCase().includes(term)
        );
    });

    return (
        <div className="space-y-6">
            <div>
                <h3 className="mb-3 text-lg font-semibold text-foreground">
                    Admin og tellere ({staff.length})
                </h3>
                <div className="space-y-2">
                    {staff.map((participant) => (
                        <ParticipantRow
                            key={participant.id}
                            participant={participant}
                            isLocal={isLocal}
                            onUpdate={onUpdate}
                        />
                    ))}
                    {staff.length === 0 && (
                        <p className="py-4 text-center text-sm text-muted-foreground">
                            Ingen admin eller tellere ennå.
                        </p>
                    )}
                </div>
            </div>
            <div>
                <ParticipantFilters
                    count={members.length}
                    search={search}
                    filter={filter}
                    onSearchChange={setSearch}
                    onFilterChange={setFilter}
                />
                {!isLocal && (
                    <BulkParticipantActions
                        filtered={filtered}
                        selected={selected}
                        selectedCount={selectedIds.length}
                        onSelectedChange={setSelected}
                        onSetVotingEligibility={(isVotingEligible) =>
                            bulkVotingMutation.mutate({
                                participantIds: selectedIds,
                                isVotingEligible,
                            })
                        }
                        onDelete={() => deleteMutation.mutate(selectedIds)}
                    />
                )}
                <div className="space-y-2">
                    {filtered.map((participant) => (
                        <ParticipantRow
                            key={participant.id}
                            participant={participant}
                            isLocal={isLocal}
                            selectable={!isLocal}
                            selected={selected.has(participant.id)}
                            onSelectedChange={(checked) => {
                                const next = new Set(selected);
                                if (checked) next.add(participant.id);
                                else next.delete(participant.id);
                                setSelected(next);
                            }}
                            onUpdate={onUpdate}
                        />
                    ))}
                    {filtered.length === 0 && (
                        <p className="py-4 text-center text-sm text-muted-foreground">
                            Ingen deltakere ennå.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

function ParticipantFilters({
    count,
    search,
    filter,
    onSearchChange,
    onFilterChange,
}: {
    count: number;
    search: string;
    filter: ParticipantFilter;
    onSearchChange: (value: string) => void;
    onFilterChange: (value: ParticipantFilter) => void;
}) {
    return (
        <div className="mb-3 space-y-2">
            <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-foreground">
                    Deltakere ({count})
                </h3>
                <Input
                    placeholder="Søk..."
                    value={search}
                    onChange={(event) => onSearchChange(event.target.value)}
                    className="max-w-xs"
                />
            </div>
            <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Filter:</span>
                {(
                    [
                        ['all', 'Alle'],
                        ['eligible', 'Stemmerett'],
                        ['not_eligible', 'Uten stemmerett'],
                    ] as const
                ).map(([value, label]) => (
                    <Button
                        key={value}
                        type="button"
                        size="sm"
                        variant={filter === value ? 'default' : 'outline'}
                        onClick={() => onFilterChange(value)}
                    >
                        {label}
                    </Button>
                ))}
            </div>
        </div>
    );
}

function BulkParticipantActions({
    filtered,
    selected,
    selectedCount,
    onSelectedChange,
    onSetVotingEligibility,
    onDelete,
}: {
    filtered: DisplayParticipant[];
    selected: Set<string>;
    selectedCount: number;
    onSelectedChange: (selected: Set<string>) => void;
    onSetVotingEligibility: (eligible: boolean) => void;
    onDelete: () => void;
}) {
    const allSelected =
        filtered.length > 0 &&
        filtered.every((participant) => selected.has(participant.id));

    return (
        <div className="mb-3 flex items-center gap-2">
            <Checkbox
                checked={allSelected}
                onCheckedChange={(checked) =>
                    onSelectedChange(
                        checked
                            ? new Set(
                                  filtered.map((participant) => participant.id),
                              )
                            : new Set(),
                    )
                }
            />
            <span className="text-xs text-muted-foreground">
                Velg alle ({filtered.length})
            </span>
            {selectedCount > 0 && (
                <>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSetVotingEligibility(true)}
                    >
                        Gi stemmerett ({selectedCount})
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSetVotingEligibility(false)}
                    >
                        Fjern stemmerett ({selectedCount})
                    </Button>
                    <Button variant="destructive" size="sm" onClick={onDelete}>
                        Fjern fra møtet ({selectedCount})
                    </Button>
                </>
            )}
        </div>
    );
}

function ParticipantRow({
    participant,
    isLocal,
    selectable = false,
    selected = false,
    onSelectedChange,
    onUpdate,
}: {
    participant: DisplayParticipant;
    isLocal: boolean;
    selectable?: boolean;
    selected?: boolean;
    onSelectedChange?: (checked: boolean) => void;
    onUpdate: (params: {
        participantId: string;
        role?: Role;
        isVotingEligible?: boolean;
    }) => void;
}) {
    return (
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
            {selectable && (
                <Checkbox
                    checked={selected}
                    onCheckedChange={(checked) =>
                        onSelectedChange?.(checked === true)
                    }
                />
            )}
            <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                    {participant.name ?? participant.email}
                </p>
                <p className="text-xs text-muted-foreground">
                    {participant.email}
                </p>
                {!participant.isParticipant && (
                    <span className="text-xs text-muted-foreground">
                        Invitert
                    </span>
                )}
            </div>
            {!isLocal && participant.isParticipant ? (
                <ParticipantControls
                    participant={participant}
                    onUpdate={onUpdate}
                />
            ) : (
                <span className="text-xs font-medium text-muted-foreground">
                    {ROLE_LABELS[participant.role]}
                </span>
            )}
        </div>
    );
}

function ParticipantControls({
    participant,
    onUpdate,
}: {
    participant: DisplayParticipant;
    onUpdate: (params: {
        participantId: string;
        role?: Role;
        isVotingEligible?: boolean;
    }) => void;
}) {
    return (
        <>
            {participant.isOwner ? (
                <span className="text-xs font-medium text-muted-foreground">
                    Eier
                </span>
            ) : (
                <Select
                    value={participant.role}
                    onValueChange={(role) =>
                        onUpdate({
                            participantId: participant.id,
                            role: role as Role,
                        })
                    }
                >
                    <SelectTrigger className="w-32">
                        <SelectValue>
                            {ROLE_LABELS[participant.role]}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="COUNTER">Teller</SelectItem>
                        <SelectItem value="PARTICIPANT">Deltaker</SelectItem>
                    </SelectContent>
                </Select>
            )}
            <div className="flex items-center gap-2">
                <Switch
                    checked={participant.isVotingEligible}
                    onCheckedChange={(isVotingEligible) =>
                        onUpdate({
                            participantId: participant.id,
                            isVotingEligible,
                        })
                    }
                />
                <span className="text-xs text-muted-foreground">
                    Stemmerett
                </span>
            </div>
        </>
    );
}
