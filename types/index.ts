export { Database as DatalakeDatabase } from "./supabase-datalake";
import { Database as NotificationDatabase } from "./supabase-notification";
export { NotificationDatabase }

export type ArrayElement<ArrayType extends readonly unknown[]> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

export type Supported<A extends number[]> = ArrayElement<A>;

export type BotData = NotificationDatabase["public"]["Tables"]["hermes-tg-counters-testing"]["Row"]