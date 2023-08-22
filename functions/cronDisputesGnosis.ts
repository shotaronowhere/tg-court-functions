import { cronDispute } from "./util/cronDispute";
import { Handler, schedule } from "@netlify/functions";

const handler: Handler = async () => {
    return await cronDispute("gnosis");
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

module.exports.handler = schedule("@hourly", handler);