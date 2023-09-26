declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DATALAKE_URL: string;
      DATALAKE_KEY: string;
      NOTIFICATION_URL: string;
      NOTIFICATION_KEY: string;
      BOT_TOKEN: string;
      WEB_HOOK_URL: string;
      LOGTAIL_SOURCE_TOKEN: string;
      RABBITMQ_URL: string;
      RPC_URL_MAINNET: string;
      RPC_URL_GNOSIS: string;
      NOTIFICATION_CHANNEL: string;
      FUNCTION_SECRET: string;
    }
  }
}

export {}
