import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const auth = {
  signUp: async (email, password, displayName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;

    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          display_name: displayName || email.split('@')[0],
        });

      if (profileError) throw profileError;
    }

    return data;
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  getCurrentUser: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  onAuthStateChange: (callback) => {
    return supabase.auth.onAuthStateChange(callback);
  },
};

export const db = {
  sessions: {
    list: async (userId) => {
      const { data, error } = await supabase
        .from('collaboration_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },

    create: async (userId, title, description = '') => {
      const { data, error } = await supabase
        .from('collaboration_sessions')
        .insert({
          user_id: userId,
          title,
          description,
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    },

    update: async (sessionId, updates) => {
      const { data, error } = await supabase
        .from('collaboration_sessions')
        .update(updates)
        .eq('id', sessionId)
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    },

    delete: async (sessionId) => {
      const { error } = await supabase
        .from('collaboration_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;
    },
  },

  phases: {
    list: async (sessionId) => {
      const { data, error } = await supabase
        .from('session_phases')
        .select('*')
        .eq('session_id', sessionId)
        .order('phase_number', { ascending: true });

      if (error) throw error;
      return data;
    },

    create: async (sessionId, phaseNumber, phaseName, content = '') => {
      const { data, error } = await supabase
        .from('session_phases')
        .insert({
          session_id: sessionId,
          phase_number: phaseNumber,
          phase_name: phaseName,
          content,
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    },

    update: async (phaseId, updates) => {
      const { data, error } = await supabase
        .from('session_phases')
        .update(updates)
        .eq('id', phaseId)
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  },

  artifacts: {
    list: async (userId, sessionId = null) => {
      let query = supabase
        .from('artifacts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (sessionId) {
        query = query.eq('session_id', sessionId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },

    create: async (userId, title, type, content, sessionId = null) => {
      const { data, error } = await supabase
        .from('artifacts')
        .insert({
          user_id: userId,
          session_id: sessionId,
          title,
          type,
          content,
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  },

  principles: {
    list: async (userId) => {
      const { data, error } = await supabase
        .from('principles')
        .select('*')
        .eq('user_id', userId)
        .order('order_index', { ascending: true });

      if (error) throw error;
      return data;
    },

    create: async (userId, title, description, category) => {
      const { data, error } = await supabase
        .from('principles')
        .insert({
          user_id: userId,
          title,
          description,
          category,
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  },

  narratives: {
    list: async (userId, includePublic = false) => {
      let query = supabase
        .from('narratives')
        .select('*')
        .order('created_at', { ascending: false });

      if (includePublic) {
        query = query.or(`user_id.eq.${userId},is_public.eq.true`);
      } else {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },

    create: async (userId, title, content, tags = [], isPublic = false, sessionId = null) => {
      const { data, error } = await supabase
        .from('narratives')
        .insert({
          user_id: userId,
          session_id: sessionId,
          title,
          content,
          tags,
          is_public: isPublic,
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  },

  reflections: {
    list: async (userId, sessionId = null) => {
      let query = supabase
        .from('reflections')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (sessionId) {
        query = query.eq('session_id', sessionId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },

    create: async (userId, sessionId, insight, context = '', tags = []) => {
      const { data, error } = await supabase
        .from('reflections')
        .insert({
          user_id: userId,
          session_id: sessionId,
          insight,
          context,
          tags,
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  },
};
