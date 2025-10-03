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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      companies: {
        Row: {
          company_name: string
          company_number: string
          company_status: string
          company_type: string | null
          created_at: string
          date_of_creation: string
          id: string
          registered_office_address: Json | null
          run_id: string
          sic_codes: string[] | null
        }
        Insert: {
          company_name: string
          company_number: string
          company_status: string
          company_type?: string | null
          created_at?: string
          date_of_creation: string
          id?: string
          registered_office_address?: Json | null
          run_id: string
          sic_codes?: string[] | null
        }
        Update: {
          company_name?: string
          company_number?: string
          company_status?: string
          company_type?: string | null
          created_at?: string
          date_of_creation?: string
          id?: string
          registered_office_address?: Json | null
          run_id?: string
          sic_codes?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "scraper_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      company_sic_codes: {
        Row: {
          company_id: string
          created_at: string
          id: string
          sic_code_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          sic_code_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          sic_code_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_sic_codes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_sic_codes_sic_code_id_fkey"
            columns: ["sic_code_id"]
            isOneToOne: false
            referencedRelation: "sic_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      officer_contacts: {
        Row: {
          created_at: string
          email: string | null
          error_message: string | null
          found: boolean
          id: string
          linkedin_url: string | null
          officer_id: string
          phone: string | null
          profile_employer: string | null
          profile_location: string | null
          profile_name: string | null
          profile_title: string | null
          searched_at: string
          source: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          error_message?: string | null
          found?: boolean
          id?: string
          linkedin_url?: string | null
          officer_id: string
          phone?: string | null
          profile_employer?: string | null
          profile_location?: string | null
          profile_name?: string | null
          profile_title?: string | null
          searched_at?: string
          source?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          error_message?: string | null
          found?: boolean
          id?: string
          linkedin_url?: string | null
          officer_id?: string
          phone?: string | null
          profile_employer?: string | null
          profile_location?: string | null
          profile_name?: string | null
          profile_title?: string | null
          searched_at?: string
          source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "officer_contacts_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: true
            referencedRelation: "officers"
            referencedColumns: ["id"]
          },
        ]
      }
      officers: {
        Row: {
          address: Json | null
          appointed_on: string | null
          company_id: string
          country_of_residence: string | null
          created_at: string
          date_of_birth: Json | null
          id: string
          is_pre_1992_appointment: boolean | null
          links: Json | null
          name: string
          nationality: string | null
          occupation: string | null
          officer_role: string
          person_number: string | null
        }
        Insert: {
          address?: Json | null
          appointed_on?: string | null
          company_id: string
          country_of_residence?: string | null
          created_at?: string
          date_of_birth?: Json | null
          id?: string
          is_pre_1992_appointment?: boolean | null
          links?: Json | null
          name: string
          nationality?: string | null
          occupation?: string | null
          officer_role: string
          person_number?: string | null
        }
        Update: {
          address?: Json | null
          appointed_on?: string | null
          company_id?: string
          country_of_residence?: string | null
          created_at?: string
          date_of_birth?: Json | null
          id?: string
          is_pre_1992_appointment?: boolean | null
          links?: Json | null
          name?: string
          nationality?: string | null
          occupation?: string | null
          officer_role?: string
          person_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "officers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      scraper_logs: {
        Row: {
          id: string
          level: Database["public"]["Enums"]["log_level"]
          message: string
          metadata: Json | null
          run_id: string
          timestamp: string
        }
        Insert: {
          id?: string
          level?: Database["public"]["Enums"]["log_level"]
          message: string
          metadata?: Json | null
          run_id: string
          timestamp?: string
        }
        Update: {
          id?: string
          level?: Database["public"]["Enums"]["log_level"]
          message?: string
          metadata?: Json | null
          run_id?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "scraper_logs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "scraper_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      scraper_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          csv_file_path: string | null
          error_message: string | null
          id: string
          jsonl_file_path: string | null
          pages_fetched: number | null
          started_at: string
          status: Database["public"]["Enums"]["run_status"]
          target_date: string
          total_companies: number | null
          total_results_from_api: number | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          csv_file_path?: string | null
          error_message?: string | null
          id?: string
          jsonl_file_path?: string | null
          pages_fetched?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["run_status"]
          target_date: string
          total_companies?: number | null
          total_results_from_api?: number | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          csv_file_path?: string | null
          error_message?: string | null
          id?: string
          jsonl_file_path?: string | null
          pages_fetched?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["run_status"]
          target_date?: string
          total_companies?: number | null
          total_results_from_api?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      sic_codes: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      log_level: "info" | "warning" | "error" | "debug"
      run_status: "pending" | "running" | "completed" | "failed"
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
      log_level: ["info", "warning", "error", "debug"],
      run_status: ["pending", "running", "completed", "failed"],
    },
  },
} as const
