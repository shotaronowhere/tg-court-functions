import axios from "axios";
import { datalake } from "../config/supabase";
import { StatusCodes } from "http-status-codes";
import { Handler, schedule } from "@netlify/functions";

const handler: Handler = async () => {
    try{

        const { data, error } = await datalake
        .from(`bot-block-heights`)
        .select("*")
        .eq("bot_name", `tg-court-functions`)
        .eq("network", "ethereum")


        if (error)
            return {
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                body: JSON.stringify({ error: error.message }),
            };

        const timestampOld = data[0].timestamp
        let startTimeMax = timestampOld;
        const disputeQuery = {
            query: `{
                disputes(first: 10, where: {startTime_gt: ${timestampOld}}, orderBy: disputeID) {
                    numberOfVotes
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

        

        const response = (await axios.post(`https://api.thegraph.com/subgraphs/name/salgozino/klerosboard`,    
            disputeQuery)).data.data.disputes
        for(const dispute of response){
            if (dispute.startTime > startTimeMax){
                startTimeMax = dispute.startTime
            }
            const res = await axios.get(`https://ipfs.kleros.io/${dispute.subcourtID.policy.policy}`);
    
            const queryTag = {
                query: ` {
              addressTags: litems(where:{
                registry:"0x66260c69d03837016d88c9877e61e08ef74c59f2",
                key0_starts_with_nocase: "eip155:1:${response[0].arbitrable.id}",
                key0_ends_with_nocase: "eip155:1:${response[0].arbitrable.id}",
                status_in:[Registered, ClearingRequested]
              }, first: 1) {
                key0
                key1
                key2
                key3
              }
            }
            `};
            const responseTag = (await axios.post('https://api.thegraph.com/subgraphs/name/kleros/legacy-curate-xdai',    
            queryTag)).data.data.addressTags
    

            await axios.post(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
                chat_id: process.env.NOTIFICATION_CHANNEL,
                text: `[Dispute ${dispute.disputeID}](https://court.kleros.io/cases/${dispute.disputeID}) created on Ethereum (Mainnet)!
                
    Arbitrable ${responseTag.length > 0 ? `[${responseTag[0].key1} / ${responseTag[0].key2}](${responseTag[0].key3})` : `[${dispute.arbitrable.id}](https://etherscan.io/address/${dispute.arbitrable.id})`}
    Subcourt: ${res.data.name}
    # of juror: ${dispute.numberOfVotes}`,
                parse_mode: 'Markdown',
                disable_web_page_preview: true
                });
    
        }

        await datalake.from(`bot-block-heights`).update({timestamp: startTimeMax}).eq("bot_name", `tg-court-functions`).eq("network", "ethereum")
        
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

};

module.exports.handler = schedule("* * * * *", handler);