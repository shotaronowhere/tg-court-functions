import axios from "axios";
import { datalake } from "../../../config/supabase";
import {
    supportedChainIds,
    getKBSubgraphData,
    getKDSubgraphData,
} from "../../../config/subgraph";
import { AppealableDisputesQuery } from "../../../generated/kleros-board-graphql";
import { ArrayElement } from "../../../types";
import PQueue from "p-queue";

const queue = new PQueue({
    intervalCap: 20,
    interval: 60000,
    carryoverConcurrencyCount: true,
});

export const appeal = async (
    timestampLastUpdate: number,
    chainid: ArrayElement<typeof supportedChainIds>
) => {
    const AppealableDisputesData = (await getKBSubgraphData(
        chainid,
        "AppealableDisputes",
        timestampLastUpdate
    )) as AppealableDisputesQuery;

    if (!AppealableDisputesData || !AppealableDisputesData.disputes)
        throw new Error("invalid timestamp or subgraph error");

    for (const appeal of AppealableDisputesData.disputes) {
        const MetaevidenceData = await getKDSubgraphData(
            chainid,
            "metaevidence",
            appeal.disputeID
        );

        if (!MetaevidenceData || !MetaevidenceData.dispute)
            throw new Error("invalid dispute or subgraph error");

        let metaEvidenceUri =
            MetaevidenceData.dispute.arbitrableHistory?.metaEvidence;
        if (!metaEvidenceUri) {
            const { data } = await datalake
                .from("court-v1-metaevidence")
                .select("uri")
                .eq("chainId", chainid)
                .eq("arbitrable", appeal.arbitrable.id)
                .eq("metaEvidenceId", MetaevidenceData.dispute.metaEvidenceId);

            if (data && data.length) {
                metaEvidenceUri = data[0].uri ?? undefined;
            }
        }

        const msg = await formatMessage(
            metaEvidenceUri,
            appeal,
            chainid == 1 ? "ethereum" : "gnosis"
        );

        await queue.add(async () => {
            await axios.post(
                `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
                {
                    chat_id: process.env.NOTIFICATION_CHANNEL,
                    text: msg,
                    parse_mode: "Markdown",
                    disable_web_page_preview: true,
                }
            );
        });
        if (appeal.lastPeriodChange > timestampLastUpdate) {
            timestampLastUpdate = appeal.lastPeriodChange;
        }
    }
    await queue.onIdle();
    return timestampLastUpdate;
};

const formatMessage = async (
    metaEvidenceUri: string | undefined,
    appeal: any,
    network: string
) => {
    let res;
    if (metaEvidenceUri) {
        try {
            res = await axios.get(`https://ipfs.kleros.io/${metaEvidenceUri}`);
        } catch (e) {}
    }
    const title = res?.data?.title;
    const description = res?.data?.description;
    const isReality = "A reality.eth question" == title;
    const isModerate = (res?.data?.fileURI as string).includes(
        "Content%20Moderation"
    );
    const refuseToArbitrate = appeal.currentRulling == 0;
    let answerString = "";
    if (refuseToArbitrate) {
        answerString = "Refuse to arbitrate";
    } else if (res?.data?.rulingOptions) {
        const answerDes =
            res?.data?.rulingOptions?.descriptions[
                Number(appeal.currentRulling - 1)
            ];
        const answerTitle =
            res?.data?.rulingOptions?.titles[Number(appeal.currentRulling - 1)];
        answerString = `${answerTitle}, ${answerDes}`;
    } else if (isModerate) {
        answerString =
            appeal.currentRulling == 1
                ? `Yes, the user broke the rules`
                : `No, the user didn't break the rules`;
    } else {
        answerString = `Kleros ruling ${appeal.currentRulling}`;
    }
    let questionString = isModerate
        ? "Did the user break the rules? (Content Moderation)"
        : res?.data?.question;

    return `[Dispute ${appeal.disputeID}](https://court.kleros.io/cases/${
        appeal.disputeID
    }) on ${network} concluded it's current round!
      
*${description}*

Question: ${questionString ? questionString : "See court for question"}

Current Ruling: ${
        answerString
            ? answerString
            : `${appeal.currentRulling} (see court for ruling meaning)`
    }

If you think the ruling is incorrect, you can request an [appeal]${
        isReality
            ? `(https://resolve.kleros.io/cases/${appeal.disputeID})`
            : `(https://court.kleros.io/cases/${appeal.disputeID})`
    }.`;
};
