// api/server.ts

import { PrismaClient } from '@prisma/client';
import { ApolloServer } from 'apollo-server-express';
import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import { Context } from './context';
import { checkJwt, DecodedToken } from './lib/auth/verifyToken';
import simpleMock from './lib/mocks/mock';
import { protectedSchema } from './schema';
import { saveAuth0UserIfNotExist } from './utils/save_user_locally';

export const createApollo = (prisma: PrismaClient) => {
    const server = new ApolloServer({
        context: async ({ req }): Promise<Context> => {
            if (req.user) {
                const decodedToken = req.user as DecodedToken;
                const userId = decodedToken.sub.split('|')[1];
                if (process.env.NODE_ENV != 'production') {
                    await saveAuth0UserIfNotExist(prisma, userId, req.headers['authorization']);
                }
                return { userId: userId, prisma };
            }
            return { userId: '', prisma };
        },
        schema: protectedSchema,
        mocks: process.env.MOCKING == 'true' && simpleMock,
        tracing: process.env.NODE_ENV == 'development',
    });
    return server;
};

const corsOptions = {
    origin: process.env.FRONTEND_URL ?? '',
    credentials: true
}


export const createGraphqlServer = async (server: ApolloServer, prisma: PrismaClient) => {
    const app = express();
    app.use(checkJwt);
    app.use(cors(corsOptions));
    if (process.env.MOCKING != 'true') await prisma.$connect();
    // Connect to database
    if (process.env.NODE_ENV != 'development') await prisma.$connect();

    server.applyMiddleware({ app, path: '/graphql', cors: corsOptions });
    return app;
};
