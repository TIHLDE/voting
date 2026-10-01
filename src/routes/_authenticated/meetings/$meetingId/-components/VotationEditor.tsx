import { LocalVotationEditor } from './LocalVotationEditor';
import { ServerVotationEditor } from './ServerVotationEditor';
import type { VotationFormData } from './votation-editor-types';

export type { VotationFormData } from './votation-editor-types';

const EMPTY_VOTATIONS: VotationFormData[] = [];
const ignoreLocalChanges = () => {};

interface VotationEditorProps {
    meetingId?: string;
    votations?: VotationFormData[];
    onChange?: (votations: VotationFormData[]) => void;
}

export default function VotationEditor({
    meetingId,
    votations = EMPTY_VOTATIONS,
    onChange,
}: VotationEditorProps) {
    if (meetingId) return <ServerVotationEditor meetingId={meetingId} />;

    return (
        <LocalVotationEditor
            votations={votations}
            onChange={onChange ?? ignoreLocalChanges}
        />
    );
}
