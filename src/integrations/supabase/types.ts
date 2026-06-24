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
      access_resend_log: {
        Row: {
          admin_user_id: string
          channel: string
          created_at: string
          id: string
          notes: string | null
          order_id: string | null
          product_id: string | null
          recipient: string | null
          status: string
          target_user_id: string
        }
        Insert: {
          admin_user_id: string
          channel?: string
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string | null
          product_id?: string | null
          recipient?: string | null
          status?: string
          target_user_id: string
        }
        Update: {
          admin_user_id?: string
          channel?: string
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string | null
          product_id?: string | null
          recipient?: string | null
          status?: string
          target_user_id?: string
        }
        Relationships: []
      }
      achievements: {
        Row: {
          created_at: string
          description: string | null
          icon_url: string | null
          id: string
          is_active: boolean
          reward_type: string | null
          reward_value_json: Json | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          reward_type?: string | null
          reward_value_json?: Json | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          reward_type?: string | null
          reward_value_json?: Json | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string | null
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          is_active?: boolean
          name?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          access_blocked: boolean
          created_at: string
          email: string
          id: string
          name: string
          plan_name: string | null
          status: Database["public"]["Enums"]["admin_user_status"]
          total_paid: number
        }
        Insert: {
          access_blocked?: boolean
          created_at?: string
          email: string
          id?: string
          name?: string
          plan_name?: string | null
          status?: Database["public"]["Enums"]["admin_user_status"]
          total_paid?: number
        }
        Update: {
          access_blocked?: boolean
          created_at?: string
          email?: string
          id?: string
          name?: string
          plan_name?: string | null
          status?: Database["public"]["Enums"]["admin_user_status"]
          total_paid?: number
        }
        Relationships: []
      }
      admin_users_summary: {
        Row: {
          active_subscriptions: number
          blocked_access: number
          id: string
          revenue_displayed: number
          total_filtered: number
          updated_at: string
        }
        Insert: {
          active_subscriptions?: number
          blocked_access?: number
          id?: string
          revenue_displayed?: number
          total_filtered?: number
          updated_at?: string
        }
        Update: {
          active_subscriptions?: number
          blocked_access?: number
          id?: string
          revenue_displayed?: number
          total_filtered?: number
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          id: string
          sender_email: string | null
          sender_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          sender_email?: string | null
          sender_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          sender_email?: string | null
          sender_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      app_settings_kv: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value_json: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value_json?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value_json?: Json
        }
        Relationships: []
      }
      branding_settings: {
        Row: {
          alt_text: string
          app_name: string
          favicon_url: string | null
          id: number
          logo_url: string | null
          updated_at: string
        }
        Insert: {
          alt_text?: string
          app_name?: string
          favicon_url?: string | null
          id?: number
          logo_url?: string | null
          updated_at?: string
        }
        Update: {
          alt_text?: string
          app_name?: string
          favicon_url?: string | null
          id?: number
          logo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
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
          required_plan_codes: string[]
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
          required_plan_codes?: string[]
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
          required_plan_codes?: string[]
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
            foreignKeyName: "catalog_products_source_product_id_fkey"
            columns: ["source_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_products_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
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
      commercial_offer_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          offer_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          offer_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          offer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_offer_codes_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "commercial_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_offer_codes_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "commercial_offers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_offer_products: {
        Row: {
          access_duration_days: number | null
          access_duration_type: string
          created_at: string
          id: string
          offer_id: string
          order_index: number
          product_id: string
          release_mode: string
          updated_at: string
        }
        Insert: {
          access_duration_days?: number | null
          access_duration_type?: string
          created_at?: string
          id?: string
          offer_id: string
          order_index?: number
          product_id: string
          release_mode?: string
          updated_at?: string
        }
        Update: {
          access_duration_days?: number | null
          access_duration_type?: string
          created_at?: string
          id?: string
          offer_id?: string
          order_index?: number
          product_id?: string
          release_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_offer_products_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "commercial_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_offer_products_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "commercial_offers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_offer_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_offers: {
        Row: {
          account_id: string
          created_at: string
          gateway: string
          id: string
          notes: string | null
          offer_name: string
          sale_mode: string
          status: string
          token: string | null
          updated_at: string
          variation_id: string
        }
        Insert: {
          account_id?: string
          created_at?: string
          gateway?: string
          id?: string
          notes?: string | null
          offer_name: string
          sale_mode?: string
          status?: string
          token?: string | null
          updated_at?: string
          variation_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          gateway?: string
          id?: string
          notes?: string | null
          offer_name?: string
          sale_mode?: string
          status?: string
          token?: string | null
          updated_at?: string
          variation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_offers_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "member_area_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      course_lesson_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          last_position_seconds: number
          lesson_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          last_position_seconds?: number
          lesson_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          last_position_seconds?: number
          lesson_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "course_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      course_lessons: {
        Row: {
          body_text: string | null
          complementary_label: string | null
          complementary_url: string | null
          created_at: string
          description: string | null
          embed_code: string | null
          id: string
          module_id: string
          order_index: number
          pdf_label: string | null
          pdf_url: string | null
          provider: string
          status: string
          title: string
          updated_at: string
          video_url: string | null
          youtube_settings: Json
        }
        Insert: {
          body_text?: string | null
          complementary_label?: string | null
          complementary_url?: string | null
          created_at?: string
          description?: string | null
          embed_code?: string | null
          id?: string
          module_id: string
          order_index?: number
          pdf_label?: string | null
          pdf_url?: string | null
          provider?: string
          status?: string
          title: string
          updated_at?: string
          video_url?: string | null
          youtube_settings?: Json
        }
        Update: {
          body_text?: string | null
          complementary_label?: string | null
          complementary_url?: string | null
          created_at?: string
          description?: string | null
          embed_code?: string | null
          id?: string
          module_id?: string
          order_index?: number
          pdf_label?: string | null
          pdf_url?: string | null
          provider?: string
          status?: string
          title?: string
          updated_at?: string
          video_url?: string | null
          youtube_settings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "course_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      course_modules: {
        Row: {
          created_at: string
          description: string | null
          id: string
          order_index: number
          product_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          product_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          product_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_kpis: {
        Row: {
          active_subscriptions: number
          avg_ticket: number
          created_at: string
          id: string
          mrr_amount: number
          period_key: string
          revenue_amount: number
          sales_count: number
          top_plan_name: string | null
          updated_at: string
        }
        Insert: {
          active_subscriptions?: number
          avg_ticket?: number
          created_at?: string
          id?: string
          mrr_amount?: number
          period_key: string
          revenue_amount?: number
          sales_count?: number
          top_plan_name?: string | null
          updated_at?: string
        }
        Update: {
          active_subscriptions?: number
          avg_ticket?: number
          created_at?: string
          id?: string
          mrr_amount?: number
          period_key?: string
          revenue_amount?: number
          sales_count?: number
          top_plan_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dashboard_series: {
        Row: {
          created_at: string
          id: string
          label: string
          period_key: string
          revenue_amount: number
          sales_count: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          period_key: string
          revenue_amount?: number
          sales_count?: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          period_key?: string
          revenue_amount?: number
          sales_count?: number
          sort_order?: number
        }
        Relationships: []
      }
      ebook_files: {
        Row: {
          allow_download: boolean
          created_at: string
          description: string | null
          file_name: string | null
          file_path: string
          file_size: number | null
          id: string
          module_id: string | null
          product_id: string
          sort_order: number
          status: string
          title: string
          total_pages: number | null
          updated_at: string
        }
        Insert: {
          allow_download?: boolean
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_path: string
          file_size?: number | null
          id?: string
          module_id?: string | null
          product_id: string
          sort_order?: number
          status?: string
          title: string
          total_pages?: number | null
          updated_at?: string
        }
        Update: {
          allow_download?: boolean
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_path?: string
          file_size?: number | null
          id?: string
          module_id?: string | null
          product_id?: string
          sort_order?: number
          status?: string
          title?: string
          total_pages?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebook_files_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "ebook_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebook_files_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
        ]
      }
      ebook_modules: {
        Row: {
          created_at: string
          description: string | null
          id: string
          product_id: string
          sort_order: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          product_id: string
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          product_id?: string
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebook_modules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
        ]
      }
      ebook_progress: {
        Row: {
          created_at: string
          ebook_file_id: string
          id: string
          last_opened_at: string
          last_page: number
          product_id: string
          progress_percentage: number
          total_pages: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ebook_file_id: string
          id?: string
          last_opened_at?: string
          last_page?: number
          product_id: string
          progress_percentage?: number
          total_pages?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ebook_file_id?: string
          id?: string
          last_opened_at?: string
          last_page?: number
          product_id?: string
          progress_percentage?: number
          total_pages?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebook_progress_ebook_file_id_fkey"
            columns: ["ebook_file_id"]
            isOneToOne: false
            referencedRelation: "ebook_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebook_progress_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
        ]
      }
      email_outbox: {
        Row: {
          area_url: string | null
          attempt_count: number
          body_html: string
          body_text: string | null
          created_at: string
          external_order_id: string | null
          id: string
          last_error: string | null
          metadata: Json
          offer_id: string | null
          product_ids: string[]
          reason: string | null
          recipient_email: string
          recipient_name: string | null
          scheduled_for: string
          sent_at: string | null
          status: string
          subject: string
          template_key: string
          updated_at: string
          user_id: string | null
          variation_id: string | null
        }
        Insert: {
          area_url?: string | null
          attempt_count?: number
          body_html: string
          body_text?: string | null
          created_at?: string
          external_order_id?: string | null
          id?: string
          last_error?: string | null
          metadata?: Json
          offer_id?: string | null
          product_ids?: string[]
          reason?: string | null
          recipient_email: string
          recipient_name?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          subject: string
          template_key?: string
          updated_at?: string
          user_id?: string | null
          variation_id?: string | null
        }
        Update: {
          area_url?: string | null
          attempt_count?: number
          body_html?: string
          body_text?: string | null
          created_at?: string
          external_order_id?: string | null
          id?: string
          last_error?: string | null
          metadata?: Json
          offer_id?: string | null
          product_ids?: string[]
          reason?: string | null
          recipient_email?: string
          recipient_name?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          subject?: string
          template_key?: string
          updated_at?: string
          user_id?: string | null
          variation_id?: string | null
        }
        Relationships: []
      }
      email_settings: {
        Row: {
          id: number
          sender_email: string
          sender_name: string
          updated_at: string
        }
        Insert: {
          id?: number
          sender_email?: string
          sender_name?: string
          updated_at?: string
        }
        Update: {
          id?: number
          sender_email?: string
          sender_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body_html: string
          created_at: string
          enabled: boolean
          id: string
          name: string
          subject: string
          template_key: string
          updated_at: string
          updated_by: string | null
          variables: Json
        }
        Insert: {
          body_html: string
          created_at?: string
          enabled?: boolean
          id?: string
          name: string
          subject: string
          template_key: string
          updated_at?: string
          updated_by?: string | null
          variables?: Json
        }
        Update: {
          body_html?: string
          created_at?: string
          enabled?: boolean
          id?: string
          name?: string
          subject?: string
          template_key?: string
          updated_at?: string
          updated_by?: string | null
          variables?: Json
        }
        Relationships: []
      }
      home_settings: {
        Row: {
          continue_fallback_product_id: string | null
          featured_product_id: string | null
          hero_button_label: string | null
          hero_image_url: string | null
          hero_label: string | null
          hero_overlay_opacity: number
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
          hero_overlay_opacity?: number
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
          hero_overlay_opacity?: number
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
      monthly_recurring_summary: {
        Row: {
          amount: number
          created_at: string
          id: string
          month_key: string
          month_label: string
          sort_order: number
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          month_key: string
          month_label: string
          sort_order?: number
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          month_key?: string
          month_label?: string
          sort_order?: number
        }
        Relationships: []
      }
      plan_product_grants: {
        Row: {
          created_at: string
          id: string
          plan_id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          plan_id: string
          product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          plan_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_product_grants_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_product_grants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          billing_interval: string
          code: string
          created_at: string
          currency: string
          description: string | null
          id: string
          name: string
          native_language: string
          price_cents: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          billing_interval?: string
          code: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          name: string
          native_language?: string
          price_cents?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          billing_interval?: string
          code?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          name?: string
          native_language?: string
          price_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          child_name: string | null
          created_at: string
          display_name: string | null
          email: string | null
          full_name: string | null
          id: string
          language_override: string | null
          phone: string | null
          purchase_email: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          child_name?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          language_override?: string | null
          phone?: string | null
          purchase_email?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          child_name?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          language_override?: string | null
          phone?: string | null
          purchase_email?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      protected_settings: {
        Row: {
          created_at: string
          description: string | null
          editable_by_role: string
          id: string
          is_protected: boolean
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          editable_by_role?: string
          id?: string
          is_protected?: boolean
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          editable_by_role?: string
          id?: string
          is_protected?: boolean
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      recent_sales: {
        Row: {
          amount: number
          customer_name: string | null
          id: string
          period_key: string
          plan_name: string | null
          sold_at: string
        }
        Insert: {
          amount?: number
          customer_name?: string | null
          id?: string
          period_key: string
          plan_name?: string | null
          sold_at?: string
        }
        Update: {
          amount?: number
          customer_name?: string | null
          id?: string
          period_key?: string
          plan_name?: string | null
          sold_at?: string
        }
        Relationships: []
      }
      report_summary: {
        Row: {
          active_plans: number
          canceled_subscriptions: number
          id: string
          period_key: string
          revenue_last_7d: number
          sales_today_amount: number
          sales_today_count: number
          top_plan_name: string | null
          updated_at: string
          users_count: number
        }
        Insert: {
          active_plans?: number
          canceled_subscriptions?: number
          id?: string
          period_key: string
          revenue_last_7d?: number
          sales_today_amount?: number
          sales_today_count?: number
          top_plan_name?: string | null
          updated_at?: string
          users_count?: number
        }
        Update: {
          active_plans?: number
          canceled_subscriptions?: number
          id?: string
          period_key?: string
          revenue_last_7d?: number
          sales_today_amount?: number
          sales_today_count?: number
          top_plan_name?: string | null
          updated_at?: string
          users_count?: number
        }
        Relationships: []
      }
      sales: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          customer_email: string | null
          event_type: string | null
          external_sale_id: string | null
          id: string
          plan_id: string | null
          provider: string
          raw_payload: Json | null
          status: string
          user_id: string | null
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          currency?: string
          customer_email?: string | null
          event_type?: string | null
          external_sale_id?: string | null
          id?: string
          plan_id?: string | null
          provider: string
          raw_payload?: Json | null
          status: string
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          customer_email?: string | null
          event_type?: string | null
          external_sale_id?: string | null
          id?: string
          plan_id?: string | null
          provider?: string
          raw_payload?: Json | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      security_audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json
          reason: string | null
          resource: string | null
          status: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
          resource?: string | null
          status?: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
          resource?: string | null
          status?: string
          user_email?: string | null
          user_id?: string | null
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
      story_covers: {
        Row: {
          cover_url: string | null
          id: string
          is_new: boolean
          slug: string
          subtitle: string
          testament: Database["public"]["Enums"]["story_testament"]
          title: string
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          id: string
          is_new?: boolean
          slug: string
          subtitle?: string
          testament?: Database["public"]["Enums"]["story_testament"]
          title: string
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          id?: string
          is_new?: boolean
          slug?: string
          subtitle?: string
          testament?: Database["public"]["Enums"]["story_testament"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscription_status_summary: {
        Row: {
          created_at: string
          id: string
          period_key: string
          sort_order: number
          status_key: string
          status_label: string
          total: number
        }
        Insert: {
          created_at?: string
          id?: string
          period_key: string
          sort_order?: number
          status_key: string
          status_label: string
          total?: number
        }
        Update: {
          created_at?: string
          id?: string
          period_key?: string
          sort_order?: number
          status_key?: string
          status_label?: string
          total?: number
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount_cents: number
          canceled_at: string | null
          created_at: string
          currency: string
          current_period_end: string | null
          customer_email: string | null
          external_customer_id: string | null
          external_subscription_id: string | null
          id: string
          plan_id: string | null
          provider: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount_cents?: number
          canceled_at?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          customer_email?: string | null
          external_customer_id?: string | null
          external_subscription_id?: string | null
          id?: string
          plan_id?: string | null
          provider?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          canceled_at?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          customer_email?: string | null
          external_customer_id?: string | null
          external_subscription_id?: string | null
          id?: string
          plan_id?: string | null
          provider?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      top_plans_summary: {
        Row: {
          created_at: string
          id: string
          period_key: string
          plan_name: string
          revenue_amount: number
          sort_order: number
          total_sales: number
        }
        Insert: {
          created_at?: string
          id?: string
          period_key: string
          plan_name: string
          revenue_amount?: number
          sort_order?: number
          total_sales?: number
        }
        Update: {
          created_at?: string
          id?: string
          period_key?: string
          plan_name?: string
          revenue_amount?: number
          sort_order?: number
          total_sales?: number
        }
        Relationships: []
      }
      user_artworks: {
        Row: {
          canvas_data_json: Json
          created_at: string
          id: string
          is_finished: boolean
          last_color_palette_json: Json | null
          page_id: string | null
          page_index: number
          rendered_image_url: string | null
          story_id: string | null
          story_slug: string
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          canvas_data_json?: Json
          created_at?: string
          id?: string
          is_finished?: boolean
          last_color_palette_json?: Json | null
          page_id?: string | null
          page_index: number
          rendered_image_url?: string | null
          story_id?: string | null
          story_slug: string
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          canvas_data_json?: Json
          created_at?: string
          id?: string
          is_finished?: boolean
          last_color_palette_json?: Json | null
          page_id?: string | null
          page_index?: number
          rendered_image_url?: string | null
          story_id?: string | null
          story_slug?: string
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_artworks_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "stories_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_artworks_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_orders: {
        Row: {
          amount_cents: number
          approved_at: string | null
          created_at: string
          currency: string
          external_order_id: string | null
          id: string
          order_number: string | null
          payment_provider: string
          plan_id: string | null
          product_id: string | null
          purchase_status: string
          purchased_at: string
          refunded_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents?: number
          approved_at?: string | null
          created_at?: string
          currency?: string
          external_order_id?: string | null
          id?: string
          order_number?: string | null
          payment_provider?: string
          plan_id?: string | null
          product_id?: string | null
          purchase_status?: string
          purchased_at?: string
          refunded_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          approved_at?: string | null
          created_at?: string
          currency?: string
          external_order_id?: string | null
          id?: string
          order_number?: string | null
          payment_provider?: string
          plan_id?: string | null
          product_id?: string | null
          purchase_status?: string
          purchased_at?: string
          refunded_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_orders_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_page_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          last_opened_at: string | null
          page_id: string | null
          page_index: number
          started_at: string | null
          status: string
          story_id: string | null
          story_slug: string
          time_spent_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          last_opened_at?: string | null
          page_id?: string | null
          page_index: number
          started_at?: string | null
          status?: string
          story_id?: string | null
          story_slug: string
          time_spent_seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          last_opened_at?: string | null
          page_id?: string | null
          page_index?: number
          started_at?: string | null
          status?: string
          story_id?: string | null
          story_slug?: string
          time_spent_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_page_progress_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "stories_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_page_progress_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_product_entitlements: {
        Row: {
          created_at: string
          expires_at: string | null
          external_purchase_id: string | null
          granted_at: string
          id: string
          product_id: string
          source_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          external_purchase_id?: string | null
          granted_at?: string
          id?: string
          product_id: string
          source_type?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          external_purchase_id?: string | null
          granted_at?: string
          id?: string
          product_id?: string
          source_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_product_entitlements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
        ]
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
      user_rewards: {
        Row: {
          created_at: string
          granted_at: string
          id: string
          source: string | null
          type: string
          user_id: string
          value_json: Json
        }
        Insert: {
          created_at?: string
          granted_at?: string
          id?: string
          source?: string | null
          type: string
          user_id: string
          value_json?: Json
        }
        Update: {
          created_at?: string
          granted_at?: string
          id?: string
          source?: string | null
          type?: string
          user_id?: string
          value_json?: Json
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
      webhook_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string | null
          external_event_id: string | null
          id: string
          payload: Json
          processed: boolean
          provider: string
          reason: string | null
          received_at: string
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type?: string | null
          external_event_id?: string | null
          id?: string
          payload?: Json
          processed?: boolean
          provider?: string
          reason?: string | null
          received_at?: string
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string | null
          external_event_id?: string | null
          id?: string
          payload?: Json
          processed?: boolean
          provider?: string
          reason?: string | null
          received_at?: string
          status?: string
        }
        Relationships: []
      }
      webhook_integrations: {
        Row: {
          active: boolean
          created_at: string
          endpoint_url: string
          id: string
          last_received_at: string | null
          name: string
          provider: string
          signing_secret: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          endpoint_url: string
          id?: string
          last_received_at?: string | null
          name: string
          provider?: string
          signing_secret?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          endpoint_url?: string
          id?: string
          last_received_at?: string | null
          name?: string
          provider?: string
          signing_secret?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      commercial_offers_safe: {
        Row: {
          account_id: string | null
          created_at: string | null
          gateway: string | null
          id: string | null
          notes: string | null
          offer_name: string | null
          sale_mode: string | null
          status: string | null
          updated_at: string | null
          variation_id: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          gateway?: string | null
          id?: string | null
          notes?: string | null
          offer_name?: string | null
          sale_mode?: string | null
          status?: string | null
          updated_at?: string | null
          variation_id?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          gateway?: string | null
          id?: string | null
          notes?: string | null
          offer_name?: string | null
          sale_mode?: string | null
          status?: string | null
          updated_at?: string | null
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_offers_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "member_area_variations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_commercial_offer_token: {
        Args: { _offer_id: string }
        Returns: string
      }
      get_webhook_signing_secret: {
        Args: { _integration_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      user_has_product_access: {
        Args: { _product_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      admin_user_status: "active" | "pending" | "canceled" | "no_plan"
      app_role: "admin" | "moderator" | "user" | "super_admin"
      story_testament: "parables" | "new" | "old"
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
      admin_user_status: ["active", "pending", "canceled", "no_plan"],
      app_role: ["admin", "moderator", "user", "super_admin"],
      story_testament: ["parables", "new", "old"],
    },
  },
} as const
