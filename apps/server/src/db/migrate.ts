import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { required } from "../config.ts";
import { connectDb } from "./client.ts";

const { db, close } = connectDb(required(process.env.DATABASE_URL, "DATABASE_URL"), { max: 1 });
try {
	await migrate(db, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
	console.log("Migrations applied.");
} finally {
	await close();
}
