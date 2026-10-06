import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    addParticipant,
    updateParticipant,
    deleteParticipants,
    bulkUpdateVotingEligibility,
    transferOwnership,
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
import ConfirmDialog from '#/components/ConfirmDialog';
import { meetingQuery, participantsQuery } from '#/queries/live';
import { toast } from 'sonner';

const ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Admin',
    COUNTER: 'Teller',
    PARTICIPANT: 'Deltaker',
};

type Role = 'ADMIN' | 'COUNTER' | 'PARTICIPANT';

interface ManageParticipantsProps {
    meetingId: string;
    isAdmin: boolean;
    isOwner: boolean;
}

export default function ManageParticipants({
    meetingId,
    isAdmin,
    isOwner,
}: ManageParticipantsProps) {
    const [newEmail, setNewEmail] = useState('');
    const [newRole, setNewRole] = useState<Role>('PARTICIPANT');
    const [transferTarget, setTransferTarget] =
        useState<DisplayParticipant | null>(null);
    const [confirmTransfer, setConfirmTransfer] = useState(false);
    const queryClient = useQueryClient();

    const { data } = useQuery(participantsQuery(meetingId));

    const addMutation = useMutation({
        mutationFn: (email: string) =>
            addParticipant({
                data: {
                    meetingId,
                    email,
                    role: newRole,
                    isVotingEligible: true,
                },
            }),
        onSuccess: () => {
            setNewEmail('');
            void queryClient.invalidateQueries(participantsQuery(meetingId));
        },
    });

    const updateMutation = useMutation({
        mutationFn: (params: {
            participantId: string;
            role?: Role;
            isVotingEligible?: boolean;
        }) =>
            updateParticipant({
                data: { meetingId, ...params },
            }),
        onSuccess: () => {
            void queryClient.invalidateQueries(participantsQuery(meetingId));
        },
        onError: (error) =>
            toast.error(error.message || 'Kunne ikke oppdatere deltaker'),
    });

    const transferMutation = useMutation({
        mutationFn: (participantId: string) =>
            transferOwnership({ data: { meetingId, participantId } }),
        onSuccess: () => {
            void queryClient.invalidateQueries(participantsQuery(meetingId));
            void queryClient.invalidateQueries(meetingQuery(meetingId));
        },
        onError: (error) =>
            toast.error(error.message || 'Kunne ikke overføre eierskap'),
    });

    const displayParticipants: DisplayParticipant[] = [
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
            name: undefined,
            role: inv.role,
            isVotingEligible: inv.isVotingEligible,
            isParticipant: false,
            isOwner: false,
        })),
    ];

    return (
        <div className="space-y-6">
            {isAdmin && (
                <AddParticipantSection
                    email={newEmail}
                    role={newRole}
                    onEmailChange={setNewEmail}
                    onRoleChange={setNewRole}
                    onAdd={() => {
                        if (newEmail) addMutation.mutate(newEmail);
                    }}
                    isAdding={addMutation.isPending}
                    error={addMutation.error?.message}
                />
            )}
            <ParticipantDirectory
                participants={displayParticipants}
                meetingId={meetingId}
                canEditRoles={isAdmin}
                onUpdate={updateMutation.mutate}
                onTransferOwnership={
                    isOwner && !transferMutation.isPending
                        ? (participant) => {
                              setTransferTarget(participant);
                              setConfirmTransfer(true);
                          }
                        : undefined
                }
            />
            <ConfirmDialog
                open={confirmTransfer}
                onOpenChange={setConfirmTransfer}
                title="Overføre eierskap?"
                description={
                    <>
                        {transferTarget?.name ?? transferTarget?.email} blir
                        eier av møtet. Du mister muligheten til å slette møtet
                        og overføre eierskapet, og kan ikke angre dette selv.
                    </>
                }
                confirmLabel="Overfør eierskap"
                actionVariant="destructive"
                onConfirm={() => {
                    if (transferTarget)
                        transferMutation.mutate(transferTarget.id);
                }}
            />
        </div>
    );
}

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
    canEditRoles,
    onUpdate,
    onTransferOwnership,
}: {
    participants: DisplayParticipant[];
    meetingId: string;
    canEditRoles: boolean;
    onUpdate: (params: {
        participantId: string;
        role?: Role;
        isVotingEligible?: boolean;
    }) => void;
    onTransferOwnership?: (participant: DisplayParticipant) => void;
}) {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<ParticipantFilter>('all');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [confirmDelete, setConfirmDelete] = useState(false);

    const deleteMutation = useMutation({
        mutationFn: (selection: DisplayParticipant[]) =>
            deleteParticipants({
                data: {
                    meetingId,
                    participantIds: selection
                        .filter((item) => item.isParticipant)
                        .map((item) => item.id),
                    inviteEmails: selection
                        .filter((item) => !item.isParticipant)
                        .map((item) => item.email),
                },
            }),
        onSuccess: () => {
            setSelected(new Set());
            void queryClient.invalidateQueries(participantsQuery(meetingId));
        },
        onError: (error) =>
            toast.error(error.message || 'Kunne ikke fjerne deltakere'),
    });
    const bulkVotingMutation = useMutation({
        mutationFn: (params: {
            participantIds: string[];
            isVotingEligible: boolean;
        }) =>
            bulkUpdateVotingEligibility({
                data: { meetingId, ...params },
            }),
        onSuccess: () => {
            setSelected(new Set());
            void queryClient.invalidateQueries(participantsQuery(meetingId));
        },
        onError: (error) =>
            toast.error(error.message || 'Kunne ikke oppdatere stemmerett'),
    });

    const staff = participants.filter(
        (participant) => participant.role !== 'PARTICIPANT',
    );
    const members = participants.filter(
        (participant) => participant.role === 'PARTICIPANT',
    );
    // Ignore selections of people who have since become admin or counter.
    const selection = members.filter((participant) =>
        selected.has(participant.id),
    );
    // Invites have no participant row, so voting eligibility can't be bulk
    // edited for them.
    const selectedParticipantIds = selection
        .filter((participant) => participant.isParticipant)
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
                            canEditRoles={canEditRoles}
                            onUpdate={onUpdate}
                            onTransferOwnership={onTransferOwnership}
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
                <BulkParticipantActions
                    filtered={filtered}
                    selected={selected}
                    selectedCount={selection.length}
                    eligibilityCount={selectedParticipantIds.length}
                    pending={
                        deleteMutation.isPending || bulkVotingMutation.isPending
                    }
                    onSelectedChange={setSelected}
                    onSetVotingEligibility={(isVotingEligible) =>
                        bulkVotingMutation.mutate({
                            participantIds: selectedParticipantIds,
                            isVotingEligible,
                        })
                    }
                    onDelete={() => setConfirmDelete(true)}
                />
                <ConfirmDialog
                    open={confirmDelete}
                    onOpenChange={setConfirmDelete}
                    title="Fjerne fra møtet?"
                    description={
                        <>
                            {selection.length === 1
                                ? `${selection[0].name ?? selection[0].email} blir fjernet fra møtet.`
                                : `${selection.length} deltakere blir fjernet fra møtet.`}{' '}
                            Stemmer som allerede er avgitt blir ikke berørt.
                        </>
                    }
                    confirmLabel="Fjern"
                    actionVariant="destructive"
                    onConfirm={() => deleteMutation.mutate(selection)}
                />
                <div className="space-y-2">
                    {filtered.map((participant) => (
                        <ParticipantRow
                            key={participant.id}
                            participant={participant}
                            canEditRoles={canEditRoles}
                            selectable
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
    eligibilityCount,
    pending,
    onSelectedChange,
    onSetVotingEligibility,
    onDelete,
}: {
    filtered: DisplayParticipant[];
    selected: Set<string>;
    selectedCount: number;
    eligibilityCount: number;
    pending: boolean;
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
                    {eligibilityCount > 0 && (
                        <>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onSetVotingEligibility(true)}
                                disabled={pending}
                            >
                                Gi stemmerett ({eligibilityCount})
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onSetVotingEligibility(false)}
                                disabled={pending}
                            >
                                Fjern stemmerett ({eligibilityCount})
                            </Button>
                        </>
                    )}
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={onDelete}
                        disabled={pending}
                    >
                        Fjern fra møtet ({selectedCount})
                    </Button>
                </>
            )}
        </div>
    );
}

function ParticipantRow({
    participant,
    canEditRoles,
    selectable = false,
    selected = false,
    onSelectedChange,
    onUpdate,
    onTransferOwnership,
}: {
    participant: DisplayParticipant;
    canEditRoles: boolean;
    selectable?: boolean;
    selected?: boolean;
    onSelectedChange?: (checked: boolean) => void;
    onUpdate: (params: {
        participantId: string;
        role?: Role;
        isVotingEligible?: boolean;
    }) => void;
    onTransferOwnership?: (participant: DisplayParticipant) => void;
}) {
    return (
        <div className="flex items-center gap-3 rounded-lg border border-card-border bg-card p-3">
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
            {participant.isParticipant &&
                !participant.isOwner &&
                participant.role === 'ADMIN' &&
                onTransferOwnership && (
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onTransferOwnership(participant)}
                    >
                        Gjør til eier
                    </Button>
                )}
            {participant.isParticipant &&
            !participant.isOwner &&
            canEditRoles ? (
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
            ) : (
                <span className="text-xs font-medium text-muted-foreground">
                    {participant.isOwner
                        ? 'Eier'
                        : ROLE_LABELS[participant.role]}
                </span>
            )}
            {participant.isParticipant && (
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
            )}
        </div>
    );
}
