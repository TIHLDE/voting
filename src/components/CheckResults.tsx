import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { getVotationResults } from '#/server/results.ts';
import { reviewVotation, getMyReview, updateVotationStatus } from '#/server/voting.ts';
import { Button } from '#/components/ui/button';
import { useWsSubscription } from '#/hooks/useWsSubscription';

interface CheckResultsProps {
  votationId: string;
  meetingId: string;
  isAdmin: boolean;
}

export default function CheckResults({ votationId, isAdmin }: CheckResultsProps) {
  const queryClient = useQueryClient();
  const [reviewCounts, setReviewCounts] = useState({
    approved: 0,
    disapproved: 0,
  });

  const { data: results } = useQuery({
    queryKey: ['results', votationId],
    queryFn: () => getVotationResults({ data: { votationId } }),
  });

  const { data: myReview } = useQuery({
    queryKey: ['myReview', votationId],
    queryFn: () => getMyReview({ data: { votationId } }),
  });

  useWsSubscription(`votation:${votationId}:reviews`, {
    onMessage: (data) => setReviewCounts(data as { approved: number; disapproved: number }),
  });

  const reviewMutation = useMutation({
    mutationFn: (approved: boolean) => reviewVotation({ data: { votationId, approved } }),
    onSuccess: (data) => {
      setReviewCounts(data);
      void queryClient.invalidateQueries({
        queryKey: ['myReview', votationId],
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: () =>
      updateVotationStatus({
        data: { votationId, status: 'PUBLISHED_RESULT' },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['votation', votationId],
      });
    },
  });

  const invalidateMutation = useMutation({
    mutationFn: () =>
      updateVotationStatus({
        data: { votationId, status: 'INVALID' },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['votation', votationId],
      });
    },
  });

  if (!results) {
    return <p className="text-center text-muted-foreground">Resultater kontrolleres...</p>;
  }

  const { result, alternatives } = results;
  const winners = alternatives.filter((a) => a.isWinner);
  const totalVotes = alternatives.reduce((sum, a) => sum + a.voteCount, 0);

  return (
    <div className="space-y-6">
      {winners.length > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
          <p className="text-sm font-semibold text-green-700 dark:text-green-300">
            Vinner: {winners.map((w) => w.text).join(', ')}
          </p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2 text-left font-semibold">Alternativ</th>
              <th className="p-2 text-right font-semibold">Stemmer</th>
              <th className="p-2 text-right font-semibold">% av totalt</th>
              <th className="p-2 text-right font-semibold">% av stemmeberettigede</th>
            </tr>
          </thead>
          <tbody>
            {alternatives.map((alt) => (
              <tr
                key={alt.id}
                className={`border-b ${alt.isWinner ? 'font-semibold text-green-700 dark:text-green-400' : ''}`}
              >
                <td className="p-2">{alt.text}</td>
                <td className="p-2 text-right">{alt.voteCount}</td>
                <td className="p-2 text-right">
                  {totalVotes > 0 ? ((alt.voteCount / totalVotes) * 100).toFixed(1) : '0.0'}%
                </td>
                <td className="p-2 text-right">
                  {result && result.votingEligibleCount > 0
                    ? ((alt.voteCount / result.votingEligibleCount) * 100).toFixed(1)
                    : '0.0'}
                  %
                </td>
              </tr>
            ))}
            {result?.blankVoteCount != null && result.blankVoteCount > 0 && (
              <tr className="border-b italic">
                <td className="p-2">Blanke stemmer</td>
                <td className="p-2 text-right">{result.blankVoteCount}</td>
                <td className="p-2 text-right" colSpan={2} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <p className="mb-3 text-sm font-semibold">Godkjenning</p>
        <p className="mb-3 text-sm text-muted-foreground">
          {reviewCounts.approved} godkjent, {reviewCounts.disapproved} avvist
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={myReview?.approved === true ? 'default' : 'outline'}
            onClick={() => reviewMutation.mutate(true)}
            disabled={reviewMutation.isPending}
          >
            Godkjenn
          </Button>
          <Button
            size="sm"
            variant={myReview?.approved === false ? 'destructive' : 'outline'}
            onClick={() => reviewMutation.mutate(false)}
            disabled={reviewMutation.isPending}
          >
            Avvis
          </Button>
        </div>
      </div>

      {isAdmin && (
        <div className="flex gap-2 border-t pt-4">
          <Button onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>
            {publishMutation.isPending ? 'Publiserer...' : 'Publiser resultater'}
          </Button>
          <Button variant="destructive" onClick={() => invalidateMutation.mutate()}>
            Ugyldiggjor
          </Button>
        </div>
      )}
    </div>
  );
}
