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
      catalog_products: {
        Row: {
          badge_text: string | null
          content_source: string
          cover_image_url: string | null
          created_at: string
          description: string | null
          ebook_mode: string | null
          external_url: string | null
          hero_image_url: string | null
          id: string
          inherited_cover: boolean
          is_featured: boolean
          is_locked: boolean
          is_mirror: boolean
          is_published: boolean
          mirror_type: string | null
          order_index: number
          product_type: string
          section_id: string | null
          slug: string
          source_product_id: string | null
          story_id: string | null
          subtitle: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          variation_id: string | null
        }
        Insert: {
          badge_text?: string | null
          content_source?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          ebook_mode?: string | null
          external_url?: string | null
          hero_image_url?: string | null
          id?: string
          inherited_cover?: boolean
          is_featured?: boolean
          is_locked?: boolean
          is_mirror?: boolean
          is_published?: boolean
          mirror_type?: string | null
          order_index?: number
          product_type?: string
          section_id?: string | null
          slug: string
          source_product_id?: string | null
          story_id?: string | null
          subtitle?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          variation_id?: string | null
        }
        Update: {
          badge_text?: string | null
          content_source?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          ebook_mode?: string | null
          external_url?: string | null
          hero_image_url?: string | null
          id?: string
          inherited_cover?: boolean
          is_featured?: boolean
          is_locked?: boolean
          is_mirror?: boolean
          is_published?: boolean
          mirror_type?: string | null
          order_index?: number
          product_type?: string
          section_id?: string | null
          slug?: string
          source_product_id?: string | null
          story_id?: string | null
          subtitle?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_products_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "catalog_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_products_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "member_area_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_sections: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          order_index: number
          slug: string
          subtitle: string | null
          title: string
          updated_at: string
          variation_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          order_index?: number
          slug: string
          subtitle?: string | null
          title: string
          updated_at?: string
          variation_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          order_index?: number
          slug?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_sections_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "member_area_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_user_favorites: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_user_favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
        ]
      }
      home_settings: {
        Row: {
          continue_fallback_product_id: string | null
          featured_product_id: string | null
          hero_button_label: string | null
          hero_image_url: string | null
          hero_label: string | null
          hero_overlay_opacity: number | null
          hero_subtitle: string | null
          hero_title: string | null
          id: string
          updated_at: string
          variation_id: string | null
        }
        Insert: {
          continue_fallback_product_id?: string | null
          featured_product_id?: string | null
          hero_button_label?: string | null
          hero_image_url?: string | null
          hero_label?: string | null
          hero_overlay_opacity?: number | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          updated_at?: string
          variation_id?: string | null
        }
        Update: {
          continue_fallback_product_id?: string | null
          featured_product_id?: string | null
          hero_button_label?: string | null
          hero_image_url?: string | null
          hero_label?: string | null
          hero_overlay_opacity?: number | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          updated_at?: string
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "home_settings_continue_fallback_product_id_fkey"
            columns: ["continue_fallback_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_settings_featured_product_id_fkey"
            columns: ["featured_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_settings_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "member_area_variations"
            referencedColumns: ["id"]
          },
        ]
      }
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
      stories: {
        Row: {
          age_max: number | null
          age_min: number | null
          age_range: string | null
          category_id: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          difficulty_level: number | null
          estimated_minutes: number | null
          id: string
          is_active: boolean
          is_featured: boolean
          is_new: boolean
          loved: number
          short_description: string | null
          slug: string
          sort_order: number
          subtitle: string | null
          testament: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          age_range?: string | null
          category_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          difficulty_level?: number | null
          estimated_minutes?: number | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          is_new?: boolean
          loved?: number
          short_description?: string | null
          slug: string
          sort_order?: number
          subtitle?: string | null
          testament?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          age_range?: string | null
          category_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          difficulty_level?: number | null
          estimated_minutes?: number | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          is_new?: boolean
          loved?: number
          short_description?: string | null
          slug?: string
          sort_order?: number
          subtitle?: string | null
          testament?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "story_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      stories_pages: {
        Row: {
          created_at: string
          id: string
          image_colored_sample_url: string | null
          image_lineart_url: string | null
          image_preview_url: string | null
          is_active: boolean
          mobile_focus_x: number | null
          mobile_focus_y: number | null
          page_number: number
          recommended_zoom: number | null
          story_id: string
          svg_markup: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_colored_sample_url?: string | null
          image_lineart_url?: string | null
          image_preview_url?: string | null
          is_active?: boolean
          mobile_focus_x?: number | null
          mobile_focus_y?: number | null
          page_number: number
          recommended_zoom?: number | null
          story_id: string
          svg_markup?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_colored_sample_url?: string | null
          image_lineart_url?: string | null
          image_preview_url?: string | null
          is_active?: boolean
          mobile_focus_x?: number | null
          mobile_focus_y?: number | null
          page_number?: number
          recommended_zoom?: number | null
          story_id?: string
          svg_markup?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stories_pages_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_categories: {
        Row: {
          color: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          emoji: string | null
          icon_url: string | null
          id: string
          is_active: boolean
          slug: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          emoji?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          emoji?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_recent_products: {
        Row: {
          id: string
          last_opened_at: string
          product_id: string
          progress_percent: number
          user_id: string
        }
        Insert: {
          id?: string
          last_opened_at?: string
          product_id: string
          progress_percent?: number
          user_id: string
        }
        Update: {
          id?: string
          last_opened_at?: string
          product_id?: string
          progress_percent?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_recent_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
        ]
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
