import { schedule } from "@netlify/functions";
import { notify } from "./util/notify";

export const handler = schedule("@hourly", notify)