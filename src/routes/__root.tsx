import {
    HeadContent,
    Scripts,
    createRootRouteWithContext,
} from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { TanStackDevtools } from '@tanstack/react-devtools';
import { Toaster } from '../components/ui/sonner';
import Footer from '../components/Footer';
import Header from '../components/Header';
import { ThemeProvider } from '../components/ThemeProvider';

import TanStackQueryProvider from '../integrations/tanstack-query/root-provider';

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools';

import appCss from '../styles.css?url';
import { APP_NAME } from '../env';

import type { QueryClient } from '@tanstack/react-query';

interface MyRouterContext {
    queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
    head: () => ({
        meta: [
            {
                charSet: 'utf-8',
            },
            {
                name: 'viewport',
                content: 'width=device-width, initial-scale=1',
            },
            {
                title: APP_NAME,
            },
        ],
        links: [
            {
                rel: 'stylesheet',
                href: appCss,
            },
        ],
    }),
    shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
    return (
        <html lang="nb" suppressHydrationWarning>
            <head>
                <HeadContent />
            </head>
            <body className="font-sans antialiased [overflow-wrap:anywhere]">
                <ThemeProvider>
                    <TanStackQueryProvider>
                        <Header />
                        {children}
                        <Footer />
                        <Toaster richColors position="top-center" />
                        <TanStackDevtools
                            config={{
                                position: 'bottom-right',
                            }}
                            plugins={[
                                {
                                    name: 'TanStack Router',
                                    render: <TanStackRouterDevtoolsPanel />,
                                },
                                TanStackQueryDevtools,
                            ]}
                        />
                    </TanStackQueryProvider>
                </ThemeProvider>
                <Scripts />
            </body>
        </html>
    );
}
