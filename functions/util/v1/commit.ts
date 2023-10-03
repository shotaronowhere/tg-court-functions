import { getCommits, supportedChainIds } from "../../../config/subgraph";
import { getAddress } from "ethers";
import { JurorsCommitQuery } from "../../../generated/kleros-v1-notifications";
import { notificationSystem } from "../../../config/supabase";
import { ArrayElement, BotData, Supported } from "../../../types";
import { Channel } from 'amqplib';
import { Logtail } from "@logtail/node";
import { sendToRabbitMQ } from "../rabbitMQ";

export const commit = async (
    channel: Channel,
    logtail: Logtail,
    blockHeight: number,
    botData: BotData
): Promise<BotData> => {
    while (1){
        const reminderDeadline = Math.floor(Date.now() / 1000) + 86400;
        const jurorsCommit = await getCommits(
            botData.network as Supported<typeof supportedChainIds>,
            {
                reminderDeadline,
                blockHeight,
                indexLast: botData.indexLast,
            }
        )
        
        if (!jurorsCommit || !jurorsCommit.draws){
            logtail.error("invalid query or subgraph error. BotData: ", {botData});
            break;
        }

        if (jurorsCommit.draws.length == 0) {
            break;
        }

        const jurors: string[] = jurorsCommit.draws.map((juror) => getAddress(juror.address));
        const jurorsMessages = jurorsCommit.draws.map((juror) => {
            return { ...juror, message: formatMessage(juror, botData.network) };
          });
          
        const tg_users = await notificationSystem.rpc("get_subscribers", {vals: jurors})

        if (!tg_users || tg_users.error!= null){
            break;
        }

        let messages = [];
        if(tg_users.data.length != 0){
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
        botData.indexLast += (jurorsCommit.draws[jurorsCommit.draws.length - 1].disputeID.periodCommitIndex + 1).toString();
        if (jurorsCommit.draws.length < 1000) break;
    }
    return botData;
};

const formatMessage = (
    juror: ArrayElement<JurorsCommitQuery["draws"]>,
    chainid: number
) => {
    const secRemaining = Math.floor(Number(juror.disputeID.periodDeadline) - Date.now()/1000)
    const daysRemaining = Math.floor(secRemaining / 86400)
    const hoursRemaining = Math.floor((secRemaining % 86400) / 3600)
    const timeRemaining = daysRemaining > 1 ? `${daysRemaining} days` : 
                            daysRemaining > 0 ? `${daysRemaining} days ${hoursRemaining} hours` : `${hoursRemaining} hours`
    const shortAddress = juror.address.slice(0, 5) + "..." + juror.address.slice(-3);
    return `*** Time to commit your vote!*** 
    
The commit phase has started in [case ${
        juror.disputeID.id
    }](https://court.kleros.io/cases/${juror.disputeID.id}) ${
        chainid == 1 ? "" : "(*gnosis*) "
    }for juror *${shortAddress}*.
    
This dispute is commit-reveal. Remember to reveal your vote later.

You have ${timeRemaining} to commit your vote.`;
};