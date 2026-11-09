import { waitReady } from "../adapters/redis/index.ts";
import { redisConsumer, startRabbitConsumer } from "../jobs/consumers.ts";
import { orgRepository } from "../repositories/orgs.ts";
import { onShutdown } from "./lifecycle.ts";
import { buildNodeDeps } from "./node-deps.ts";

const { deps, redis, close } = await buildNodeDeps();
const { logger } = deps;
const jobDeps = { db: deps.db, blobs: deps.adapters.blobs, mailer: deps.adapters.mailer, logger };

let running = true;
let finished: () => void = () => {};
const done = new Promise<void>((resolve) => (finished = resolve));
let stop: () => void = () => {};
const stopped = new Promise<void>((resolve) => (stop = resolve));
onShutdown(async (reason) => {
	logger.info("job worker stopping", { reason });
	running = false;
	stop();
	await done;
});

logger.info("job worker started", { driver: deps.config.queueDriver ?? "redis" });

// Audit retention; idempotent, so several workers pruning at once is harmless.
const prune = () =>
	orgRepository(deps.db)
		.pruneAudit(deps.config.limits.auditRetentionDays)
		.then((removed) => logger.info("audit pruned", { removed }))
		.catch((error) => logger.error("audit prune failed", { error }));
void prune();
const pruner = setInterval(prune, 6 * 3_600_000);
pruner.unref();

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
finished();
