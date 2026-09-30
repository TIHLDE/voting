import { ScriptOnce } from '@tanstack/react-router';
import {
    createContext,
    use,
    useCallback,
    useMemo,
    useSyncExternalStore,
} from 'react';

type Theme = 'dark' | 'light';

type ThemeProviderProps = {
    children: React.ReactNode;
    storageKey?: string;
};

type ThemeProviderState = {
    theme: Theme;
    setTheme: (theme: Theme) => void;
};

const THEME_EVENT = 'theme-change';

function getThemeScript(storageKey: string) {
    const key = JSON.stringify(storageKey);

    return `(function () {
  try {
    var t = localStorage.getItem(${key});
    if (t !== "light" && t !== "dark") {
      t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      localStorage.setItem(${key}, t);
    }
    var e = document.documentElement;
    e.classList.add(t);
    e.style.colorScheme = t;
  } catch (e) {}
})();`;
}

const ThemeProviderContext = createContext<ThemeProviderState | null>(null);

function applyTheme(theme: Theme) {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    root.style.colorScheme = theme;
}

export function ThemeProvider({
    children,
    storageKey = 'theme',
}: ThemeProviderProps) {
    const subscribe = useCallback((callback: () => void) => {
        window.addEventListener(THEME_EVENT, callback);
        window.addEventListener('storage', callback);
        return () => {
            window.removeEventListener(THEME_EVENT, callback);
            window.removeEventListener('storage', callback);
        };
    }, []);
    const getSnapshot = useCallback((): Theme => {
        const stored = localStorage.getItem(storageKey);
        return stored === 'dark' ? 'dark' : 'light';
    }, [storageKey]);
    const theme = useSyncExternalStore<Theme>(
        subscribe,
        getSnapshot,
        () => 'light',
    );
    const setTheme = useCallback(
        (next: Theme) => {
            localStorage.setItem(storageKey, next);
            applyTheme(next);
            window.dispatchEvent(new Event(THEME_EVENT));
        },
        [storageKey],
    );
    const context = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

    return (
        <ThemeProviderContext value={context}>
            <ScriptOnce>{getThemeScript(storageKey)}</ScriptOnce>
            {children}
        </ThemeProviderContext>
    );
}

export function useTheme() {
    const context = use(ThemeProviderContext);
    if (!context)
        throw new Error('useTheme must be used within a ThemeProvider');
    return context;
}
