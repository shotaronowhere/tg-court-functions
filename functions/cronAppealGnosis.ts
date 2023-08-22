import { cronAppeal } from "./util/cronAppeal";
import { Handler, schedule } from "@netlify/functions";

const handler: Handler = async () => {
    return await cronAppeal("gnosis");
};

module.exports.handler = schedule("@hourly", handler);