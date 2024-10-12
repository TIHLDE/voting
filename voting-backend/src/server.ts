// api/server.ts

import { PrismaClient } from '@prisma/client';
import { ApolloServer } from 'apollo-server-express';
import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import { Context } from './context';
import { checkJwt } from './lib/auth/verifyToken';
import simpleMock from './lib/mocks/mock';
import { protectedSchema } from './schema';
import { saveAuth0UserIfNotExist } from './utils/save_user_locally';
const corsOptions = {
    origin: [process.env.FRONTEND_URL ?? 'http://localhost'],
    credentials: true
}
export const createApollo = (prisma: PrismaClient) => {
    const server = new ApolloServer({
        context: async ({ req }): Promise<Context> => {
            try {   
                if (req.auth) {
                    const sub = req.auth.payload?.sub
                    if (!sub) {
                        console.log(req.auth);
                        throw new Error('Something wrong with the auth token');
                    }

                    const userId = sub.split('|')[1];
                    await saveAuth0UserIfNotExist(prisma, userId, req.headers.authorization);
                    return { userId: userId, prisma };
                }
            } catch (error) {
                
                console.error(error);
            }
            return { userId: '', prisma };
        },
        schema: protectedSchema,
        mocks: process.env.MOCKING == 'true' && simpleMock,
        tracing: process.env.NODE_ENV == 'development',
    });
    return server;
};




export const createGraphqlServer = async (server: ApolloServer, prisma: PrismaClient) => {
    const app = express();
    
    app.use(cors(corsOptions));

    app.use(checkJwt);
    await prisma.$connect();

    server.applyMiddleware({ app, path: '/graphql', cors: corsOptions});
    return app;
};
