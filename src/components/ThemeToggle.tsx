import { MoonIcon, SunIcon } from 'lucide-react';
import { Button } from '#/components/ui/button';
import { useTheme } from './ThemeProvider';

export default function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const label =
        theme === 'dark' ? 'Bytt til lyst tema' : 'Bytt til mørkt tema';

    return (
        <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={label}
            title={label}
        >
            {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
        </Button>
    );
}
