import { describe, expect, it } from 'vite-plus/test';
import { liveEvents } from './live-events';

describe('live event contracts', () => {
    it('builds scoped channels and validates authoritative payloads', () => {
        const event = liveEvents.votationVotes('votation-1');

        expect(event.channel).toBe('votation:votation-1:votes');
        expect(
            event.schema.safeParse({
                voteCount: 4,
                votingEligibleCount: 10,
            }).success,
        ).toBe(true);
        expect(
            event.schema.safeParse({
                voteCount: '4',
                votingEligibleCount: 10,
            }).success,
        ).toBe(false);
    });

    it('rejects unknown votation statuses', () => {
        const result = liveEvents
            .votationStatus('votation-1')
            .schema.safeParse({
                votationId: 'votation-1',
                votationStatus: 'BROKEN',
            });

        expect(result.success).toBe(false);
    });
});
