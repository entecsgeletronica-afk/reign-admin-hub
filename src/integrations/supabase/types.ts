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
      member_area_domains: {
        Row: {
          created_at: string
          full_domain: string
          id: string
          is_primary: boolean
          member_area_id: string
          root_domain: string
          status: string
          subdomain_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_domain: string
          id?: string
          is_primary?: boolean
          member_area_id: string
          root_domain: string
          status?: string
          subdomain_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_domain?: string
          id?: string
          is_primary?: boolean
          member_area_id?: string
          root_domain?: string
          status?: string
          subdomain_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_area_domains_member_area_id_fkey"
            columns: ["member_area_id"]
            isOneToOne: false
            referencedRelation: "member_area_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      member_area_variations: {
        Row: {
          accent_color: string | null
          access_type: string
          account_id: string
          app_name: string | null
          background_color: string | null
          button_color: string | null
          button_text_color: string | null
          card_color: string | null
          created_at: string
          date_format: string
          default_locale: string
          description: string | null
          domain_mode: string
          enabled_languages: string[]
          favicon_url: string | null
          hero_image_url: string | null
          id: string
          is_primary: boolean
          login_background_mode: string
          login_email_placeholder: string | null
          login_footer_text: string | null
          login_helper_text: string | null
          login_image_url: string | null
          login_layout_mode: string
          login_password_placeholder: string | null
          login_submit_label: string | null
          login_subtitle: string | null
          login_title: string | null
          logo_alt: string | null
          logo_url: string | null
          microcopy_json: Json
          muted_text_color: string | null
          no_access_behavior: string
          order_index: number
          primary_color: string | null
          primary_type: string
          root_domain: string | null
          sales_page_url: string | null
          secondary_color: string | null
          short_label: string | null
          sidebar_color: string | null
          slug: string
          status: string
          subdomain_key: string | null
          support_email: string | null
          surface_color: string | null
          text_color: string | null
          theme_mode: string
          title: string
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          access_type?: string
          account_id?: string
          app_name?: string | null
          background_color?: string | null
          button_color?: string | null
          button_text_color?: string | null
          card_color?: string | null
          created_at?: string
          date_format?: string
          default_locale?: string
          description?: string | null
          domain_mode?: string
          enabled_languages?: string[]
          favicon_url?: string | null
          hero_image_url?: string | null
          id?: string
          is_primary?: boolean
          login_background_mode?: string
          login_email_placeholder?: string | null
          login_footer_text?: string | null
          login_helper_text?: string | null
          login_image_url?: string | null
          login_layout_mode?: string
          login_password_placeholder?: string | null
          login_submit_label?: string | null
          login_subtitle?: string | null
          login_title?: string | null
          logo_alt?: string | null
          logo_url?: string | null
          microcopy_json?: Json
          muted_text_color?: string | null
          no_access_behavior?: string
          order_index?: number
          primary_color?: string | null
          primary_type?: string
          root_domain?: string | null
          sales_page_url?: string | null
          secondary_color?: string | null
          short_label?: string | null
          sidebar_color?: string | null
          slug: string
          status?: string
          subdomain_key?: string | null
          support_email?: string | null
          surface_color?: string | null
          text_color?: string | null
          theme_mode?: string
          title: string
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          access_type?: string
          account_id?: string
          app_name?: string | null
          background_color?: string | null
          button_color?: string | null
          button_text_color?: string | null
          card_color?: string | null
          created_at?: string
          date_format?: string
          default_locale?: string
          description?: string | null
          domain_mode?: string
          enabled_languages?: string[]
          favicon_url?: string | null
          hero_image_url?: string | null
          id?: string
          is_primary?: boolean
          login_background_mode?: string
          login_email_placeholder?: string | null
          login_footer_text?: string | null
          login_helper_text?: string | null
          login_image_url?: string | null
          login_layout_mode?: string
          login_password_placeholder?: string | null
          login_submit_label?: string | null
          login_subtitle?: string | null
          login_title?: string | null
          logo_alt?: string | null
          logo_url?: string | null
          microcopy_json?: Json
          muted_text_color?: string | null
          no_access_behavior?: string
          order_index?: number
          primary_color?: string | null
          primary_type?: string
          root_domain?: string | null
          sales_page_url?: string | null
          secondary_color?: string | null
          short_label?: string | null
          sidebar_color?: string | null
          slug?: string
          status?: string
          subdomain_key?: string | null
          support_email?: string | null
          surface_color?: string | null
          text_color?: string | null
          theme_mode?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "super_admin"
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
      app_role: ["admin", "moderator", "user", "super_admin"],
    },
  },
} as const
