import { getAppealableDisputes, supportedChainIds } from "../../../config/subgraph";
import { getAddress } from "ethers";
import { JurorsAppealQuery } from "../../../generated/kleros-v1-notifications";
import { notificationSystem } from "../../../config/supabase";
import { ArrayElement, BotData, Supported } from "../../../types";
import { Channel } from 'amqplib';
import { Logtail } from "@logtail/node";
import { sendToRabbitMQ } from "../rabbitMQ";

export const appeal = async (
    channel: Channel,
    logtail: Logtail,
    blockHeight: number,
    botData: BotData
): Promise<BotData> => {
    while (1){
        const reminderDeadline = Math.floor(Date.now() / 1000) + 86400;
        const jurorsAppeal = await getAppealableDisputes(
            botData.network as Supported<typeof supportedChainIds>,
            {
                reminderDeadline,
                blockHeight,
                indexLast: botData.indexLast,
            }
        )
        
        console.log(jurorsAppeal);

        if (!jurorsAppeal || !jurorsAppeal.draws){
            logtail.error("invalid query or subgraph error. BotData: ", {botData});
            break;
        }

        if (jurorsAppeal.draws.length == 0) {
            break;
        }

        const jurors: string[] = jurorsAppeal.draws.map((juror) => getAddress(juror.address));
          
        const tg_users = await notificationSystem.rpc("get_subscribers", {vals: jurors})

        if (!tg_users || tg_users.error!= null){
            break;
        }

        const jurorsMessages = jurorsAppeal.draws.map((juror) => {
            return { ...juror, message: formatMessage(juror, botData.network)};
          });

          if(tg_users.data.length != 0){
            let messages = [];
            for (const juror of jurorsMessages) {
                tg_users.data.find((tg_user) => tg_user.juror_address == getAddress(juror.address));
                // get_subscribers returns sorted by juror_address
                let index = tg_users.data.findIndex((tg_user) => tg_user.juror_address == getAddress(juror.address));
                if (index == -1) continue; 
                let tg_subcribers : number[] = [];
                while (tg_users.data[index]?.juror_address == getAddress(juror.address)){
                    tg_subcribers.push(tg_users.data[index]?.tg_user_id);
                    index++;
                }
                // Telegram API malfunctioning, can't send caption with animation
                // sending two messages instead
                messages.push(
                    { 
                        tg_subcribers, 
                        messages: [
                            {
                            cmd: "sendAnimation",
                            file: "./assets/drawn.webp",
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
                );
            }
            await sendToRabbitMQ(logtail, channel, messages);
        }
        botData.indexLast += (jurorsAppeal.draws[jurorsAppeal.draws.length - 1].disputeID.periodAppealIndex + 1).toString();
        if (jurorsAppeal.draws.length < 1000) break;
    }
    return botData;
};

const formatMessage = (
    appeal: ArrayElement<JurorsAppealQuery["draws"]>,
    network: number
): string => {
    const secRemaining = Math.floor(Number(appeal.disputeID.periodDeadline) - Date.now()/1000)
    const daysRemaining = Math.floor(secRemaining / 86400)
    const hoursRemaining = Math.floor((secRemaining % 86400) / 3600)
    const timeRemaining = daysRemaining > 1 ? `${daysRemaining} days` : 
                            daysRemaining > 0 ? `${daysRemaining} days ${hoursRemaining} hours` : `${hoursRemaining} hours`
    return `[Dispute ${appeal?.disputeID.id}](https://court.kleros.io/cases/${
        appeal?.disputeID.id
    }) ${network == 100 ? "(*gnosis*) " : ""}concluded it's current round!
    
If you think the ruling is incorrect, you can request an [appeal](https://court.kleros.io/cases/${appeal.disputeID.id}). There is ${timeRemaining} left to appeal.`
};
