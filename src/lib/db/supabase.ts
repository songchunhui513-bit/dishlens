import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | undefined;
let _adminClient: SupabaseClient | undefined;

function getClient(): SupabaseClient | undefined {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return undefined;

  _client = createClient(url, key);
  return _client;
}

function getAdminClient(): SupabaseClient | undefined {
  if (_adminClient) return _adminClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return undefined;

  _adminClient = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return _adminClient;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function noop(): any {
  return new Proxy(
    {},
    {
      get(_, prop: string) {
        if (prop === "then") return undefined;
        return noop;
      },
      apply() {
        return noop();
      },
    }
  );
}

function from(table: string) {
  const c = getClient();
  if (!c) return noop();
  return c.from(table);
}

export const supabase = { from } as unknown as SupabaseClient;
export { getClient as getSupabaseClient };
export { getAdminClient as getSupabaseAdminClient };
