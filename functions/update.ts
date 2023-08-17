import axios from "axios";
import { isAddress } from "ethers";
import { datalake } from "../config/supabase";
import { StatusCodes } from "http-status-codes";
require('dotenv').config()
import { Bot, webhookCallback } from 'grammy'
const { BOT_TOKEN, FUNCTION_SECRET } = process.env
const bot = new Bot(BOT_TOKEN)

const handleUpdate = webhookCallback(bot, 'aws-lambda')
bot.command('start', ctx => ctx.reply('Hello!'))

exports.handler = async (event: any) => {
    try {
        console.log(event.headers["x-telegram-bot-api-secret-token"])
        if (event.headers["x-telegram-bot-api-secret-token"] !== FUNCTION_SECRET)
          return new Response('not allowed', { status: 405 })
    
        await handleUpdate(event)

        return {
            statusCode: StatusCodes.OK
        }  
    } catch (err) {
        console.error(err)
        return {
            statusCode: StatusCodes.BAD_REQUEST,
            body: JSON.stringify({ error: err }),
        };
    }
}