import { createClient } from "@supabase/supabase-js";

export const datalake = createClient(
  process.env.DATALAKE_URL,
  process.env.DATALAKE_KEY
);
