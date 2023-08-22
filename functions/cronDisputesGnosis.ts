import { cronDispute } from "./util/cronDispute";
import { Handler, schedule } from "@netlify/functions";

const handler: Handler = async () => {
    return await cronDispute("gnosis");
};

module.exports.handler = schedule("0 */4 * * *", handler);