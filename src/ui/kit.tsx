/** Small UI primitives shared by every screen. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function Btn({
  children,
  onClick,
  variant = 'default',
  size,
  disabled,
  title,
  active,
  type = 'button',
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
  size?: 'sm';
  disabled?: boolean;
  title?: string;
  active?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`btn ${variant === 'default' ? '' : variant} ${size ?? ''} ${className ?? ''}`}
      style={active ? { borderColor: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 16%, transparent)' } : undefined}
    >
      {children}
    </button>
  );
}

export function Seg<T extends string | number>({
  options,
  value,
  onChange,
  size,
}: {
  options: { value: T; label: ReactNode; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm';
}) {
  return (
    <div className="seg" role="tablist" data-size={size}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="tab"
          type="button"
          aria-selected={o.value === value}
          aria-pressed={o.value === value}
          title={o.title}
          onClick={() => onChange(o.value)}
          style={size === 'sm' ? { padding: '4px 8px', fontSize: 11.5 } : undefined}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint ? <span className="tiny muted">{hint}</span> : null}
    </div>
  );
}

export function Toggle({ label, checked, onChange }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" />
      <span>{label}</span>
    </label>
  );
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  suffix,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="row">
      <input
        className="grow"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="mono tiny muted" style={{ minWidth: 34, textAlign: 'right' }}>
        {value}
        {suffix}
      </span>
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
  wide,
  footer,
}: {
  title: ReactNode;
  children: ReactNode;
  onClose?: () => void;
  wide?: boolean;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const content = (
    <div className="overlay" onMouseDown={(e) => (e.target === e.currentTarget ? onClose?.() : undefined)}>
      <div className="panel modal" style={wide ? { width: 'min(760px, 100%)' } : undefined} role="dialog" aria-modal="true">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <h2 className="grow">{title}</h2>
          {onClose ? (
            <Btn variant="ghost" size="sm" onClick={onClose} title="Close">
              ✕
            </Btn>
          ) : null}
        </div>
        <div>{children}</div>
        {footer ? <div className="row" style={{ justifyContent: 'flex-end' }}>{footer}</div> : null}
      </div>
    </div>
  );
  // portal so a modal can never be trapped (or clipped) by the panel it was
  // opened from — backdrop-filter/overflow on ancestors would confine it
  return typeof document === 'undefined' ? content : createPortal(content, document.body);
}

export function Chip({ children, tone, onClick, title }: { children: ReactNode; tone?: 'accent'; onClick?: () => void; title?: string }) {
  if (onClick)
    return (
      <button className={`chip ${tone ?? ''}`} onClick={onClick} title={title} style={{ cursor: 'pointer' }}>
        {children}
      </button>
    );
  return (
    <span className={`chip ${tone ?? ''}`} title={title}>
      {children}
    </span>
  );
}

export function ColorRow({ value, onChange, colors }: { value: string; onChange: (v: string) => void; colors: string[] }) {
  return (
    <div className="swatches">
      {colors.map((c) => (
        <button key={c} className="swatch-btn" aria-pressed={value.toLowerCase() === c.toLowerCase()} style={{ background: c }} onClick={() => onChange(c)} title={c} />
      ))}
      <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#888888'} onChange={(e) => onChange(e.target.value)} title="Custom colour" />
    </div>
  );
}

/** Transient status line used for copy/export confirmations. */
export function useNotice(timeout = 2000) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = (m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), timeout);
  };
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  return { msg, show };
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function download(filename: string, text: string, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function fmtClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (ms < 20000) {
    const t = Math.max(0, ms / 1000);
    return `${Math.floor(t)}.${Math.floor((t % 1) * 10)}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function SectionTitle({ title, hint, right }: { title: string; hint?: string; right?: ReactNode }) {
  return (
    <div className="section-title">
      <h3>{title}</h3>
      {hint ? <span>{hint}</span> : null}
      <span className="grow" />
      {right}
    </div>
  );
}

export const GROW = { flex: 1, minWidth: 0 } as const;
