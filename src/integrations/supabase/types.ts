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
      arena_buttons: {
        Row: {
          arena_id: string
          created_at: string
          id: string
          label: string
        }
        Insert: {
          arena_id: string
          created_at?: string
          id?: string
          label: string
        }
        Update: {
          arena_id?: string
          created_at?: string
          id?: string
          label?: string
        }
        Relationships: []
      }
      arenas: {
        Row: {
          active: boolean
          created_at: string
          id: string
          logo_url: string | null
          name: string
          owner_id: string | null
          primary_color: string
          slug: string
          supabase_service_key: string | null
          supabase_url: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          owner_id?: string | null
          primary_color?: string
          slug: string
          supabase_service_key?: string | null
          supabase_url?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          primary_color?: string
          slug?: string
          supabase_service_key?: string | null
          supabase_url?: string | null
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
            foreignKeyName: "cameras_button_id_fkey"
            columns: ["button_id"]
            isOneToOne: false
            referencedRelation: "arena_buttons"
            referencedColumns: ["id"]
          },
        ]
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
        ]
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
          name: string
          serial: string
        }
        Insert: {
          arena_id: string
          created_at?: string
          id?: string
          name: string
          serial: string
        }
        Update: {
          arena_id?: string
          created_at?: string
          id?: string
          name?: string
          serial?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
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
    },
  },
} as const
