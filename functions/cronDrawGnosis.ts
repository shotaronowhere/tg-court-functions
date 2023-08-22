import { cronDraw } from "./util/cronDraw";
import { Handler, schedule } from "@netlify/functions";

const handler: Handler = async () => {
    return await cronDraw("gnosis");
};

module.exports.handler = schedule("@hourly", handler);