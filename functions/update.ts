exports.handler = async (event: any) => {
    console.log("Received an update from Telegram!", event.body);
    return { statusCode: 200 };
  };