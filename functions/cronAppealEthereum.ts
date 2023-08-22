import { cronAppeal } from "./util/cronAppeal";
import { cronAppeal } from "./util/cronAppeal";
import { Handler, schedule } from "@netlify/functions";

const handler: Handler = async () => {
    return await cronAppeal("ethereum");
    return await cronAppeal("ethereum");
};

module.exports.handler = schedule("@hourly", handler);