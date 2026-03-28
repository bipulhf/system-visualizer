import { connect } from "amqplib";
import { env } from "./env";

export async function checkRabbitMqConnection(): Promise<void> {
  const connection = await connect(env.rabbitMqUrl);
  const channel = await connection.createChannel();
  const assertedQueue = await channel.assertQueue("", {
    exclusive: true,
    autoDelete: true,
  });
  await channel.deleteQueue(assertedQueue.queue);
  await channel.close();
  await connection.close();
}
