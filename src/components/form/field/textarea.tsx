import { useFieldContext } from '#/hooks/form';
import { Textarea as TextareaPrimitive } from '#/components/ui/textarea';
import { useField } from './field';

type TextareaProps = Omit<
    React.ComponentProps<typeof TextareaPrimitive>,
    'value' | 'onChange' | 'onBlur' | 'id' | 'name' | 'required'
>;

export function Textarea(props: TextareaProps) {
    const field = useFieldContext<string>();
    const ctx = useField();

    return (
        <TextareaPrimitive
            {...props}
            id={ctx.inputId}
            name={field.name}
            required={ctx.required}
            value={field.state.value}
            onChange={(e) => field.handleChange(e.target.value)}
            onBlur={field.handleBlur}
            aria-invalid={ctx.isInvalid}
        />
    );
}
