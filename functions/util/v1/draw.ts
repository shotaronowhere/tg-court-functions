import { getDraws, supportedChainIds } from "../../../config/subgraph";
import { getAddress } from "ethers";
import { JurorsDrawnQuery } from "../../../generated/kleros-v1-notifications";
import { notificationSystem } from "../../../config/supabase";
import { ArrayElement, BotData, Supported } from "../../../types";
import { Channel } from 'amqplib';
import { Logtail } from "@logtail/node";
import { sendToRabbitMQ } from "../rabbitMQ";

export const draw = async (
    channel: Channel,
    logtail: Logtail,
    blockHeight: number,
    botData: BotData
): Promise<BotData> => {
    let page = 0
    // read all pages
    while (1){
        const reminderDeadline = Math.floor(Date.now()/1000) + 86400;
        const jurorsDrawn = await getDraws(
            botData.network as Supported<typeof supportedChainIds>,
            {
                first: 1000,
                skip: botData.skip + page * 1000,
                reminderDeadline,
                BNLow: botData.counter_0,
                BNHigh: botData.counter_1 ?? blockHeight,
            }
        )

        if (!jurorsDrawn || !jurorsDrawn.draws){
            botData.skip = botData.skip + page * 1000;
            logtail.error("invalid query or subgraph error. BotData, page: ", {botData, page});
            break;
        }

        if (jurorsDrawn.draws.length == 0) {
            if (botData.counter_1 == null) { // last run finished
                botData.counter_0 = blockHeight + 1;
                break;
            }
            else {
                botData.counter_0 = botData.counter_1 + 1;
                botData.counter_1 = null;
                page = 0;
                botData.skip = 0;
                continue;
            }
        }

        const jurors: string[] = jurorsDrawn.draws.map((juror) => getAddress(juror.address));
        const jurorsMessages = jurorsDrawn.draws.map((juror) => {
            return { ...juror, message: formatMessage(juror, botData.network) };
          });
          
        const tg_users = await notificationSystem.rpc("get_subscribers", {vals: jurors})

        if (!tg_users || tg_users.error!= null){
            break;
        }
            
        if(tg_users.data.length == 0){
            if(jurorsDrawn.draws.length == 1000){
                page++;
                continue
            } else {
                break;
            }
        }


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
        page++;
    }
    return botData;
};

const formatMessage = (
    juror: ArrayElement<JurorsDrawnQuery["draws"]>,
    chainid: number
) => {
    const isCommitReveal = juror.disputeID.subcourt.hiddenVotes;
    const secRemaining = Math.floor(Number(juror.disputeID.periodDeadline) - Date.now()/1000)

    const daysRemaining = Math.floor(secRemaining / 86400)
    const hoursRemaining = Math.floor((secRemaining % 86400) / 3600)
    const timeRemaining = daysRemaining > 1 ? `${daysRemaining} days` : 
                            daysRemaining > 0 ? `${daysRemaining} days ${hoursRemaining} hours` : `${hoursRemaining} hours`
    const shortAddress = juror.address.slice(0, 5) + "..." + juror.address.slice(-3);
    return `***Juror duty awaits you!*** 
    
*${shortAddress}* has been drawn in [case ${
        juror.disputeID.id
    }](https://court.kleros.io/cases/${juror.disputeID.id}) (*${
        chainid == 1 ? "mainnet" : "gnosis"
    }*).
    
${isCommitReveal? "This dispute is commit-reveal. Remember to reveal your vote later.\n\n": ""} Voting starts in ${timeRemaining}. You can already start reviewing the evidence.`;
};