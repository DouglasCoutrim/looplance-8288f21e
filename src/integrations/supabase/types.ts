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
          created_at: string
          id: string
          quadra_id: string
          status: string
        }
        Insert: {
          arena_id: string
          created_at?: string
          id?: string
          quadra_id: string
          status?: string
        }
        Update: {
          arena_id?: string
          created_at?: string
          id?: string
          quadra_id?: string
          status?: string
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
        }
        Insert: {
          active?: boolean
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
        }
        Update: {
          active?: boolean
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
        }
        Relationships: []
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
      quadras: {
        Row: {
          arena_id: string | null
          created_at: string | null
          id: string
          nome: string
          rtsp_url: string | null
        }
        Insert: {
          arena_id?: string | null
          created_at?: string | null
          id?: string
          nome: string
          rtsp_url?: string | null
        }
        Update: {
          arena_id?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          rtsp_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quadras_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quadras_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "public_arenas"
            referencedColumns: ["id"]
          },
        ]
      }
      replays: {
        Row: {
          arena_id: string
          created_at: string
          id: string
          quadra_id: string | null
          video_url: string
        }
        Insert: {
          arena_id: string
          created_at?: string
          id?: string
          quadra_id?: string | null
          video_url: string
        }
        Update: {
          arena_id?: string
          created_at?: string
          id?: string
          quadra_id?: string | null
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "replays_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replays_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "public_arenas"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
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
