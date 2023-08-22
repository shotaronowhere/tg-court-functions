import { cronAppeal } from "./util/cronAppeal";
import { Handler, schedule } from "@netlify/functions";

const handler: Handler = async () => {
    return await cronAppeal("ethereum");
};

module.exports.handler = schedule("0 */4 * * *", handler);