import { useState, type CSSProperties, type ReactNode } from 'react';
import { FloatingFocusManager, FloatingPortal, autoUpdate, flip, offset, safePolygon, shift, useClick, useDismiss, useFloating, useHover, useInteractions, useRole } from '@floating-ui/react';

interface Props {
  children: ReactNode;          // trigger label
  content: ReactNode;           // popover body
  className?: string;           // trigger classes (e.g. bx-term, bx-chip)
  style?: CSSProperties;
  ariaLabel?: string;
  hover?: boolean;              // open on hover too (default true); keyboard/click always work
  placement?: 'bottom-start' | 'bottom' | 'top-start' | 'top' | 'right' | 'left';
  testId?: string;
  onOpen?: () => void;
}

/**
 * Popover anchored to a <button> trigger (floating-ui). Hover shows a read-only preview; click / Enter / Space
 * opens it interactively (focus moves inside, Esc closes and returns focus). Never hover-only.
 */
export default function Popover({ children, content, className, style, ariaLabel, hover = true, placement = 'bottom-start', testId, onOpen }: Props) {
  const [open, setOpen] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: (o, _e, reason) => {
      setOpen(o);
      setInteractive(o && reason !== 'hover' && reason !== 'safe-polygon');
      if (o) onOpen?.();
    },
    placement,
    middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const hoverI = useHover(context, { enabled: hover, delay: { open: 120, close: 80 }, handleClose: safePolygon(), move: false });
  const click = useClick(context, { toggle: true });
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'dialog' });
  const { getReferenceProps, getFloatingProps } = useInteractions([hoverI, click, dismiss, role]);
  const panel = (
    <div ref={refs.setFloating} style={{ ...floatingStyles, zIndex: 60 }} {...getFloatingProps()} className="bx-card p-3 max-w-sm w-max text-sm shadow-lg bg-paper dark:bg-night" data-testid={testId ? `${testId}-popover` : undefined}>
      {content}
    </div>
  );
  return (
    <>
      <button
        type="button"
        ref={refs.setReference}
        {...getReferenceProps({ 'aria-describedby': open ? context.floatingId : undefined })}
        className={className}
        style={style}
        aria-label={ariaLabel}
        data-testid={testId}
      >
        {children}
      </button>
      {open && (
        <FloatingPortal>
          {interactive ? (
            <FloatingFocusManager context={context} modal={false} initialFocus={0} returnFocus>
              {panel}
            </FloatingFocusManager>
          ) : panel}
        </FloatingPortal>
      )}
    </>
  );
}
