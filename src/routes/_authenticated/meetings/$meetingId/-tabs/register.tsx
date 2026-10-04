import { Button } from '#/components/ui/button';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { useRef, useSyncExternalStore } from 'react';
import { toast } from 'sonner';

const subscribeToOrigin = () => () => {};

function useOrigin() {
    return useSyncExternalStore(
        subscribeToOrigin,
        () => window.location.origin,
        () => '',
    );
}

export function SelfRegistrationPanel({
    meetingId,
    allowSelfRegistration,
}: {
    meetingId: string;
    allowSelfRegistration: boolean;
}) {
    const origin = useOrigin();
    const qrCanvasRef = useRef<HTMLCanvasElement>(null);

    async function copyQrCode() {
        const canvas = qrCanvasRef.current;
        if (!canvas) return;

        try {
            // Pass the blob as a promise so Safari keeps the user gesture.
            const png = new Promise<Blob>((resolve, reject) =>
                canvas.toBlob((blob) =>
                    blob ? resolve(blob) : reject(new Error('toBlob failed')),
                ),
            );
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': png }),
            ]);
            toast.success('QR-kode kopiert');
        } catch {
            toast.error('Kunne ikke kopiere QR-koden');
        }
    }

    if (!allowSelfRegistration) {
        return (
            <div className="rounded-xl border bg-card p-6 text-center shadow-sm">
                <p className="text-muted-foreground">
                    Selvregistrering er ikke aktivert for dette møtet. Du kan
                    aktivere det i møteinnstillingene.
                </p>
            </div>
        );
    }

    const regUrl = origin ? `${origin}/join/${meetingId}` : '';

    return (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-foreground">
                Selvregistrering
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
                Del denne lenken eller QR-koden med deltakere som skal
                registrere seg selv. Deltakere som registrerer seg må godkjennes
                under Deltakere-fanen.
            </p>
            <div className="mb-4 flex items-center gap-2">
                <code className="flex-1 rounded-lg border bg-muted px-3 py-2 text-sm">
                    {regUrl}
                </code>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                        void navigator.clipboard.writeText(regUrl);
                        toast.success('Lenke kopiert');
                    }}
                >
                    Kopier
                </Button>
            </div>
            <div className="flex flex-col items-center gap-3">
                {regUrl ? (
                    <>
                        <div className="rounded-lg bg-white p-4">
                            <QRCodeSVG value={regUrl} size={200} />
                        </div>
                        {/* Higher resolution copy, with a white margin, for the clipboard */}
                        <QRCodeCanvas
                            ref={qrCanvasRef}
                            value={regUrl}
                            size={512}
                            marginSize={4}
                            className="hidden"
                        />
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void copyQrCode()}
                        >
                            Kopier QR-kode
                        </Button>
                    </>
                ) : (
                    <div className="h-[200px] w-[200px] animate-pulse rounded bg-muted" />
                )}
            </div>
        </div>
    );
}
