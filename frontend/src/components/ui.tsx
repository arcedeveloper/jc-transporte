'use client';

import { forwardRef, useEffect, useId, useRef, useLayoutEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { CircleCheck, Eye, EyeOff, LoaderCircle, TriangleAlert, X } from 'lucide-react';
import { useToasts } from '@/store/toast';
import type { BookingStatus, TripStatus } from '@/lib/types';
import { groupDecimal, groupDigits } from '@/lib/format';

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ---------- Botón ----------

type Variant = 'primary' | 'accent' | 'outline' | 'ghost' | 'danger' | 'whatsapp';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-ruta text-white hover:bg-ruta-dark disabled:bg-ruta/40',
  accent: 'bg-ambar text-ruta-dark hover:bg-[#f0a500] disabled:bg-ambar/40',
  outline: 'border-2 border-ruta/20 text-ruta bg-white hover:border-ruta/50 disabled:opacity-50',
  ghost: 'text-ruta hover:bg-ruta-50 disabled:opacity-50',
  danger: 'bg-tierra text-white hover:bg-[#962f1b] disabled:bg-tierra/40',
  whatsapp: 'bg-[#1f9e55] text-white hover:bg-[#188046]',
};
const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-lg gap-1.5',
  md: 'h-11 px-4 rounded-xl gap-2',
  lg: 'h-14 px-6 text-lg rounded-2xl gap-2.5',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra?: string) {
  return cn(
    'inline-flex items-center justify-center font-bold transition-colors disabled:cursor-not-allowed select-none',
    variants[variant],
    sizes[size],
    extra,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading && <LoaderCircle className="size-5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  className,
  children,
  external,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  external?: boolean;
}) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={buttonClass(variant, size, className)}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

// ---------- Formularios ----------

export function Field({
  label,
  error,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-bold text-tinta">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-tierra" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-niebla">{hint}</p>
      ) : null}
    </div>
  );
}

const inputBase =
  'h-12 w-full rounded-xl border-2 bg-white px-3.5 text-base text-tinta placeholder:text-niebla/70 transition-colors focus:border-ruta focus:outline-none';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, error, hint, className, id, ...rest }, ref) {
  const auto = useId();
  const inputId = id ?? auto;
  const input = (
    <input
      ref={ref}
      id={inputId}
      aria-invalid={!!error}
      className={cn(inputBase, error ? 'border-tierra' : 'border-linea', className)}
      {...rest}
    />
  );
  if (!label) return input;
  return (
    <Field label={label} error={error} hint={hint} htmlFor={inputId}>
      {input}
    </Field>
  );
});

/** Campo de contraseña con un ojito para mostrar u ocultar lo que se escribe. */
export function PasswordInput({ label, error, hint, className, id, ...rest }: Omit<InputProps, 'type'>) {
  const auto = useId();
  const inputId = id ?? auto;
  const [show, setShow] = useState(false);
  const input = (
    <div className="relative">
      <input
        id={inputId}
        type={show ? 'text' : 'password'}
        aria-invalid={!!error}
        className={cn(inputBase, 'pr-12', error ? 'border-tierra' : 'border-linea', className)}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute inset-y-0 right-1 my-auto grid size-10 place-items-center rounded-lg text-niebla/70 transition-colors hover:text-ruta"
        aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={show}
        title={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  );
  if (!label) return input;
  return (
    <Field label={label} error={error} hint={hint} htmlFor={inputId}>
      {input}
    </Field>
  );
}

/**
 * Campo para montos y cantidades: pone los puntos de miles mientras escribís (120.000)
 * y deja el cursor donde estaba. `value` y `onValueChange` usan el texto con puntos;
 * para el número usá parseNumber().
 */
export function NumberInput({
  value,
  onValueChange,
  decimals = false,
  ...rest
}: Omit<InputProps, 'value' | 'onChange' | 'type'> & { value: string; onValueChange: (v: string) => void; decimals?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  const fmt = decimals ? groupDecimal : groupDigits;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || caret.current === null || document.activeElement !== el) return;
    // Ubicar el cursor después de la misma cantidad de dígitos que tenía a la izquierda
    let seen = 0;
    let pos = 0;
    while (pos < el.value.length && seen < caret.current) {
      if (/[\d,]/.test(el.value[pos]!)) seen++;
      pos++;
    }
    el.setSelectionRange(pos, pos);
    caret.current = null;
  }, [value]);

  return (
    <Input
      ref={ref}
      inputMode={decimals ? 'decimal' : 'numeric'}
      autoComplete="off"
      value={value}
      onChange={(e) => {
        const raw = e.target.value;
        const left = raw.slice(0, e.target.selectionStart ?? raw.length);
        caret.current = left.replace(/[^\d,]/g, '').length;
        onValueChange(fmt(raw));
      }}
      {...rest}
    />
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export function Select({ label, error, className, id, children, ...rest }: SelectProps) {
  const auto = useId();
  const selectId = id ?? auto;
  const select = (
    <select
      id={selectId}
      aria-invalid={!!error}
      className={cn(inputBase, 'appearance-none bg-[length:20px] bg-[right_12px_center] bg-no-repeat pr-10', error ? 'border-tierra' : 'border-linea', className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2312355b' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
      {...rest}
    >
      {children}
    </select>
  );
  if (!label) return select;
  return (
    <Field label={label} error={error} htmlFor={selectId}>
      {select}
    </Field>
  );
}

// ---------- Estados ----------

export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-niebla" role="status">
      <LoaderCircle className="size-6 animate-spin text-ruta" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border-2 border-tierra/30 bg-tierra-50 p-5" role="alert">
      <div className="flex items-start gap-2.5 text-tierra">
        <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
        <p className="font-bold">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-linea bg-white px-6 py-12 text-center">
      <p className="font-display text-2xl font-semibold text-ruta">{title}</p>
      {children && <div className="mt-2 text-niebla">{children}</div>}
    </div>
  );
}

const bookingStatus: Record<BookingStatus, [string, string]> = {
  pending: ['Pendiente de pago', 'bg-ambar-50 text-ambar-dark border-ambar/50'],
  confirmed: ['Confirmada', 'bg-monte-50 text-monte border-monte/40'],
  cancelled: ['Cancelada', 'bg-tierra-50 text-tierra border-tierra/30'],
};
export function BookingBadge({ status }: { status: BookingStatus }) {
  const [label, cls] = bookingStatus[status];
  return <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-bold', cls)}>{label}</span>;
}

const tripStatus: Record<TripStatus, [string, string]> = {
  scheduled: ['Programado', 'bg-ruta-50 text-ruta border-ruta/20'],
  in_progress: ['En viaje', 'bg-monte-50 text-monte border-monte/40'],
  completed: ['Finalizado', 'bg-papel text-niebla border-linea'],
  cancelled: ['Cancelado', 'bg-tierra-50 text-tierra border-tierra/30'],
};
export function TripBadge({ status }: { status: TripStatus }) {
  const [label, cls] = tripStatus[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-bold', cls)}>
      {status === 'in_progress' && <span className="size-2 animate-pulse rounded-full bg-monte" aria-hidden />}
      {label}
    </span>
  );
}

// ---------- Modal ----------

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <motion.div
            className="absolute inset-0 bg-ruta-dark/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              'relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7',
              wide ? 'sm:max-w-2xl' : 'sm:max-w-md',
            )}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <h2 className="font-display text-3xl font-bold text-ruta">{title}</h2>
              <button onClick={onClose} className="rounded-full p-1.5 text-niebla hover:bg-papel" aria-label="Cerrar">
                <X className="size-6" />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ---------- Avisos flotantes ----------

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className={cn(
              'pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl px-4 py-3 font-bold shadow-xl',
              t.kind === 'error' ? 'bg-tierra text-white' : t.kind === 'success' ? 'bg-monte text-white' : 'bg-ruta text-white',
            )}
            onClick={() => dismiss(t.id)}
          >
            {t.kind === 'error' ? <TriangleAlert className="mt-0.5 size-5 shrink-0" /> : <CircleCheck className="mt-0.5 size-5 shrink-0" />}
            <span>{t.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
