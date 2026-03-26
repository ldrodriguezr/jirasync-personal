import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getProfile, getAllProfiles, getProjects, upsertProfile } from '../lib/db';
import type { Profile, Project } from '../types';

interface AppContextType {
  user: Profile | null;
  loading: boolean;
  activeProject: Project | null;
  projects: Project[];
  profiles: Profile[];
  setActiveProject: (p: Project | null) => void;
  refreshProjects: () => Promise<void>;
  refreshProfiles: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeProject, setActiveProjectState] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const refreshProjects = useCallback(async () => {
    const data = await getProjects();
    setProjects(data);
    // Restore persisted active project
    const savedId = localStorage.getItem('jirasync_active_project');
    if (savedId) {
      const found = data.find((p) => p.id === savedId);
      if (found) setActiveProjectState(found);
      else if (data.length > 0) setActiveProjectState(data[0]);
    } else if (data.length > 0) {
      setActiveProjectState(data[0]);
    }
  }, []);

  const refreshProfiles = useCallback(async () => {
    const data = await getAllProfiles();
    setProfiles(data);
  }, []);

  const setActiveProject = useCallback((p: Project | null) => {
    setActiveProjectState(p);
    if (p) localStorage.setItem('jirasync_active_project', p.id);
    else localStorage.removeItem('jirasync_active_project');
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  useEffect(() => {
    // Restore session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        let profile = await getProfile(session.user.id);
        if (!profile) {
          // Create profile if missing (e.g., existing auth users)
          await upsertProfile({
            id: session.user.id,
            email: session.user.email ?? '',
            full_name: session.user.user_metadata?.full_name ?? null,
            avatar_url: null,
          });
          profile = await getProfile(session.user.id);
        }
        setUser(profile);
        await Promise.all([refreshProjects(), refreshProfiles()]);
      }
      setLoading(false);
    });

    // Auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        let profile = await getProfile(session.user.id);
        if (!profile) {
          await upsertProfile({
            id: session.user.id,
            email: session.user.email ?? '',
            full_name: session.user.user_metadata?.full_name ?? null,
            avatar_url: null,
          });
          profile = await getProfile(session.user.id);
        }
        setUser(profile);
        await Promise.all([refreshProjects(), refreshProfiles()]);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProjects([]);
        setProfiles([]);
        setActiveProjectState(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [refreshProjects, refreshProfiles]);

  return (
    <AppContext.Provider
      value={{
        user,
        loading,
        activeProject,
        projects,
        profiles,
        setActiveProject,
        refreshProjects,
        refreshProfiles,
        signOut,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
