import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Layers, LayoutDashboard, List, Zap, FolderOpen, Hash } from 'lucide-react';
import { getIssues } from '../../lib/db';
import { useApp } from '../../context/AppContext';
import type { Issue } from '../../types';
import IssueTypeIcon from '../issues/IssueTypeIcon';

interface CommandItem {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  action: () => void;
  type: 'nav' | 'issue' | 'project';
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: Props) {
  const { activeProject, projects, setActiveProject } = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load issues for active project
  useEffect(() => {
    if (!open || !activeProject) return;
    getIssues(activeProject.id, { includeArchived: false }).then(setIssues).catch(() => {});
  }, [open, activeProject]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const nav = useCallback((path: string) => { navigate(path); onClose(); }, [navigate, onClose]);

  const navItems: CommandItem[] = [
    { id: 'nav-board',     label: 'Board',     sublabel: 'Go to Board view',     icon: <Layers size={14} />,         action: () => nav('/board'),     type: 'nav' },
    { id: 'nav-backlog',   label: 'Backlog',   sublabel: 'Go to Backlog',         icon: <List size={14} />,           action: () => nav('/backlog'),   type: 'nav' },
    { id: 'nav-sprints',   label: 'Sprints',   sublabel: 'Go to Sprints',         icon: <Zap size={14} />,            action: () => nav('/sprints'),   type: 'nav' },
    { id: 'nav-dashboard', label: 'Dashboard', sublabel: 'Go to Dashboard',       icon: <LayoutDashboard size={14} />, action: () => nav('/dashboard'), type: 'nav' },
    { id: 'nav-calendar',  label: 'Calendar',  sublabel: 'Go to Calendar view',   icon: <Hash size={14} />,           action: () => nav('/calendar'),  type: 'nav' },
    { id: 'nav-projects',  label: 'Projects',  sublabel: 'Manage projects',       icon: <FolderOpen size={14} />,     action: () => nav('/projects'),  type: 'nav' },
  ];

  const projectItems: CommandItem[] = projects.map((p) => ({
    id: `proj-${p.id}`,
    label: p.name,
    sublabel: `Switch to project · ${p.key}`,
    icon: <span className="w-3.5 h-3.5 rounded-sm flex-shrink-0" style={{ backgroundColor: p.color }} />,
    action: () => { setActiveProject(p); nav('/board'); },
    type: 'project' as const,
  }));

  const issueItems: CommandItem[] = issues.map((i) => ({
    id: `issue-${i.id}`,
    label: i.title,
    sublabel: `${i.ticket_id} · ${i.status.replace('_', ' ')}`,
    icon: <IssueTypeIcon type={i.type} size={14} />,
    action: () => {
      nav('/board');
      // Store the issue to open in sessionStorage for Board to pick up
      sessionStorage.setItem('mytask_open_issue', i.id);
      onClose();
    },
    type: 'issue' as const,
  }));

  const allItems: CommandItem[] = query.trim()
    ? [
        ...navItems.filter((n) => n.label.toLowerCase().includes(query.toLowerCase())),
        ...projectItems.filter((p) => p.label.toLowerCase().includes(query.toLowerCase())),
        ...issueItems.filter(
          (i) =>
            i.label.toLowerCase().includes(query.toLowerCase()) ||
            (i.sublabel ?? '').toLowerCase().includes(query.toLowerCase())
        ),
      ]
    : [...navItems, ...projectItems];

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, allItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        allItems[selected]?.action();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, allItems, selected, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selected}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  // Reset selection when results change
  useEffect(() => { setSelected(0); }, [query]);

  if (!open) return null;

  const groups: { label: string; type: CommandItem['type'] }[] = [
    { label: 'Navigation', type: 'nav' },
    { label: 'Projects', type: 'project' },
    { label: 'Issues', type: 'issue' },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 dark:border-gray-800">
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search issues, pages, projects..."
            className="flex-1 text-sm text-gray-800 dark:text-gray-200 bg-transparent outline-none placeholder-gray-400"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded text-gray-500 dark:text-gray-400 font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-1">
          {allItems.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No results for "{query}"</p>
          )}

          {query.trim()
            ? allItems.map((item, idx) => (
                <ResultRow
                  key={item.id}
                  item={item}
                  idx={idx}
                  selected={selected === idx}
                  onSelect={() => { setSelected(idx); item.action(); }}
                />
              ))
            : groups.map(({ label, type }) => {
                const items = allItems.filter((i) => i.type === type);
                if (items.length === 0) return null;
                return (
                  <div key={type}>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-1.5 mt-1">
                      {label}
                    </p>
                    {items.map((item) => {
                      const idx = allItems.indexOf(item);
                      return (
                        <ResultRow
                          key={item.id}
                          item={item}
                          idx={idx}
                          selected={selected === idx}
                          onSelect={() => { setSelected(idx); item.action(); }}
                        />
                      );
                    })}
                  </div>
                );
              })}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-[10px] text-gray-400">
          <span><kbd className="font-mono bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-1 rounded">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-1 rounded">↵</kbd> select</span>
          <span><kbd className="font-mono bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-1 rounded">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

function ResultRow({
  item,
  idx,
  selected,
  onSelect,
}: {
  item: CommandItem;
  idx: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      data-idx={idx}
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
        selected ? 'bg-blue-50 text-blue-700' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800'
      }`}
    >
      <span className={`flex-shrink-0 ${selected ? 'text-blue-500' : 'text-gray-400'}`}>
        {item.icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="text-sm font-medium block truncate">{item.label}</span>
        {item.sublabel && (
          <span className="text-[11px] text-gray-400 truncate block">{item.sublabel}</span>
        )}
      </span>
    </button>
  );
}
