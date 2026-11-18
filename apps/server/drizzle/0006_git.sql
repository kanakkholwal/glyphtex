CREATE TABLE "project_git_link" (
	"project_id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"repo" text NOT NULL,
	"branch" text NOT NULL,
	"last_commit" text,
	"base" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"linked_by" text,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_git_link" ADD CONSTRAINT "project_git_link_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_git_link" ADD CONSTRAINT "project_git_link_linked_by_user_id_fk" FOREIGN KEY ("linked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;