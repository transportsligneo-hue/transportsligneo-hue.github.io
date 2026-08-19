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
      activity_logs: {
        Row: {
          action: string
          actor_label: string | null
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip: string | null
          ip_address: string | null
          metadata: Json | null
          new_value: Json | null
          old_value: Json | null
          organization_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_label?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: string | null
          ip_address?: string | null
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
          organization_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_label?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: string | null
          ip_address?: string | null
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
          organization_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_notifications: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          link: string | null
          lu: boolean
          lu_at: string | null
          message: string | null
          metadata: Json | null
          titre: string
          type: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          link?: string | null
          lu?: boolean
          lu_at?: string | null
          message?: string | null
          metadata?: Json | null
          titre: string
          type: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          link?: string | null
          lu?: boolean
          lu_at?: string | null
          message?: string | null
          metadata?: Json | null
          titre?: string
          type?: string
        }
        Relationships: []
      }
      admin_security_audit: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          details: Json
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          details?: Json
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          details?: Json
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      admin_table_prefs: {
        Row: {
          created_at: string
          hidden_columns: Json
          id: string
          table_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hidden_columns?: Json
          id?: string
          table_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hidden_columns?: Json
          id?: string
          table_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_settings: {
        Row: {
          ai_enabled: boolean
          assistance_level: string
          auto_report: boolean
          compare_departure_arrival: boolean
          created_at: string
          detect_battery_level: boolean
          detect_dents: boolean
          detect_equipment: boolean
          detect_fuel_level: boolean
          detect_impacts: boolean
          detect_lights: boolean
          detect_mirrors: boolean
          detect_rims: boolean
          detect_scratches: boolean
          detect_warning_lights: boolean
          detect_windshield: boolean
          id: string
          is_singleton: boolean
          mission_prefill: boolean
          model_overrides: Json
          ocr_documents: boolean
          ocr_odometer: boolean
          photo_assistant: boolean
          smart_suggestions: boolean
          updated_at: string
        }
        Insert: {
          ai_enabled?: boolean
          assistance_level?: string
          auto_report?: boolean
          compare_departure_arrival?: boolean
          created_at?: string
          detect_battery_level?: boolean
          detect_dents?: boolean
          detect_equipment?: boolean
          detect_fuel_level?: boolean
          detect_impacts?: boolean
          detect_lights?: boolean
          detect_mirrors?: boolean
          detect_rims?: boolean
          detect_scratches?: boolean
          detect_warning_lights?: boolean
          detect_windshield?: boolean
          id?: string
          is_singleton?: boolean
          mission_prefill?: boolean
          model_overrides?: Json
          ocr_documents?: boolean
          ocr_odometer?: boolean
          photo_assistant?: boolean
          smart_suggestions?: boolean
          updated_at?: string
        }
        Update: {
          ai_enabled?: boolean
          assistance_level?: string
          auto_report?: boolean
          compare_departure_arrival?: boolean
          created_at?: string
          detect_battery_level?: boolean
          detect_dents?: boolean
          detect_equipment?: boolean
          detect_fuel_level?: boolean
          detect_impacts?: boolean
          detect_lights?: boolean
          detect_mirrors?: boolean
          detect_rims?: boolean
          detect_scratches?: boolean
          detect_warning_lights?: boolean
          detect_windshield?: boolean
          id?: string
          is_singleton?: boolean
          mission_prefill?: boolean
          model_overrides?: Json
          ocr_documents?: boolean
          ocr_odometer?: boolean
          photo_assistant?: boolean
          smart_suggestions?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      ai_usage_events: {
        Row: {
          capability: string
          cost_credits: number | null
          created_at: string
          error_code: string | null
          id: string
          latency_ms: number | null
          metadata: Json
          model_id: string | null
          success: boolean
          user_id: string | null
        }
        Insert: {
          capability: string
          cost_credits?: number | null
          created_at?: string
          error_code?: string | null
          id?: string
          latency_ms?: number | null
          metadata?: Json
          model_id?: string | null
          success: boolean
          user_id?: string | null
        }
        Update: {
          capability?: string
          cost_credits?: number | null
          created_at?: string
          error_code?: string | null
          id?: string
          latency_ms?: number | null
          metadata?: Json
          model_id?: string | null
          success?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      api_estimates: {
        Row: {
          created_at: string
          delivery_address: string
          distance_km: number | null
          environment: string
          id: string
          organization_id: string
          pickup_address: string
          pickup_date: string | null
          price_ht: number
          price_ttc: number
          valid_until: string
          vehicle_type: string | null
        }
        Insert: {
          created_at?: string
          delivery_address: string
          distance_km?: number | null
          environment: string
          id?: string
          organization_id: string
          pickup_address: string
          pickup_date?: string | null
          price_ht: number
          price_ttc: number
          valid_until?: string
          vehicle_type?: string | null
        }
        Update: {
          created_at?: string
          delivery_address?: string
          distance_km?: number | null
          environment?: string
          id?: string
          organization_id?: string
          pickup_address?: string
          pickup_date?: string | null
          price_ht?: number
          price_ttc?: number
          valid_until?: string
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_estimates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_internal_config: {
        Row: {
          created_at: string
          key: string
          value: string
        }
        Insert: {
          created_at?: string
          key: string
          value: string
        }
        Update: {
          created_at?: string
          key?: string
          value?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          environment: string
          id: string
          key_hash: string
          key_last4: string
          key_prefix: string
          last_used_at: string | null
          name: string
          organization_id: string
          revoked_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          environment: string
          id?: string
          key_hash: string
          key_last4: string
          key_prefix: string
          last_used_at?: string | null
          name?: string
          organization_id: string
          revoked_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          environment?: string
          id?: string
          key_hash?: string
          key_last4?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          organization_id?: string
          revoked_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_rate_counters: {
        Row: {
          api_key_id: string
          count: number
          window_start: string
        }
        Insert: {
          api_key_id: string
          count?: number
          window_start: string
        }
        Update: {
          api_key_id?: string
          count?: number
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_rate_counters_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      api_webhook_deliveries: {
        Row: {
          attempt: number
          created_at: string
          endpoint_id: string | null
          error: string | null
          event: string
          id: string
          mission_id: string | null
          organization_id: string
          payload: Json
          status_code: number | null
          success: boolean
          target_url: string
        }
        Insert: {
          attempt?: number
          created_at?: string
          endpoint_id?: string | null
          error?: string | null
          event: string
          id?: string
          mission_id?: string | null
          organization_id: string
          payload?: Json
          status_code?: number | null
          success?: boolean
          target_url: string
        }
        Update: {
          attempt?: number
          created_at?: string
          endpoint_id?: string | null
          error?: string | null
          event?: string
          id?: string
          mission_id?: string | null
          organization_id?: string
          payload?: Json
          status_code?: number | null
          success?: boolean
          target_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_webhook_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "api_webhook_endpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_webhook_deliveries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_webhook_endpoints: {
        Row: {
          active: boolean
          created_at: string
          environment: string
          events: string[]
          id: string
          organization_id: string
          secret: string
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          environment?: string
          events?: string[]
          id?: string
          organization_id: string
          secret: string
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          created_at?: string
          environment?: string
          events?: string[]
          id?: string
          organization_id?: string
          secret?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_webhook_endpoints_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      articles: {
        Row: {
          contenu: string
          created_at: string
          extrait: string | null
          id: string
          image_url: string | null
          published_at: string | null
          slug: string
          statut: string
          titre: string
          updated_at: string
        }
        Insert: {
          contenu?: string
          created_at?: string
          extrait?: string | null
          id?: string
          image_url?: string | null
          published_at?: string | null
          slug: string
          statut?: string
          titre: string
          updated_at?: string
        }
        Update: {
          contenu?: string
          created_at?: string
          extrait?: string | null
          id?: string
          image_url?: string | null
          published_at?: string | null
          slug?: string
          statut?: string
          titre?: string
          updated_at?: string
        }
        Relationships: []
      }
      assistant_conversations: {
        Row: {
          contact_email: string | null
          contact_nom: string | null
          contact_telephone: string | null
          created_at: string
          id: string
          last_message_at: string
          message_count: number
          needs_human: boolean
          page_origine: string | null
          session_token: string
        }
        Insert: {
          contact_email?: string | null
          contact_nom?: string | null
          contact_telephone?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          message_count?: number
          needs_human?: boolean
          page_origine?: string | null
          session_token: string
        }
        Update: {
          contact_email?: string | null
          contact_nom?: string | null
          contact_telephone?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          message_count?: number
          needs_human?: boolean
          page_origine?: string | null
          session_token?: string
        }
        Relationships: []
      }
      assistant_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "assistant_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      attributions: {
        Row: {
          annulation_at: string | null
          annulation_categorie: string | null
          annulation_facturable: boolean
          annulation_indemnite: number | null
          annulation_motif: string | null
          annulation_par: string | null
          annulation_passage_vide: boolean
          convoyeur_id: string
          created_at: string
          etape_courante: string | null
          id: string
          is_public: boolean
          mode: string
          numero_mission: string | null
          options_completion: Json
          pdf_share_client: boolean
          refus_motif: string | null
          repondu_at: string | null
          statut: string
          statut_convoyeur: string
          trajet_id: string
          updated_at: string
        }
        Insert: {
          annulation_at?: string | null
          annulation_categorie?: string | null
          annulation_facturable?: boolean
          annulation_indemnite?: number | null
          annulation_motif?: string | null
          annulation_par?: string | null
          annulation_passage_vide?: boolean
          convoyeur_id: string
          created_at?: string
          etape_courante?: string | null
          id?: string
          is_public?: boolean
          mode?: string
          numero_mission?: string | null
          options_completion?: Json
          pdf_share_client?: boolean
          refus_motif?: string | null
          repondu_at?: string | null
          statut?: string
          statut_convoyeur?: string
          trajet_id: string
          updated_at?: string
        }
        Update: {
          annulation_at?: string | null
          annulation_categorie?: string | null
          annulation_facturable?: boolean
          annulation_indemnite?: number | null
          annulation_motif?: string | null
          annulation_par?: string | null
          annulation_passage_vide?: boolean
          convoyeur_id?: string
          created_at?: string
          etape_courante?: string | null
          id?: string
          is_public?: boolean
          mode?: string
          numero_mission?: string | null
          options_completion?: Json
          pdf_share_client?: boolean
          refus_motif?: string | null
          repondu_at?: string | null
          statut?: string
          statut_convoyeur?: string
          trajet_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attributions_convoyeur_id_fkey"
            columns: ["convoyeur_id"]
            isOneToOne: false
            referencedRelation: "convoyeurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attributions_trajet_id_fkey"
            columns: ["trajet_id"]
            isOneToOne: false
            referencedRelation: "trajets"
            referencedColumns: ["id"]
          },
        ]
      }
      avis_clients: {
        Row: {
          commentaire: string
          created_at: string
          date_avis: string
          id: string
          mission_id: string | null
          nom_affiche: string
          note: number
          statut: string
          type_client: string | null
          updated_at: string
          ville: string | null
        }
        Insert: {
          commentaire: string
          created_at?: string
          date_avis?: string
          id?: string
          mission_id?: string | null
          nom_affiche: string
          note?: number
          statut?: string
          type_client?: string | null
          updated_at?: string
          ville?: string | null
        }
        Update: {
          commentaire?: string
          created_at?: string
          date_avis?: string
          id?: string
          mission_id?: string | null
          nom_affiche?: string
          note?: number
          statut?: string
          type_client?: string | null
          updated_at?: string
          ville?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avis_clients_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_actions_history: {
        Row: {
          action_type: string
          company_id: string | null
          created_at: string
          created_by: string | null
          id: string
          metadata: Json | null
          related_id: string
          related_type: string
        }
        Insert: {
          action_type: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json | null
          related_id: string
          related_type: string
        }
        Update: {
          action_type?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json | null
          related_id?: string
          related_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "b2b_actions_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_fleet_leads: {
        Row: {
          assigned_to: string | null
          budget: string | null
          company_id: string | null
          constraints: string | null
          created_at: string
          description: string | null
          estimated_vehicle_count: number
          frequency: string | null
          geography: string | null
          id: string
          lead_score: number
          need_type: string
          numero: string
          organization_id: string | null
          score_category: string
          start_delay: string | null
          status: string
          structure_type: string
          updated_at: string
          vehicle_types: string | null
        }
        Insert: {
          assigned_to?: string | null
          budget?: string | null
          company_id?: string | null
          constraints?: string | null
          created_at?: string
          description?: string | null
          estimated_vehicle_count?: number
          frequency?: string | null
          geography?: string | null
          id?: string
          lead_score?: number
          need_type?: string
          numero?: string
          organization_id?: string | null
          score_category?: string
          start_delay?: string | null
          status?: string
          structure_type?: string
          updated_at?: string
          vehicle_types?: string | null
        }
        Update: {
          assigned_to?: string | null
          budget?: string | null
          company_id?: string | null
          constraints?: string | null
          created_at?: string
          description?: string | null
          estimated_vehicle_count?: number
          frequency?: string | null
          geography?: string | null
          id?: string
          lead_score?: number
          need_type?: string
          numero?: string
          organization_id?: string | null
          score_category?: string
          start_delay?: string | null
          status?: string
          structure_type?: string
          updated_at?: string
          vehicle_types?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "b2b_fleet_leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_fleet_leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_notes: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          id: string
          note: string
          related_id: string
          related_type: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note: string
          related_id: string
          related_type: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string
          related_id?: string
          related_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "b2b_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_transport_requests: {
        Row: {
          assigned_convoyeur_id: string | null
          company_id: string | null
          created_at: string
          distance_km: number | null
          dropoff_address: string
          estimated_price_ht: number | null
          estimated_price_ttc: number | null
          id: string
          notes: string | null
          numero: string
          operational_status: string
          organization_id: string | null
          payment_status: string
          pickup_address: string
          scheduled_date: string
          scheduled_time: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          updated_at: string
          urgency: string
          vehicle_running: boolean
          vehicle_type: string
        }
        Insert: {
          assigned_convoyeur_id?: string | null
          company_id?: string | null
          created_at?: string
          distance_km?: number | null
          dropoff_address: string
          estimated_price_ht?: number | null
          estimated_price_ttc?: number | null
          id?: string
          notes?: string | null
          numero?: string
          operational_status?: string
          organization_id?: string | null
          payment_status?: string
          pickup_address: string
          scheduled_date: string
          scheduled_time: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          urgency?: string
          vehicle_running?: boolean
          vehicle_type?: string
        }
        Update: {
          assigned_convoyeur_id?: string | null
          company_id?: string | null
          created_at?: string
          distance_km?: number | null
          dropoff_address?: string
          estimated_price_ht?: number | null
          estimated_price_ttc?: number | null
          id?: string
          notes?: string | null
          numero?: string
          operational_status?: string
          organization_id?: string | null
          payment_status?: string
          pickup_address?: string
          scheduled_date?: string
          scheduled_time?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          urgency?: string
          vehicle_running?: boolean
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "b2b_transport_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_transport_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_transport_requests_admin_data: {
        Row: {
          created_at: string
          internal_notes: string | null
          request_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          internal_notes?: string | null
          request_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          internal_notes?: string | null
          request_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "b2b_transport_requests_admin_data_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "b2b_transport_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_events: {
        Row: {
          campaign_id: string
          created_at: string
          event_type: string
          id: string
          link_url: string | null
          recipient_id: string
          user_agent: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          event_type: string
          id?: string
          link_url?: string | null
          recipient_id: string
          user_agent?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          event_type?: string
          id?: string
          link_url?: string | null
          recipient_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_events_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "campaign_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_recipients: {
        Row: {
          campaign_id: string
          client_id: string | null
          created_at: string
          display_name: string | null
          email: string
          error_message: string | null
          id: string
          organization_id: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          client_id?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          error_message?: string | null
          id?: string
          organization_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          client_id?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          error_message?: string | null
          id?: string
          organization_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          created_by: string | null
          cta_text: string | null
          cta_url: string | null
          id: string
          message: string
          name: string
          preheader: string | null
          scheduled_at: string | null
          sender_name: string
          sent_at: string | null
          status: string
          subject: string
          title: string
          updated_at: string
          visual_url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cta_text?: string | null
          cta_url?: string | null
          id?: string
          message?: string
          name: string
          preheader?: string | null
          scheduled_at?: string | null
          sender_name?: string
          sent_at?: string | null
          status?: string
          subject?: string
          title?: string
          updated_at?: string
          visual_url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cta_text?: string | null
          cta_url?: string | null
          id?: string
          message?: string
          name?: string
          preheader?: string | null
          scheduled_at?: string | null
          sender_name?: string
          sent_at?: string | null
          status?: string
          subject?: string
          title?: string
          updated_at?: string
          visual_url?: string | null
        }
        Relationships: []
      }
      catalogue_penalites: {
        Row: {
          actif: boolean
          article_reference: string | null
          code: string | null
          created_at: string
          description: string | null
          id: string
          libelle: string
          type_montant: string
          updated_at: string
          valeur: number
        }
        Insert: {
          actif?: boolean
          article_reference?: string | null
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          libelle: string
          type_montant: string
          updated_at?: string
          valeur?: number
        }
        Update: {
          actif?: boolean
          article_reference?: string | null
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          libelle?: string
          type_montant?: string
          updated_at?: string
          valeur?: number
        }
        Relationships: []
      }
      chat_tool_calls: {
        Row: {
          arguments: Json
          conversation_id: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          session_token: string | null
          success: boolean
          tool_name: string
        }
        Insert: {
          arguments?: Json
          conversation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          session_token?: string | null
          success?: boolean
          tool_name: string
        }
        Update: {
          arguments?: Json
          conversation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          session_token?: string | null
          success?: boolean
          tool_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_tool_calls_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "assistant_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_default_addresses: {
        Row: {
          active: boolean
          address: string
          address_type: string
          client_email: string
          client_user_id: string | null
          code_postal: string | null
          contact_email: string | null
          contact_nom: string | null
          contact_tel: string | null
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          label: string
          notes_acces: string | null
          pays: string | null
          updated_at: string
          ville: string | null
        }
        Insert: {
          active?: boolean
          address: string
          address_type?: string
          client_email: string
          client_user_id?: string | null
          code_postal?: string | null
          contact_email?: string | null
          contact_nom?: string | null
          contact_tel?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          label: string
          notes_acces?: string | null
          pays?: string | null
          updated_at?: string
          ville?: string | null
        }
        Update: {
          active?: boolean
          address?: string
          address_type?: string
          client_email?: string
          client_user_id?: string | null
          code_postal?: string | null
          contact_email?: string | null
          contact_nom?: string | null
          contact_tel?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          label?: string
          notes_acces?: string | null
          pays?: string | null
          updated_at?: string
          ville?: string | null
        }
        Relationships: []
      }
      client_km_accounts: {
        Row: {
          client_id: string | null
          email: string
          id: string
          missions_count: number
          tier_name: string | null
          total_km: number
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          email: string
          id?: string
          missions_count?: number
          tier_name?: string | null
          total_km?: number
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          email?: string
          id?: string
          missions_count?: number
          tier_name?: string | null
          total_km?: number
          updated_at?: string
        }
        Relationships: []
      }
      client_pricing_rules: {
        Row: {
          active: boolean
          client_email: string
          client_scope: string
          client_user_id: string | null
          created_at: string
          created_by: string | null
          departement_arrivee: string | null
          departement_depart: string | null
          id: string
          notes: string | null
          priority: number
          prix_aller_retour: number | null
          prix_aller_simple: number | null
          prix_express: number | null
          prix_ht: number | null
          prix_ttc: number
          supplements: Json
          trip_type: string
          updated_at: string
          ville_arrivee: string | null
          ville_depart: string | null
          zone_label: string | null
        }
        Insert: {
          active?: boolean
          client_email: string
          client_scope?: string
          client_user_id?: string | null
          created_at?: string
          created_by?: string | null
          departement_arrivee?: string | null
          departement_depart?: string | null
          id?: string
          notes?: string | null
          priority?: number
          prix_aller_retour?: number | null
          prix_aller_simple?: number | null
          prix_express?: number | null
          prix_ht?: number | null
          prix_ttc: number
          supplements?: Json
          trip_type?: string
          updated_at?: string
          ville_arrivee?: string | null
          ville_depart?: string | null
          zone_label?: string | null
        }
        Update: {
          active?: boolean
          client_email?: string
          client_scope?: string
          client_user_id?: string | null
          created_at?: string
          created_by?: string | null
          departement_arrivee?: string | null
          departement_depart?: string | null
          id?: string
          notes?: string | null
          priority?: number
          prix_aller_retour?: number | null
          prix_aller_simple?: number | null
          prix_express?: number | null
          prix_ht?: number | null
          prix_ttc?: number
          supplements?: Json
          trip_type?: string
          updated_at?: string
          ville_arrivee?: string | null
          ville_depart?: string | null
          zone_label?: string | null
        }
        Relationships: []
      }
      client_unsubscribes: {
        Row: {
          campaign_id: string | null
          client_id: string | null
          email: string
          id: string
          unsubscribed_at: string
        }
        Insert: {
          campaign_id?: string | null
          client_id?: string | null
          email: string
          id?: string
          unsubscribed_at?: string
        }
        Update: {
          campaign_id?: string | null
          client_id?: string | null
          email?: string
          id?: string
          unsubscribed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_unsubscribes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          contact_email: string
          contact_function: string | null
          contact_name: string
          contact_phone: string
          created_at: string
          id: string
          name: string
          organization_id: string | null
          score: number
          score_category: string
          sector: string | null
          siret: string | null
          size: string | null
          type: string
          updated_at: string
        }
        Insert: {
          contact_email: string
          contact_function?: string | null
          contact_name: string
          contact_phone: string
          created_at?: string
          id?: string
          name: string
          organization_id?: string | null
          score?: number
          score_category?: string
          sector?: string | null
          siret?: string | null
          size?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          contact_email?: string
          contact_function?: string | null
          contact_name?: string
          contact_phone?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string | null
          score?: number
          score_category?: string
          sector?: string | null
          siret?: string | null
          size?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          adresse_cp: string | null
          adresse_ligne1: string | null
          adresse_pays: string | null
          adresse_ville: string | null
          assurance_mention: string | null
          banque_nom: string | null
          bic: string | null
          capital_social: string | null
          created_at: string
          email_contact: string | null
          forme_juridique: string | null
          iban: string | null
          id: string
          raison_sociale: string | null
          rcs: string | null
          signataire_fonction: string | null
          signataire_nom: string | null
          singleton: boolean
          siret: string | null
          site_web: string | null
          telephone: string | null
          tva_intra: string | null
          updated_at: string
        }
        Insert: {
          adresse_cp?: string | null
          adresse_ligne1?: string | null
          adresse_pays?: string | null
          adresse_ville?: string | null
          assurance_mention?: string | null
          banque_nom?: string | null
          bic?: string | null
          capital_social?: string | null
          created_at?: string
          email_contact?: string | null
          forme_juridique?: string | null
          iban?: string | null
          id?: string
          raison_sociale?: string | null
          rcs?: string | null
          signataire_fonction?: string | null
          signataire_nom?: string | null
          singleton?: boolean
          siret?: string | null
          site_web?: string | null
          telephone?: string | null
          tva_intra?: string | null
          updated_at?: string
        }
        Update: {
          adresse_cp?: string | null
          adresse_ligne1?: string | null
          adresse_pays?: string | null
          adresse_ville?: string | null
          assurance_mention?: string | null
          banque_nom?: string | null
          bic?: string | null
          capital_social?: string | null
          created_at?: string
          email_contact?: string | null
          forme_juridique?: string | null
          iban?: string | null
          id?: string
          raison_sociale?: string | null
          rcs?: string | null
          signataire_fonction?: string | null
          signataire_nom?: string | null
          singleton?: boolean
          siret?: string | null
          site_web?: string | null
          telephone?: string | null
          tva_intra?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          nom: string
          prenom: string
          profil: string
          segment: string | null
          societe: string | null
          statut: string
          telephone: string | null
          type_demande: string
          updated_at: string
          volume: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          nom: string
          prenom?: string
          profil?: string
          segment?: string | null
          societe?: string | null
          statut?: string
          telephone?: string | null
          type_demande?: string
          updated_at?: string
          volume?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          nom?: string
          prenom?: string
          profil?: string
          segment?: string | null
          societe?: string | null
          statut?: string
          telephone?: string | null
          type_demande?: string
          updated_at?: string
          volume?: string | null
        }
        Relationships: []
      }
      convoyeur_contrats: {
        Row: {
          charte_document_id: string | null
          charte_incluse: boolean
          charte_signed_at: string | null
          charte_signed_pdf_path: string | null
          convoyeur_id: string | null
          created_at: string
          created_by: string | null
          decline_reason: string | null
          declined_at: string | null
          email: string
          expired_at: string | null
          expires_at: string
          id: string
          last_reminder_at: string | null
          nom_complet: string | null
          provider: string
          sent_at: string
          signature_ip: string | null
          signature_link: string | null
          signature_lu_approuve: boolean
          signature_nom: string | null
          signature_user_agent: string | null
          signed_at: string | null
          signed_pdf_path: string | null
          snapshot: Json
          statut: string
          token_hash: string | null
          updated_at: string
          user_id: string | null
          yousign_document_id: string | null
          yousign_environment: string | null
          yousign_signature_request_id: string | null
          yousign_signer_id: string | null
        }
        Insert: {
          charte_document_id?: string | null
          charte_incluse?: boolean
          charte_signed_at?: string | null
          charte_signed_pdf_path?: string | null
          convoyeur_id?: string | null
          created_at?: string
          created_by?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          email: string
          expired_at?: string | null
          expires_at: string
          id?: string
          last_reminder_at?: string | null
          nom_complet?: string | null
          provider?: string
          sent_at?: string
          signature_ip?: string | null
          signature_link?: string | null
          signature_lu_approuve?: boolean
          signature_nom?: string | null
          signature_user_agent?: string | null
          signed_at?: string | null
          signed_pdf_path?: string | null
          snapshot?: Json
          statut?: string
          token_hash?: string | null
          updated_at?: string
          user_id?: string | null
          yousign_document_id?: string | null
          yousign_environment?: string | null
          yousign_signature_request_id?: string | null
          yousign_signer_id?: string | null
        }
        Update: {
          charte_document_id?: string | null
          charte_incluse?: boolean
          charte_signed_at?: string | null
          charte_signed_pdf_path?: string | null
          convoyeur_id?: string | null
          created_at?: string
          created_by?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          email?: string
          expired_at?: string | null
          expires_at?: string
          id?: string
          last_reminder_at?: string | null
          nom_complet?: string | null
          provider?: string
          sent_at?: string
          signature_ip?: string | null
          signature_link?: string | null
          signature_lu_approuve?: boolean
          signature_nom?: string | null
          signature_user_agent?: string | null
          signed_at?: string | null
          signed_pdf_path?: string | null
          snapshot?: Json
          statut?: string
          token_hash?: string | null
          updated_at?: string
          user_id?: string | null
          yousign_document_id?: string | null
          yousign_environment?: string | null
          yousign_signature_request_id?: string | null
          yousign_signer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "convoyeur_contrats_convoyeur_id_fkey"
            columns: ["convoyeur_id"]
            isOneToOne: false
            referencedRelation: "convoyeurs"
            referencedColumns: ["id"]
          },
        ]
      }
      convoyeur_invitations: {
        Row: {
          accepted_at: string | null
          convoyeur_id: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          nom: string | null
          prenom: string | null
          status: string
          telephone: string | null
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          convoyeur_id?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          nom?: string | null
          prenom?: string | null
          status?: string
          telephone?: string | null
          token: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          convoyeur_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          nom?: string | null
          prenom?: string | null
          status?: string
          telephone?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "convoyeur_invitations_convoyeur_id_fkey"
            columns: ["convoyeur_id"]
            isOneToOne: false
            referencedRelation: "convoyeurs"
            referencedColumns: ["id"]
          },
        ]
      }
      convoyeurs: {
        Row: {
          account_status: string
          annees_experience: number | null
          created_at: string
          disponibilite: string | null
          email: string
          has_completed_training: boolean
          id: string
          message: string | null
          missions_terminees: number
          niveau: string
          nom: string
          note_moyenne: number | null
          organization_id: string | null
          permis: string | null
          permis_numero: string | null
          permis_photo_url: string | null
          prenom: string
          site_id: string | null
          statut: string
          telephone: string
          training_completed_at: string | null
          training_status: string
          type_convoyeur: string
          updated_at: string
          user_id: string | null
          ville: string | null
        }
        Insert: {
          account_status?: string
          annees_experience?: number | null
          created_at?: string
          disponibilite?: string | null
          email: string
          has_completed_training?: boolean
          id?: string
          message?: string | null
          missions_terminees?: number
          niveau?: string
          nom: string
          note_moyenne?: number | null
          organization_id?: string | null
          permis?: string | null
          permis_numero?: string | null
          permis_photo_url?: string | null
          prenom: string
          site_id?: string | null
          statut?: string
          telephone: string
          training_completed_at?: string | null
          training_status?: string
          type_convoyeur?: string
          updated_at?: string
          user_id?: string | null
          ville?: string | null
        }
        Update: {
          account_status?: string
          annees_experience?: number | null
          created_at?: string
          disponibilite?: string | null
          email?: string
          has_completed_training?: boolean
          id?: string
          message?: string | null
          missions_terminees?: number
          niveau?: string
          nom?: string
          note_moyenne?: number | null
          organization_id?: string | null
          permis?: string | null
          permis_numero?: string | null
          permis_photo_url?: string | null
          prenom?: string
          site_id?: string | null
          statut?: string
          telephone?: string
          training_completed_at?: string | null
          training_status?: string
          type_convoyeur?: string
          updated_at?: string
          user_id?: string | null
          ville?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "convoyeurs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convoyeurs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "organization_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      demandes_convoyage: {
        Row: {
          adresse_recuperation_retour: string | null
          amount_paid_cents: number | null
          arrivee: string
          arrivee_retour: string | null
          carburant: string | null
          client_pricing_rule_id: string | null
          contact_arrivee_nom: string | null
          contact_arrivee_note: string | null
          contact_arrivee_tel: string | null
          contact_depart_nom: string | null
          contact_depart_note: string | null
          contact_depart_tel: string | null
          created_at: string
          date_retour: string | null
          date_souhaitee: string | null
          default_address_id: string | null
          depart: string
          depart_retour: string | null
          devis_genere_at: string | null
          devis_id: string | null
          distance_km: number | null
          email: string
          group_reference: string | null
          heure_retour: string | null
          heure_souhaitee: string | null
          id: string
          immatriculation: string | null
          immatriculation_retour: string | null
          marque: string | null
          marque_retour: string | null
          message: string | null
          mission_group_id: string | null
          modele: string | null
          modele_retour: string | null
          nom: string
          options: string | null
          options_meta: Json
          paid_at: string | null
          payment_status: string
          prenom: string
          pricing_display_mode: string | null
          prix_estime: number | null
          pv_digitalise: string
          recuperation_retour_identique: boolean
          statut: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          telephone: string | null
          updated_at: string
          user_id: string | null
          vehicule_couleur: string | null
          vehicule_energie: string | null
          vehicule_immatriculation: string | null
          vehicule_km: number | null
          vehicule_marque: string | null
          vehicule_modele: string | null
          vehicule_notes: string | null
          vehicule_type: string | null
          vehicule_vin: string | null
          vin_retour: string | null
        }
        Insert: {
          adresse_recuperation_retour?: string | null
          amount_paid_cents?: number | null
          arrivee: string
          arrivee_retour?: string | null
          carburant?: string | null
          client_pricing_rule_id?: string | null
          contact_arrivee_nom?: string | null
          contact_arrivee_note?: string | null
          contact_arrivee_tel?: string | null
          contact_depart_nom?: string | null
          contact_depart_note?: string | null
          contact_depart_tel?: string | null
          created_at?: string
          date_retour?: string | null
          date_souhaitee?: string | null
          default_address_id?: string | null
          depart: string
          depart_retour?: string | null
          devis_genere_at?: string | null
          devis_id?: string | null
          distance_km?: number | null
          email: string
          group_reference?: string | null
          heure_retour?: string | null
          heure_souhaitee?: string | null
          id?: string
          immatriculation?: string | null
          immatriculation_retour?: string | null
          marque?: string | null
          marque_retour?: string | null
          message?: string | null
          mission_group_id?: string | null
          modele?: string | null
          modele_retour?: string | null
          nom: string
          options?: string | null
          options_meta?: Json
          paid_at?: string | null
          payment_status?: string
          prenom: string
          pricing_display_mode?: string | null
          prix_estime?: number | null
          pv_digitalise?: string
          recuperation_retour_identique?: boolean
          statut?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          telephone?: string | null
          updated_at?: string
          user_id?: string | null
          vehicule_couleur?: string | null
          vehicule_energie?: string | null
          vehicule_immatriculation?: string | null
          vehicule_km?: number | null
          vehicule_marque?: string | null
          vehicule_modele?: string | null
          vehicule_notes?: string | null
          vehicule_type?: string | null
          vehicule_vin?: string | null
          vin_retour?: string | null
        }
        Update: {
          adresse_recuperation_retour?: string | null
          amount_paid_cents?: number | null
          arrivee?: string
          arrivee_retour?: string | null
          carburant?: string | null
          client_pricing_rule_id?: string | null
          contact_arrivee_nom?: string | null
          contact_arrivee_note?: string | null
          contact_arrivee_tel?: string | null
          contact_depart_nom?: string | null
          contact_depart_note?: string | null
          contact_depart_tel?: string | null
          created_at?: string
          date_retour?: string | null
          date_souhaitee?: string | null
          default_address_id?: string | null
          depart?: string
          depart_retour?: string | null
          devis_genere_at?: string | null
          devis_id?: string | null
          distance_km?: number | null
          email?: string
          group_reference?: string | null
          heure_retour?: string | null
          heure_souhaitee?: string | null
          id?: string
          immatriculation?: string | null
          immatriculation_retour?: string | null
          marque?: string | null
          marque_retour?: string | null
          message?: string | null
          mission_group_id?: string | null
          modele?: string | null
          modele_retour?: string | null
          nom?: string
          options?: string | null
          options_meta?: Json
          paid_at?: string | null
          payment_status?: string
          prenom?: string
          pricing_display_mode?: string | null
          prix_estime?: number | null
          pv_digitalise?: string
          recuperation_retour_identique?: boolean
          statut?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          telephone?: string | null
          updated_at?: string
          user_id?: string | null
          vehicule_couleur?: string | null
          vehicule_energie?: string | null
          vehicule_immatriculation?: string | null
          vehicule_km?: number | null
          vehicule_marque?: string | null
          vehicule_modele?: string | null
          vehicule_notes?: string | null
          vehicule_type?: string | null
          vehicule_vin?: string | null
          vin_retour?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demandes_convoyage_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
        ]
      }
      devis: {
        Row: {
          accepted_at: string | null
          adresse_recuperation_retour: string | null
          amount_paid_cents: number | null
          archived_at: string | null
          arrivee: string
          arrivee_retour: string | null
          carburant: string | null
          carte_grise_recto_url: string | null
          carte_grise_verso_url: string | null
          client_pricing_rule_id: string | null
          contact_arrivee_nom: string | null
          contact_arrivee_note: string | null
          contact_arrivee_tel: string | null
          contact_depart_nom: string | null
          contact_depart_note: string | null
          contact_depart_tel: string | null
          converted_at: string | null
          converted_by: string | null
          created_at: string
          date_retour: string | null
          date_souhaitee: string | null
          demande_id: string | null
          depart: string
          depart_retour: string | null
          distance_km: number | null
          duree_estimee: string | null
          email: string
          email_envoye: boolean
          expires_at: string | null
          heure_retour: string | null
          heure_souhaitee: string | null
          id: string
          immatriculation: string | null
          immatriculation_retour: string | null
          locked_at: string | null
          marque: string | null
          marque_retour: string | null
          message: string | null
          mission_group_id: string | null
          mission_id: string | null
          modele: string | null
          modele_retour: string | null
          multiplier_label: string | null
          nom: string
          numero: string
          option_trajet: string | null
          origine: string
          paid_at: string | null
          pdf_url: string | null
          prenom: string
          prestation: string | null
          prix_aller: number | null
          prix_base: number | null
          prix_estime: number
          prix_manuel: boolean
          prix_retour: number | null
          pv_digitalise: string | null
          recuperation_retour_identique: boolean
          refus_motif: string | null
          refused_at: string | null
          regime_snapshot: string | null
          sent_at: string | null
          statut: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          tarif_label: string | null
          telephone: string | null
          total_ht: number | null
          total_ttc: number | null
          total_tva: number | null
          type_vehicule: string | null
          updated_at: string
          user_id: string | null
          vat_breakdown: Json | null
          vehicule_docs_completed: boolean
          vehicules: Json | null
          version: number
          vin: string | null
          vin_retour: string | null
        }
        Insert: {
          accepted_at?: string | null
          adresse_recuperation_retour?: string | null
          amount_paid_cents?: number | null
          archived_at?: string | null
          arrivee: string
          arrivee_retour?: string | null
          carburant?: string | null
          carte_grise_recto_url?: string | null
          carte_grise_verso_url?: string | null
          client_pricing_rule_id?: string | null
          contact_arrivee_nom?: string | null
          contact_arrivee_note?: string | null
          contact_arrivee_tel?: string | null
          contact_depart_nom?: string | null
          contact_depart_note?: string | null
          contact_depart_tel?: string | null
          converted_at?: string | null
          converted_by?: string | null
          created_at?: string
          date_retour?: string | null
          date_souhaitee?: string | null
          demande_id?: string | null
          depart: string
          depart_retour?: string | null
          distance_km?: number | null
          duree_estimee?: string | null
          email: string
          email_envoye?: boolean
          expires_at?: string | null
          heure_retour?: string | null
          heure_souhaitee?: string | null
          id?: string
          immatriculation?: string | null
          immatriculation_retour?: string | null
          locked_at?: string | null
          marque?: string | null
          marque_retour?: string | null
          message?: string | null
          mission_group_id?: string | null
          mission_id?: string | null
          modele?: string | null
          modele_retour?: string | null
          multiplier_label?: string | null
          nom: string
          numero?: string
          option_trajet?: string | null
          origine?: string
          paid_at?: string | null
          pdf_url?: string | null
          prenom: string
          prestation?: string | null
          prix_aller?: number | null
          prix_base?: number | null
          prix_estime: number
          prix_manuel?: boolean
          prix_retour?: number | null
          pv_digitalise?: string | null
          recuperation_retour_identique?: boolean
          refus_motif?: string | null
          refused_at?: string | null
          regime_snapshot?: string | null
          sent_at?: string | null
          statut?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          tarif_label?: string | null
          telephone?: string | null
          total_ht?: number | null
          total_ttc?: number | null
          total_tva?: number | null
          type_vehicule?: string | null
          updated_at?: string
          user_id?: string | null
          vat_breakdown?: Json | null
          vehicule_docs_completed?: boolean
          vehicules?: Json | null
          version?: number
          vin?: string | null
          vin_retour?: string | null
        }
        Update: {
          accepted_at?: string | null
          adresse_recuperation_retour?: string | null
          amount_paid_cents?: number | null
          archived_at?: string | null
          arrivee?: string
          arrivee_retour?: string | null
          carburant?: string | null
          carte_grise_recto_url?: string | null
          carte_grise_verso_url?: string | null
          client_pricing_rule_id?: string | null
          contact_arrivee_nom?: string | null
          contact_arrivee_note?: string | null
          contact_arrivee_tel?: string | null
          contact_depart_nom?: string | null
          contact_depart_note?: string | null
          contact_depart_tel?: string | null
          converted_at?: string | null
          converted_by?: string | null
          created_at?: string
          date_retour?: string | null
          date_souhaitee?: string | null
          demande_id?: string | null
          depart?: string
          depart_retour?: string | null
          distance_km?: number | null
          duree_estimee?: string | null
          email?: string
          email_envoye?: boolean
          expires_at?: string | null
          heure_retour?: string | null
          heure_souhaitee?: string | null
          id?: string
          immatriculation?: string | null
          immatriculation_retour?: string | null
          locked_at?: string | null
          marque?: string | null
          marque_retour?: string | null
          message?: string | null
          mission_group_id?: string | null
          mission_id?: string | null
          modele?: string | null
          modele_retour?: string | null
          multiplier_label?: string | null
          nom?: string
          numero?: string
          option_trajet?: string | null
          origine?: string
          paid_at?: string | null
          pdf_url?: string | null
          prenom?: string
          prestation?: string | null
          prix_aller?: number | null
          prix_base?: number | null
          prix_estime?: number
          prix_manuel?: boolean
          prix_retour?: number | null
          pv_digitalise?: string | null
          recuperation_retour_identique?: boolean
          refus_motif?: string | null
          refused_at?: string | null
          regime_snapshot?: string | null
          sent_at?: string | null
          statut?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          tarif_label?: string | null
          telephone?: string | null
          total_ht?: number | null
          total_ttc?: number | null
          total_tva?: number | null
          type_vehicule?: string | null
          updated_at?: string
          user_id?: string | null
          vat_breakdown?: Json | null
          vehicule_docs_completed?: boolean
          vehicules?: Json | null
          version?: number
          vin?: string | null
          vin_retour?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devis_demande_id_fkey"
            columns: ["demande_id"]
            isOneToOne: false
            referencedRelation: "demandes_convoyage"
            referencedColumns: ["id"]
          },
        ]
      }
      devis_acceptations: {
        Row: {
          accepted_at: string
          cgv_version: string
          client_email: string
          client_user_id: string | null
          created_at: string
          devis_id: string
          devis_version: number
          id: string
          ip_address: string | null
          metadata: Json
          montant_accepte: number
          otp_sent_at: string | null
          otp_verified_at: string | null
          pdf_url: string | null
          signature_url: string | null
          statut: string
          user_agent: string | null
          validation_method: string
        }
        Insert: {
          accepted_at?: string
          cgv_version?: string
          client_email: string
          client_user_id?: string | null
          created_at?: string
          devis_id: string
          devis_version?: number
          id?: string
          ip_address?: string | null
          metadata?: Json
          montant_accepte: number
          otp_sent_at?: string | null
          otp_verified_at?: string | null
          pdf_url?: string | null
          signature_url?: string | null
          statut?: string
          user_agent?: string | null
          validation_method?: string
        }
        Update: {
          accepted_at?: string
          cgv_version?: string
          client_email?: string
          client_user_id?: string | null
          created_at?: string
          devis_id?: string
          devis_version?: number
          id?: string
          ip_address?: string | null
          metadata?: Json
          montant_accepte?: number
          otp_sent_at?: string | null
          otp_verified_at?: string | null
          pdf_url?: string | null
          signature_url?: string | null
          statut?: string
          user_agent?: string | null
          validation_method?: string
        }
        Relationships: [
          {
            foreignKeyName: "devis_acceptations_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
        ]
      }
      devis_otp_challenges: {
        Row: {
          attempts: number
          client_user_id: string
          code_hash: string
          consumed_at: string | null
          created_at: string
          devis_id: string
          email: string
          expires_at: string
          id: string
          ip_address: string | null
          max_attempts: number
          method: string
          user_agent: string | null
        }
        Insert: {
          attempts?: number
          client_user_id: string
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          devis_id: string
          email: string
          expires_at: string
          id?: string
          ip_address?: string | null
          max_attempts?: number
          method?: string
          user_agent?: string | null
        }
        Update: {
          attempts?: number
          client_user_id?: string
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          devis_id?: string
          email?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          max_attempts?: number
          method?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devis_otp_challenges_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
        ]
      }
      devis_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          devis_id: string
          id: string
          new_statut: string
          note: string | null
          old_statut: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          devis_id: string
          id?: string
          new_statut: string
          note?: string | null
          old_statut?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          devis_id?: string
          id?: string
          new_statut?: string
          note?: string | null
          old_statut?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devis_status_history_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
        ]
      }
      disponibilites_convoyeurs: {
        Row: {
          convoyeur_id: string
          created_at: string
          date_dispo: string
          id: string
          notes: string | null
          statut: string
          updated_at: string
        }
        Insert: {
          convoyeur_id: string
          created_at?: string
          date_dispo: string
          id?: string
          notes?: string | null
          statut?: string
          updated_at?: string
        }
        Update: {
          convoyeur_id?: string
          created_at?: string
          date_dispo?: string
          id?: string
          notes?: string | null
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disponibilites_convoyeurs_convoyeur_id_fkey"
            columns: ["convoyeur_id"]
            isOneToOne: false
            referencedRelation: "convoyeurs"
            referencedColumns: ["id"]
          },
        ]
      }
      documents_convoyeurs: {
        Row: {
          convoyeur_id: string
          created_at: string
          id: string
          motif_refus: string | null
          nom_fichier: string
          statut_validation: string
          type_document: string
          url_fichier: string
          valide_le: string | null
          valide_par: string | null
        }
        Insert: {
          convoyeur_id: string
          created_at?: string
          id?: string
          motif_refus?: string | null
          nom_fichier: string
          statut_validation?: string
          type_document: string
          url_fichier: string
          valide_le?: string | null
          valide_par?: string | null
        }
        Update: {
          convoyeur_id?: string
          created_at?: string
          id?: string
          motif_refus?: string | null
          nom_fichier?: string
          statut_validation?: string
          type_document?: string
          url_fichier?: string
          valide_le?: string | null
          valide_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_convoyeurs_convoyeur_id_fkey"
            columns: ["convoyeur_id"]
            isOneToOne: false
            referencedRelation: "convoyeurs"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      factures: {
        Row: {
          amount_paid_cents: number | null
          arrivee: string | null
          attribution_id: string | null
          client_adresse: string | null
          client_email: string
          client_nom: string
          client_prenom: string | null
          client_siret: string | null
          client_societe: string | null
          client_tva: string | null
          conditions_paiement: string | null
          created_at: string
          date_echeance: string | null
          date_facture: string
          date_mission: string | null
          date_paiement: string | null
          depart: string | null
          designation: string | null
          distance_km: number | null
          id: string
          metadata: Json
          mission_id: string | null
          mode_paiement: string | null
          numero: string
          paid_at: string | null
          pdf_url: string | null
          prix_ht: number
          prix_ttc: number
          prix_tva: number
          reference_client: string | null
          reference_label: string | null
          regime_snapshot: string | null
          statut: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          total_ht: number | null
          total_ttc: number | null
          total_tva: number | null
          tva_taux: number
          type_facture: string
          updated_at: string
          vat_breakdown: Json | null
        }
        Insert: {
          amount_paid_cents?: number | null
          arrivee?: string | null
          attribution_id?: string | null
          client_adresse?: string | null
          client_email: string
          client_nom: string
          client_prenom?: string | null
          client_siret?: string | null
          client_societe?: string | null
          client_tva?: string | null
          conditions_paiement?: string | null
          created_at?: string
          date_echeance?: string | null
          date_facture?: string
          date_mission?: string | null
          date_paiement?: string | null
          depart?: string | null
          designation?: string | null
          distance_km?: number | null
          id?: string
          metadata?: Json
          mission_id?: string | null
          mode_paiement?: string | null
          numero: string
          paid_at?: string | null
          pdf_url?: string | null
          prix_ht?: number
          prix_ttc?: number
          prix_tva?: number
          reference_client?: string | null
          reference_label?: string | null
          regime_snapshot?: string | null
          statut?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          total_ht?: number | null
          total_ttc?: number | null
          total_tva?: number | null
          tva_taux?: number
          type_facture?: string
          updated_at?: string
          vat_breakdown?: Json | null
        }
        Update: {
          amount_paid_cents?: number | null
          arrivee?: string | null
          attribution_id?: string | null
          client_adresse?: string | null
          client_email?: string
          client_nom?: string
          client_prenom?: string | null
          client_siret?: string | null
          client_societe?: string | null
          client_tva?: string | null
          conditions_paiement?: string | null
          created_at?: string
          date_echeance?: string | null
          date_facture?: string
          date_mission?: string | null
          date_paiement?: string | null
          depart?: string | null
          designation?: string | null
          distance_km?: number | null
          id?: string
          metadata?: Json
          mission_id?: string | null
          mode_paiement?: string | null
          numero?: string
          paid_at?: string | null
          pdf_url?: string | null
          prix_ht?: number
          prix_ttc?: number
          prix_tva?: number
          reference_client?: string | null
          reference_label?: string | null
          regime_snapshot?: string | null
          statut?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          total_ht?: number | null
          total_ttc?: number | null
          total_tva?: number | null
          tva_taux?: number
          type_facture?: string
          updated_at?: string
          vat_breakdown?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "factures_attribution_id_fkey"
            columns: ["attribution_id"]
            isOneToOne: false
            referencedRelation: "attributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      faq: {
        Row: {
          created_at: string
          id: string
          ordre: number
          publie: boolean
          question: string
          reponse: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          ordre?: number
          publie?: boolean
          question: string
          reponse: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          ordre?: number
          publie?: boolean
          question?: string
          reponse?: string
          updated_at?: string
        }
        Relationships: []
      }
      fleet_driver_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          created_by: string | null
          email: string
          id: string
          method: string
          nom: string
          organization_id: string
          permis_date_obtention: string | null
          permis_doc_url: string | null
          permis_numero: string | null
          prenom: string
          site_id: string | null
          status: string
          telephone: string | null
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          method?: string
          nom: string
          organization_id: string
          permis_date_obtention?: string | null
          permis_doc_url?: string | null
          permis_numero?: string | null
          prenom: string
          site_id?: string | null
          status?: string
          telephone?: string | null
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          method?: string
          nom?: string
          organization_id?: string
          permis_date_obtention?: string | null
          permis_doc_url?: string | null
          permis_numero?: string | null
          prenom?: string
          site_id?: string | null
          status?: string
          telephone?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_driver_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_driver_invitations_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "organization_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      formation_certificates: {
        Row: {
          certificate_number: string
          convoyeur_id: string
          created_at: string
          full_name: string
          id: string
          issued_at: string
          metadata: Json
          revoked_at: string | null
          updated_at: string
          verification_token: string
        }
        Insert: {
          certificate_number: string
          convoyeur_id: string
          created_at?: string
          full_name: string
          id?: string
          issued_at?: string
          metadata?: Json
          revoked_at?: string | null
          updated_at?: string
          verification_token?: string
        }
        Update: {
          certificate_number?: string
          convoyeur_id?: string
          created_at?: string
          full_name?: string
          id?: string
          issued_at?: string
          metadata?: Json
          revoked_at?: string | null
          updated_at?: string
          verification_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "formation_certificates_convoyeur_id_fkey"
            columns: ["convoyeur_id"]
            isOneToOne: false
            referencedRelation: "convoyeurs"
            referencedColumns: ["id"]
          },
        ]
      }
      formation_exam_attempts: {
        Row: {
          answers: Json
          convoyeur_id: string
          created_at: string
          duration_seconds: number | null
          exam_id: string
          finished_at: string
          id: string
          passed: boolean
          questions: Json
          score: number
          started_at: string
        }
        Insert: {
          answers?: Json
          convoyeur_id: string
          created_at?: string
          duration_seconds?: number | null
          exam_id: string
          finished_at?: string
          id?: string
          passed?: boolean
          questions?: Json
          score: number
          started_at?: string
        }
        Update: {
          answers?: Json
          convoyeur_id?: string
          created_at?: string
          duration_seconds?: number | null
          exam_id?: string
          finished_at?: string
          id?: string
          passed?: boolean
          questions?: Json
          score?: number
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "formation_exam_attempts_convoyeur_id_fkey"
            columns: ["convoyeur_id"]
            isOneToOne: false
            referencedRelation: "convoyeurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formation_exam_attempts_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "formation_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      formation_exams: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          minimum_score: number
          question_count: number
          question_pool: Json
          time_limit_minutes: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          minimum_score?: number
          question_count?: number
          question_pool?: Json
          time_limit_minutes?: number
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          minimum_score?: number
          question_count?: number
          question_pool?: Json
          time_limit_minutes?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      formation_modules: {
        Row: {
          category: string
          content_body: string | null
          content_type: string
          content_url: string | null
          created_at: string
          description: string | null
          estimated_minutes: number
          id: string
          is_active: boolean
          is_required: boolean
          minimum_score: number
          quiz_questions: Json
          sections: Json
          slug: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          content_body?: string | null
          content_type?: string
          content_url?: string | null
          created_at?: string
          description?: string | null
          estimated_minutes?: number
          id?: string
          is_active?: boolean
          is_required?: boolean
          minimum_score?: number
          quiz_questions?: Json
          sections?: Json
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content_body?: string | null
          content_type?: string
          content_url?: string | null
          created_at?: string
          description?: string | null
          estimated_minutes?: number
          id?: string
          is_active?: boolean
          is_required?: boolean
          minimum_score?: number
          quiz_questions?: Json
          sections?: Json
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      formation_progress: {
        Row: {
          completed_at: string | null
          convoyeur_id: string
          created_at: string
          id: string
          last_seen_at: string
          module_id: string
          score: number | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          convoyeur_id: string
          created_at?: string
          id?: string
          last_seen_at?: string
          module_id: string
          score?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          convoyeur_id?: string
          created_at?: string
          id?: string
          last_seen_at?: string
          module_id?: string
          score?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "formation_progress_convoyeur_id_fkey"
            columns: ["convoyeur_id"]
            isOneToOne: false
            referencedRelation: "convoyeurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formation_progress_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "formation_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      formation_quiz_attempts: {
        Row: {
          answers: Json
          convoyeur_id: string
          created_at: string
          id: string
          module_id: string
          passed: boolean
          score: number
        }
        Insert: {
          answers?: Json
          convoyeur_id: string
          created_at?: string
          id?: string
          module_id: string
          passed?: boolean
          score: number
        }
        Update: {
          answers?: Json
          convoyeur_id?: string
          created_at?: string
          id?: string
          module_id?: string
          passed?: boolean
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "formation_quiz_attempts_convoyeur_id_fkey"
            columns: ["convoyeur_id"]
            isOneToOne: false
            referencedRelation: "convoyeurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formation_quiz_attempts_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "formation_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_events: {
        Row: {
          assigned_to: string | null
          author_id: string | null
          commentaire: string | null
          created_at: string
          event_type: string
          from_statut: string | null
          id: string
          incident_id: string
          to_statut: string | null
        }
        Insert: {
          assigned_to?: string | null
          author_id?: string | null
          commentaire?: string | null
          created_at?: string
          event_type: string
          from_statut?: string | null
          id?: string
          incident_id: string
          to_statut?: string | null
        }
        Update: {
          assigned_to?: string | null
          author_id?: string | null
          commentaire?: string | null
          created_at?: string
          event_type?: string
          from_statut?: string | null
          id?: string
          incident_id?: string
          to_statut?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "mission_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_document_ocr: {
        Row: {
          attribution_id: string
          classification: string
          created_at: string
          document_type: string
          id: string
          inspection_id: string
          ocr_error: string | null
          ocr_status: string
          raw_text: string | null
          storage_path: string
          structured_data: Json | null
          updated_at: string
          vue_type: string
        }
        Insert: {
          attribution_id: string
          classification?: string
          created_at?: string
          document_type: string
          id?: string
          inspection_id: string
          ocr_error?: string | null
          ocr_status?: string
          raw_text?: string | null
          storage_path: string
          structured_data?: Json | null
          updated_at?: string
          vue_type: string
        }
        Update: {
          attribution_id?: string
          classification?: string
          created_at?: string
          document_type?: string
          id?: string
          inspection_id?: string
          ocr_error?: string | null
          ocr_status?: string
          raw_text?: string | null
          storage_path?: string
          structured_data?: Json | null
          updated_at?: string
          vue_type?: string
        }
        Relationships: []
      }
      inspection_photos: {
        Row: {
          created_at: string
          file_size_bytes: number | null
          id: string
          inspection_id: string
          notes: string | null
          url_photo: string
          vue_type: string
          zone_id: string | null
        }
        Insert: {
          created_at?: string
          file_size_bytes?: number | null
          id?: string
          inspection_id: string
          notes?: string | null
          url_photo: string
          vue_type: string
          zone_id?: string | null
        }
        Update: {
          created_at?: string
          file_size_bytes?: number | null
          id?: string
          inspection_id?: string
          notes?: string | null
          url_photo?: string
          vue_type?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_photos_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          attribution_id: string
          created_at: string
          equipements: Json | null
          id: string
          kilometrage_arrivee: number | null
          kilometrage_depart: number | null
          notes: string | null
          statut: string
          type: string
          updated_at: string
        }
        Insert: {
          attribution_id: string
          created_at?: string
          equipements?: Json | null
          id?: string
          kilometrage_arrivee?: number | null
          kilometrage_depart?: number | null
          notes?: string | null
          statut?: string
          type: string
          updated_at?: string
        }
        Update: {
          attribution_id?: string
          created_at?: string
          equipements?: Json | null
          id?: string
          kilometrage_arrivee?: number | null
          kilometrage_depart?: number | null
          notes?: string | null
          statut?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspections_attribution_id_fkey"
            columns: ["attribution_id"]
            isOneToOne: false
            referencedRelation: "attributions"
            referencedColumns: ["id"]
          },
        ]
      }
      km_tiers: {
        Row: {
          benefit: string | null
          color: string
          created_at: string
          id: string
          min_km: number
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          benefit?: string | null
          color?: string
          created_at?: string
          id?: string
          min_km?: number
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          benefit?: string | null
          color?: string
          created_at?: string
          id?: string
          min_km?: number
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      mission_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          attribution_id: string
          base_severity: string
          created_at: string
          details: Json
          escalated_at: string | null
          id: string
          message: string | null
          resolved_at: string | null
          severity: string
          status: string
          titre: string
          triggered_at: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          attribution_id: string
          base_severity?: string
          created_at?: string
          details?: Json
          escalated_at?: string | null
          id?: string
          message?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          titre: string
          triggered_at?: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          attribution_id?: string
          base_severity?: string
          created_at?: string
          details?: Json
          escalated_at?: string | null
          id?: string
          message?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          titre?: string
          triggered_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_alerts_attribution_id_fkey"
            columns: ["attribution_id"]
            isOneToOne: false
            referencedRelation: "attributions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_departure_checklists: {
        Row: {
          attribution_id: string
          created_at: string
          created_by: string | null
          gilet_jaune: boolean
          id: string
          permis_en_possession: boolean
          tenue_conforme: boolean
          validated_at: string
        }
        Insert: {
          attribution_id: string
          created_at?: string
          created_by?: string | null
          gilet_jaune?: boolean
          id?: string
          permis_en_possession?: boolean
          tenue_conforme?: boolean
          validated_at?: string
        }
        Update: {
          attribution_id?: string
          created_at?: string
          created_by?: string | null
          gilet_jaune?: boolean
          id?: string
          permis_en_possession?: boolean
          tenue_conforme?: boolean
          validated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_departure_checklists_attribution_id_fkey"
            columns: ["attribution_id"]
            isOneToOne: true
            referencedRelation: "attributions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_documents: {
        Row: {
          ajoute_par: string
          attribution_id: string
          created_at: string
          id: string
          nom_fichier: string
          type_document: string
          uploaded_by: string
          url_fichier: string
          visible_client: boolean
          visible_driver: boolean
        }
        Insert: {
          ajoute_par?: string
          attribution_id: string
          created_at?: string
          id?: string
          nom_fichier: string
          type_document?: string
          uploaded_by: string
          url_fichier: string
          visible_client?: boolean
          visible_driver?: boolean
        }
        Update: {
          ajoute_par?: string
          attribution_id?: string
          created_at?: string
          id?: string
          nom_fichier?: string
          type_document?: string
          uploaded_by?: string
          url_fichier?: string
          visible_client?: boolean
          visible_driver?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "mission_documents_attribution_id_fkey"
            columns: ["attribution_id"]
            isOneToOne: false
            referencedRelation: "attributions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_etape_history: {
        Row: {
          attribution_id: string
          created_at: string
          created_by: string | null
          etape: string
          id: string
          notes: string | null
        }
        Insert: {
          attribution_id: string
          created_at?: string
          created_by?: string | null
          etape: string
          id?: string
          notes?: string | null
        }
        Update: {
          attribution_id?: string
          created_at?: string
          created_by?: string | null
          etape?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mission_etape_history_attribution_id_fkey"
            columns: ["attribution_id"]
            isOneToOne: false
            referencedRelation: "attributions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_incidents: {
        Row: {
          assigned_to: string | null
          attribution_id: string
          convoyeur_user_id: string
          created_at: string
          description: string
          gravite: string
          id: string
          latitude: number | null
          longitude: number | null
          photos: Json | null
          prise_en_charge_at: string | null
          reponse_admin: string | null
          resolu_at: string | null
          statut: string
          titre: string
          type_incident: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          attribution_id: string
          convoyeur_user_id: string
          created_at?: string
          description: string
          gravite?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          photos?: Json | null
          prise_en_charge_at?: string | null
          reponse_admin?: string | null
          resolu_at?: string | null
          statut?: string
          titre: string
          type_incident?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          attribution_id?: string
          convoyeur_user_id?: string
          created_at?: string
          description?: string
          gravite?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          photos?: Json | null
          prise_en_charge_at?: string | null
          reponse_admin?: string | null
          resolu_at?: string | null
          statut?: string
          titre?: string
          type_incident?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_incidents_attribution_id_fkey"
            columns: ["attribution_id"]
            isOneToOne: false
            referencedRelation: "attributions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_locations: {
        Row: {
          accuracy: number | null
          attribution_id: string
          created_at: string
          id: string
          latitude: number
          longitude: number
          recorded_at: string
        }
        Insert: {
          accuracy?: number | null
          attribution_id: string
          created_at?: string
          id?: string
          latitude: number
          longitude: number
          recorded_at?: string
        }
        Update: {
          accuracy?: number | null
          attribution_id?: string
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_locations_attribution_id_fkey"
            columns: ["attribution_id"]
            isOneToOne: false
            referencedRelation: "attributions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_offres: {
        Row: {
          admin_counter_at: string | null
          admin_counter_by: string | null
          admin_counter_offer: number | null
          bid_round: number
          commentaire_convoyeur: string | null
          convoyeur_id: string
          created_at: string
          id: string
          is_winning: boolean
          message: string | null
          prix_propose: number
          prix_suggere_snapshot: number | null
          statut: string
          trajet_id: string
          type_offre: string
          updated_at: string
        }
        Insert: {
          admin_counter_at?: string | null
          admin_counter_by?: string | null
          admin_counter_offer?: number | null
          bid_round?: number
          commentaire_convoyeur?: string | null
          convoyeur_id: string
          created_at?: string
          id?: string
          is_winning?: boolean
          message?: string | null
          prix_propose: number
          prix_suggere_snapshot?: number | null
          statut?: string
          trajet_id: string
          type_offre?: string
          updated_at?: string
        }
        Update: {
          admin_counter_at?: string | null
          admin_counter_by?: string | null
          admin_counter_offer?: number | null
          bid_round?: number
          commentaire_convoyeur?: string | null
          convoyeur_id?: string
          created_at?: string
          id?: string
          is_winning?: boolean
          message?: string | null
          prix_propose?: number
          prix_suggere_snapshot?: number | null
          statut?: string
          trajet_id?: string
          type_offre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_offres_convoyeur_id_fkey"
            columns: ["convoyeur_id"]
            isOneToOne: false
            referencedRelation: "convoyeurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_offres_trajet_id_fkey"
            columns: ["trajet_id"]
            isOneToOne: false
            referencedRelation: "trajets"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_pv_digitaux: {
        Row: {
          actif: boolean
          attribution_id: string
          code: string | null
          created_at: string
          id: string
          instruction: string | null
          plaque: string | null
          plateforme: string
          updated_at: string
          url: string | null
        }
        Insert: {
          actif?: boolean
          attribution_id: string
          code?: string | null
          created_at?: string
          id?: string
          instruction?: string | null
          plaque?: string | null
          plateforme: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          actif?: boolean
          attribution_id?: string
          code?: string | null
          created_at?: string
          id?: string
          instruction?: string | null
          plaque?: string | null
          plateforme?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      mission_review_requests: {
        Row: {
          attribution_id: string
          auto: boolean
          channel: string
          created_at: string
          created_by: string | null
          id: string
          recipient_email: string | null
          recipient_name: string | null
          recipient_phone: string | null
          recipient_type: string
          review_left_at: string | null
          sent_at: string
          status: string
          trajet_id: string | null
          updated_at: string
        }
        Insert: {
          attribution_id: string
          auto?: boolean
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          recipient_type: string
          review_left_at?: string | null
          sent_at?: string
          status?: string
          trajet_id?: string | null
          updated_at?: string
        }
        Update: {
          attribution_id?: string
          auto?: boolean
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          recipient_type?: string
          review_left_at?: string | null
          sent_at?: string
          status?: string
          trajet_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_review_requests_attribution_id_fkey"
            columns: ["attribution_id"]
            isOneToOne: false
            referencedRelation: "attributions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_selfies: {
        Row: {
          accuracy: number | null
          attribution_id: string
          convoyeur_user_id: string
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          storage_path: string
          taken_at: string
        }
        Insert: {
          accuracy?: number | null
          attribution_id: string
          convoyeur_user_id: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          storage_path: string
          taken_at?: string
        }
        Update: {
          accuracy?: number | null
          attribution_id?: string
          convoyeur_user_id?: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          storage_path?: string
          taken_at?: string
        }
        Relationships: []
      }
      mission_sequences: {
        Row: {
          current_value: number
          id: string
          prefix: string
          updated_at: string
          year: number
        }
        Insert: {
          current_value?: number
          id?: string
          prefix: string
          updated_at?: string
          year: number
        }
        Update: {
          current_value?: number
          id?: string
          prefix?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      mission_signatures: {
        Row: {
          attribution_id: string
          created_at: string
          id: string
          kind: string
          latitude: number | null
          longitude: number | null
          signature_data: string
          signed_at: string
          signed_by_user_id: string | null
          signer_name: string
        }
        Insert: {
          attribution_id: string
          created_at?: string
          id?: string
          kind: string
          latitude?: number | null
          longitude?: number | null
          signature_data: string
          signed_at?: string
          signed_by_user_id?: string | null
          signer_name: string
        }
        Update: {
          attribution_id?: string
          created_at?: string
          id?: string
          kind?: string
          latitude?: number | null
          longitude?: number | null
          signature_data?: string
          signed_at?: string
          signed_by_user_id?: string | null
          signer_name?: string
        }
        Relationships: []
      }
      mission_step_overrides: {
        Row: {
          attribution_id: string
          created_at: string
          created_by: string | null
          id: string
          override_mode: string
          reason: string | null
          step_key: string
        }
        Insert: {
          attribution_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          override_mode?: string
          reason?: string | null
          step_key: string
        }
        Update: {
          attribution_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          override_mode?: string
          reason?: string | null
          step_key?: string
        }
        Relationships: []
      }
      missions: {
        Row: {
          archived_at: string | null
          carburant: string | null
          carte_grise_recto_url: string | null
          carte_grise_verso_url: string | null
          contact_arrivee_nom: string | null
          contact_arrivee_note: string | null
          contact_arrivee_tel: string | null
          contact_depart_nom: string | null
          contact_depart_note: string | null
          contact_depart_tel: string | null
          created_at: string
          date_prise_en_charge: string
          devis_id: string | null
          email: string
          fleet_organization_id: string | null
          group_reference: string | null
          heure_prise_en_charge: string | null
          id: string
          immatriculation: string | null
          leg_index: number | null
          leg_type: string | null
          marque: string | null
          mission_group_id: string | null
          modele: string | null
          nom: string
          numero: string
          options: Json
          organization_id: string | null
          prenom: string
          prix_locked: boolean
          prix_total: number
          remarques: string | null
          statut: string
          telephone: string | null
          tracking_code: string | null
          type_trajet: string
          updated_at: string
          user_id: string
          ville_arrivee: string
          ville_depart: string
          vin: string | null
        }
        Insert: {
          archived_at?: string | null
          carburant?: string | null
          carte_grise_recto_url?: string | null
          carte_grise_verso_url?: string | null
          contact_arrivee_nom?: string | null
          contact_arrivee_note?: string | null
          contact_arrivee_tel?: string | null
          contact_depart_nom?: string | null
          contact_depart_note?: string | null
          contact_depart_tel?: string | null
          created_at?: string
          date_prise_en_charge: string
          devis_id?: string | null
          email: string
          fleet_organization_id?: string | null
          group_reference?: string | null
          heure_prise_en_charge?: string | null
          id?: string
          immatriculation?: string | null
          leg_index?: number | null
          leg_type?: string | null
          marque?: string | null
          mission_group_id?: string | null
          modele?: string | null
          nom: string
          numero?: string
          options?: Json
          organization_id?: string | null
          prenom: string
          prix_locked?: boolean
          prix_total?: number
          remarques?: string | null
          statut?: string
          telephone?: string | null
          tracking_code?: string | null
          type_trajet?: string
          updated_at?: string
          user_id: string
          ville_arrivee: string
          ville_depart: string
          vin?: string | null
        }
        Update: {
          archived_at?: string | null
          carburant?: string | null
          carte_grise_recto_url?: string | null
          carte_grise_verso_url?: string | null
          contact_arrivee_nom?: string | null
          contact_arrivee_note?: string | null
          contact_arrivee_tel?: string | null
          contact_depart_nom?: string | null
          contact_depart_note?: string | null
          contact_depart_tel?: string | null
          created_at?: string
          date_prise_en_charge?: string
          devis_id?: string | null
          email?: string
          fleet_organization_id?: string | null
          group_reference?: string | null
          heure_prise_en_charge?: string | null
          id?: string
          immatriculation?: string | null
          leg_index?: number | null
          leg_type?: string | null
          marque?: string | null
          mission_group_id?: string | null
          modele?: string | null
          nom?: string
          numero?: string
          options?: Json
          organization_id?: string | null
          prenom?: string
          prix_locked?: boolean
          prix_total?: number
          remarques?: string | null
          statut?: string
          telephone?: string | null
          tracking_code?: string | null
          type_trajet?: string
          updated_at?: string
          user_id?: string
          ville_arrivee?: string
          ville_depart?: string
          vin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "missions_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_fleet_organization_id_fkey"
            columns: ["fleet_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      module_content_versions: {
        Row: {
          changed_at: string
          changed_by: string | null
          changed_by_email: string | null
          id: string
          module_id: string
          module_title: string | null
          snapshot: Json
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          changed_by_email?: string | null
          id?: string
          module_id: string
          module_title?: string | null
          snapshot?: Json
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          changed_by_email?: string | null
          id?: string
          module_id?: string
          module_title?: string | null
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "module_content_versions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      module_progress: {
        Row: {
          attempts_count: number
          case_study_answer: number | null
          checklist_state: Json
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          module_id: string
          quiz_score: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts_count?: number
          case_study_answer?: number | null
          checklist_state?: Json
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          module_id: string
          quiz_score?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts_count?: number
          case_study_answer?: number | null
          checklist_state?: Json
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          module_id?: string
          quiz_score?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_progress_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          case_study: Json
          checklist_items: Json
          content: string
          created_at: string
          duration_minutes: number
          id: string
          is_active: boolean
          last_updated: string
          objectives: Json
          order_index: number
          quiz_questions: Json
          resource_label: string | null
          resource_url: string | null
          tag: string | null
          title: string
          updated_by: string | null
          video_url: string | null
        }
        Insert: {
          case_study?: Json
          checklist_items?: Json
          content?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          is_active?: boolean
          last_updated?: string
          objectives?: Json
          order_index: number
          quiz_questions?: Json
          resource_label?: string | null
          resource_url?: string | null
          tag?: string | null
          title: string
          updated_by?: string | null
          video_url?: string | null
        }
        Update: {
          case_study?: Json
          checklist_items?: Json
          content?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          is_active?: boolean
          last_updated?: string
          objectives?: Json
          order_index?: number
          quiz_questions?: Json
          resource_label?: string | null
          resource_url?: string | null
          tag?: string | null
          title?: string
          updated_by?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      native_push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: string
          token: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      newsletter_abonnes: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string | null
          unsubscribe_token: string
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string | null
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string | null
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          category: string
          channel: string
          created_at: string
          enabled: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          channel: string
          created_at?: string
          enabled?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          channel?: string
          created_at?: string
          enabled?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          created_at: string
          description: string | null
          enabled_admin: boolean
          enabled_client: boolean
          enabled_convoyeur: boolean
          enabled_push: boolean
          groupe: string
          key: string
          label: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled_admin?: boolean
          enabled_client?: boolean
          enabled_convoyeur?: boolean
          enabled_push?: boolean
          groupe?: string
          key: string
          label: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled_admin?: boolean
          enabled_client?: boolean
          enabled_convoyeur?: boolean
          enabled_push?: boolean
          groupe?: string
          key?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          invited_at: string | null
          invited_by: string | null
          joined_at: string | null
          member_role: string
          organization_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string | null
          member_role?: string
          organization_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string | null
          member_role?: string
          organization_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_roles: {
        Row: {
          active: boolean
          created_at: string
          id: string
          organization_id: string
          role: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          organization_id: string
          role: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_sites: {
        Row: {
          actif: boolean
          adresse: string | null
          code_postal: string | null
          contact_email: string | null
          contact_nom: string | null
          contact_telephone: string | null
          created_at: string
          id: string
          nom: string
          notes: string | null
          organization_id: string
          pays: string | null
          updated_at: string
          ville: string | null
        }
        Insert: {
          actif?: boolean
          adresse?: string | null
          code_postal?: string | null
          contact_email?: string | null
          contact_nom?: string | null
          contact_telephone?: string | null
          created_at?: string
          id?: string
          nom: string
          notes?: string | null
          organization_id: string
          pays?: string | null
          updated_at?: string
          ville?: string | null
        }
        Update: {
          actif?: boolean
          adresse?: string | null
          code_postal?: string | null
          contact_email?: string | null
          contact_nom?: string | null
          contact_telephone?: string | null
          created_at?: string
          id?: string
          nom?: string
          notes?: string | null
          organization_id?: string
          pays?: string | null
          updated_at?: string
          ville?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_sites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          account_type: string
          billing_address: string | null
          billing_email: string | null
          commercial_name: string | null
          created_at: string
          created_by: string | null
          id: string
          legacy_company_id: string | null
          legal_name: string
          logo_url: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          score: number
          score_category: string
          sector: string | null
          siret: string | null
          size: string | null
          status: string
          updated_at: string
          vat_number: string | null
          website: string | null
        }
        Insert: {
          account_type?: string
          billing_address?: string | null
          billing_email?: string | null
          commercial_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          legacy_company_id?: string | null
          legal_name: string
          logo_url?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          score?: number
          score_category?: string
          sector?: string | null
          siret?: string | null
          size?: string | null
          status?: string
          updated_at?: string
          vat_number?: string | null
          website?: string | null
        }
        Update: {
          account_type?: string
          billing_address?: string | null
          billing_email?: string | null
          commercial_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          legacy_company_id?: string | null
          legal_name?: string
          logo_url?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          score?: number
          score_category?: string
          sector?: string | null
          siret?: string | null
          size?: string | null
          status?: string
          updated_at?: string
          vat_number?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_legacy_company_id_fkey"
            columns: ["legacy_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations_admin_data: {
        Row: {
          created_at: string
          notes_internes: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          notes_internes?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          notes_internes?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_admin_data_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      paiements_convoyeurs: {
        Row: {
          convoyeur_id: string
          created_at: string
          created_by: string | null
          date_execution: string | null
          facture_numero: string | null
          facture_url: string | null
          id: string
          methode: string
          montant_total: number
          nb_missions: number
          notes: string | null
          numero: string | null
          periode_debut: string | null
          periode_fin: string | null
          reference_bancaire: string | null
          statut: string
          updated_at: string
        }
        Insert: {
          convoyeur_id: string
          created_at?: string
          created_by?: string | null
          date_execution?: string | null
          facture_numero?: string | null
          facture_url?: string | null
          id?: string
          methode?: string
          montant_total?: number
          nb_missions?: number
          notes?: string | null
          numero?: string | null
          periode_debut?: string | null
          periode_fin?: string | null
          reference_bancaire?: string | null
          statut?: string
          updated_at?: string
        }
        Update: {
          convoyeur_id?: string
          created_at?: string
          created_by?: string | null
          date_execution?: string | null
          facture_numero?: string | null
          facture_url?: string | null
          id?: string
          methode?: string
          montant_total?: number
          nb_missions?: number
          notes?: string | null
          numero?: string | null
          periode_debut?: string | null
          periode_fin?: string | null
          reference_bancaire?: string | null
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paiements_convoyeurs_convoyeur_id_fkey"
            columns: ["convoyeur_id"]
            isOneToOne: false
            referencedRelation: "convoyeurs"
            referencedColumns: ["id"]
          },
        ]
      }
      po_pdf_history: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          attribution_id: string | null
          created_at: string
          facture_id: string | null
          facture_numero: string | null
          id: string
          new_po: string | null
          old_po: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          attribution_id?: string | null
          created_at?: string
          facture_id?: string | null
          facture_numero?: string | null
          id?: string
          new_po?: string | null
          old_po?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          attribution_id?: string | null
          created_at?: string
          facture_id?: string | null
          facture_numero?: string | null
          id?: string
          new_po?: string | null
          old_po?: string | null
        }
        Relationships: []
      }
      pricing_settings: {
        Row: {
          created_at: string
          currency: string
          default_vat_rate: number
          id: boolean
          regime: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          default_vat_rate?: number
          id?: boolean
          regime?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          default_vat_rate?: number
          id?: boolean
          regime?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: string
          adresse: string | null
          adresse_facturation: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          exempte_acceptation_devis: boolean
          facture_mention_active: boolean
          facture_mention_legale: string | null
          id: string
          last_module_visited: string | null
          logo_url: string | null
          nom: string
          organization_id: string | null
          prenom: string
          pricing_display_mode: string
          relances_disabled: boolean
          siret: string | null
          societe: string | null
          statut: string
          telephone: string | null
          training_started_at: string | null
          tva_exemption_note: string | null
          tva_intra: string | null
          type_client: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_status?: string
          adresse?: string | null
          adresse_facturation?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          exempte_acceptation_devis?: boolean
          facture_mention_active?: boolean
          facture_mention_legale?: string | null
          id?: string
          last_module_visited?: string | null
          logo_url?: string | null
          nom?: string
          organization_id?: string | null
          prenom?: string
          pricing_display_mode?: string
          relances_disabled?: boolean
          siret?: string | null
          societe?: string | null
          statut?: string
          telephone?: string | null
          training_started_at?: string | null
          tva_exemption_note?: string | null
          tva_intra?: string | null
          type_client?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_status?: string
          adresse?: string | null
          adresse_facturation?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          exempte_acceptation_devis?: boolean
          facture_mention_active?: boolean
          facture_mention_legale?: string | null
          id?: string
          last_module_visited?: string | null
          logo_url?: string | null
          nom?: string
          organization_id?: string | null
          prenom?: string
          pricing_display_mode?: string
          relances_disabled?: boolean
          siret?: string | null
          societe?: string | null
          statut?: string
          telephone?: string | null
          training_started_at?: string | null
          tva_exemption_note?: string | null
          tva_intra?: string | null
          type_client?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      public_tracking_attempts: {
        Row: {
          blocked_until: string | null
          created_at: string
          failed_count: number
          fingerprint: string
          id: string
          updated_at: string
          window_started_at: string
        }
        Insert: {
          blocked_until?: string | null
          created_at?: string
          failed_count?: number
          fingerprint: string
          id?: string
          updated_at?: string
          window_started_at?: string
        }
        Update: {
          blocked_until?: string | null
          created_at?: string
          failed_count?: number
          fingerprint?: string
          id?: string
          updated_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      regles_remuneration: {
        Row: {
          actif: boolean
          cond_distance_max: number | null
          cond_distance_min: number | null
          cond_type_mission: string | null
          cond_vehicule_type: string | null
          cond_zone: string | null
          created_at: string
          created_by: string | null
          date_debut: string
          date_fin: string | null
          id: string
          libelle: string
          montant_forfait: number
          montant_min: number | null
          notes: string | null
          priorite: number
          seuil_km: number
          taux_km: number
          type_regle: string
          updated_at: string
        }
        Insert: {
          actif?: boolean
          cond_distance_max?: number | null
          cond_distance_min?: number | null
          cond_type_mission?: string | null
          cond_vehicule_type?: string | null
          cond_zone?: string | null
          created_at?: string
          created_by?: string | null
          date_debut?: string
          date_fin?: string | null
          id?: string
          libelle: string
          montant_forfait?: number
          montant_min?: number | null
          notes?: string | null
          priorite?: number
          seuil_km?: number
          taux_km?: number
          type_regle: string
          updated_at?: string
        }
        Update: {
          actif?: boolean
          cond_distance_max?: number | null
          cond_distance_min?: number | null
          cond_type_mission?: string | null
          cond_vehicule_type?: string | null
          cond_zone?: string | null
          created_at?: string
          created_by?: string | null
          date_debut?: string
          date_fin?: string | null
          id?: string
          libelle?: string
          montant_forfait?: number
          montant_min?: number | null
          notes?: string | null
          priorite?: number
          seuil_km?: number
          taux_km?: number
          type_regle?: string
          updated_at?: string
        }
        Relationships: []
      }
      remuneration_ajustements: {
        Row: {
          annulation_motif: string | null
          annule: boolean
          annule_at: string | null
          annule_par: string | null
          article_reference: string | null
          categorie: string
          created_at: string
          created_by: string | null
          id: string
          incident_id: string | null
          justificatif_url: string | null
          libelle: string
          montant: number
          motif: string
          penalite_id: string | null
          remuneration_id: string
          updated_at: string
        }
        Insert: {
          annulation_motif?: string | null
          annule?: boolean
          annule_at?: string | null
          annule_par?: string | null
          article_reference?: string | null
          categorie: string
          created_at?: string
          created_by?: string | null
          id?: string
          incident_id?: string | null
          justificatif_url?: string | null
          libelle: string
          montant: number
          motif: string
          penalite_id?: string | null
          remuneration_id: string
          updated_at?: string
        }
        Update: {
          annulation_motif?: string | null
          annule?: boolean
          annule_at?: string | null
          annule_par?: string | null
          article_reference?: string | null
          categorie?: string
          created_at?: string
          created_by?: string | null
          id?: string
          incident_id?: string | null
          justificatif_url?: string | null
          libelle?: string
          montant?: number
          motif?: string
          penalite_id?: string | null
          remuneration_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "remuneration_ajustements_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "mission_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remuneration_ajustements_penalite_id_fkey"
            columns: ["penalite_id"]
            isOneToOne: false
            referencedRelation: "catalogue_penalites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remuneration_ajustements_remuneration_id_fkey"
            columns: ["remuneration_id"]
            isOneToOne: false
            referencedRelation: "remunerations_missions"
            referencedColumns: ["id"]
          },
        ]
      }
      remunerations_missions: {
        Row: {
          attribution_id: string | null
          base_forfait: number
          base_km_montant: number
          calcul_detail: Json
          calcule_at: string
          convoyeur_id: string | null
          created_at: string
          date_mission: string | null
          distance_km: number | null
          frais_annexes: number
          id: string
          montant_base: number
          montant_total: number
          notes: string | null
          numero_mission: string | null
          paiement_id: string | null
          primes: number
          regle_id: string | null
          source_calcul: string
          statut: string
          total_ajustements: number
          trajet_id: string
          updated_at: string
          valide_at: string | null
          valide_par: string | null
        }
        Insert: {
          attribution_id?: string | null
          base_forfait?: number
          base_km_montant?: number
          calcul_detail?: Json
          calcule_at?: string
          convoyeur_id?: string | null
          created_at?: string
          date_mission?: string | null
          distance_km?: number | null
          frais_annexes?: number
          id?: string
          montant_base?: number
          montant_total?: number
          notes?: string | null
          numero_mission?: string | null
          paiement_id?: string | null
          primes?: number
          regle_id?: string | null
          source_calcul?: string
          statut?: string
          total_ajustements?: number
          trajet_id: string
          updated_at?: string
          valide_at?: string | null
          valide_par?: string | null
        }
        Update: {
          attribution_id?: string | null
          base_forfait?: number
          base_km_montant?: number
          calcul_detail?: Json
          calcule_at?: string
          convoyeur_id?: string | null
          created_at?: string
          date_mission?: string | null
          distance_km?: number | null
          frais_annexes?: number
          id?: string
          montant_base?: number
          montant_total?: number
          notes?: string | null
          numero_mission?: string | null
          paiement_id?: string | null
          primes?: number
          regle_id?: string | null
          source_calcul?: string
          statut?: string
          total_ajustements?: number
          trajet_id?: string
          updated_at?: string
          valide_at?: string | null
          valide_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "remunerations_missions_attribution_id_fkey"
            columns: ["attribution_id"]
            isOneToOne: false
            referencedRelation: "attributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remunerations_missions_convoyeur_id_fkey"
            columns: ["convoyeur_id"]
            isOneToOne: false
            referencedRelation: "convoyeurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remunerations_missions_paiement_id_fkey"
            columns: ["paiement_id"]
            isOneToOne: false
            referencedRelation: "paiements_convoyeurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remunerations_missions_regle_id_fkey"
            columns: ["regle_id"]
            isOneToOne: false
            referencedRelation: "regles_remuneration"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remunerations_missions_trajet_id_fkey"
            columns: ["trajet_id"]
            isOneToOne: true
            referencedRelation: "trajets"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          client_id: string
          commentaire: string | null
          created_at: string
          id: string
          mission_id: string
          note: number
          updated_at: string
        }
        Insert: {
          client_id: string
          commentaire?: string | null
          created_at?: string
          id?: string
          mission_id: string
          note: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          commentaire?: string | null
          created_at?: string
          id?: string
          mission_id?: string
          note?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          granted: boolean
          id: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          granted?: boolean
          id?: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          id?: string
          permission?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      scan_handoff_extractions: {
        Row: {
          created_at: string
          extraction: Json
          id: string
          session_id: string
        }
        Insert: {
          created_at?: string
          extraction: Json
          id?: string
          session_id: string
        }
        Update: {
          created_at?: string
          extraction?: Json
          id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_handoff_extractions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "scan_handoff_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_handoff_sessions: {
        Row: {
          consumed_at: string | null
          context: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          short_code: string
          status: string
          token: string
        }
        Insert: {
          consumed_at?: string | null
          context?: string
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          short_code: string
          status?: string
          token: string
        }
        Update: {
          consumed_at?: string | null
          context?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          short_code?: string
          status?: string
          token?: string
        }
        Relationships: []
      }
      short_links: {
        Row: {
          code: string
          created_at: string
          hits: number
          id: string
          purpose: string | null
          target_url: string
        }
        Insert: {
          code: string
          created_at?: string
          hits?: number
          id?: string
          purpose?: string | null
          target_url: string
        }
        Update: {
          code?: string
          created_at?: string
          hits?: number
          id?: string
          purpose?: string | null
          target_url?: string
        }
        Relationships: []
      }
      signup_events: {
        Row: {
          created_at: string
          documents_expected: number
          documents_rejected: Json
          documents_uploaded: number
          email: string | null
          emails: Json
          error_message: string | null
          full_name: string | null
          id: string
          kind: string
          notification_created: boolean
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          documents_expected?: number
          documents_rejected?: Json
          documents_uploaded?: number
          email?: string | null
          emails?: Json
          error_message?: string | null
          full_name?: string | null
          id?: string
          kind: string
          notification_created?: boolean
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          documents_expected?: number
          documents_rejected?: Json
          documents_uploaded?: number
          email?: string | null
          emails?: Json
          error_message?: string | null
          full_name?: string | null
          id?: string
          kind?: string
          notification_created?: boolean
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      trajets: {
        Row: {
          allow_counter_offer: boolean
          archived_at: string | null
          arrivee: string
          arrivee_contact_email: string | null
          arrivee_contact_instructions: string | null
          arrivee_contact_nom: string | null
          arrivee_contact_prenom: string | null
          arrivee_contact_societe: string | null
          arrivee_contact_telephone: string | null
          arrivee_contact_telephone2: string | null
          attribution_mode: string
          bidding_enabled: boolean
          carte_grise_recto_url: string | null
          carte_grise_verso_url: string | null
          client_email: string | null
          client_nom: string | null
          client_telephone: string | null
          commande_ref: string | null
          commission_convoyeur_pct: number | null
          contact_arrivee_nom: string | null
          contact_arrivee_note: string | null
          contact_arrivee_tel: string | null
          contact_depart_nom: string | null
          contact_depart_note: string | null
          contact_depart_tel: string | null
          created_at: string
          date_souhaitee: string | null
          date_trajet: string | null
          demande_id: string | null
          depart: string
          devis_id: string | null
          group_reference: string | null
          heure_trajet: string | null
          id: string
          immatriculation: string | null
          is_round_trip: boolean
          is_test_data: boolean
          leg_index: number | null
          leg_type: string | null
          marque: string | null
          mission_group_id: string | null
          mission_id: string | null
          modele: string | null
          niveau_requis: string
          numero_mission: string | null
          options_meta: Json
          parent_trajet_id: string | null
          pricing_mode: string
          prix: number | null
          prix_client: number | null
          prix_convoyeur: number | null
          prix_convoyeur_fixe: number | null
          prix_convoyeur_max: number | null
          prix_convoyeur_min: number | null
          prix_societe: number | null
          prix_suggere: number | null
          prix_total: number | null
          proposal_expires_at: string | null
          published_at: string | null
          pv_digitalise: string | null
          statut: string
          statut_publication: string
          tarif_convoyeur: number | null
          type_mission: string
          updated_at: string
          vehicule_couleur: string | null
          vehicule_energie: string | null
          vehicule_immatriculation: string | null
          vehicule_km: number | null
          vehicule_notes: string | null
          vehicule_type: string | null
          vehicule_vin: string | null
          vin: string | null
        }
        Insert: {
          allow_counter_offer?: boolean
          archived_at?: string | null
          arrivee: string
          arrivee_contact_email?: string | null
          arrivee_contact_instructions?: string | null
          arrivee_contact_nom?: string | null
          arrivee_contact_prenom?: string | null
          arrivee_contact_societe?: string | null
          arrivee_contact_telephone?: string | null
          arrivee_contact_telephone2?: string | null
          attribution_mode?: string
          bidding_enabled?: boolean
          carte_grise_recto_url?: string | null
          carte_grise_verso_url?: string | null
          client_email?: string | null
          client_nom?: string | null
          client_telephone?: string | null
          commande_ref?: string | null
          commission_convoyeur_pct?: number | null
          contact_arrivee_nom?: string | null
          contact_arrivee_note?: string | null
          contact_arrivee_tel?: string | null
          contact_depart_nom?: string | null
          contact_depart_note?: string | null
          contact_depart_tel?: string | null
          created_at?: string
          date_souhaitee?: string | null
          date_trajet?: string | null
          demande_id?: string | null
          depart: string
          devis_id?: string | null
          group_reference?: string | null
          heure_trajet?: string | null
          id?: string
          immatriculation?: string | null
          is_round_trip?: boolean
          is_test_data?: boolean
          leg_index?: number | null
          leg_type?: string | null
          marque?: string | null
          mission_group_id?: string | null
          mission_id?: string | null
          modele?: string | null
          niveau_requis?: string
          numero_mission?: string | null
          options_meta?: Json
          parent_trajet_id?: string | null
          pricing_mode?: string
          prix?: number | null
          prix_client?: number | null
          prix_convoyeur?: number | null
          prix_convoyeur_fixe?: number | null
          prix_convoyeur_max?: number | null
          prix_convoyeur_min?: number | null
          prix_societe?: number | null
          prix_suggere?: number | null
          prix_total?: number | null
          proposal_expires_at?: string | null
          published_at?: string | null
          pv_digitalise?: string | null
          statut?: string
          statut_publication?: string
          tarif_convoyeur?: number | null
          type_mission?: string
          updated_at?: string
          vehicule_couleur?: string | null
          vehicule_energie?: string | null
          vehicule_immatriculation?: string | null
          vehicule_km?: number | null
          vehicule_notes?: string | null
          vehicule_type?: string | null
          vehicule_vin?: string | null
          vin?: string | null
        }
        Update: {
          allow_counter_offer?: boolean
          archived_at?: string | null
          arrivee?: string
          arrivee_contact_email?: string | null
          arrivee_contact_instructions?: string | null
          arrivee_contact_nom?: string | null
          arrivee_contact_prenom?: string | null
          arrivee_contact_societe?: string | null
          arrivee_contact_telephone?: string | null
          arrivee_contact_telephone2?: string | null
          attribution_mode?: string
          bidding_enabled?: boolean
          carte_grise_recto_url?: string | null
          carte_grise_verso_url?: string | null
          client_email?: string | null
          client_nom?: string | null
          client_telephone?: string | null
          commande_ref?: string | null
          commission_convoyeur_pct?: number | null
          contact_arrivee_nom?: string | null
          contact_arrivee_note?: string | null
          contact_arrivee_tel?: string | null
          contact_depart_nom?: string | null
          contact_depart_note?: string | null
          contact_depart_tel?: string | null
          created_at?: string
          date_souhaitee?: string | null
          date_trajet?: string | null
          demande_id?: string | null
          depart?: string
          devis_id?: string | null
          group_reference?: string | null
          heure_trajet?: string | null
          id?: string
          immatriculation?: string | null
          is_round_trip?: boolean
          is_test_data?: boolean
          leg_index?: number | null
          leg_type?: string | null
          marque?: string | null
          mission_group_id?: string | null
          mission_id?: string | null
          modele?: string | null
          niveau_requis?: string
          numero_mission?: string | null
          options_meta?: Json
          parent_trajet_id?: string | null
          pricing_mode?: string
          prix?: number | null
          prix_client?: number | null
          prix_convoyeur?: number | null
          prix_convoyeur_fixe?: number | null
          prix_convoyeur_max?: number | null
          prix_convoyeur_min?: number | null
          prix_societe?: number | null
          prix_suggere?: number | null
          prix_total?: number | null
          proposal_expires_at?: string | null
          published_at?: string | null
          pv_digitalise?: string | null
          statut?: string
          statut_publication?: string
          tarif_convoyeur?: number | null
          type_mission?: string
          updated_at?: string
          vehicule_couleur?: string | null
          vehicule_energie?: string | null
          vehicule_immatriculation?: string | null
          vehicule_km?: number | null
          vehicule_notes?: string | null
          vehicule_type?: string | null
          vehicule_vin?: string | null
          vin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trajets_demande_id_fkey"
            columns: ["demande_id"]
            isOneToOne: false
            referencedRelation: "demandes_convoyage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trajets_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trajets_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trajets_parent_trajet_id_fkey"
            columns: ["parent_trajet_id"]
            isOneToOne: false
            referencedRelation: "trajets"
            referencedColumns: ["id"]
          },
        ]
      }
      trajets_admin_data: {
        Row: {
          created_at: string
          marge_indicative_pct: number | null
          notes_internes: string | null
          prix_client_ttc: number | null
          trajet_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          marge_indicative_pct?: number | null
          notes_internes?: string | null
          prix_client_ttc?: number | null
          trajet_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          marge_indicative_pct?: number | null
          notes_internes?: string | null
          prix_client_ttc?: number | null
          trajet_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trajets_admin_data_trajet_id_fkey"
            columns: ["trajet_id"]
            isOneToOne: true
            referencedRelation: "trajets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          category: string
          created_at: string
          dedup_key: string | null
          deep_link: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          link: string | null
          lu: boolean
          message: string | null
          metadata: Json
          priority: string
          titre: string
          type: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          dedup_key?: string | null
          deep_link?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          link?: string | null
          lu?: boolean
          message?: string | null
          metadata?: Json
          priority?: string
          titre: string
          type: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          dedup_key?: string | null
          deep_link?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          link?: string | null
          lu?: boolean
          message?: string | null
          metadata?: Json
          priority?: string
          titre?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          actif: boolean
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          actif?: boolean
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          actif?: boolean
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vat_rates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          label: string
          rate: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          label: string
          rate: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          label?: string
          rate?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      vehicle_documents: {
        Row: {
          created_at: string
          doc_type: string
          expire_le: string | null
          id: string
          mime_type: string | null
          nom: string
          storage_path: string
          taille_octets: number | null
          updated_at: string
          uploaded_by: string | null
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          doc_type?: string
          expire_le?: string | null
          id?: string
          mime_type?: string | null
          nom: string
          storage_path: string
          taille_octets?: number | null
          updated_at?: string
          uploaded_by?: string | null
          vehicle_id: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          expire_le?: string | null
          id?: string
          mime_type?: string | null
          nom?: string
          storage_path?: string
          taille_octets?: number | null
          updated_at?: string
          uploaded_by?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_documents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_maintenances: {
        Row: {
          cout: number | null
          created_at: string
          effectue_le: string
          garage: string | null
          id: string
          kilometrage: number | null
          notes: string | null
          type_intervention: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          cout?: number | null
          created_at?: string
          effectue_le?: string
          garage?: string | null
          id?: string
          kilometrage?: number | null
          notes?: string | null
          type_intervention?: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          cout?: number | null
          created_at?: string
          effectue_le?: string
          garage?: string | null
          id?: string
          kilometrage?: number | null
          notes?: string | null
          type_intervention?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_maintenances_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_movements: {
        Row: {
          created_at: string
          from_address: string | null
          id: string
          mission_id: string | null
          notes: string | null
          occurred_at: string
          to_address: string | null
          trajet_id: string | null
          type: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          from_address?: string | null
          id?: string
          mission_id?: string | null
          notes?: string | null
          occurred_at?: string
          to_address?: string | null
          trajet_id?: string | null
          type: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          from_address?: string | null
          id?: string
          mission_id?: string | null
          notes?: string | null
          occurred_at?: string
          to_address?: string | null
          trajet_id?: string | null
          type?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_movements_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_movements_trajet_id_fkey"
            columns: ["trajet_id"]
            isOneToOne: false
            referencedRelation: "trajets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_movements_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          archived_at: string | null
          assurance_cout_annuel: number | null
          assurance_expire_le: string | null
          carte_grise_expire_le: string | null
          controle_technique_expire_le: string | null
          couleur: string | null
          created_at: string
          energie: string | null
          id: string
          immatriculation: string | null
          intervalle_revision_km: number | null
          kilometrage: number | null
          marque: string | null
          mise_en_circulation: string | null
          modele: string | null
          notes: string | null
          organization_id: string
          prochaine_revision_km: number | null
          site_id: string | null
          statut: string
          type_vehicule: string | null
          updated_at: string
          vin: string | null
        }
        Insert: {
          archived_at?: string | null
          assurance_cout_annuel?: number | null
          assurance_expire_le?: string | null
          carte_grise_expire_le?: string | null
          controle_technique_expire_le?: string | null
          couleur?: string | null
          created_at?: string
          energie?: string | null
          id?: string
          immatriculation?: string | null
          intervalle_revision_km?: number | null
          kilometrage?: number | null
          marque?: string | null
          mise_en_circulation?: string | null
          modele?: string | null
          notes?: string | null
          organization_id: string
          prochaine_revision_km?: number | null
          site_id?: string | null
          statut?: string
          type_vehicule?: string | null
          updated_at?: string
          vin?: string | null
        }
        Update: {
          archived_at?: string | null
          assurance_cout_annuel?: number | null
          assurance_expire_le?: string | null
          carte_grise_expire_le?: string | null
          controle_technique_expire_le?: string | null
          couleur?: string | null
          created_at?: string
          energie?: string | null
          id?: string
          immatriculation?: string | null
          intervalle_revision_km?: number | null
          kilometrage?: number | null
          marque?: string | null
          mise_en_circulation?: string | null
          modele?: string | null
          notes?: string | null
          organization_id?: string
          prochaine_revision_km?: number | null
          site_id?: string | null
          statut?: string
          type_vehicule?: string | null
          updated_at?: string
          vin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "organization_sites"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      trajets_assigned_safe: {
        Row: {
          arrivee: string | null
          arrivee_contact_instructions: string | null
          arrivee_contact_nom: string | null
          arrivee_contact_telephone: string | null
          arrivee_contact_telephone2: string | null
          carte_grise_recto_url: string | null
          carte_grise_verso_url: string | null
          contact_arrivee_nom: string | null
          contact_arrivee_note: string | null
          contact_arrivee_tel: string | null
          contact_depart_nom: string | null
          contact_depart_note: string | null
          contact_depart_tel: string | null
          created_at: string | null
          date_souhaitee: string | null
          date_trajet: string | null
          demande_id: string | null
          depart: string | null
          devis_id: string | null
          heure_trajet: string | null
          id: string | null
          immatriculation: string | null
          leg_type: string | null
          marque: string | null
          mission_group_id: string | null
          modele: string | null
          numero_mission: string | null
          options_meta: Json | null
          prix_convoyeur_fixe: number | null
          prix_suggere: number | null
          published_at: string | null
          pv_digitalise: string | null
          statut: string | null
          statut_publication: string | null
          tarif_convoyeur: number | null
          type_mission: string | null
          updated_at: string | null
          vehicule_couleur: string | null
          vehicule_energie: string | null
          vehicule_immatriculation: string | null
          vehicule_km: number | null
          vehicule_notes: string | null
          vehicule_type: string | null
          vehicule_vin: string | null
          vin: string | null
        }
        Relationships: []
      }
      trajets_client_safe: {
        Row: {
          allow_counter_offer: boolean | null
          archived_at: string | null
          arrivee: string | null
          arrivee_contact_email: string | null
          arrivee_contact_instructions: string | null
          arrivee_contact_nom: string | null
          arrivee_contact_prenom: string | null
          arrivee_contact_societe: string | null
          arrivee_contact_telephone: string | null
          arrivee_contact_telephone2: string | null
          attribution_mode: string | null
          bidding_enabled: boolean | null
          carte_grise_recto_url: string | null
          carte_grise_verso_url: string | null
          client_email: string | null
          client_nom: string | null
          client_telephone: string | null
          commande_ref: string | null
          contact_arrivee_nom: string | null
          contact_arrivee_note: string | null
          contact_arrivee_tel: string | null
          contact_depart_nom: string | null
          contact_depart_note: string | null
          contact_depart_tel: string | null
          created_at: string | null
          date_souhaitee: string | null
          date_trajet: string | null
          demande_id: string | null
          depart: string | null
          devis_id: string | null
          group_reference: string | null
          heure_trajet: string | null
          id: string | null
          immatriculation: string | null
          is_round_trip: boolean | null
          is_test_data: boolean | null
          leg_index: number | null
          leg_type: string | null
          marque: string | null
          mission_group_id: string | null
          mission_id: string | null
          modele: string | null
          niveau_requis: string | null
          numero_mission: string | null
          options_meta: Json | null
          parent_trajet_id: string | null
          pricing_mode: string | null
          prix: number | null
          prix_client: number | null
          prix_total: number | null
          proposal_expires_at: string | null
          published_at: string | null
          pv_digitalise: string | null
          statut: string | null
          statut_publication: string | null
          type_mission: string | null
          updated_at: string | null
          vehicule_couleur: string | null
          vehicule_energie: string | null
          vehicule_immatriculation: string | null
          vehicule_km: number | null
          vehicule_notes: string | null
          vehicule_type: string | null
          vehicule_vin: string | null
          vin: string | null
        }
        Relationships: []
      }
      trajets_publies_safe: {
        Row: {
          allow_counter_offer: boolean | null
          arrivee: string | null
          attribution_mode: string | null
          bidding_enabled: boolean | null
          created_at: string | null
          date_trajet: string | null
          depart: string | null
          heure_trajet: string | null
          id: string | null
          is_test_data: boolean | null
          leg_type: string | null
          marque: string | null
          mission_group_id: string | null
          modele: string | null
          niveau_requis: string | null
          pricing_mode: string | null
          prix_convoyeur: number | null
          prix_convoyeur_fixe: number | null
          prix_convoyeur_max: number | null
          prix_convoyeur_min: number | null
          prix_suggere: number | null
          proposal_expires_at: string | null
          published_at: string | null
          publisher_logo_url: string | null
          publisher_nom: string | null
          publisher_verifie: boolean | null
          statut_publication: string | null
          vehicule_energie: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _trajets_assigned_safe_rows: {
        Args: never
        Returns: {
          arrivee: string
          arrivee_contact_instructions: string
          arrivee_contact_nom: string
          arrivee_contact_telephone: string
          arrivee_contact_telephone2: string
          carte_grise_recto_url: string
          carte_grise_verso_url: string
          contact_arrivee_nom: string
          contact_arrivee_note: string
          contact_arrivee_tel: string
          contact_depart_nom: string
          contact_depart_note: string
          contact_depart_tel: string
          created_at: string
          date_souhaitee: string
          date_trajet: string
          demande_id: string
          depart: string
          devis_id: string
          heure_trajet: string
          id: string
          immatriculation: string
          leg_type: string
          marque: string
          mission_group_id: string
          modele: string
          numero_mission: string
          options_meta: Json
          prix_convoyeur_fixe: number
          prix_suggere: number
          published_at: string
          pv_digitalise: string
          statut: string
          statut_publication: string
          tarif_convoyeur: number
          type_mission: string
          updated_at: string
          vehicule_couleur: string
          vehicule_energie: string
          vehicule_immatriculation: string
          vehicule_km: number
          vehicule_notes: string
          vehicule_type: string
          vehicule_vin: string
          vin: string
        }[]
      }
      _trajets_client_safe_rows: {
        Args: never
        Returns: {
          allow_counter_offer: boolean
          archived_at: string
          arrivee: string
          arrivee_contact_email: string
          arrivee_contact_instructions: string
          arrivee_contact_nom: string
          arrivee_contact_prenom: string
          arrivee_contact_societe: string
          arrivee_contact_telephone: string
          arrivee_contact_telephone2: string
          attribution_mode: string
          bidding_enabled: boolean
          carte_grise_recto_url: string
          carte_grise_verso_url: string
          client_email: string
          client_nom: string
          client_telephone: string
          commande_ref: string
          contact_arrivee_nom: string
          contact_arrivee_note: string
          contact_arrivee_tel: string
          contact_depart_nom: string
          contact_depart_note: string
          contact_depart_tel: string
          created_at: string
          date_souhaitee: string
          date_trajet: string
          demande_id: string
          depart: string
          devis_id: string
          group_reference: string
          heure_trajet: string
          id: string
          immatriculation: string
          is_round_trip: boolean
          is_test_data: boolean
          leg_index: number
          leg_type: string
          marque: string
          mission_group_id: string
          mission_id: string
          modele: string
          niveau_requis: string
          numero_mission: string
          options_meta: Json
          parent_trajet_id: string
          pricing_mode: string
          prix: number
          prix_client: number
          prix_total: number
          proposal_expires_at: string
          published_at: string
          pv_digitalise: string
          statut: string
          statut_publication: string
          type_mission: string
          updated_at: string
          vehicule_couleur: string
          vehicule_energie: string
          vehicule_immatriculation: string
          vehicule_km: number
          vehicule_notes: string
          vehicule_type: string
          vehicule_vin: string
          vin: string
        }[]
      }
      _trajets_publies_safe_rows: {
        Args: never
        Returns: {
          allow_counter_offer: boolean
          arrivee: string
          attribution_mode: string
          bidding_enabled: boolean
          created_at: string
          date_trajet: string
          depart: string
          heure_trajet: string
          id: string
          is_test_data: boolean
          leg_type: string
          marque: string
          mission_group_id: string
          modele: string
          niveau_requis: string
          pricing_mode: string
          prix_convoyeur: number
          prix_convoyeur_fixe: number
          prix_convoyeur_max: number
          prix_convoyeur_min: number
          prix_suggere: number
          proposal_expires_at: string
          published_at: string
          publisher_logo_url: string
          publisher_nom: string
          publisher_verifie: boolean
          statut_publication: string
          vehicule_energie: string
        }[]
      }
      accept_convoyeur_invitation: { Args: { _token: string }; Returns: Json }
      accept_mission_fixe: { Args: { _trajet_id: string }; Returns: string }
      acknowledge_mission_alert: {
        Args: { _alert_id: string }
        Returns: undefined
      }
      admin_assign_convoyeur: {
        Args: { _convoyeur_id: string; _trajet_id: string }
        Returns: string
      }
      admin_award_offer: { Args: { _offre_id: string }; Returns: string }
      admin_cancel_mission:
        | {
            Args: {
              _attribution_id: string
              _cancel_trajet?: boolean
              _categorie: string
              _facturable?: boolean
              _indemnite?: number
              _motif?: string
              _passage_vide?: boolean
            }
            Returns: undefined
          }
        | {
            Args: {
              _apply_group?: boolean
              _attribution_id: string
              _cancel_trajet?: boolean
              _categorie: string
              _facturable?: boolean
              _indemnite?: number
              _motif?: string
              _passage_vide?: boolean
            }
            Returns: number
          }
      admin_cancel_mission_leg: {
        Args: { _mission_id: string }
        Returns: undefined
      }
      admin_convert_demande_to_missions: {
        Args: { _demande_id: string }
        Returns: {
          leg: string
          mission_id: string
          numero: string
        }[]
      }
      admin_convert_devis_to_missions: {
        Args: {
          _converted_by?: string
          _devis_id: string
          _mission_status?: string
        }
        Returns: {
          leg: string
          mission_id: string
          numero: string
        }[]
      }
      admin_counter_offer: {
        Args: { _counter_price: number; _message?: string; _offre_id: string }
        Returns: undefined
      }
      admin_create_convoyeur_invitation: {
        Args: {
          _email: string
          _nom?: string
          _prenom?: string
          _telephone?: string
        }
        Returns: {
          convoyeur_id: string
          invitation_id: string
          token: string
        }[]
      }
      admin_create_test_mission: {
        Args: { _target_convoyeur_id?: string }
        Returns: string
      }
      admin_delete_test_mission: {
        Args: { _trajet_id: string }
        Returns: undefined
      }
      admin_propose_mission_to_convoyeur: {
        Args: {
          _convoyeur_id: string
          _expires_in_hours?: number
          _trajet_id: string
        }
        Returns: string
      }
      admin_publish_to_catalogue: {
        Args: {
          _allow_counter_offer?: boolean
          _expires_in_hours?: number
          _trajet_id: string
        }
        Returns: undefined
      }
      admin_reject_offer: {
        Args: { _offre_id: string; _reason?: string }
        Returns: undefined
      }
      admin_rename_mission_numero: {
        Args: { _attribution_id: string; _numero: string }
        Returns: string
      }
      admin_reset_mission: {
        Args: { _attribution_id: string }
        Returns: undefined
      }
      admin_reset_operational_data: { Args: never; Returns: Json }
      admin_run_alert_detection: { Args: never; Returns: Json }
      admin_set_mission_po: {
        Args: { _apply_group?: boolean; _attribution_id: string; _po: string }
        Returns: number
      }
      admin_set_mission_prix: {
        Args: { _mission_id: string; _prix: number }
        Returns: undefined
      }
      admin_unlink_mission_from_group: {
        Args: { _mission_id: string }
        Returns: undefined
      }
      admin_update_incident: {
        Args: {
          _assigned_to?: string
          _clear_assignation?: boolean
          _commentaire?: string
          _incident_id: string
          _statut?: string
        }
        Returns: undefined
      }
      admin_update_mission_infos: {
        Args: { _patch: Json; _trajet_id: string }
        Returns: Json
      }
      admin_update_trajet_prix: {
        Args: { _prix: number; _prix_convoyeur?: number; _trajet_id: string }
        Returns: Json
      }
      api_emit_event: {
        Args: { _event: string; _mission_id: string; _payload: Json }
        Returns: undefined
      }
      api_rate_bump: {
        Args: { _api_key_id: string; _window: string }
        Returns: number
      }
      auto_archive_old_records: { Args: never; Returns: undefined }
      backfill_missions_from_trajets: { Args: never; Returns: number }
      calculer_remuneration_mission: {
        Args: { _force?: boolean; _trajet_id: string }
        Returns: string
      }
      can_convoyeur_bid_on_trajet: {
        Args: { _convoyeur_id: string; _trajet_id: string }
        Returns: boolean
      }
      can_driver_update_attribution: {
        Args: {
          _attribution_id: string
          _convoyeur_id: string
          _numero_mission: string
          _statut: string
          _trajet_id: string
        }
        Returns: boolean
      }
      canonical_group_numero: { Args: { p_group_id: string }; Returns: string }
      convoyeur_documents_signes: {
        Args: { _user_id: string }
        Returns: boolean
      }
      convoyeur_level_rank: { Args: { _n: string }; Returns: number }
      create_admin_notification: {
        Args: {
          _entity_id?: string
          _entity_type?: string
          _link?: string
          _message?: string
          _metadata?: Json
          _titre: string
          _type: string
        }
        Returns: string
      }
      create_b2b_transport_request: {
        Args: {
          _company_id: string
          _distance_km: number
          _dropoff_address: string
          _estimated_price_ht: number
          _estimated_price_ttc: number
          _notes: string
          _pickup_address: string
          _scheduled_date: string
          _scheduled_time: string
          _urgency: string
          _vehicle_running: boolean
          _vehicle_type: string
        }
        Returns: {
          id: string
          numero: string
        }[]
      }
      create_scan_handoff_session: {
        Args: { _context?: string }
        Returns: {
          expires_at: string
          id: string
          short_code: string
          token: string
        }[]
      }
      create_user_notification: {
        Args: {
          _category?: string
          _dedup_key?: string
          _entity_id?: string
          _entity_type?: string
          _link?: string
          _message?: string
          _metadata?: Json
          _priority?: string
          _titre: string
          _type: string
          _user_id: string
        }
        Returns: string
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      detect_mission_alerts: { Args: never; Returns: Json }
      devis_is_aller_retour: { Args: { _option: string }; Returns: boolean }
      driver_apply_to_mission: {
        Args: {
          _message?: string
          _proposed_price?: number
          _trajet_id: string
        }
        Returns: string
      }
      driver_respond_to_proposal: {
        Args: { _accept: boolean; _attribution_id: string; _reason?: string }
        Returns: undefined
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      expire_stale_proposals: { Args: never; Returns: undefined }
      find_or_create_company: {
        Args: {
          _contact_email: string
          _contact_function?: string
          _contact_name: string
          _contact_phone: string
          _name: string
          _sector?: string
          _siret?: string
          _size?: string
          _type: string
        }
        Returns: string
      }
      gen_tracking_code: { Args: never; Returns: string }
      generate_group_reference: { Args: never; Returns: string }
      get_active_vat_rates: {
        Args: never
        Returns: {
          id: string
          is_active: boolean
          is_default: boolean
          label: string
          rate: number
          sort_order: number
        }[]
      }
      get_ai_settings: {
        Args: never
        Returns: {
          ai_enabled: boolean
          assistance_level: string
          auto_report: boolean
          compare_departure_arrival: boolean
          created_at: string
          detect_battery_level: boolean
          detect_dents: boolean
          detect_equipment: boolean
          detect_fuel_level: boolean
          detect_impacts: boolean
          detect_lights: boolean
          detect_mirrors: boolean
          detect_rims: boolean
          detect_scratches: boolean
          detect_warning_lights: boolean
          detect_windshield: boolean
          id: string
          is_singleton: boolean
          mission_prefill: boolean
          model_overrides: Json
          ocr_documents: boolean
          ocr_odometer: boolean
          photo_assistant: boolean
          smart_suggestions: boolean
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ai_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_company_public_info: {
        Args: never
        Returns: {
          adresse_cp: string
          adresse_ligne1: string
          adresse_pays: string
          adresse_ville: string
          assurance_mention: string
          capital_social: string
          email_contact: string
          forme_juridique: string
          raison_sociale: string
          rcs: string
          signataire_fonction: string
          signataire_nom: string
          siret: string
          site_web: string
          telephone: string
          tva_intra: string
        }[]
      }
      get_convoyeur_invitation: {
        Args: { _token: string }
        Returns: {
          email: string
          expired: boolean
          nom: string
          prenom: string
          status: string
          telephone: string
        }[]
      }
      get_formation_exam_for_driver: { Args: never; Returns: Json }
      get_formation_modules_for_driver: { Args: never; Returns: Json }
      get_my_contrat_status: {
        Args: never
        Returns: {
          charte_incluse: boolean
          charte_signed_at: string
          charte_signed_pdf_path: string
          id: string
          sent_at: string
          signed_at: string
          signed_pdf_path: string
          statut: string
        }[]
      }
      get_public_pricing_display: {
        Args: never
        Returns: {
          currency: string
          default_vat_rate: number
          regime: string
        }[]
      }
      get_training_modules: { Args: never; Returns: Json }
      has_completed_driver_training: {
        Args: { _user_id?: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_attribution_client: {
        Args: { _attribution_id: string; _user_id: string }
        Returns: boolean
      }
      is_mission_client: {
        Args: { _mission_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_privileged_writer: { Args: never; Returns: boolean }
      is_public_app_setting_key: { Args: { _key: string }; Returns: boolean }
      is_validated_convoyeur: { Args: { _user_id: string }; Returns: boolean }
      log_activity: {
        Args: {
          _action: string
          _entity_id?: string
          _entity_type: string
          _metadata?: Json
          _organization_id?: string
        }
        Returns: string
      }
      map_trajet_statut_to_mission: {
        Args: { _statut: string }
        Returns: string
      }
      mission_pickup_ts: {
        Args: { _date: string; _heure: string }
        Returns: string
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      next_devis_numero: { Args: never; Returns: string }
      next_document_number: {
        Args: { _doc_prefix: string; _year?: number }
        Returns: string
      }
      next_mission_number: {
        Args: { _prefix: string; _year?: number }
        Returns: string
      }
      normalize_all_mission_numeros: { Args: never; Returns: number }
      normalize_mission_group_prices: {
        Args: { _group: string }
        Returns: undefined
      }
      normalize_mission_numero: { Args: { p_numero: string }; Returns: string }
      push_scan_handoff_extraction: {
        Args: { _extraction: Json; _token: string }
        Returns: string
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recalculate_company_score: {
        Args: { _company_id: string }
        Returns: undefined
      }
      recompute_convoyeur_niveau: {
        Args: { _convoyeur_id: string }
        Returns: undefined
      }
      refresh_client_km_accounts: { Args: never; Returns: undefined }
      refresh_convoyeur_training_status: {
        Args: { _convoyeur_id: string }
        Returns: undefined
      }
      remu_refresh_totals: { Args: { _remu_id: string }; Returns: undefined }
      resolve_client_pricing_rule: {
        Args: {
          _arrivee: string
          _depart: string
          _email: string
          _is_aller_retour: boolean
          _user_id: string
        }
        Returns: {
          prix_ttc: number
          rule_id: string
        }[]
      }
      resolve_client_pricing_split: {
        Args: {
          _arrivee: string
          _depart: string
          _depart_retour: string
          _email: string
          _user_id: string
        }
        Returns: {
          prix_aller: number
          prix_retour: number
          rule_id_aller: string
          rule_id_retour: string
        }[]
      }
      resolve_mission_alert: { Args: { _alert_id: string }; Returns: undefined }
      resolve_scan_handoff_token: {
        Args: { _token: string }
        Returns: {
          context: string
          expires_at: string
          session_id: string
          status: string
        }[]
      }
      service_convert_demande_to_missions: {
        Args: { _converted_by: string; _demande_id: string }
        Returns: {
          leg: string
          mission_id: string
          numero: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      split_ar_prices: {
        Args: { _total: number }
        Returns: {
          aller: number
          retour: number
        }[]
      }
      submit_case_study: {
        Args: { _choice: number; _module_id: string }
        Returns: Json
      }
      submit_formation_exam: {
        Args: {
          _answers: Json
          _exam_id: string
          _question_indexes: number[]
          _started_at: string
        }
        Returns: Json
      }
      submit_module_quiz: {
        Args: { _answers: Json; _module_id: string }
        Returns: Json
      }
      super_admin_set_role: {
        Args: {
          _actif?: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _target_user_id: string
        }
        Returns: undefined
      }
      sync_trajet_dates_from_devis: {
        Args: { _devis_id: string }
        Returns: undefined
      }
      verify_certificate: {
        Args: { _token: string }
        Returns: {
          certificate_number: string
          full_name: string
          issued_at: string
          valid: boolean
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "convoyeur"
        | "client"
        | "super_admin"
        | "manager"
        | "sous_traitant"
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
      app_role: [
        "admin",
        "convoyeur",
        "client",
        "super_admin",
        "manager",
        "sous_traitant",
      ],
    },
  },
} as const
