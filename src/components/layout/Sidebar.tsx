import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Layers,
  List,
  Zap,
  FolderOpen,
  LogOut,
  ChevronDown,
  Plus,
  Calendar,
  Search,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Avatar from '../ui/Avatar';

const NAV = [
  { to: '/board',     label: 'Board',      Icon: Layers },
  { to: '/backlog',   label: 'Backlog',    Icon: List },
  { to: '/sprints',   label: 'Sprints',    Icon: Zap },
  { to: '/calendar',  label: 'Calendar',   Icon: Calendar },
  { to: '/dashboard', label: 'Dashboard',  Icon: LayoutDashboard },
  { to: '/projects',  label: 'Projects',   Icon: FolderOpen },
];

export default function Sidebar({ onOpenPalette }: { onOpenPalette?: () => void }) {
  const { user, activeProject, projects, setActiveProject, signOut } = useApp();
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <aside className="w-56 min-h-screen bg-sidebar flex flex-col py-4 gap-2 flex-shrink-0">
      {/* Logo */}
      <div className="px-4 mb-2 flex items-center gap-2">
        <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center">
          <span className="text-white font-bold text-sm">J</span>
        </div>
        <span className="text-white font-bold tracking-wide text-sm">JiraSync</span>
      </div>

      {/* Command palette trigger */}
      <div className="px-3 mb-1">
        <button
          onClick={onOpenPalette}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md bg-sidebar-hover hover:bg-sidebar-active text-gray-400 hover:text-white text-xs transition-colors"
        >
          <Search size={12} />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="text-[9px] bg-black/20 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
        </button>
      </div>

      {/* Project selector */}
      <div className="px-3 mb-1 relative">
        <button
          onClick={() => setProjectMenuOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-sidebar-hover hover:bg-sidebar-active text-white text-sm transition-colors"
        >
          <span className="flex items-center gap-2 truncate">
            {activeProject ? (
              <>
                <span
                  className="w-4 h-4 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: activeProject.color }}
                />
                <span className="truncate font-medium">{activeProject.name}</span>
              </>
            ) : (
              <span className="text-gray-400">Select project</span>
            )}
          </span>
          <ChevronDown size={14} className="flex-shrink-0 text-gray-400" />
        </button>

        {projectMenuOpen && (
          <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
            {projects.map((p) => (
              <button
                key={p.id}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-gray-800"
                onClick={() => { setActiveProject(p); setProjectMenuOpen(false); }}
              >
                <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: p.color }} />
                <span className="truncate">{p.name}</span>
                <span className="ml-auto text-xs text-gray-400 font-mono">{p.key}</span>
              </button>
            ))}
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 border-t border-gray-100"
              onClick={() => { setProjectMenuOpen(false); navigate('/projects'); }}
            >
              <Plus size={14} />
              New project
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 flex flex-col gap-0.5">
        {NAV.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors
              ${isActive
                ? 'bg-sidebar-active text-white font-medium'
                : 'text-gray-400 hover:text-white hover:bg-sidebar-hover'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 border-t border-white/10 pt-3">
        <div className="flex items-center gap-2 px-2 py-2 rounded-md">
          <Avatar name={user?.full_name ?? user?.email} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">
              {user?.full_name ?? user?.email?.split('@')[0]}
            </p>
            <p className="text-gray-400 text-[10px] truncate">{user?.email}</p>
          </div>
          <button onClick={signOut} title="Sign out" className="text-gray-400 hover:text-white p-1 rounded">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
