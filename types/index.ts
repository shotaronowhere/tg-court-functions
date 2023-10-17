export { Database as DatalakeDatabase } from "./supabase-datalake";
import { Database as NotificationDatabase } from "./supabase-notification";
export { NotificationDatabase }
import { ParseMode } from "grammy/types";

export type ArrayElement<ArrayType extends readonly unknown[]> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

export type Supported<A extends number[]> = ArrayElement<A>;

export type BotData = NotificationDatabase["public"]["Tables"]["hermes-counters"]["Row"]

export type HermesMessage = {
  payload: {
          tg_subcribers: number[];
          messages: ({
          cmd: "sendAnimation";
          file: string;
      } | {
          cmd: "sendMessage";
          msg: string;
          options: {
              parse_mode: ParseMode;
          };
      })[]
  }
  signedPayload: string;
}