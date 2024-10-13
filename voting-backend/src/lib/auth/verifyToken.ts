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
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  audience: 'https://tihlde-voting',
  tokenSigningAlg: 'RS256'
});
