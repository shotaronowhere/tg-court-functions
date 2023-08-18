import { createClient } from "@supabase/supabase-js";

export const datalake = createClient(
  process.env.DATALAKE_URL,
  process.env.DATALAKE_KEY,
  {auth: {persistSession: false}}
);

export const notificationSystem = createClient(
  process.env.NOTIFICATION_URL,
  process.env.NOTIFICATION_KEY,
  {auth: {persistSession: false}}
);
