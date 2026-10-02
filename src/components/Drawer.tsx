import { useEffect, type ReactNode } from "react";

/** Right-side drawer on desktop, bottom sheet on mobile. */
export function Drawer({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <button aria-label="Close" className="absolute inset-0 bg-background/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <aside
        className={`absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-xl border border-border bg-popover p-5 shadow-2xl animate-fade-in md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:rounded-none md:rounded-l-xl ${wide ? "md:w-[720px]" : "md:w-[420px]"}`}
      >
        <header className="mb-5 flex items-center justify-between">
          <h2 className="label-xs text-foreground">{title}</h2>
          <button onClick={onClose} className="rounded px-2 py-1 font-mono text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
            ESC ✕
          </button>
        </header>
        {children}
      </aside>
    </div>
  );
}
