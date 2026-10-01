interface WizardShellProps {
    currentStep: number;
    steps: string[];
    onStepChange: (step: number) => void;
    children: React.ReactNode;
}

export default function WizardShell({
    currentStep,
    steps,
    onStepChange,
    children,
}: WizardShellProps) {
    return (
        <div>
            <nav className="mb-8 flex items-center justify-center gap-2">
                {steps.map((label, index) => (
                    <button
                        key={label}
                        type="button"
                        onClick={() => onStepChange(index)}
                        className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                            index === currentStep
                                ? 'border bg-accent text-foreground'
                                : index < currentStep
                                  ? 'text-foreground hover:underline'
                                  : 'text-muted-foreground'
                        }`}
                    >
                        <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                                index <= currentStep
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground'
                            }`}
                        >
                            {index + 1}
                        </span>
                        <span className="hidden sm:inline">{label}</span>
                    </button>
                ))}
            </nav>
            {children}
        </div>
    );
}
