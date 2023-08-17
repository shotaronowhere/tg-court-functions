import axios from "axios";
import { isAddress } from "ethers";
import { datalake } from "../config/supabase";
require('dotenv').config()
import { Bot, webhookCallback } from 'grammy'
const { BOT_TOKEN, FUNCTION_SECRET } = process.env
const bot = new Bot(BOT_TOKEN)

const handleUpdate = webhookCallback(bot, 'aws-lambda')
bot.command('start', ctx => ctx.reply('Hello!'))

exports.handler = async (event: any) => {
    try {
        console.log(event)
        const url = new URL(event.url)
        if (url.searchParams.get('secret') !== FUNCTION_SECRET)
          return new Response('not allowed', { status: 405 })
    
        return await handleUpdate(event)
    } catch (err) {
    console.error(err)
    }
}