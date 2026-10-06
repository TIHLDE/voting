import '@tanstack/react-start/server-only';
import { getRequest } from '@tanstack/react-start/server';

import { env } from '#/env';

type EmailContentBlock =
    | { type: 'title'; content: string }
    | { type: 'text'; content: string }
    | { type: 'button'; text: string; url: string };

async function sendPhotonEmail(options: {
    to: string;
    subject: string;
    content: EmailContentBlock[];
}) {
    if (!env.PHOTON_EMAIL_API_KEY) return;

    const response = await fetch(`${env.PHOTON_API_URL}/email/send`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${env.PHOTON_EMAIL_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
        signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
        throw new Error(
            `Photon email API responded ${response.status}: ${await response.text()}`,
        );
    }
}

function appOrigin() {
    return env.BETTER_AUTH_URL ?? new URL(getRequest().url).origin;
}

export async function sendMeetingInviteEmail(options: {
    to: string;
    meetingId: string;
    meetingTitle: string;
    hasAccount: boolean;
}) {
    const meetingUrl = `${appOrigin()}/meetings/${options.meetingId}`;

    try {
        await sendPhotonEmail({
            to: options.to,
            subject: `Du er invitert til ${options.meetingTitle}`,
            content: [
                { type: 'title', content: options.meetingTitle },
                {
                    type: 'text',
                    content: options.hasAccount
                        ? `Du er lagt til som deltaker i møtet «${options.meetingTitle}».`
                        : `Du er invitert til møtet «${options.meetingTitle}». Logg inn med denne e-postadressen, så blir du lagt til som deltaker.`,
                },
                {
                    type: 'button',
                    text: options.hasAccount ? 'Gå til møtet' : 'Logg inn',
                    url: meetingUrl,
                },
            ],
        });
    } catch (error) {
        console.error('Failed to send meeting invite email', error);
    }
}
