CREATE TYPE "public"."meeting_status" AS ENUM('UPCOMING', 'ONGOING', 'ENDED');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('ADMIN', 'COUNTER', 'PARTICIPANT');--> statement-breakpoint
CREATE TYPE "public"."votation_status" AS ENUM('UPCOMING', 'OPEN', 'CHECKING_RESULT', 'PUBLISHED_RESULT', 'INVALID');--> statement-breakpoint
CREATE TYPE "public"."votation_type" AS ENUM('SIMPLE', 'QUALIFIED', 'STV');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alternative" (
	"id" text PRIMARY KEY NOT NULL,
	"text" varchar(120) NOT NULL,
	"index" integer DEFAULT 0 NOT NULL,
	"is_winner" boolean DEFAULT false NOT NULL,
	"votation_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alternative_round_vote_count" (
	"alternative_id" text NOT NULL,
	"vote_count" double precision NOT NULL,
	"stv_round_result_id" text NOT NULL,
	CONSTRAINT "alt_round_vote_count_pk" PRIMARY KEY("alternative_id","stv_round_result_id")
);
--> statement-breakpoint
CREATE TABLE "has_voted" (
	"user_id" text NOT NULL,
	"votation_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "has_voted_pk" PRIMARY KEY("user_id","votation_id")
);
--> statement-breakpoint
CREATE TABLE "invite" (
	"email" text NOT NULL,
	"role" "role" NOT NULL,
	"is_voting_eligible" boolean DEFAULT true NOT NULL,
	"meeting_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting" (
	"id" text PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"status" "meeting_status" DEFAULT 'UPCOMING' NOT NULL,
	"allow_self_registration" boolean DEFAULT false NOT NULL,
	"owner_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participant" (
	"id" text PRIMARY KEY NOT NULL,
	"role" "role" NOT NULL,
	"is_voting_eligible" boolean DEFAULT true NOT NULL,
	"is_approved" boolean DEFAULT true NOT NULL,
	"user_id" text NOT NULL,
	"meeting_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "stv_round_result" (
	"id" text PRIMARY KEY NOT NULL,
	"index" integer NOT NULL,
	"result_id" text
);
--> statement-breakpoint
CREATE TABLE "stv_vote" (
	"id" text PRIMARY KEY NOT NULL,
	"votation_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "votation" (
	"id" text PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" "votation_status" DEFAULT 'UPCOMING' NOT NULL,
	"type" "votation_type" DEFAULT 'SIMPLE' NOT NULL,
	"blank_votes" boolean DEFAULT false NOT NULL,
	"blank_vote_count" integer DEFAULT 0 NOT NULL,
	"hidden_votes" boolean DEFAULT false NOT NULL,
	"number_of_winners" integer DEFAULT 1 NOT NULL,
	"majority_threshold" integer DEFAULT 50 NOT NULL,
	"index" integer NOT NULL,
	"meeting_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "votation_result" (
	"votation_id" text PRIMARY KEY NOT NULL,
	"voting_eligible_count" integer NOT NULL,
	"vote_count" integer NOT NULL,
	"blank_vote_count" integer,
	"quota" double precision
);
--> statement-breakpoint
CREATE TABLE "votation_result_review" (
	"votation_id" text NOT NULL,
	"participant_id" text NOT NULL,
	"approved" boolean NOT NULL,
	CONSTRAINT "votation_result_review_pk" PRIMARY KEY("votation_id","participant_id")
);
--> statement-breakpoint
CREATE TABLE "vote" (
	"id" text PRIMARY KEY NOT NULL,
	"alternative_id" text NOT NULL,
	"ranking" integer DEFAULT 1 NOT NULL,
	"stv_vote_id" text
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alternative" ADD CONSTRAINT "alternative_votation_id_votation_id_fk" FOREIGN KEY ("votation_id") REFERENCES "public"."votation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alternative_round_vote_count" ADD CONSTRAINT "alternative_round_vote_count_alternative_id_alternative_id_fk" FOREIGN KEY ("alternative_id") REFERENCES "public"."alternative"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alternative_round_vote_count" ADD CONSTRAINT "alternative_round_vote_count_stv_round_result_id_stv_round_result_id_fk" FOREIGN KEY ("stv_round_result_id") REFERENCES "public"."stv_round_result"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "has_voted" ADD CONSTRAINT "has_voted_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "has_voted" ADD CONSTRAINT "has_voted_votation_id_votation_id_fk" FOREIGN KEY ("votation_id") REFERENCES "public"."votation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant" ADD CONSTRAINT "participant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant" ADD CONSTRAINT "participant_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stv_round_result" ADD CONSTRAINT "stv_round_result_result_id_votation_result_votation_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."votation_result"("votation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stv_vote" ADD CONSTRAINT "stv_vote_votation_id_votation_id_fk" FOREIGN KEY ("votation_id") REFERENCES "public"."votation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votation" ADD CONSTRAINT "votation_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votation_result" ADD CONSTRAINT "votation_result_votation_id_votation_id_fk" FOREIGN KEY ("votation_id") REFERENCES "public"."votation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votation_result_review" ADD CONSTRAINT "votation_result_review_votation_id_votation_id_fk" FOREIGN KEY ("votation_id") REFERENCES "public"."votation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votation_result_review" ADD CONSTRAINT "votation_result_review_participant_id_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote" ADD CONSTRAINT "vote_alternative_id_alternative_id_fk" FOREIGN KEY ("alternative_id") REFERENCES "public"."alternative"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote" ADD CONSTRAINT "vote_stv_vote_id_stv_vote_id_fk" FOREIGN KEY ("stv_vote_id") REFERENCES "public"."stv_vote"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invite_email_meeting_idx" ON "invite" USING btree ("email","meeting_id");--> statement-breakpoint
CREATE UNIQUE INDEX "participant_user_meeting_idx" ON "participant" USING btree ("user_id","meeting_id");