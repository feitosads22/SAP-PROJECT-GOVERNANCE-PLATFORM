// Gerado por introspecção do schema em 2026-09-06 17:08.
// Substituir por `supabase gen types typescript` assim que a CLI estiver disponível.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      attachments: {
        Row: {
          id: string
          organization_id: string
          evidence_id: string | null
          bucket: string
          storage_path: string
          file_name: string
          file_size: number | null
          mime_type: string | null
          uploaded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id?: string
          evidence_id?: string | null
          bucket: string
          storage_path: string
          file_name: string
          file_size?: number | null
          mime_type?: string | null
          uploaded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          evidence_id?: string | null
          bucket?: string
          storage_path?: string
          file_name?: string
          file_size?: number | null
          mime_type?: string | null
          uploaded_by?: string | null
          created_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          organization_id: string
          user_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          old_value: Json | null
          new_value: Json | null
          ip_address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id?: string
          user_id?: string | null
          action: string
          entity_type: string
          entity_id?: string | null
          old_value?: Json | null
          new_value?: Json | null
          ip_address?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string | null
          action?: string
          entity_type?: string
          entity_id?: string | null
          old_value?: Json | null
          new_value?: Json | null
          ip_address?: string | null
          created_at?: string
        }
      }
      change_requests: {
        Row: {
          id: string
          organization_id: string
          project_id: string
          number: number
          title: string
          description: string | null
          justification: string | null
          additional_hours: number
          additional_cost: number
          schedule_impact_days: number
          scope_impact: string | null
          requested_by: string | null
          approved_by: string | null
          approved_at: string | null
          status: string
          rejection_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id?: string
          project_id: string
          number?: number
          title: string
          description?: string | null
          justification?: string | null
          additional_hours?: number
          additional_cost?: number
          schedule_impact_days?: number
          scope_impact?: string | null
          requested_by?: string | null
          approved_by?: string | null
          approved_at?: string | null
          status?: string
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          project_id?: string
          number?: number
          title?: string
          description?: string | null
          justification?: string | null
          additional_hours?: number
          additional_cost?: number
          schedule_impact_days?: number
          scope_impact?: string | null
          requested_by?: string | null
          approved_by?: string | null
          approved_at?: string | null
          status?: string
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      evidence_template_fields: {
        Row: {
          id: string
          organization_id: string
          template_id: string
          label: string
          field_type: string
          is_required: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          organization_id?: string
          template_id: string
          label: string
          field_type: string
          is_required?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          template_id?: string
          label?: string
          field_type?: string
          is_required?: boolean
          sort_order?: number
          created_at?: string
        }
      }
      evidence_templates: {
        Row: {
          id: string
          organization_id: string
          name: string
          description: string | null
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id?: string
          name: string
          description?: string | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          description?: string | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
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
      }
      notifications: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          type: string
          title: string
          body: string | null
          entity_type: string | null
          entity_id: string | null
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id?: string
          user_id: string
          type: string
          title: string
          body?: string | null
          entity_type?: string | null
          entity_id?: string | null
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          type?: string
          title?: string
          body?: string | null
          entity_type?: string | null
          entity_id?: string | null
          read_at?: string | null
          created_at?: string
        }
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
      }
      project_budgets: {
        Row: {
          id: string
          organization_id: string
          project_id: string
          budget_total: number
          revenue_planned: number | null
          cost_planned: number | null
          contingency_pct: number | null
          currency: string
          approved_by: string | null
          approved_at: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id?: string
          project_id: string
          budget_total: number
          revenue_planned?: number | null
          cost_planned?: number | null
          contingency_pct?: number | null
          currency?: string
          approved_by?: string | null
          approved_at?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          project_id?: string
          budget_total?: number
          revenue_planned?: number | null
          cost_planned?: number | null
          contingency_pct?: number | null
          currency?: string
          approved_by?: string | null
          approved_at?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      project_costs: {
        Row: {
          id: string
          organization_id: string
          project_id: string
          category: string
          description: string
          amount: number
          cost_date: string
          approved_by: string | null
          approved_at: string | null
          receipt_path: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id?: string
          project_id: string
          category: string
          description: string
          amount: number
          cost_date?: string
          approved_by?: string | null
          approved_at?: string | null
          receipt_path?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          project_id?: string
          category?: string
          description?: string
          amount?: number
          cost_date?: string
          approved_by?: string | null
          approved_at?: string | null
          receipt_path?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      project_forecasts: {
        Row: {
          id: string
          organization_id: string
          project_id: string
          forecast_date: string
          cost_forecast: number
          revenue_forecast: number | null
          completion_pct: number | null
          notes: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id?: string
          project_id: string
          forecast_date?: string
          cost_forecast: number
          revenue_forecast?: number | null
          completion_pct?: number | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          project_id?: string
          forecast_date?: string
          cost_forecast?: number
          revenue_forecast?: number | null
          completion_pct?: number | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
      }
      project_issues: {
        Row: {
          id: string
          organization_id: string
          project_id: string
          title: string
          description: string | null
          priority: string
          impact: string | null
          owner_id: string | null
          due_date: string | null
          status: string
          resolution: string | null
          resolved_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id?: string
          project_id: string
          title: string
          description?: string | null
          priority?: string
          impact?: string | null
          owner_id?: string | null
          due_date?: string | null
          status?: string
          resolution?: string | null
          resolved_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          project_id?: string
          title?: string
          description?: string | null
          priority?: string
          impact?: string | null
          owner_id?: string | null
          due_date?: string | null
          status?: string
          resolution?: string | null
          resolved_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
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
      }
      project_risks: {
        Row: {
          id: string
          organization_id: string
          project_id: string
          title: string
          description: string | null
          category: string | null
          probability: string
          impact: string
          score: number | null
          owner_id: string | null
          due_date: string | null
          mitigation_plan: string | null
          contingency_plan: string | null
          status: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id?: string
          project_id: string
          title: string
          description?: string | null
          category?: string | null
          probability?: string
          impact?: string
          score?: number | null
          owner_id?: string | null
          due_date?: string | null
          mitigation_plan?: string | null
          contingency_plan?: string | null
          status?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          project_id?: string
          title?: string
          description?: string | null
          category?: string | null
          probability?: string
          impact?: string
          score?: number | null
          owner_id?: string | null
          due_date?: string | null
          mitigation_plan?: string | null
          contingency_plan?: string | null
          status?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
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
      }
      resource_allocations: {
        Row: {
          id: string
          organization_id: string
          resource_id: string
          project_id: string
          role_in_project: string | null
          allocated_hours: number
          start_date: string | null
          end_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id?: string
          resource_id: string
          project_id: string
          role_in_project?: string | null
          allocated_hours: number
          start_date?: string | null
          end_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          resource_id?: string
          project_id?: string
          role_in_project?: string | null
          allocated_hours?: number
          start_date?: string | null
          end_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      resources: {
        Row: {
          id: string
          organization_id: string
          profile_id: string
          sap_modules: string[]
          seniority: string
          hourly_rate: number | null
          weekly_capacity_hours: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id?: string
          profile_id: string
          sap_modules?: string[]
          seniority?: string
          hourly_rate?: number | null
          weekly_capacity_hours?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          profile_id?: string
          sap_modules?: string[]
          seniority?: string
          hourly_rate?: number | null
          weekly_capacity_hours?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
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
      }
      task_evidence_values: {
        Row: {
          id: string
          organization_id: string
          evidence_id: string
          field_id: string
          value_text: string | null
          value_number: number | null
          value_date: string | null
          value_boolean: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id?: string
          evidence_id: string
          field_id: string
          value_text?: string | null
          value_number?: number | null
          value_date?: string | null
          value_boolean?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          evidence_id?: string
          field_id?: string
          value_text?: string | null
          value_number?: number | null
          value_date?: string | null
          value_boolean?: boolean | null
          created_at?: string
          updated_at?: string
        }
      }
      task_evidences: {
        Row: {
          id: string
          organization_id: string
          task_id: string
          template_id: string | null
          title: string
          description: string | null
          status: string
          submitted_by: string | null
          submitted_at: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          rejection_reason: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id?: string
          task_id: string
          template_id?: string | null
          title: string
          description?: string | null
          status?: string
          submitted_by?: string | null
          submitted_at?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          rejection_reason?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          task_id?: string
          template_id?: string | null
          title?: string
          description?: string | null
          status?: string
          submitted_by?: string | null
          submitted_at?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          rejection_reason?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
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
          sap_activate_phase: string | null
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
          sap_activate_phase?: string | null
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
          sap_activate_phase?: string | null
        }
      }
      timesheets: {
        Row: {
          id: string
          organization_id: string
          resource_id: string
          project_id: string
          task_id: string | null
          date: string
          hours: number
          description: string | null
          approved_by: string | null
          approved_at: string | null
          created_at: string
          updated_at: string
          rejected_by: string | null
          rejected_at: string | null
          rejection_reason: string | null
        }
        Insert: {
          id?: string
          organization_id?: string
          resource_id: string
          project_id: string
          task_id?: string | null
          date: string
          hours: number
          description?: string | null
          approved_by?: string | null
          approved_at?: string | null
          created_at?: string
          updated_at?: string
          rejected_by?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          resource_id?: string
          project_id?: string
          task_id?: string | null
          date?: string
          hours?: number
          description?: string | null
          approved_by?: string | null
          approved_at?: string | null
          created_at?: string
          updated_at?: string
          rejected_by?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
        }
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
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
