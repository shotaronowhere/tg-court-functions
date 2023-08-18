declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DATALAKE_URL: string;
      DATALAKE_KEY: string;
      NOTIFICATION_URL: string;
      NOTIFICATION_KEY: string;
      BOT_TOKEN: string;
      LOGTAIL_SOURCE_TOKEN: string;
      PRIVATE_RPC_ENDPOINT_MAINNET: string;
      NOTIFICATION_CHANNEL: string;
      FUNCTION_SECRET: string;
    }
  }
}

export {}
