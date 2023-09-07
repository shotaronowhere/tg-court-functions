import axios from "axios";
import { supportedChainIds, getKBSubgraphData } from "../../../config/subgraph";
import { getAddress } from "ethers";
import { JurorsDrawnQuery } from "../../../generated/kleros-board-graphql";
import { notificationSystem } from "../../../config/supabase";
import { ArrayElement } from "../../../types";
import PQueue from "p-queue";

const queue = new PQueue({
    intervalCap: 20,
    interval: 1000,
    carryoverConcurrencyCount: true,
});

export const draw = async (
    timestampLastUpdate: number,
    chainid: ArrayElement<typeof supportedChainIds>
) => {
    const JurorsDrawn = (await getKBSubgraphData(chainid, "JurorsDrawn", {
        timestamp: timestampLastUpdate,
    })) as JurorsDrawnQuery;

    if (!JurorsDrawn || !JurorsDrawn.draws)
        throw new Error("invalid timestamp or subgraph error");

    const uniqueJurors = removeDuplicatesByProperties(
        JurorsDrawn.draws,
        "address",
        "disputeId"
    );
    for (const drawnJuror of uniqueJurors) {
        const tg_users = await notificationSystem
            .from(`tg-juror-subscriptions`)
            .select("tg_user_id")
            .eq("juror_address", getAddress(drawnJuror.address));

        if (!tg_users?.data || tg_users?.data?.length == 0) continue;

        for (const tg_user of tg_users?.data!) {
            const tg_users_id = tg_user.tg_user_id.toString();

            await queue.add(async () => {
                await axios.post(
                    `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
                    {
                        chat_id: tg_users_id,
                        text: formatMessage(drawnJuror, chainid),
                        parse_mode: "Markdown",
                        disable_web_page_preview: true,
                    }
                );
            });
        }
        if (drawnJuror.timestamp > timestampLastUpdate) {
            timestampLastUpdate = drawnJuror.timestamp;
        }
    }

    await queue.onIdle();
    return timestampLastUpdate;
};

const formatMessage = (
    drawnJuror: ArrayElement<JurorsDrawnQuery["draws"]>,
    chainid: number
) => {
    const shortAddress =
        drawnJuror.address.slice(0, 6) + "..." + drawnJuror.address.slice(-4);
    return `Juror *${shortAddress}* has been drawn in [dispute ${
        drawnJuror.disputeId
    }](https://court.kleros.io/cases/${drawnJuror.disputeId}) (*${
        chainid == 1 ? "mainnet" : "gnosis"
    }*).`;
};

function removeDuplicatesByProperties(
    arr: any[],
    prop1: string,
    prop2: string
): any[] {
    const uniqueMap = new Map();
    const result = [];

    for (const obj of arr) {
        const propertyPair = `${obj[prop1]}_${obj[prop2]}`;
        if (!uniqueMap.has(propertyPair)) {
            uniqueMap.set(propertyPair, true);
            result.push(obj);
        }
    }

    return result;
}
