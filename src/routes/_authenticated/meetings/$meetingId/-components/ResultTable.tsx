interface ResultAlternative {
    id: string;
    text: string;
    isWinner: boolean;
    voteCount: number;
}

interface ResultSummary {
    votingEligibleCount: number;
    blankVoteCount: number | null;
}

export function ResultTable({
    alternatives,
    result,
    isStv,
}: {
    alternatives: ResultAlternative[];
    result: ResultSummary | null;
    isStv: boolean;
}) {
    const totalVotes = alternatives.reduce(
        (sum, alternative) => sum + alternative.voteCount,
        0,
    );

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b">
                        <th className="p-2 text-left font-semibold">
                            Alternativ
                        </th>
                        <th className="p-2 text-right font-semibold">
                            {isStv ? 'Førstevalg' : 'Stemmer'}
                        </th>
                        <th className="p-2 text-right font-semibold">
                            % av totalt
                        </th>
                        <th className="p-2 text-right font-semibold">
                            % av stemmeberettigede
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {alternatives.map((alternative) => (
                        <ResultRow
                            key={alternative.id}
                            alternative={alternative}
                            totalVotes={totalVotes}
                            votingEligibleCount={
                                result?.votingEligibleCount ?? 0
                            }
                        />
                    ))}
                    {result?.blankVoteCount != null &&
                        result.blankVoteCount > 0 && (
                            <tr className="border-b italic">
                                <td className="p-2">Blanke stemmer</td>
                                <td className="p-2 text-right">
                                    {result.blankVoteCount}
                                </td>
                                <td className="p-2 text-right" colSpan={2} />
                            </tr>
                        )}
                </tbody>
            </table>
        </div>
    );
}

function ResultRow({
    alternative,
    totalVotes,
    votingEligibleCount,
}: {
    alternative: ResultAlternative;
    totalVotes: number;
    votingEligibleCount: number;
}) {
    const totalPercent =
        totalVotes > 0 ? (alternative.voteCount / totalVotes) * 100 : 0;
    const eligiblePercent =
        votingEligibleCount > 0
            ? (alternative.voteCount / votingEligibleCount) * 100
            : 0;

    return (
        <tr
            className={`border-b ${alternative.isWinner ? 'font-semibold text-green-700 dark:text-green-400' : ''}`}
        >
            <td className="p-2">
                {alternative.text}
                {alternative.isWinner && ' *'}
            </td>
            <td className="p-2 text-right">{alternative.voteCount}</td>
            <td className="p-2 text-right">{totalPercent.toFixed(1)}%</td>
            <td className="p-2 text-right">{eligiblePercent.toFixed(1)}%</td>
        </tr>
    );
}
