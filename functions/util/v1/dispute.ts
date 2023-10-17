import axios from "axios";
import { getNewDisputes, supportedChainIdsV1 } from "../../../config/subgraph";
import { NewDisputesQuery } from "../../../generated/kleros-v1-notifications";
import { ArrayElement, BotData, Supported } from "../../../types";
import { Channel } from 'amqplib';
import { Logtail } from "@logtail/node";
import { sendToRabbitMQ } from "../rabbitMQ";
import { retryPromise } from "../retry";
import { Wallet } from "ethers";

export const dispute = async (
    channel: Channel,
    logtail: Logtail,
    signer: Wallet,
    blockHeight: number,
    botData: BotData,
    testTgUserId?: number
) => {
    while (1){
        const newDisputeData = await getNewDisputes(
            botData.network as Supported<typeof supportedChainIdsV1>,
            {
                blockHeight: blockHeight, 
                disputeID: Number(botData.indexLast)
            })

        if (!newDisputeData || !newDisputeData.disputes){
            logtail.error("invalid query or subgraph error.");
            break;
        }

        if (newDisputeData.disputes.length == 0) {
            break;
        }

        let messages = [];
        const group_id = testTgUserId ?? Number(process.env.NOTIFICATION_CHANNEL);

        const jurorsMessages = await Promise.all(newDisputeData.disputes.map(async (draw) => {
            const metaEvidenceUri = draw.disputeID.arbitrableHistory?.metaEvidence.id ??
            await retryPromise(
                () => {
                    console.log("fetching metaevidence for network and disputeID: ", botData.network, draw.disputeID);
                    return fetch(`https://kleros-api.netlify.app/.netlify/functions/get-dispute-metaevidence?chainId=${botData.network}&disputeId=${draw.disputeID}`).then(async (res) => (await res.json()).metaEvidenceUri)
                }).catch((e) => {console.error("dispute metaEvidenceUri fetch failed: ", draw.disputeID)});

            return { ...draw, message: await formatMessage(metaEvidenceUri, draw, botData.network) };
            }));

        for(const dispute of jurorsMessages){

            const payload = { 
                tg_subcribers: [group_id], 
                messages: [
                    {
                        cmd: "sendAnimation",
                        file: "dispute",
                    },
                    {
                    cmd: "sendMessage" as "sendMessage",
                    msg: dispute.message,
                    options: 
                        {
                            parse_mode: "Markdown",
                            disable_web_page_preview: true
                        }
                    }
                ]
            }

            messages.push(
                { payload, signedPayload: await signer.signMessage(JSON.stringify(payload))}
            );
        }
        if (messages.length != 0) {
            await sendToRabbitMQ(logtail, channel, messages);
        }
        botData.indexLast = (Number(botData.indexLast) + newDisputeData.disputes.length).toString();
        // don't bother to read more pages if there are less than 1000 disputes returned in query
        if (newDisputeData.disputes.length < 1000) {
            break;
        }
    }
    return botData;
}

const formatMessage = async (
    metaEvidenceUri: string | void | null,
    dispute: ArrayElement<NewDisputesQuery["disputes"]>,
    chainid: number
) => {
    let name = dispute.court.name;
    if (!name) {
        try {
            name = await axios.get(`https://ipfs.kleros.io/${dispute.court.policy}`).then((res) => res.data.name);
        } catch (e) {
            console.log(e);
        }
    }

    let title: string | undefined;
    let description: string | undefined;
    if (metaEvidenceUri) {
        try {
            const res = await axios.get(`https://ipfs.kleros.io/${metaEvidenceUri}`).catch((e) => { console.error(e); return undefined; });
            title = res?.data?.title;
            description = res?.data?.description;
        } catch (e) {
            console.error(e);
        }
    }

    return `[Dispute ${dispute.disputeID}](https://court.kleros.io/cases/${dispute.disputeID}) (*V1${chainid == 1 ? "" : " Gnosis"}*) created in subcourt *${name ?? `id - ${dispute.court.id}`}*.${title ? `\n\n*Summary*: ${description}` : ""}`;
};