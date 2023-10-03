import { getVotes, supportedChainIds } from "../../../config/subgraph";
import { getAddress } from "ethers";
import { JurorsVoteQuery } from "../../../generated/kleros-v1-notifications";
import { notificationSystem } from "../../../config/supabase";
import { ArrayElement, BotData, Supported } from "../../../types";
import { Channel } from 'amqplib';
import { Logtail } from "@logtail/node";
import { sendToRabbitMQ } from "../rabbitMQ";

export const vote = async (
    channel: Channel,
    logtail: Logtail,
    blockHeight: number,
    botData: BotData
): Promise<BotData> => {
    while (1){
        const reminderDeadline = Math.floor(Date.now() / 1000) + 86400;
        const jurorsDrawn = await getVotes(
            botData.network as Supported<typeof supportedChainIds>,
            {
                reminderDeadline,
                blockHeight,
                indexLast: botData.indexLast,
            }
        )
            console.log("jurorsDrawn: ", jurorsDrawn);
        if (!jurorsDrawn || !jurorsDrawn.draws){
            logtail.error("invalid query or subgraph error. BotData: ", {botData});
            break;
        }

        if (jurorsDrawn.draws.length == 0) {
            break;
        }

        const jurors: string[] = jurorsDrawn.draws.map((juror) => getAddress(juror.address));
        const jurorsMessages = jurorsDrawn.draws.map((juror) => {
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
        botData.indexLast = (jurorsDrawn.draws[jurorsDrawn.draws.length - 1].disputeID.periodVoteIndex + 1).toString();
        if (jurorsDrawn.draws.length < 1000) break;
    }
    return botData;
};

const formatMessage = (
    juror: ArrayElement<JurorsVoteQuery["draws"]>,
    chainid: number
) => {
    const isCommitReveal = juror.disputeID.subcourt.hiddenVotes;
    const action = isCommitReveal ? "reveal" : "cast";
    const label = isCommitReveal ? "reveal" : "vote";
    const secRemaining = Math.floor(Number(juror.disputeID.periodDeadline) - Date.now()/1000)
    const daysRemaining = Math.floor(secRemaining / 86400)
    const hoursRemaining = Math.floor((secRemaining % 86400) / 3600)
    const timeRemaining = daysRemaining > 1 ? `${daysRemaining} days` : 
                            daysRemaining > 0 ? `${daysRemaining} days ${hoursRemaining} hours` : `${hoursRemaining} hours`
    const shortAddress = juror.address.slice(0, 5) + "..." + juror.address.slice(-3);
    return `*** Time to ${action} your vote!*** 
    
    The ${label} phase has started in [case ${
        juror.disputeID.id
    }](https://court.kleros.io/cases/${juror.disputeID.id}) ${
        chainid == 1 ? "" : "(*gnosis*) "
    }for juror *${shortAddress}*.
    
    You have ${timeRemaining} to ${action} your vote.`
};