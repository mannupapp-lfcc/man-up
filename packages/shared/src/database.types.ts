export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      contact_logs: {
        Row: {
          contacted_at: string
          id: string
          leader_id: string
          method: Database["public"]["Enums"]["contact_method"] | null
          ministry_id: string
          note: string | null
          profile_id: string
        }
        Insert: {
          contacted_at?: string
          id?: string
          leader_id: string
          method?: Database["public"]["Enums"]["contact_method"] | null
          ministry_id: string
          note?: string | null
          profile_id: string
        }
        Update: {
          contacted_at?: string
          id?: string
          leader_id?: string
          method?: Database["public"]["Enums"]["contact_method"] | null
          ministry_id?: string
          note?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_logs_leader_id_fkey"
            columns: ["leader_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_logs_ministry_id_fkey"
            columns: ["ministry_id"]
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_logs_profile_id_fkey"
            columns: ["profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          id: string
          is_published: boolean
          ministry_id: string
          sanity_id: string
          synced_at: string
          title: string
        }
        Insert: {
          id?: string
          is_published?: boolean
          ministry_id: string
          sanity_id: string
          synced_at?: string
          title: string
        }
        Update: {
          id?: string
          is_published?: boolean
          ministry_id?: string
          sanity_id?: string
          synced_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_ministry_id_fkey"
            columns: ["ministry_id"]
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      gathering_checkins: {
        Row: {
          checked_in_at: string
          gathering_id: string
          id: string
          ministry_id: string
          profile_id: string
        }
        Insert: {
          checked_in_at?: string
          gathering_id: string
          id?: string
          ministry_id: string
          profile_id: string
        }
        Update: {
          checked_in_at?: string
          gathering_id?: string
          id?: string
          ministry_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gathering_checkins_gathering_id_fkey"
            columns: ["gathering_id"]
            referencedRelation: "gatherings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gathering_checkins_ministry_id_fkey"
            columns: ["ministry_id"]
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gathering_checkins_profile_id_fkey"
            columns: ["profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gatherings: {
        Row: {
          church_center_url: string | null
          created_at: string
          gathering_at: string
          id: string
          ministry_id: string
          pco_event_id: string | null
          title: string
        }
        Insert: {
          church_center_url?: string | null
          created_at?: string
          gathering_at: string
          id?: string
          ministry_id: string
          pco_event_id?: string | null
          title: string
        }
        Update: {
          church_center_url?: string | null
          created_at?: string
          gathering_at?: string
          id?: string
          ministry_id?: string
          pco_event_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "gatherings_ministry_id_fkey"
            columns: ["ministry_id"]
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          is_group_leader: boolean
          joined_at: string
          left_at: string | null
          ministry_id: string
          profile_id: string
        }
        Insert: {
          group_id: string
          id?: string
          is_group_leader?: boolean
          joined_at?: string
          left_at?: string | null
          ministry_id: string
          profile_id: string
        }
        Update: {
          group_id?: string
          id?: string
          is_group_leader?: boolean
          joined_at?: string
          left_at?: string | null
          ministry_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_ministry_id_fkey"
            columns: ["ministry_id"]
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_profile_id_fkey"
            columns: ["profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          body: string
          created_at: string
          group_id: string
          id: string
          ministry_id: string
          profile_id: string
        }
        Insert: {
          body: string
          created_at?: string
          group_id: string
          id?: string
          ministry_id: string
          profile_id: string
        }
        Update: {
          body?: string
          created_at?: string
          group_id?: string
          id?: string
          ministry_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_ministry_id_fkey"
            columns: ["ministry_id"]
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_profile_id_fkey"
            columns: ["profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          id: string
          meeting_day: string | null
          meeting_time: string | null
          ministry_id: string
          name: string
          status: Database["public"]["Enums"]["group_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_day?: string | null
          meeting_time?: string | null
          ministry_id: string
          name: string
          status?: Database["public"]["Enums"]["group_status"]
        }
        Update: {
          created_at?: string
          id?: string
          meeting_day?: string | null
          meeting_time?: string | null
          ministry_id?: string
          name?: string
          status?: Database["public"]["Enums"]["group_status"]
        }
        Relationships: [
          {
            foreignKeyName: "groups_ministry_id_fkey"
            columns: ["ministry_id"]
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          max_uses: number | null
          ministry_id: string
          revoked_at: string | null
          role_granted: Database["public"]["Enums"]["ministry_role"]
          uses: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          ministry_id: string
          revoked_at?: string | null
          role_granted?: Database["public"]["Enums"]["ministry_role"]
          uses?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          ministry_id?: string
          revoked_at?: string | null
          role_granted?: Database["public"]["Enums"]["ministry_role"]
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_codes_ministry_id_fkey"
            columns: ["ministry_id"]
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      leader_scores: {
        Row: {
          as_of: string
          components: NonNullable<Json>
          id: string
          ministry_id: string
          profile_id: string
          total: number
        }
        Insert: {
          as_of: string
          components: NonNullable<Json>
          id?: string
          ministry_id: string
          profile_id: string
          total: number
        }
        Update: {
          as_of?: string
          components?: NonNullable<Json>
          id?: string
          ministry_id?: string
          profile_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "leader_scores_ministry_id_fkey"
            columns: ["ministry_id"]
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leader_scores_profile_id_fkey"
            columns: ["profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed_at: string | null
          id: string
          lesson_id: string
          ministry_id: string
          profile_id: string
          reflection: string | null
        }
        Insert: {
          completed_at?: string | null
          id?: string
          lesson_id: string
          ministry_id: string
          profile_id: string
          reflection?: string | null
        }
        Update: {
          completed_at?: string | null
          id?: string
          lesson_id?: string
          ministry_id?: string
          profile_id?: string
          reflection?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_ministry_id_fkey"
            columns: ["ministry_id"]
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_profile_id_fkey"
            columns: ["profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          course_id: string
          id: string
          ministry_id: string
          sanity_id: string
          sort_order: number
          synced_at: string
          title: string
        }
        Insert: {
          course_id: string
          id?: string
          ministry_id: string
          sanity_id: string
          sort_order: number
          synced_at?: string
          title: string
        }
        Update: {
          course_id?: string
          id?: string
          ministry_id?: string
          sanity_id?: string
          sort_order?: number
          synced_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_ministry_id_fkey"
            columns: ["ministry_id"]
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_attendance: {
        Row: {
          id: string
          marked_at: string
          marked_by: string | null
          meeting_id: string
          ministry_id: string
          profile_id: string
          status: Database["public"]["Enums"]["attendance_status"]
        }
        Insert: {
          id?: string
          marked_at?: string
          marked_by?: string | null
          meeting_id: string
          ministry_id: string
          profile_id: string
          status: Database["public"]["Enums"]["attendance_status"]
        }
        Update: {
          id?: string
          marked_at?: string
          marked_by?: string | null
          meeting_id?: string
          ministry_id?: string
          profile_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
        }
        Relationships: [
          {
            foreignKeyName: "meeting_attendance_marked_by_fkey"
            columns: ["marked_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_attendance_meeting_id_fkey"
            columns: ["meeting_id"]
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_attendance_ministry_id_fkey"
            columns: ["ministry_id"]
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_attendance_profile_id_fkey"
            columns: ["profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          attendance_marked_at: string | null
          created_at: string
          group_id: string
          id: string
          meeting_at: string
          ministry_id: string
        }
        Insert: {
          attendance_marked_at?: string | null
          created_at?: string
          group_id: string
          id?: string
          meeting_at: string
          ministry_id: string
        }
        Update: {
          attendance_marked_at?: string | null
          created_at?: string
          group_id?: string
          id?: string
          meeting_at?: string
          ministry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_group_id_fkey"
            columns: ["group_id"]
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_ministry_id_fkey"
            columns: ["ministry_id"]
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      member_scores: {
        Row: {
          as_of: string
          components: NonNullable<Json>
          id: string
          ministry_id: string
          profile_id: string
          tier: string
          total: number
          velocity_alert: boolean
        }
        Insert: {
          as_of: string
          components: NonNullable<Json>
          id?: string
          ministry_id: string
          profile_id: string
          tier: string
          total: number
          velocity_alert?: boolean
        }
        Update: {
          as_of?: string
          components?: NonNullable<Json>
          id?: string
          ministry_id?: string
          profile_id?: string
          tier?: string
          total?: number
          velocity_alert?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "member_scores_ministry_id_fkey"
            columns: ["ministry_id"]
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_scores_profile_id_fkey"
            columns: ["profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ministries: {
        Row: {
          created_at: string
          id: string
          ministry_key: string
          name: string
          organization_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          ministry_key: string
          name: string
          organization_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          ministry_key?: string
          name?: string
          organization_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ministries_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ministry_config: {
        Row: {
          id: string
          key: string
          ministry_id: string
          updated_at: string
          updated_by: string | null
          value: NonNullable<Json>
        }
        Insert: {
          id?: string
          key: string
          ministry_id: string
          updated_at?: string
          updated_by?: string | null
          value: NonNullable<Json>
        }
        Update: {
          id?: string
          key?: string
          ministry_id?: string
          updated_at?: string
          updated_by?: string | null
          value?: NonNullable<Json>
        }
        Relationships: [
          {
            foreignKeyName: "ministry_config_ministry_id_fkey"
            columns: ["ministry_id"]
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      ministry_members: {
        Row: {
          id: string
          joined_at: string
          left_at: string | null
          ministry_id: string
          profile_id: string
          role: Database["public"]["Enums"]["ministry_role"]
          role_since: string
        }
        Insert: {
          id?: string
          joined_at?: string
          left_at?: string | null
          ministry_id: string
          profile_id: string
          role?: Database["public"]["Enums"]["ministry_role"]
          role_since?: string
        }
        Update: {
          id?: string
          joined_at?: string
          left_at?: string | null
          ministry_id?: string
          profile_id?: string
          role?: Database["public"]["Enums"]["ministry_role"]
          role_since?: string
        }
        Relationships: [
          {
            foreignKeyName: "ministry_members_ministry_id_fkey"
            columns: ["ministry_id"]
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ministry_members_profile_id_fkey"
            columns: ["profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      pco_gathering_attendance: {
        Row: {
          event_at: string
          id: string
          ministry_id: string
          pco_event_id: string
          pco_person_id: string
          synced_at: string
        }
        Insert: {
          event_at: string
          id?: string
          ministry_id: string
          pco_event_id: string
          pco_person_id: string
          synced_at?: string
        }
        Update: {
          event_at?: string
          id?: string
          ministry_id?: string
          pco_event_id?: string
          pco_person_id?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pco_gathering_attendance_ministry_id_fkey"
            columns: ["ministry_id"]
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      pco_match_log: {
        Row: {
          action: string
          id: string
          ministry_id: string
          pco_person_id: string | null
          performed_at: string
          performed_by: string
          profile_id: string
        }
        Insert: {
          action: string
          id?: string
          ministry_id: string
          pco_person_id?: string | null
          performed_at?: string
          performed_by: string
          profile_id: string
        }
        Update: {
          action?: string
          id?: string
          ministry_id?: string
          pco_person_id?: string | null
          performed_at?: string
          performed_by?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pco_match_log_ministry_id_fkey"
            columns: ["ministry_id"]
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pco_match_log_performed_by_fkey"
            columns: ["performed_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pco_match_log_profile_id_fkey"
            columns: ["profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pco_roster: {
        Row: {
          email: string | null
          full_name: string | null
          id: string
          ministry_id: string
          pco_person_id: string
          phone: string | null
          synced_at: string
        }
        Insert: {
          email?: string | null
          full_name?: string | null
          id?: string
          ministry_id: string
          pco_person_id: string
          phone?: string | null
          synced_at?: string
        }
        Update: {
          email?: string | null
          full_name?: string | null
          id?: string
          ministry_id?: string
          pco_person_id?: string
          phone?: string | null
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pco_roster_ministry_id_fkey"
            columns: ["ministry_id"]
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      pco_sync_log: {
        Row: {
          error: string | null
          id: string
          ministry_id: string
          ran_at: string
          resource: string
          rows_upserted: number
          status: string
        }
        Insert: {
          error?: string | null
          id?: string
          ministry_id: string
          ran_at?: string
          resource: string
          rows_upserted?: number
          status: string
        }
        Update: {
          error?: string | null
          id?: string
          ministry_id?: string
          ran_at?: string
          resource?: string
          rows_upserted?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pco_sync_log_ministry_id_fkey"
            columns: ["ministry_id"]
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      prayer_interactions: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          ministry_id: string
          prayer_request_id: string
          profile_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          ministry_id: string
          prayer_request_id: string
          profile_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          ministry_id?: string
          prayer_request_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prayer_interactions_ministry_id_fkey"
            columns: ["ministry_id"]
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prayer_interactions_prayer_request_id_fkey"
            columns: ["prayer_request_id"]
            referencedRelation: "prayer_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prayer_interactions_profile_id_fkey"
            columns: ["profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prayer_requests: {
        Row: {
          body: string
          created_at: string
          group_id: string | null
          id: string
          is_anonymous: boolean
          ministry_id: string
          profile_id: string
          status: Database["public"]["Enums"]["prayer_status"]
          visibility: Database["public"]["Enums"]["prayer_visibility"]
        }
        Insert: {
          body: string
          created_at?: string
          group_id?: string | null
          id?: string
          is_anonymous?: boolean
          ministry_id: string
          profile_id: string
          status?: Database["public"]["Enums"]["prayer_status"]
          visibility?: Database["public"]["Enums"]["prayer_visibility"]
        }
        Update: {
          body?: string
          created_at?: string
          group_id?: string | null
          id?: string
          is_anonymous?: boolean
          ministry_id?: string
          profile_id?: string
          status?: Database["public"]["Enums"]["prayer_status"]
          visibility?: Database["public"]["Enums"]["prayer_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "prayer_requests_group_id_fkey"
            columns: ["group_id"]
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prayer_requests_ministry_id_fkey"
            columns: ["ministry_id"]
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prayer_requests_profile_id_fkey"
            columns: ["profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          organization_id: string
          pco_person_id: string | null
          phone: string | null
          photo_url: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          organization_id: string
          pco_person_id?: string | null
          phone?: string | null
          photo_url?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          organization_id?: string
          pco_person_id?: string | null
          phone?: string | null
          photo_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          expo_token: string
          id: string
          ministry_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          expo_token: string
          id?: string
          ministry_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          expo_token?: string
          id?: string
          ministry_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_ministry_id_fkey"
            columns: ["ministry_id"]
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_tokens_profile_id_fkey"
            columns: ["profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sanity_sync_log: {
        Row: {
          action: string
          document_type: string
          id: string
          sanity_id: string
          synced_at: string
        }
        Insert: {
          action: string
          document_type: string
          id?: string
          sanity_id: string
          synced_at?: string
        }
        Update: {
          action?: string
          document_type?: string
          id?: string
          sanity_id?: string
          synced_at?: string
        }
        Relationships: []
      }
      score_config: {
        Row: {
          id: string
          key: string
          ministry_id: string
          updated_at: string
          updated_by: string | null
          value: number
        }
        Insert: {
          id?: string
          key: string
          ministry_id: string
          updated_at?: string
          updated_by?: string | null
          value: number
        }
        Update: {
          id?: string
          key?: string
          ministry_id?: string
          updated_at?: string
          updated_by?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "score_config_ministry_id_fkey"
            columns: ["ministry_id"]
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      serve_logs: {
        Row: {
          created_at: string
          id: string
          logged_by: string | null
          ministry_id: string
          opportunity_id: string | null
          profile_id: string
          served_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logged_by?: string | null
          ministry_id: string
          opportunity_id?: string | null
          profile_id: string
          served_at: string
        }
        Update: {
          created_at?: string
          id?: string
          logged_by?: string | null
          ministry_id?: string
          opportunity_id?: string | null
          profile_id?: string
          served_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "serve_logs_logged_by_fkey"
            columns: ["logged_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serve_logs_ministry_id_fkey"
            columns: ["ministry_id"]
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serve_logs_opportunity_id_fkey"
            columns: ["opportunity_id"]
            referencedRelation: "serve_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serve_logs_profile_id_fkey"
            columns: ["profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      serve_opportunities: {
        Row: {
          church_center_url: string | null
          created_at: string
          id: string
          ministry_id: string
          serve_at: string | null
          title: string
        }
        Insert: {
          church_center_url?: string | null
          created_at?: string
          id?: string
          ministry_id: string
          serve_at?: string | null
          title: string
        }
        Update: {
          church_center_url?: string | null
          created_at?: string
          id?: string
          ministry_id?: string
          serve_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "serve_opportunities_ministry_id_fkey"
            columns: ["ministry_id"]
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_invite: {
        Args: { p_code: string }
        Returns: {
          ministry_name: string
          role: Database["public"]["Enums"]["ministry_role"]
        }[]
      }
      fn_can_read_profile: { Args: { p_profile: string }; Returns: boolean }
      fn_ensure_membership: {
        Args: {
          p_full_name: string
          p_ministry: string
          p_phone: string
          p_role: Database["public"]["Enums"]["ministry_role"]
        }
        Returns: boolean
      }
      fn_in_group: {
        Args: { p_group: string; p_ministry: string }
        Returns: boolean
      }
      fn_is_admin: { Args: { p_ministry: string }; Returns: boolean }
      fn_is_leader: { Args: { p_ministry: string }; Returns: boolean }
      fn_leads_group: {
        Args: { p_group: string; p_ministry: string }
        Returns: boolean
      }
      fn_leads_member: {
        Args: { p_ministry: string; p_profile: string }
        Returns: boolean
      }
      fn_ministry_role: {
        Args: { p_ministry: string }
        Returns: Database["public"]["Enums"]["ministry_role"]
      }
      fn_ministry_timezone: { Args: { p_ministry: string }; Returns: string }
      fn_open_signup: { Args: { p_ministry: string }; Returns: boolean }
      generate_meetings: {
        Args: { p_ministry: string; p_weeks?: number }
        Returns: number
      }
      join_ministry: {
        Args: { p_full_name: string; p_ministry: string; p_phone?: string }
        Returns: string
      }
      list_open_ministries: {
        Args: Record<PropertyKey, never>
        Returns: {
          ministry_id: string
          ministry_name: string
          organization_name: string
        }[]
      }
      mark_attendance: {
        Args: { p_excused?: string[]; p_meeting: string; p_present: string[] }
        Returns: undefined
      }
      place_member: {
        Args: { p_group: string; p_profile: string }
        Returns: undefined
      }
      redeem_invite: {
        Args: { p_code: string; p_full_name?: string; p_phone?: string }
        Returns: string
      }
      set_group_leader: {
        Args: {
          p_group: string
          p_profile: string
          p_role: Database["public"]["Enums"]["ministry_role"]
        }
        Returns: undefined
      }
    }
    Enums: {
      attendance_status: "present" | "absent" | "excused"
      contact_method: "call" | "text" | "in_person" | "other"
      group_status: "forming" | "active" | "archived"
      ministry_role: "member" | "co_leader" | "leader" | "admin"
      prayer_status: "open" | "answered" | "archived"
      prayer_visibility: "group" | "ministry"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      attendance_status: ["present", "absent", "excused"],
      contact_method: ["call", "text", "in_person", "other"],
      group_status: ["forming", "active", "archived"],
      ministry_role: ["member", "co_leader", "leader", "admin"],
      prayer_status: ["open", "answered", "archived"],
      prayer_visibility: ["group", "ministry"],
    },
  },
} as const
