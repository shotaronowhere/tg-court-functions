export { Database as DatalakeDatabase } from "./supabase-datalake";
export { Database as NotificationDatabase } from "./supabase-notification";

export type ArrayElement<ArrayType extends readonly unknown[]> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

export type Supported<A extends number[]> = ArrayElement<A>;
