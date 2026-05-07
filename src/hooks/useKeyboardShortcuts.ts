import { useEffect } from 'react';

export interface ShortcutMap {
  /** `C` — create issue */
  onCreate?: () => void;
  /** `/` — focus search */
  onSearch?: () => void;
  /** `Escape` — handled automatically by modals; exposed here for page-level use */
  onEscape?: () => void;
}

/**
 * Registers global keyboard shortcuts for the current page.
 * Skips shortcuts when the user is typing inside an input, textarea or contenteditable.
 */
export function useKeyboardShortcuts({ onCreate, onSearch, onEscape }: ShortcutMap) {
  useEffect(() => {
    const isTyping = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const editable = (e.target as HTMLElement)?.isContentEditable;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || editable;
    };

    const handler = (e: KeyboardEvent) => {
      // Escape — always fires even in inputs (to close modals)
      if (e.key === 'Escape') {
        onEscape?.();
        return;
      }

      if (isTyping(e)) return;

      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        onCreate?.();
      } else if (e.key === '/') {
        e.preventDefault();
        onSearch?.();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCreate, onSearch, onEscape]);
}
