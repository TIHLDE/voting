import { auth } from "express-oauth2-jwt-bearer";

export interface DecodedToken {
    iss: string;
    sub: string;
    aud: string[];
    iat: number;
    exp: number;
    azp: string;
    scope: string;
}

export const checkJwt = auth({
  audience: 'https://tihlde-voting',
  issuerBaseURL: 'https://dev-grxlv-id.us.auth0.com/',
  tokenSigningAlg: 'RS256'
});
