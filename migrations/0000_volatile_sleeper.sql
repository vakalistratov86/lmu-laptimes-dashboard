CREATE TABLE "drivers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"team" text NOT NULL,
	"country" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_errors" (
	"id" serial PRIMARY KEY NOT NULL,
	"import_job_id" text NOT NULL,
	"raw_payload" text NOT NULL,
	"error_code" text NOT NULL,
	"error_message" text NOT NULL,
	"occurred_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"file_hash" text NOT NULL,
	"file_name" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"session_id" integer,
	"total_laps" integer,
	"valid_laps" integer,
	"error_laps" integer,
	"error" text,
	"log_format_version" text,
	"created_at" bigint NOT NULL,
	"finished_at" bigint,
	CONSTRAINT "import_jobs_file_hash_unique" UNIQUE("file_hash")
);
--> statement-breakpoint
CREATE TABLE "lap_times" (
	"id" serial PRIMARY KEY NOT NULL,
	"track_id" integer NOT NULL,
	"driver_id" integer NOT NULL,
	"car_class" text NOT NULL,
	"car" text NOT NULL,
	"lap_ms" integer NOT NULL,
	"sector1_ms" integer,
	"sector2_ms" integer,
	"sector3_ms" integer,
	"conditions" text NOT NULL,
	"tyre" text NOT NULL,
	"date" text NOT NULL,
	"session_id" integer
);
--> statement-breakpoint
CREATE TABLE "session_incidents" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"driver_id" integer NOT NULL,
	"target_driver_id" integer,
	"elapsed_time_sec" real NOT NULL,
	"severity" real NOT NULL,
	"is_immovable" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_laps" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_result_id" integer NOT NULL,
	"session_id" integer NOT NULL,
	"driver_id" integer NOT NULL,
	"lap_num" integer NOT NULL,
	"position" integer,
	"lap_time_ms" real,
	"elapsed_time_sec" real,
	"sector1_ms" real,
	"sector2_ms" real,
	"sector3_ms" real,
	"top_speed_kph" real,
	"fuel_level" real,
	"fuel_used" real,
	"vehicle_condition" real,
	"vehicle_condition_used" real,
	"tyre_fl_condition" real,
	"tyre_fr_condition" real,
	"tyre_rl_condition" real,
	"tyre_rr_condition" real,
	"front_compound" text,
	"rear_compound" text,
	"tyre_fl" text,
	"tyre_fr" text,
	"tyre_rl" text,
	"tyre_rr" text,
	"is_pit_lap" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"driver_id" integer NOT NULL,
	"is_player" integer DEFAULT 0 NOT NULL,
	"position" integer NOT NULL,
	"class_position" integer NOT NULL,
	"lap_rank_including_discos" integer,
	"car_class" text NOT NULL,
	"car" text NOT NULL,
	"car_type" text,
	"team" text NOT NULL,
	"car_number" text,
	"veh_file" text,
	"veh_name" text,
	"category" text,
	"laps" integer NOT NULL,
	"pitstops" integer NOT NULL,
	"best_lap_ms" integer,
	"finish_status" text,
	"control_and_aids" text,
	"connected" integer
);
--> statement-breakpoint
CREATE TABLE "session_sector_bests" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"driver_id" integer NOT NULL,
	"car_class" text NOT NULL,
	"sector" integer NOT NULL,
	"elapsed_time_sec" real NOT NULL,
	"lap_num" integer
);
--> statement-breakpoint
CREATE TABLE "session_track_limits" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"driver_id" integer NOT NULL,
	"lap_num" integer NOT NULL,
	"elapsed_time_sec" real NOT NULL,
	"warning_points" integer,
	"current_points" integer,
	"resolution" integer,
	"decision" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"track_id" integer NOT NULL,
	"event" text NOT NULL,
	"session_type" text NOT NULL,
	"venue" text NOT NULL,
	"course" text,
	"track_length_m" real,
	"game_version" text,
	"date_time" text NOT NULL,
	"date_time_unix" bigint,
	"file_name" text NOT NULL,
	"setting" text,
	"driver_count" integer NOT NULL,
	"lap_count" integer NOT NULL,
	"race_laps" integer,
	"race_time_min" integer,
	"mech_fail_rate" integer,
	"damage_mult" integer,
	"fuel_mult" real,
	"tire_mult" real,
	"vehicles_allowed" text,
	"parc_ferme" integer,
	"fixed_setups" integer,
	"free_settings" integer,
	"fixed_upgrades" integer,
	"tire_warmers" integer,
	"dedicated" integer,
	"session_duration_min" integer,
	"session_max_laps" integer,
	"most_laps_completed" integer
);
--> statement-breakpoint
CREATE TABLE "telemetry_channels" (
	"id" serial PRIMARY KEY NOT NULL,
	"telemetry_session_id" integer NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"frequency_hz" integer,
	"unit" text,
	"sample_count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telemetry_import_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"file_hash" text NOT NULL,
	"file_name" text NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"telemetry_session_id" integer,
	"channel_count" integer,
	"sample_count" integer,
	"error" text,
	"created_at" bigint NOT NULL,
	"finished_at" bigint,
	CONSTRAINT "telemetry_import_jobs_file_hash_unique" UNIQUE("file_hash")
);
--> statement-breakpoint
CREATE TABLE "telemetry_samples" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel_id" integer NOT NULL,
	"seq" integer NOT NULL,
	"ts" real,
	"value1" real,
	"value2" real,
	"value3" real,
	"value4" real
);
--> statement-breakpoint
CREATE TABLE "telemetry_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"import_job_id" text NOT NULL,
	"file_name" text NOT NULL,
	"driver_name" text,
	"steam_id" text,
	"recording_time" text,
	"session_time" text,
	"session_type" text,
	"track_name" text,
	"track_layout" text,
	"weather_conditions" text,
	"car_name" text,
	"car_class" text,
	"car_setup" text,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"country" text NOT NULL,
	"length_km" real NOT NULL,
	"turns" integer NOT NULL,
	"layout" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "telemetry_samples_channel_id_idx" ON "telemetry_samples" USING btree ("channel_id");