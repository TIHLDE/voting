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

export const STATUS_LABELS: Record<string, string> = {
    OPEN: 'Åpen',
    CHECKING_RESULT: 'Kontrolleres',
    PUBLISHED_RESULT: 'Publisert',
    INVALID: 'Ugyldig',
};

export function createEmptyVotation(): VotationFormData {
    return {
        id: crypto.randomUUID(),
        title: '',
        type: 'SIMPLE',
        blankVotes: false,
        hiddenVotes: false,
        numberOfWinners: 1,
        majorityThreshold: 50,
        alternatives: [],
    };
}
