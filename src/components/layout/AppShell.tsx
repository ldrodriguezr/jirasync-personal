import React, { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import Sidebar from './Sidebar';
import CommandPalette from '../ui/CommandPalette';
import { useApp } from '../../context/AppContext';
import { useSmartNotifications } from '../../hooks/useSmartNotifications';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, activeProject } = useApp();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Smart notifications
  useSmartNotifications({
    projectId: activeProject?.id,
    userId: user?.id,
    enabled: true,
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex min-h-screen">
      {/* Mobile hamburger */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="md:hidden fixed top-3 left-3 z-30 p-2 rounded-lg bg-sidebar text-white shadow-lg"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:static top-0 left-0 bottom-0 z-50
        transform transition-transform duration-200 ease-in-out md:transform-none
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {sidebarOpen && (
          <button onClick={() => setSidebarOpen(false)}
            className="md:hidden absolute top-3 right-3 z-10 p-1 rounded text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        )}
        <Sidebar
          onOpenPalette={() => setPaletteOpen(true)}
          onNavClick={() => setSidebarOpen(false)}
        />
      </div>

      <main className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-950 transition-colors">
        <div className="md:hidden h-12" />
        {children}
      </main>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
