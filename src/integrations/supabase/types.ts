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
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      arena_buttons: {
        Row: {
          arena_id: string
          board_id: string | null
          button_number: number | null
          camera_id: string | null
          created_at: string
          hardware_pin: string | null
          id: string
          label: string
        }
        Insert: {
          arena_id: string
          board_id?: string | null
          button_number?: number | null
          camera_id?: string | null
          created_at?: string
          hardware_pin?: string | null
          id?: string
          label: string
        }
        Update: {
          arena_id?: string
          board_id?: string | null
          button_number?: number | null
          camera_id?: string | null
          created_at?: string
          hardware_pin?: string | null
          id?: string
          label?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_buttons_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_buttons_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "public_arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_buttons_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "zero_delay_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_buttons_camera_id_fkey"
            columns: ["camera_id"]
            isOneToOne: false
            referencedRelation: "cameras"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_ingest_tokens: {
        Row: {
          arena_id: string
          created_at: string
          created_by: string | null
          id: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          token_hash: string
          token_prefix: string
        }
        Insert: {
          arena_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          token_hash: string
          token_prefix: string
        }
        Update: {
          arena_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          token_hash?: string
          token_prefix?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_ingest_tokens_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_ingest_tokens_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "public_arenas"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_sponsors: {
        Row: {
          arena_id: string
          created_at: string
          display_order: number
          id: string
          link_url: string | null
          logo_url: string
          name: string
        }
        Insert: {
          arena_id: string
          created_at?: string
          display_order?: number
          id?: string
          link_url?: string | null
          logo_url: string
          name: string
        }
        Update: {
          arena_id?: string
          created_at?: string
          display_order?: number
          id?: string
          link_url?: string | null
          logo_url?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_sponsors_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_sponsors_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "public_arenas"
            referencedColumns: ["id"]
          },
        ]
      }
      arenas: {
        Row: {
          active: boolean
          agent_webhook_secret: string | null
          agent_webhook_url: string | null
          city: string | null
          config_version: number
          created_at: string
          id: string
          logo_url: string | null
          name: string
          owner_id: string | null
          primary_color: string
          retention_days: number | null
          slug: string
          state: string | null
          supabase_anon_key: string | null
          supabase_service_key: string | null
          supabase_url: string | null
          videos_bucket: string | null
        }
        Insert: {
          active?: boolean
          agent_webhook_secret?: string | null
          agent_webhook_url?: string | null
          city?: string | null
          config_version?: number
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          owner_id?: string | null
          primary_color?: string
          retention_days?: number | null
          slug: string
          state?: string | null
          supabase_anon_key?: string | null
          supabase_service_key?: string | null
          supabase_url?: string | null
          videos_bucket?: string | null
        }
        Update: {
          active?: boolean
          agent_webhook_secret?: string | null
          agent_webhook_url?: string | null
          city?: string | null
          config_version?: number
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          primary_color?: string
          retention_days?: number | null
          slug?: string
          state?: string | null
          supabase_anon_key?: string | null
          supabase_service_key?: string | null
          supabase_url?: string | null
          videos_bucket?: string | null
        }
        Relationships: []
      }
      cameras: {
        Row: {
          arena_id: string
          button_id: string | null
          created_at: string
          id: string
          name: string
          rtsp_url: string
        }
        Insert: {
          arena_id: string
          button_id?: string | null
          created_at?: string
          id?: string
          name: string
          rtsp_url: string
        }
        Update: {
          arena_id?: string
          button_id?: string | null
          created_at?: string
          id?: string
          name?: string
          rtsp_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "cameras_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cameras_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "public_arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cameras_button_id_fkey"
            columns: ["button_id"]
            isOneToOne: false
            referencedRelation: "arena_buttons"
            referencedColumns: ["id"]
          },
        ]
      }
      court_cameras: {
        Row: {
          arena_id: string
          camera_id: string
          court_id: string
          created_at: string
          id: string
        }
        Insert: {
          arena_id: string
          camera_id: string
          court_id: string
          created_at?: string
          id?: string
        }
        Update: {
          arena_id?: string
          camera_id?: string
          court_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      courts: {
        Row: {
          arena_id: string
          created_at: string
          id: string
          name: string
          qr_token: string
        }
        Insert: {
          arena_id: string
          created_at?: string
          id?: string
          name: string
          qr_token?: string
        }
        Update: {
          arena_id?: string
          created_at?: string
          id?: string
          name?: string
          qr_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "courts_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courts_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "public_arenas"
            referencedColumns: ["id"]
          },
        ]
      }
      favorite_arenas: {
        Row: {
          arena_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          arena_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          arena_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      global_replays: {
        Row: {
          arena_id: string
          arena_logo_url: string | null
          arena_name: string
          arena_primary_color: string
          arena_slug: string
          court_id: string | null
          court_name: string | null
          created_at: string
          data_evento: string
          hora_evento: string
          id: string
          thumbnail_url: string | null
          title: string | null
          video_id: string | null
          video_url: string
        }
        Insert: {
          arena_id: string
          arena_logo_url?: string | null
          arena_name: string
          arena_primary_color?: string
          arena_slug: string
          court_id?: string | null
          court_name?: string | null
          created_at?: string
          data_evento?: string
          hora_evento?: string
          id?: string
          thumbnail_url?: string | null
          title?: string | null
          video_id?: string | null
          video_url: string
        }
        Update: {
          arena_id?: string
          arena_logo_url?: string | null
          arena_name?: string
          arena_primary_color?: string
          arena_slug?: string
          court_id?: string | null
          court_name?: string | null
          created_at?: string
          data_evento?: string
          hora_evento?: string
          id?: string
          thumbnail_url?: string | null
          title?: string | null
          video_id?: string | null
          video_url?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      replay_jobs: {
        Row: {
          arena_id: string
          aspect_ratio: string
          coords_json: Json | null
          created_at: string
          crop_h: number
          crop_w: number
          crop_x: number
          crop_y: number
          duracao_segundos: number
          end_time: number | null
          id: string
          output_url: string | null
          source_video_id: string | null
          source_video_url: string | null
          start_time: number | null
          status: string
          thumbnail_url: string | null
          timestamp_inicio: number
          updated_at: string
          user_id: string
        }
        Insert: {
          arena_id: string
          aspect_ratio?: string
          coords_json?: Json | null
          created_at?: string
          crop_h?: number
          crop_w?: number
          crop_x?: number
          crop_y?: number
          duracao_segundos?: number
          end_time?: number | null
          id?: string
          output_url?: string | null
          source_video_id?: string | null
          source_video_url?: string | null
          start_time?: number | null
          status?: string
          thumbnail_url?: string | null
          timestamp_inicio?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          arena_id?: string
          aspect_ratio?: string
          coords_json?: Json | null
          created_at?: string
          crop_h?: number
          crop_w?: number
          crop_x?: number
          crop_y?: number
          duracao_segundos?: number
          end_time?: number | null
          id?: string
          output_url?: string | null
          source_video_id?: string | null
          source_video_url?: string | null
          start_time?: number | null
          status?: string
          thumbnail_url?: string | null
          timestamp_inicio?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          arena_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          arena_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          arena_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "public_arenas"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          arena_id: string
          court_id: string | null
          created_at: string
          duration_seconds: number | null
          id: string
          thumbnail_url: string | null
          title: string
          uploaded_by: string | null
          video_url: string
        }
        Insert: {
          arena_id: string
          court_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          thumbnail_url?: string | null
          title: string
          uploaded_by?: string | null
          video_url: string
        }
        Update: {
          arena_id?: string
          court_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          thumbnail_url?: string | null
          title?: string
          uploaded_by?: string | null
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "videos_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "public_arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
      zero_delay_boards: {
        Row: {
          arena_id: string
          created_at: string
          id: string
          model: string
          name: string
          serial: string
        }
        Insert: {
          arena_id: string
          created_at?: string
          id?: string
          model?: string
          name: string
          serial: string
        }
        Update: {
          arena_id?: string
          created_at?: string
          id?: string
          model?: string
          name?: string
          serial?: string
        }
        Relationships: [
          {
            foreignKeyName: "zero_delay_boards_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zero_delay_boards_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "public_arenas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      arena_button_camera_map: {
        Row: {
          arena_id: string | null
          button_label: string | null
          button_number: number | null
          camera_id: string | null
          camera_name: string | null
          pino: string | null
          rtsp: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arena_buttons_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_buttons_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "public_arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_buttons_camera_id_fkey"
            columns: ["camera_id"]
            isOneToOne: false
            referencedRelation: "cameras"
            referencedColumns: ["id"]
          },
        ]
      }
      public_arenas: {
        Row: {
          active: boolean | null
          city: string | null
          id: string | null
          logo_url: string | null
          name: string | null
          primary_color: string | null
          slug: string | null
          state: string | null
          supabase_anon_key: string | null
          supabase_url: string | null
        }
        Insert: {
          active?: boolean | null
          city?: string | null
          id?: string | null
          logo_url?: string | null
          name?: string | null
          primary_color?: string | null
          slug?: string | null
          state?: string | null
          supabase_anon_key?: string | null
          supabase_url?: string | null
        }
        Update: {
          active?: boolean | null
          city?: string | null
          id?: string | null
          logo_url?: string | null
          name?: string | null
          primary_color?: string | null
          slug?: string | null
          state?: string | null
          supabase_anon_key?: string | null
          supabase_url?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_arena_access: {
        Args: { _arena_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_arena_admin: {
        Args: { _arena_id: string; _user_id: string }
        Returns: boolean
      }
      is_arena_player: {
        Args: { _arena_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "superadmin" | "admin_arena" | "player"
      user_role: "superadmin" | "admin_arena" | "usuario_comum"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["superadmin", "admin_arena", "player"],
      user_role: ["superadmin", "admin_arena", "usuario_comum"],
    },
  },
} as const
