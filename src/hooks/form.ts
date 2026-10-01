import {
    createFormHookContexts,
    createFormHook,
    useStore,
} from '@tanstack/react-form';
import {
    Checkbox,
    CheckboxGroup,
    Description,
    Error,
    Field,
    Label,
    // Number,
    RadioGroup,
    Select,
    Switch,
} from '#/components/form/field';
import { InputField, PasswordField } from '#/components/form/basic-fields';
import { FormErrors } from '#/components/form/form-errors';
import { SubmitButton } from '#/components/form/submit-button';

type FormAPI = {
    handleSubmit: () => void | Promise<void>;
    reset: () => void | Promise<void>;
};

export function formHandlers<TFormAPI extends FormAPI>(
    formApi: TFormAPI,
    preventDefault = true,
    stopPropagation = true,
): React.ComponentProps<'form'> {
    return {
        noValidate: true,
        onSubmit: (e) => {
            if (preventDefault) e.preventDefault();
            if (stopPropagation) e.stopPropagation();

            formApi.handleSubmit();
        },
        onReset: (e) => {
            if (preventDefault) e.preventDefault();
            if (stopPropagation) e.stopPropagation();

            formApi.reset();
        },
    };
}

export const { fieldContext, useFieldContext, formContext, useFormContext } =
    createFormHookContexts();

export function useFieldErrorVisible(): boolean {
    const field = useFieldContext();
    const submitted = useStore(
        field.form.store,
        (state) => state.submissionAttempts > 0,
    );
    return (
        (field.state.meta.isBlurred || submitted) && !field.state.meta.isValid
    );
}

const { useAppForm, withForm, withFieldGroup } = createFormHook({
    fieldComponents: {
        Field,
        Label,
        PasswordField,
        InputField,
        Number,
        Checkbox,
        CheckboxGroup,
        Switch,
        Select,
        RadioGroup,
        Description,
        Error,
    },
    formComponents: {
        SubmitButton,
        FormErrors,
    },
    fieldContext,
    formContext,
});

export { useAppForm, withForm, withFieldGroup };
