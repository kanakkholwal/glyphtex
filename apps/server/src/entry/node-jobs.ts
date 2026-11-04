import { waitReady } from "../adapters/redis/index.ts";
import { redisConsumer, startRabbitConsumer } from "../jobs/consumers.ts";
import { buildNodeDeps } from "./node-deps.ts";

const { deps, redis, close } = await buildNodeDeps();
const { logger } = deps;
const jobDeps = { db: deps.db, blobs: deps.adapters.blobs, mailer: deps.adapters.mailer, logger };

let running = true;
const stopped = new Promise<void>((resolve) => {
	const stop = () => {
		running = false;
		resolve();
	};
	process.on("SIGTERM", stop);
	process.on("SIGINT", stop);
});

logger.info("job worker started", { driver: deps.config.queueDriver ?? "redis" });

if (deps.config.queueDriver === "rabbitmq") {
	const closeRabbit = await startRabbitConsumer(deps.config.rabbitmqUrl as string, jobDeps, logger);
	await stopped;
	await closeRabbit();
} else {
	const blocking = redis.duplicate();
	await waitReady(blocking);
	const consumer = redisConsumer(redis, blocking, jobDeps);
	await consumer.recover();
	const promoter = setInterval(
		() => void consumer.promoteDue().catch((error) => logger.error("promote failed", { error })),
		1000
	);
	while (running) {
		await consumer.processOne().catch((error) => logger.error("consumer error", { error }));
	}
	clearInterval(promoter);
	blocking.disconnect();
}
await close();
