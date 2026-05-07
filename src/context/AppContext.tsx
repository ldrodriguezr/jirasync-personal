import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getProfile, getAllProfiles, getProjects, upsertProfile, getProjectTags } from '../lib/db';
import type { Profile, Project, ProjectTag } from '../types';

interface AppContextType {
  user: Profile | null;
  loading: boolean;
  activeProject: Project | null;
  projects: Project[];
  profiles: Profile[];
  projectTags: ProjectTag[];
  setActiveProject: (p: Project | null) => void;
  refreshProjects: () => Promise<void>;
  refreshProfiles: () => Promise<void>;
  refreshTags: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

function authUserToProfile(authUser: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}): Profile {
  return {
    id: authUser.id,
    email: authUser.email ?? '',
    full_name: (authUser.user_metadata?.['full_name'] as string) ?? null,
    avatar_url: null,
    created_at: new Date().toISOString(),
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeProject, setActiveProjectState] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [projectTags, setProjectTags] = useState<ProjectTag[]>([]);

  const refreshTags = useCallback(async (projectId?: string) => {
    const id = projectId ?? activeProject?.id;
    if (!id) { setProjectTags([]); return; }
    try {
      const tags = await getProjectTags(id);
      setProjectTags(tags);
    } catch (e) {
      console.error('refreshTags error:', e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject?.id]);

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
    if (p) {
      localStorage.setItem('jirasync_active_project', p.id);
      getProjectTags(p.id).then(setProjectTags).catch(console.error);
    } else {
      localStorage.removeItem('jirasync_active_project');
      setProjectTags([]);
    }
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
      // Never block login due to profile table issues.
      return authUserToProfile(authUser);
    }
  }, []);

  const withTimeout = useCallback(async <T,>(
    promise: Promise<T>,
    ms: number,
    fallback: T
  ): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<T>((resolve) => {
      timeoutId = setTimeout(() => resolve(fallback), ms);
    });
    const result = await Promise.race([promise, timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);
    return result;
  }, []);

  useEffect(() => {
    let mounted = true;
    // Safety-net: force loading=false after 5s no matter what
    const safetyTimer = setTimeout(() => { if (mounted) setLoading(false); }, 5000);

    // ── Initial session check (guaranteed to call setLoading(false)) ──────────
    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        if (!mounted) return;
        try {
          if (session?.user) {
            const profile = await withTimeout(resolveProfile(session.user), 3000, null);
            if (!mounted) return;
            setUser(profile ?? authUserToProfile(session.user));
            // Fetch additional data in parallel but never block loading forever
            if (profile && mounted) {
              await Promise.allSettled([
                withTimeout(refreshProjects(), 3000, undefined),
                withTimeout(refreshProfiles(), 3000, undefined),
              ]);
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
      })
      .finally(() => clearTimeout(safetyTimer));

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
          // Do not lock the whole app on sign-in follow-up calls.
          const profile = await withTimeout(resolveProfile(session.user), 3000, null);
          if (!mounted) return;
          setUser(profile ?? authUserToProfile(session.user));
          if (profile) {
            await Promise.allSettled([
              withTimeout(refreshProjects(), 3000, undefined),
              withTimeout(refreshProfiles(), 3000, undefined),
            ]);
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
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [resolveProfile, refreshProjects, refreshProfiles, withTimeout]);

  return (
    <AppContext.Provider
      value={{
        user,
        loading,
        activeProject,
        projects,
        profiles,
        projectTags,
        setActiveProject,
        refreshProjects,
        refreshProfiles,
        refreshTags,
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
