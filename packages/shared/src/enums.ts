import type { Database } from "./database.types";

// Postgres enums are the source of truth. These aliases read from the generated
// types so a status string can never drift from the database.
export type DbEnums = Database["public"]["Enums"];
export type DbEnum<K extends keyof DbEnums> = DbEnums[K];
