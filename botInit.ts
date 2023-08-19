import TelegramBot = require("node-telegram-bot-api");
import axios from "axios";
import { bot } from "./assets/multilang.json";

require('dotenv').config()
const { BOT_TOKEN, WEB_HOOK_URL, FUNCTION_SECRET } = process.env
const tgBot = new TelegramBot(BOT_TOKEN, {polling: false});  

const initialize = async () => {
    
    console.log("Setting multilang bot info . . .")
    for (const lang in bot.names){
        const name = bot.names[lang as keyof typeof bot.names]
        console.log('setting bot name ',lang,name)
        try{
            await axios.post(
            `https://api.telegram.org/bot${process.env.BOT_TOKEN}/setMyName`, 
            {
                name: name,
                language_code: lang,
            })
        } catch (e) {
            console.log('failed setting name ',lang,name)
            console.log(e)
        }
    }

    for (const lang in bot.short_descriptions){
        const short_description = bot.short_descriptions[lang as keyof typeof bot.names]
        console.log('setting bot short description ',lang)
        try{
            await axios.post(
            `https://api.telegram.org/bot${process.env.BOT_TOKEN}/setMyShortDescription`, 
            {
                short_description: short_description,
                language_code: lang,
            })
        } catch (e) {
            console.log('failed setting short description ',lang,short_description)
            console.log(e)
        }
    }

    for (const lang in bot.descriptions){
        const description = bot.descriptions[lang as keyof typeof bot.names]
        console.log('setting bot description ',lang)
        try{
            await axios.post(
            `https://api.telegram.org/bot${process.env.BOT_TOKEN}/setMyDescription`, 
            {
                description: description,
                language_code: lang,
            })
        } catch (e) {
            console.log('failed setting description ',lang, description)
            console.log(e)
        }
    }

    for (const lang in bot.commands){
        const commands = bot.commands[lang as keyof typeof bot.commands]
        // setting command
        console.log('setting commands', lang)
        try{
            await tgBot.setMyCommands(commands,{language_code: lang})//, scope: 'all_private_chats' as unknown as TelegramBot.BotCommandScopeAllPrivateChats})
        } catch (e) {
            console.log('failed setting commands ',lang,commands)
            console.log(e)
        }
    }

    console.log('setting webhook')

    try{
        await axios.post(
            `https://api.telegram.org/bot${process.env.BOT_TOKEN}/setWebhook`, 
            {
                url: WEB_HOOK_URL,
                allowed_updates : ["message"],
                drop_pending_updates : true,
                secret_token: FUNCTION_SECRET
            })
    } catch(e) {
        console.log(e)
    }
}

(async ()=> {
    await initialize();
})();