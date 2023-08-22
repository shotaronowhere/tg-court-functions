import axios from "axios";
import { notificationSystem } from "../../config/supabase";
import { StatusCodes } from "http-status-codes";

export const cronDraw = async (network: string) => {
    try{
        const response = await notificationSystem
        .from(`bot-block-heights`)
        .select("timestamp")
        .eq("bot_name", `tg-court-draw`)
        .eq("network", network)

        if (response.error)
            return {
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                body: JSON.stringify({ error: response.error.message }),
            };
        

        const timestampOld = response.data[0].timestamp
        let startTimeMax = timestampOld;
        const disputeQuery = {
            query: `{
                disputes(first: 5, where: {startTime_gt: ${timestampOld}}, orderBy: disputeID) {
                    startTime
                    disputeID
                arbitrable {
                    id
                }
                subcourtID{
                    id
                    policy{
                    policy
                    }
                    
                }
                }
                }`,
        }


        const disputeCreation = (await axios.post(`https://api.thegraph.com/subgraphs/name/klerosboard/klerosboard-gnosis`,    
            disputeQuery))?.data?.data?.disputes ?? []

        for(const dispute of disputeCreation){
            let res 
            try{res = await axios.get(`https://ipfs.kleros.io/${dispute.subcourtID.policy.policy}`)}catch(e){console.log(e)};


            await axios.post(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
                chat_id: process.env.NOTIFICATION_CHANNEL,
                text: `[Dispute ${dispute.disputeID}](https://court.kleros.io/cases/${dispute.disputeID}) created on Gnosis!
                
    Arbitrable: [${dispute.arbitrable.id}](https://${network == "ethereum"? "ether" : network}scan.io/address/${dispute.arbitrable.id})
    Subcourt: ${res? res.data.name: dispute.subcourtID}`,
                parse_mode: 'Markdown',
                disable_web_page_preview: true
                });
            if (dispute.startTime > startTimeMax){
                startTimeMax = dispute.startTime
            }
        }

        await notificationSystem.from(`bot-block-heights`).update({timestamp: startTimeMax}).eq("bot_name", `tg-court-appeal`).eq("network", network)
        
        return {
            statusCode: StatusCodes.OK
        };
    } catch (err: any) {
        console.log(err)
        return {
          statusCode: StatusCodes.BAD_REQUEST,
          body: JSON.stringify({ error: err.message }),
        };
      }
}