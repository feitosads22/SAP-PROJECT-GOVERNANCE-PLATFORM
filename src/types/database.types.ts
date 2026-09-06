// Types do schema Supabase — introspecção de 0001_foundation + 0001b_hotfix.
// Conferido campo a campo contra o schema real em 2026-09-05 23:53.
// Regenerar via CLI: supabase gen types typescript --project-id <ref>
// O frontend só consome estes types — nunca campos inventados.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      milestones: {
        Row: {
          id: string
          organization_id: string
          project_id: string
          phase_id: string | null
          name: string
          description: string | null
          due_date: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          project_id: string
          phase_id?: string | null
          name: string
          description?: string | null
          due_date?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          project_id?: string
          phase_id?: string | null
          name?: string
          description?: string | null
          due_date?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          sap_client_number: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          sap_client_number?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          sap_client_number?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      phases: {
        Row: {
          id: string
          organization_id: string
          project_id: string
          name: string
          code: string
          description: string | null
          start_date: string | null
          end_date: string | null
          status: string
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          project_id: string
          name: string
          code: string
          description?: string | null
          start_date?: string | null
          end_date?: string | null
          status?: string
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          project_id?: string
          name?: string
          code?: string
          description?: string | null
          start_date?: string | null
          end_date?: string | null
          status?: string
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          organization_id: string | null
          role: string
          full_name: string | null
          email: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          organization_id?: string | null
          role?: string
          full_name?: string | null
          email?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          role?: string
          full_name?: string | null
          email?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_modules: {
        Row: {
          id: string
          organization_id: string
          project_id: string
          name: string
          code: string
          sap_module: string | null
          description: string | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          project_id: string
          name: string
          code: string
          sap_module?: string | null
          description?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          project_id?: string
          name?: string
          code?: string
          sap_module?: string | null
          description?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          organization_id: string
          name: string
          code: string
          description: string | null
          status: string
          priority: string
          manager_id: string | null
          customer_id: string | null
          sap_module: string | null
          start_date: string | null
          end_date: string | null
          actual_start_date: string | null
          actual_end_date: string | null
          progress: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          code: string
          description?: string | null
          status?: string
          priority?: string
          manager_id?: string | null
          customer_id?: string | null
          sap_module?: string | null
          start_date?: string | null
          end_date?: string | null
          actual_start_date?: string | null
          actual_end_date?: string | null
          progress?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          code?: string
          description?: string | null
          status?: string
          priority?: string
          manager_id?: string | null
          customer_id?: string | null
          sap_module?: string | null
          start_date?: string | null
          end_date?: string | null
          actual_start_date?: string | null
          actual_end_date?: string | null
          progress?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_dependencies: {
        Row: {
          id: string
          organization_id: string
          task_id: string
          depends_on_task_id: string
          dependency_type: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          task_id: string
          depends_on_task_id: string
          dependency_type?: string
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          task_id?: string
          depends_on_task_id?: string
          dependency_type?: string
          created_at?: string
        }
        Relationships: []
      }
      task_history: {
        Row: {
          id: string
          organization_id: string
          task_id: string
          changed_by: string | null
          field: string
          old_value: string | null
          new_value: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          task_id: string
          changed_by?: string | null
          field: string
          old_value?: string | null
          new_value?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          task_id?: string
          changed_by?: string | null
          field?: string
          old_value?: string | null
          new_value?: string | null
          created_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          id: string
          organization_id: string
          project_id: string
          module_id: string | null
          phase_id: string | null
          wbs_id: string | null
          parent_task_id: string | null
          title: string
          description: string | null
          status: string
          priority: string
          assignee_id: string | null
          reviewer_id: string | null
          planned_start_date: string | null
          planned_end_date: string | null
          estimated_hours: number
          progress: number
          requires_evidence: boolean
          completed_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          project_id: string
          module_id?: string | null
          phase_id?: string | null
          wbs_id?: string | null
          parent_task_id?: string | null
          title: string
          description?: string | null
          status?: string
          priority?: string
          assignee_id?: string | null
          reviewer_id?: string | null
          planned_start_date?: string | null
          planned_end_date?: string | null
          estimated_hours?: number
          progress?: number
          requires_evidence?: boolean
          completed_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          project_id?: string
          module_id?: string | null
          phase_id?: string | null
          wbs_id?: string | null
          parent_task_id?: string | null
          title?: string
          description?: string | null
          status?: string
          priority?: string
          assignee_id?: string | null
          reviewer_id?: string | null
          planned_start_date?: string | null
          planned_end_date?: string | null
          estimated_hours?: number
          progress?: number
          requires_evidence?: boolean
          completed_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      wbs_items: {
        Row: {
          id: string
          organization_id: string
          project_id: string
          parent_id: string | null
          code: string
          name: string
          description: string | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          project_id: string
          parent_id?: string | null
          code: string
          name: string
          description?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          project_id?: string
          parent_id?: string | null
          code?: string
          name?: string
          description?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      create_organization: {
        Args: { p_name: string; p_slug: string; p_sap_client_number?: string | null }
        Returns: string
      }
      current_org_id: { Args: Record<string, never>; Returns: string }
      current_role: { Args: Record<string, never>; Returns: string }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

