# tg-court-functions

Netlify Functions for Hermes, the Kleros Messenger. A god who delivers jury duty summons sent from the Kleros Court.

## Development

### Netlify setup

```bash
netlify login
...

# if site already exists
netlify link
...

# if site doesn't exist
netlify init
...
```

### Shell 1
```bash
yarn dev
```

### Shell 2
```bash
curl -s -X POST http://localhost:8888/.netlify/functions/update -H "Accept: application/json" -H "x-telegram-bot-api-secret-token: 123" -d '{"message": { "foo": "bar" }}'
```

## Live Development

### Preparation

#### Retrieve your Telegram user chatId
1. Sending a message to your bot on Telegram
2. Visiting `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`, find the corresponding message and retrieve the chatId
3. Set the value to the environment variable `$NOTIFICATION_CHANNEL`

#### Bot Init
Set this environment variable, if needed extrapolate $USER 
```bash
$ export WEB_HOOK_URL=https://dev-$USER--kleros-tg-court-notifications.netlify.live/.netlify/functions/update

$ yarn bot-init
Setting multilang bot info . . .
setting bot name  en Hermes | The Kleros Messenger
setting bot name  fr Hermes | Le messager de Kleros
...
setting commands es
setting webhook
```

### Shell 1
```bash
yarn dev --live dev-$USER
```

### Shell 2
```bash
curl -s -X POST -H "Accept: application/json" https://dev-$USER--tg-court-functions.netlify.live/.netlify/functions/update -H "x-telegram-bot-api-secret-token: 123" -d '{"message": { "foo": "bar" }}'
```

### Send a command to the bot on Telegram


Me:
`/subscribe vitalik.eth`

Bot:
`Thank you! I will notify you when a dispute is created for this juror.`
