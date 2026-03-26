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
    try {
      const data = await getProjects();
      setProjects(data);
      const savedId = localStorage.getItem('jirasync_active_project');
      if (savedId) {
        const found = data.find((p) => p.id === savedId);
        if (found) setActiveProjectState(found);
        else if (data.length > 0) setActiveProjectState(data[0]);
      } else if (data.length > 0) {
        setActiveProjectState(data[0]);
      }
    } catch (e) {
      console.error('refreshProjects error:', e);
    }
  }, []);

  const refreshProfiles = useCallback(async () => {
    try {
      const data = await getAllProfiles();
      setProfiles(data);
    } catch (e) {
      console.error('refreshProfiles error:', e);
    }
  }, []);

  const setActiveProject = useCallback((p: Project | null) => {
    setActiveProjectState(p);
    if (p) localStorage.setItem('jirasync_active_project', p.id);
    else localStorage.removeItem('jirasync_active_project');
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const resolveProfile = useCallback(async (authUser: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  }): Promise<Profile | null> => {
    try {
      let profile = await getProfile(authUser.id);
      if (!profile) {
        await upsertProfile({
          id: authUser.id,
          email: authUser.email ?? '',
          full_name: (authUser.user_metadata?.['full_name'] as string) ?? null,
          avatar_url: null,
        });
        profile = await getProfile(authUser.id);
      }
      return profile;
    } catch (e) {
      console.error('resolveProfile error:', e);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // ── Initial session check (guaranteed to call setLoading(false)) ──────────
    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        if (!mounted) return;
        try {
          if (session?.user) {
            const profile = await resolveProfile(session.user);
            if (!mounted) return;
            setUser(profile);
            if (profile) {
              await Promise.all([refreshProjects(), refreshProfiles()]);
            }
          }
        } catch (e) {
          console.error('session init error:', e);
        } finally {
          if (mounted) setLoading(false);
        }
      })
      .catch((e) => {
        console.error('getSession error:', e);
        if (mounted) setLoading(false);
      });

    // ── Listen for subsequent auth changes (sign in / sign out) ───────────────
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      try {
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setProjects([]);
          setProfiles([]);
          setActiveProjectState(null);
          setLoading(false);
          return;
        }
        if (event === 'SIGNED_IN' && session?.user) {
          setLoading(true);
          const profile = await resolveProfile(session.user);
          if (!mounted) return;
          setUser(profile);
          if (profile) {
            await Promise.all([refreshProjects(), refreshProfiles()]);
          }
          if (mounted) setLoading(false);
        }
      } catch (e) {
        console.error('auth change error:', e);
        if (mounted) setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [resolveProfile, refreshProjects, refreshProfiles]);

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
