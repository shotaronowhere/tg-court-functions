import { Logtail } from "@logtail/node";
import { Channel } from 'amqplib';

export async function sendToRabbitMQ(logtail: Logtail, channel: Channel, messages: any[]) {
    for (const item of messages) {

      const message = JSON.stringify(item);
      channel.sendToQueue('tg-hermes', Buffer.from(message), {
            persistent: true,
        });
    }
  
    const stats = {
      events: messages.length,
    };
  
    //channel.publish('mission.control.room', 'notifications', Buffer.from(JSON.stringify(stats)));
    //logtail.info(`Sent messages to RabbitMQ: ${JSON.stringify(stats)}` )
    //logtail.flush()
}
