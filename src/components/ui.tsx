interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'ai';
  size?: 'sm' | 'md';
}

const variantClass: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'll-btn--primary',
  secondary: 'll-btn--secondary',
  ghost: 'll-btn--ghost',
  danger: 'll-btn--danger',
  ai: 'll-btn--ai',
};

const sizeClass: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'll-btn--sm',
  md: 'll-btn--md',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`ll-btn ll-focus-ring ${variantClass[variant]} ${sizeClass[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  inputSize?: 'sm' | 'md';
}

export function Input({ inputSize = 'md', className = '', ...props }: InputProps) {
  const sizeClassName = inputSize === 'sm' ? 'll-text-sm' : '';
  return <input className={`ll-field ll-focus-ring ${sizeClassName} ${className}`} {...props} />;
}

export function Select({ label, className = '', children, ...props }: SelectProps) {
  return (
    <label className="ll-field-label">
      {label && <span>{label}</span>}
      <select className={`ll-field ll-focus-ring ${className}`} {...props}>
        {children}
      </select>
    </label>
  );
}

export function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`ll-card shadow-md ${className}`}>{children}</div>;
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="ll-banner ll-banner--error ll-animate-slide-up">
      <span className="mr-2" aria-hidden="true">⚠️</span>
      {message}
    </div>
  );
}

export function LoadingSpinner({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="ll-animate-fade-in ll-text-base ll-text-secondary flex items-center gap-2">
      <span
        className="ll-spinner"
        aria-hidden="true"
      />
      {message}
    </div>
  );
}

export function ThemeWrapper({
  children,
}: {
  theme?: 'light' | 'dark' | 'system';
  children: React.ReactNode;
}) {
  return <div className="ll-root min-h-full">{children}</div>;
}

export function PhaseStubButton({ label }: { label: string }) {
  return (
    <Button variant="ghost" size="sm" disabled title="Coming in a future phase">
      {label}
    </Button>
  );
}
