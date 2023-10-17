import { getAppealableDisputes, supportedChainIdsV1 } from "../../../config/subgraph";
import { getAddress } from "ethers";
import { JurorsAppealQuery } from "../../../generated/kleros-v1-notifications";
import { notificationSystem } from "../../../config/supabase";
import { ArrayElement, BotData, Supported } from "../../../types";
import { Channel } from 'amqplib';
import { Logtail } from "@logtail/node";
import { sendToRabbitMQ } from "../rabbitMQ";
import { Wallet } from "ethers";

export const appeal = async (
    channel: Channel,
    logtail: Logtail,
    signer: Wallet,
    blockHeight: number,
    botData: BotData,
    testTgUserId?: number
): Promise<BotData> => {
    while (1){
        const reminderDeadline = Math.floor(Date.now() / 1000) + 86400;
        const jurorsAppeal = await getAppealableDisputes(
            botData.network as Supported<typeof supportedChainIdsV1>,
            {
                reminderDeadline,
                blockHeight,
                indexLast: botData.indexLast,
            }
        )
        

        if (!jurorsAppeal || !jurorsAppeal.userDisputeInfos){
            logtail.error("invalid query or subgraph error. BotData: ", {botData});
            break;
        }

        if (jurorsAppeal.userDisputeInfos.length == 0) {
            break;
        }

        const jurors: string[] = jurorsAppeal.userDisputeInfos.map((juror) => getAddress(juror.juror));
          
        const tg_users = await notificationSystem.rpc("get_subscribers", {vals: jurors})

        if (!tg_users || tg_users.error!= null){
            break;
        }

        const jurorsMessages = jurorsAppeal.userDisputeInfos.map((juror) => {
            return { ...juror, message: formatMessage(juror, botData.network)};
          });

        let messages = [];
        for (const juror of jurorsMessages) {
            let tg_subcribers : number[] = [];
            if (testTgUserId != null){
                tg_subcribers.push(testTgUserId);
            } else {
                tg_users.data.find((tg_user: { juror_address: string; }) => tg_user.juror_address == getAddress(juror.juror));
                // get_subscribers returns sorted by juror_address
                let index = tg_users.data.findIndex((tg_user: { juror_address: string; }) => tg_user.juror_address == getAddress(juror.juror));
                if (index == -1) continue; 
                while (tg_users.data[index]?.juror_address == getAddress(juror.juror)){
                    tg_subcribers.push(tg_users.data[index]?.tg_user_id);
                    index++;
                }
            }
            
            // Telegram API malfunctioning, can't send caption with animation
            // sending two messages instead
            const payload = { 
                tg_subcribers, 
                messages: [
                    {
                    cmd: "sendAnimation",
                    file: "appeal",
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
        botData.indexLast = (Number(jurorsAppeal.userDisputeInfos[jurorsAppeal.userDisputeInfos.length - 1].dispute.periodNotificationIndex) + 1).toString();
        if (jurorsAppeal.userDisputeInfos.length < 1000) break;
    }
    return botData;
};

const formatMessage = (
    appeal: ArrayElement<JurorsAppealQuery["userDisputeInfos"]>,
    network: number
): string => {
    const secRemaining = Math.floor(Number(appeal.dispute.periodDeadline) - Date.now()/1000)
    const daysRemaining = Math.floor(secRemaining / 86400)
    const hoursRemaining = Math.floor((secRemaining % 86400) / 3600)
    const minRemaining = Math.floor((secRemaining % 3600) / 60)
    const timeRemaining = `${daysRemaining > 0 ? `${daysRemaining} day ` : ""}` +
                            `${hoursRemaining > 0 ? `${hoursRemaining} hour ` : ""}` +
                            `${minRemaining > 0 && daysRemaining == 0 ? `${minRemaining} min ` : ""}`
    return `[Dispute ${appeal?.dispute.id}](https://court.kleros.io/cases/${
        appeal?.dispute.id
    }) ${network == 1 ? "(*V1*)" : "(*V1 Gnosis*)"} concluded it's current round!
    
If you think the ruling is incorrect, you can request an [appeal](https://court.kleros.io/cases/${appeal.dispute.id}). There is ${timeRemaining}left to appeal.`
};
