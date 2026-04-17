import { ChangeEventHandler, HTMLAttributes } from 'react';

type BaseFieldProps = {
  label: string;
  name?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
};

type InputFieldProps = BaseFieldProps & {
  type?: string;
};

type TextareaFieldProps = BaseFieldProps & {
  rows?: number;
};

const fieldShellClassName =
  'w-full rounded-2xl border border-white/10 bg-[var(--input-bg)] px-4 py-3 text-sm font-medium text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60';

export function FormField({
  label,
  name,
  hint,
  error,
  required,
  value,
  onChange,
  placeholder,
  autoComplete,
  inputMode,
  disabled,
  readOnly,
  className = '',
  type = 'text',
}: InputFieldProps) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-[var(--text-1)]">
        {label}
        {required ? <span className="ml-1 text-blue-500">*</span> : null}
      </label>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        disabled={disabled}
        readOnly={readOnly}
        className={`${fieldShellClassName} ${error ? 'border-red-400/50 focus:border-red-400 focus:ring-red-500/20' : ''} ${className}`.trim()}
      />
      {error ? <p className="mt-2 text-xs font-medium text-red-300">{error}</p> : null}
      {!error && hint ? <p className="mt-2 text-xs font-medium text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function TextareaField({
  label,
  name,
  hint,
  error,
  required,
  value,
  onChange,
  placeholder,
  disabled,
  readOnly,
  rows = 5,
  className = '',
}: TextareaFieldProps) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-[var(--text-1)]">
        {label}
        {required ? <span className="ml-1 text-blue-500">*</span> : null}
      </label>
      <textarea
        name={name}
        rows={rows}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        className={`${fieldShellClassName} min-h-[136px] resize-y ${error ? 'border-red-400/50 focus:border-red-400 focus:ring-red-500/20' : ''} ${className}`.trim()}
      />
      {error ? <p className="mt-2 text-xs font-medium text-red-300">{error}</p> : null}
      {!error && hint ? <p className="mt-2 text-xs font-medium text-slate-500">{hint}</p> : null}
    </div>
  );
}
