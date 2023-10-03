export async function retryPromise<T>(
  promiseFactory: () => Promise<T | undefined>,
  maxRetries: number = 10,
  delayMs: number = 10000
): Promise<T | undefined> {
  let retries = 0;
  
  async function attempt(): Promise<T | undefined> {
    try {
      const result = await promiseFactory();
      if (result !== undefined) {
        return result;
      }
      // If the result is undefined, treat it as an error and retry.
    } catch (error) {
      // Treat any error as a retry condition.
    }

    retries++;
    if (retries < maxRetries) {
      console.log(`Retrying in ${delayMs / 1000} seconds (Attempt ${retries + 1} of ${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return attempt();
    } else {
      return undefined; // If all retries fail, return undefined.
    }
  }

  return attempt();
}