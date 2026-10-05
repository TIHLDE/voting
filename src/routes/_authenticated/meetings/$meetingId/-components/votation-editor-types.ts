import type { getVotationsForMeeting } from '#/server/votations';

export interface VotationAlternativeFormData {
    id: string;
    text: string;
    index: number;
}

export interface VotationFormData {
    id: string;
    title: string;
    description?: string;
    type: 'SIMPLE' | 'QUALIFIED' | 'STV';
    blankVotes: boolean;
    hiddenVotes: boolean;
    numberOfWinners: number;
    majorityThreshold: number;
    alternatives: VotationAlternativeFormData[];
}

export const TYPE_LABELS: Record<VotationFormData['type'], string> = {
    SIMPLE: 'Simpelt flertall',
    QUALIFIED: 'Kvalifisert flertall',
    STV: 'Preferansevalg (STV)',
};

export function createEmptyVotation(): VotationFormData {
    return {
        id: crypto.randomUUID(),
        title: '',
        type: 'SIMPLE',
        blankVotes: true,
        hiddenVotes: true,
        numberOfWinners: 1,
        majorityThreshold: 50,
        alternatives: [],
    };
}

export type ServerVotation = Awaited<
    ReturnType<typeof getVotationsForMeeting>
>[number];

export function toFormData(votation: ServerVotation): VotationFormData {
    return {
        id: votation.id,
        title: votation.title,
        description: votation.description ?? '',
        type: votation.type,
        blankVotes: votation.blankVotes,
        hiddenVotes: votation.hiddenVotes,
        numberOfWinners: votation.numberOfWinners,
        majorityThreshold: votation.majorityThreshold,
        alternatives: votation.alternatives.map((alternative) => ({
            id: alternative.id,
            text: alternative.text,
            index: alternative.index,
        })),
    };
}

export function toServerInput(data: VotationFormData, index: number) {
    return {
        title: data.title,
        description: data.description,
        type: data.type,
        blankVotes: data.blankVotes,
        hiddenVotes: data.hiddenVotes,
        numberOfWinners: data.numberOfWinners,
        majorityThreshold: data.majorityThreshold,
        index,
        alternatives: data.alternatives.map(
            (alternative, alternativeIndex) => ({
                text: alternative.text,
                index: alternativeIndex,
            }),
        ),
    };
}
