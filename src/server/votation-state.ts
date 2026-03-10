type VotationStatus =
    | 'UPCOMING'
    | 'OPEN'
    | 'CHECKING_RESULT'
    | 'PUBLISHED_RESULT'
    | 'INVALID';

const validTransitions: Record<VotationStatus, VotationStatus[]> = {
    UPCOMING: ['OPEN'],
    OPEN: ['CHECKING_RESULT', 'INVALID'],
    CHECKING_RESULT: ['PUBLISHED_RESULT', 'INVALID'],
    PUBLISHED_RESULT: [],
    INVALID: [],
};

export function validateStatusTransition(
    current: VotationStatus,
    next: VotationStatus,
): boolean {
    return validTransitions[current].includes(next);
}
