import { getDrawsV2, supportedChainIdsV2 } from "../../../config/subgraph";
import { getAddress } from "ethers";
import { JurorsDrawnV2Query } from "../../../generated/kleros-v2-notifications";
import { notificationSystem } from "../../../config/supabase";
import { ArrayElement, BotData, Supported } from "../../../types";
import { Channel } from 'amqplib';
import { Logtail } from "@logtail/node";
import { sendToRabbitMQ } from "../rabbitMQ";
import { Wallet } from "ethers";

export const drawV2 = async (
    channel: Channel,
    logtail: Logtail,
    signer: Wallet,
    blockHeight: number,
    botData: BotData,
    testTgUserId?: number
): Promise<BotData> => {
    while (1){
        const jurorsDrawn = await getDrawsV2(
            botData.network as Supported<typeof supportedChainIdsV2>,
            {
                blockHeight,
                indexLast: botData.indexLast
            }
        )

        if (!jurorsDrawn || !jurorsDrawn.draws){
            logtail.error("invalid query or subgraph error. BotData: ", {botData});
            break;
        }

        if (jurorsDrawn.draws.length == 0) {
            break;
        }

        const jurors: string[] = jurorsDrawn.draws.map((juror) => getAddress(juror.juror.id));
        const jurorsMessages = jurorsDrawn.draws.map((juror) => {
            return { ...juror, message: formatMessage(juror, botData.network) };
          });
          

        const tg_users = await notificationSystem.rpc("get_subscribers", {vals: jurors})

        if (!tg_users || tg_users.error!= null){
            break;
        }

        let messages = [];
        for (const juror of jurorsMessages) {
            let tg_subcribers : number[] = [];
            if (testTgUserId != null){
                tg_subcribers.push(testTgUserId);
            } else {
                tg_users.data.find((tg_user) => tg_user.juror_address == getAddress(juror.juror.id));
                // get_subscribers returns sorted by juror_address
                let index = tg_users.data.findIndex((tg_user) => tg_user.juror_address == getAddress(juror.juror.id));
                if (index == -1) continue; 
                while (tg_users.data[index]?.juror_address == getAddress(juror.juror.id)){
                    tg_subcribers.push(tg_users.data[index]?.tg_user_id);
                    index++;
                }
            }
            // Telegram API malfunctioning, can't send caption with animation
            // sending two messages instead
            const payload = 
            { 
                tg_subcribers, 
                messages: [
                    {
                    cmd: "sendAnimation",
                    file: "drawn",
                    },{
                    cmd: "sendMessage",
                    msg: juror.message,
                    options: 
                        {
                            parse_mode: "Markdown",
                        }
                    }
                ]
            }

            messages.push({ payload, signedPayload: await signer.signMessage(JSON.stringify(payload))});
        }
        await sendToRabbitMQ(logtail, channel, messages);
        botData.indexLast = (Number(jurorsDrawn.draws[jurorsDrawn.draws.length - 1].drawNotificationIndex) + 1).toString();
        if (jurorsDrawn.draws.length < 1000) break;
    }
    return botData;
};

const formatMessage = (
    juror: ArrayElement<JurorsDrawnV2Query["draws"]>,
    chainid: number
) => {
    const isCommitReveal = juror.dispute.court.hiddenVotes;
    const secRemaining = Math.floor(Number(juror.dispute.periodDeadline) - Date.now()/1000)

    const daysRemaining = Math.floor(secRemaining / 86400)
    const hoursRemaining = Math.floor((secRemaining % 86400) / 3600)
    const minRemaining = Math.floor((secRemaining % 3600) / 60)
    const timeRemaining = `${daysRemaining > 0 ? `${daysRemaining} day${daysRemaining > 1 ? "s " : " "}` : ""}` +
                            `${hoursRemaining > 0 ? `${hoursRemaining} hour${hoursRemaining > 1 ? "s " : " "}` : ""}` +
                            `${minRemaining > 0 && daysRemaining == 0 ? `${minRemaining} min${minRemaining > 1 ? "s " : " "}` : ""}`
    const shortAddress = juror.juror.id.slice(0, 5) + "..." + juror.juror.id.slice(-3);
    return `***Juror duty awaits you!*** 
    
*${shortAddress}* has been drawn in [case ${
        juror.dispute.id
    }](https://court.kleros.io/cases/${juror.dispute.id}) (*V2*).
    
${isCommitReveal? "This dispute is commit-reveal. Remember to reveal your vote later.\n\n": ""} Voting starts in ${secRemaining > 60? timeRemaining.substring(0,timeRemaining.length-1): 'less than a minute'}. You can already start reviewing the evidence.`;
};