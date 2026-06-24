import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

let cachedClient: ReturnType<typeof createStoryPagesAdminClient> | undefined;

function createStoryPagesAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.STORY_SYNC_SERVICE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase server environment variables. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or STORY_SYNC_SERVICE_KEY) are set.'
    );
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function getStoryPagesAdminClient() {
  if (!cachedClient) {
    cachedClient = createStoryPagesAdminClient();
  }

  return cachedClient;
}
