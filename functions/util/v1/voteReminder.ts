import { getVotesReminders, supportedChainIds } from "../../../config/subgraph";
import { getAddress } from "ethers";
import { JurorsVoteReminderQuery } from "../../../generated/kleros-v1-notifications";
import { notificationSystem } from "../../../config/supabase";
import { ArrayElement, BotData, Supported } from "../../../types";
import { Channel } from 'amqplib';
import { Logtail } from "@logtail/node";
import { sendToRabbitMQ } from "../rabbitMQ";

export const voteReminder = async (
    channel: Channel,
    logtail: Logtail,
    blockHeight: number,
    botData: BotData
): Promise<BotData> => {
    while (1){
        const timeNow = Math.floor(Date.now() / 1000);
        const reminderDeadline = timeNow + 86400; // 24 hours
        const jurorsVote = await getVotesReminders(
            botData.network as Supported<typeof supportedChainIds>,
            {
                timeNow,
                reminderDeadline,
                blockHeight,
                idLast: botData.indexLast,
                blockLast: botData.blockHeight
            }
        )
        
        if (!jurorsVote || !jurorsVote.draws){
            logtail.error("invalid query or subgraph error. BotData: ", {botData});
            break;
        }

        if (jurorsVote.draws.length == 0) {
            botData.indexLast = "0";
            botData.blockHeight = blockHeight;
            break;
        }

        const jurors: string[] = jurorsVote.draws.map((juror) => getAddress(juror.address));
        const jurorsMessages = jurorsVote.draws.map((juror) => {
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
                            file: "./assets/vote.webp",
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
        botData.indexLast = jurorsVote.draws[jurorsVote.draws.length - 1].id;
        if (jurorsVote.draws.length < 1000){
            botData.blockHeight = blockHeight;
            break;
        };
    }
    return botData;
};

const formatMessage = (
    juror: ArrayElement<JurorsVoteReminderQuery["draws"]>,
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
    return `*** Time is running out to ${action} your vote!*** 
    
    The ${label} phase has started in [case ${
        juror.disputeID.id
    }](https://court.kleros.io/cases/${juror.disputeID.id}) ${
        chainid == 1 ? "" : "(*gnosis*) "
    }for juror *${shortAddress}*.
    
    You have ${timeRemaining} to ${action} your vote.`
};