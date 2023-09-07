import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { DatalakeDatabase, NotificationDatabase } from "../types";

dotenv.config();

export const datalake = createClient<DatalakeDatabase>(
  process.env.DATALAKE_URL,
  process.env.DATALAKE_KEY,
  {auth: {persistSession: false}}
);

export const notificationSystem = createClient<NotificationDatabase>(
  process.env.NOTIFICATION_URL,
  process.env.NOTIFICATION_KEY,
  {auth: {persistSession: false}}
);
