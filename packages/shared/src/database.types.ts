// GENERATED FILE. Do not edit by hand.
// Regenerate after every migration:
//   supabase gen types typescript --local > packages/shared/src/database.types.ts
// Placeholder until 0001_schema.sql is applied (build order slice 2).

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
