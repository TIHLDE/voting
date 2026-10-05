const FALLBACK = 'Noe gikk galt. Prøv igjen.';

export const NETWORK_ERROR_MESSAGE =
    'Fikk ikke kontakt med serveren. Sjekk nettet og prøv igjen.';

const AUTH_ERROR_MESSAGES: Record<string, string> = {
    INVALID_EMAIL_OR_PASSWORD: 'Feil e-post eller passord.',
    INVALID_PASSWORD: 'Feil e-post eller passord.',
    USER_NOT_FOUND: 'Feil e-post eller passord.',
    CREDENTIAL_ACCOUNT_NOT_FOUND: 'Feil e-post eller passord.',
    INVALID_EMAIL: 'Skriv inn en gyldig e-postadresse.',
    PASSWORD_TOO_SHORT: 'Passordet må ha minst 8 tegn.',
    PASSWORD_TOO_LONG: 'Passordet er for langt.',
    USER_ALREADY_EXISTS:
        'Det finnes allerede en konto med denne e-posten. Logg inn i stedet.',
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
        'Det finnes allerede en konto med denne e-posten. Logg inn i stedet.',
    PROVIDER_NOT_FOUND: 'Innlogging med TIHLDE virker ikke akkurat nå.',
};

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
    access_denied: 'Du avbrøt innloggingen.',
    account_not_linked:
        'Det finnes allerede en konto med denne e-posten. Logg inn med e-post og passord.',
    unable_to_link_account:
        'Det finnes allerede en konto med denne e-posten. Logg inn med e-post og passord.',
    email_not_found: 'Vi fikk ikke e-posten din fra TIHLDE. Prøv igjen.',
    email_not_verified: 'E-posten din hos TIHLDE er ikke bekreftet.',
    oauth_provider_not_found: 'Innlogging med TIHLDE virker ikke akkurat nå.',
    state_mismatch: 'Innloggingen tok for lang tid. Prøv igjen.',
    state_not_found: 'Innloggingen tok for lang tid. Prøv igjen.',
};

export function authErrorMessage(error: {
    code?: string;
    status?: number;
}): string {
    if (error.status === 429) {
        return 'For mange forsøk. Vent litt og prøv igjen.';
    }
    return (error.code && AUTH_ERROR_MESSAGES[error.code]) || FALLBACK;
}

export function oauthErrorMessage(code: string): string {
    return (
        OAUTH_ERROR_MESSAGES[code] ??
        'Innlogging med TIHLDE mislyktes. Prøv igjen.'
    );
}
