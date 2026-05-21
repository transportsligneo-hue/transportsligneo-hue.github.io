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
          ip_address: string | null
          metadata: Json | null
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
          ip_address?: string | null
          metadata?: Json | null
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
          ip_address?: string | null
          metadata?: Json | null
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
      attributions: {
        Row: {
          convoyeur_id: string
          created_at: string
          etape_courante: string | null
          id: string
          numero_mission: string | null
          options_completion: Json
          pdf_share_client: boolean
          statut: string
          trajet_id: string
          updated_at: string
        }
        Insert: {
          convoyeur_id: string
          created_at?: string
          etape_courante?: string | null
          id?: string
          numero_mission?: string | null
          options_completion?: Json
          pdf_share_client?: boolean
          statut?: string
          trajet_id: string
          updated_at?: string
        }
        Update: {
          convoyeur_id?: string
          created_at?: string
          etape_courante?: string | null
          id?: string
          numero_mission?: string | null
          options_completion?: Json
          pdf_share_client?: boolean
          statut?: string
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
          {
            foreignKeyName: "attributions_trajet_id_fkey"
            columns: ["trajet_id"]
            isOneToOne: false
            referencedRelation: "trajets_publies_safe"
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
          internal_notes: string | null
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
          internal_notes?: string | null
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
          internal_notes?: string | null
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
      client_pricing_rules: {
        Row: {
          active: boolean
          client_email: string
          client_user_id: string | null
          created_at: string
          created_by: string | null
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
          client_user_id?: string | null
          created_at?: string
          created_by?: string | null
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
          client_user_id?: string | null
          created_at?: string
          created_by?: string | null
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
      convoyeurs: {
        Row: {
          account_status: string
          annees_experience: number | null
          created_at: string
          disponibilite: string | null
          email: string
          id: string
          message: string | null
          nom: string
          organization_id: string | null
          permis: string | null
          permis_numero: string | null
          permis_photo_url: string | null
          prenom: string
          statut: string
          telephone: string
          type_convoyeur: string
          updated_at: string
          user_id: string
          ville: string | null
        }
        Insert: {
          account_status?: string
          annees_experience?: number | null
          created_at?: string
          disponibilite?: string | null
          email: string
          id?: string
          message?: string | null
          nom: string
          organization_id?: string | null
          permis?: string | null
          permis_numero?: string | null
          permis_photo_url?: string | null
          prenom: string
          statut?: string
          telephone: string
          type_convoyeur?: string
          updated_at?: string
          user_id: string
          ville?: string | null
        }
        Update: {
          account_status?: string
          annees_experience?: number | null
          created_at?: string
          disponibilite?: string | null
          email?: string
          id?: string
          message?: string | null
          nom?: string
          organization_id?: string | null
          permis?: string | null
          permis_numero?: string | null
          permis_photo_url?: string | null
          prenom?: string
          statut?: string
          telephone?: string
          type_convoyeur?: string
          updated_at?: string
          user_id?: string
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
        ]
      }
      demandes_convoyage: {
        Row: {
          amount_paid_cents: number | null
          arrivee: string
          arrivee_retour: string | null
          carburant: string | null
          contact_arrivee_nom: string | null
          contact_arrivee_note: string | null
          contact_arrivee_tel: string | null
          contact_depart_nom: string | null
          contact_depart_note: string | null
          contact_depart_tel: string | null
          created_at: string
          date_souhaitee: string | null
          default_address_id: string | null
          depart: string
          depart_retour: string | null
          distance_km: number | null
          email: string
          heure_souhaitee: string | null
          id: string
          immatriculation: string | null
          immatriculation_retour: string | null
          marque: string | null
          marque_retour: string | null
          message: string | null
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
          amount_paid_cents?: number | null
          arrivee: string
          arrivee_retour?: string | null
          carburant?: string | null
          contact_arrivee_nom?: string | null
          contact_arrivee_note?: string | null
          contact_arrivee_tel?: string | null
          contact_depart_nom?: string | null
          contact_depart_note?: string | null
          contact_depart_tel?: string | null
          created_at?: string
          date_souhaitee?: string | null
          default_address_id?: string | null
          depart: string
          depart_retour?: string | null
          distance_km?: number | null
          email: string
          heure_souhaitee?: string | null
          id?: string
          immatriculation?: string | null
          immatriculation_retour?: string | null
          marque?: string | null
          marque_retour?: string | null
          message?: string | null
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
          amount_paid_cents?: number | null
          arrivee?: string
          arrivee_retour?: string | null
          carburant?: string | null
          contact_arrivee_nom?: string | null
          contact_arrivee_note?: string | null
          contact_arrivee_tel?: string | null
          contact_depart_nom?: string | null
          contact_depart_note?: string | null
          contact_depart_tel?: string | null
          created_at?: string
          date_souhaitee?: string | null
          default_address_id?: string | null
          depart?: string
          depart_retour?: string | null
          distance_km?: number | null
          email?: string
          heure_souhaitee?: string | null
          id?: string
          immatriculation?: string | null
          immatriculation_retour?: string | null
          marque?: string | null
          marque_retour?: string | null
          message?: string | null
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
        Relationships: []
      }
      devis: {
        Row: {
          amount_paid_cents: number | null
          arrivee: string
          arrivee_retour: string | null
          carburant: string | null
          carte_grise_recto_url: string | null
          carte_grise_verso_url: string | null
          contact_arrivee_nom: string | null
          contact_arrivee_note: string | null
          contact_arrivee_tel: string | null
          contact_depart_nom: string | null
          contact_depart_note: string | null
          contact_depart_tel: string | null
          converted_at: string | null
          converted_by: string | null
          created_at: string
          date_souhaitee: string | null
          depart: string
          depart_retour: string | null
          distance_km: number | null
          duree_estimee: string | null
          email: string
          email_envoye: boolean
          heure_souhaitee: string | null
          id: string
          immatriculation_retour: string | null
          marque: string | null
          marque_retour: string | null
          message: string | null
          mission_id: string | null
          modele: string | null
          modele_retour: string | null
          multiplier_label: string | null
          nom: string
          numero: string
          option_trajet: string | null
          paid_at: string | null
          pdf_url: string | null
          prenom: string
          prestation: string | null
          prix_base: number | null
          prix_estime: number
          statut: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          tarif_label: string | null
          telephone: string | null
          type_vehicule: string | null
          updated_at: string
          user_id: string | null
          vehicule_docs_completed: boolean
          vin: string | null
          vin_retour: string | null
        }
        Insert: {
          amount_paid_cents?: number | null
          arrivee: string
          arrivee_retour?: string | null
          carburant?: string | null
          carte_grise_recto_url?: string | null
          carte_grise_verso_url?: string | null
          contact_arrivee_nom?: string | null
          contact_arrivee_note?: string | null
          contact_arrivee_tel?: string | null
          contact_depart_nom?: string | null
          contact_depart_note?: string | null
          contact_depart_tel?: string | null
          converted_at?: string | null
          converted_by?: string | null
          created_at?: string
          date_souhaitee?: string | null
          depart: string
          depart_retour?: string | null
          distance_km?: number | null
          duree_estimee?: string | null
          email: string
          email_envoye?: boolean
          heure_souhaitee?: string | null
          id?: string
          immatriculation_retour?: string | null
          marque?: string | null
          marque_retour?: string | null
          message?: string | null
          mission_id?: string | null
          modele?: string | null
          modele_retour?: string | null
          multiplier_label?: string | null
          nom: string
          numero?: string
          option_trajet?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          prenom: string
          prestation?: string | null
          prix_base?: number | null
          prix_estime: number
          statut?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          tarif_label?: string | null
          telephone?: string | null
          type_vehicule?: string | null
          updated_at?: string
          user_id?: string | null
          vehicule_docs_completed?: boolean
          vin?: string | null
          vin_retour?: string | null
        }
        Update: {
          amount_paid_cents?: number | null
          arrivee?: string
          arrivee_retour?: string | null
          carburant?: string | null
          carte_grise_recto_url?: string | null
          carte_grise_verso_url?: string | null
          contact_arrivee_nom?: string | null
          contact_arrivee_note?: string | null
          contact_arrivee_tel?: string | null
          contact_depart_nom?: string | null
          contact_depart_note?: string | null
          contact_depart_tel?: string | null
          converted_at?: string | null
          converted_by?: string | null
          created_at?: string
          date_souhaitee?: string | null
          depart?: string
          depart_retour?: string | null
          distance_km?: number | null
          duree_estimee?: string | null
          email?: string
          email_envoye?: boolean
          heure_souhaitee?: string | null
          id?: string
          immatriculation_retour?: string | null
          marque?: string | null
          marque_retour?: string | null
          message?: string | null
          mission_id?: string | null
          modele?: string | null
          modele_retour?: string | null
          multiplier_label?: string | null
          nom?: string
          numero?: string
          option_trajet?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          prenom?: string
          prestation?: string | null
          prix_base?: number | null
          prix_estime?: number
          statut?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          tarif_label?: string | null
          telephone?: string | null
          type_vehicule?: string | null
          updated_at?: string
          user_id?: string | null
          vehicule_docs_completed?: boolean
          vin?: string | null
          vin_retour?: string | null
        }
        Relationships: []
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
          statut: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          tva_taux: number
          type_facture: string
          updated_at: string
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
          statut?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          tva_taux?: number
          type_facture?: string
          updated_at?: string
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
          statut?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          tva_taux?: number
          type_facture?: string
          updated_at?: string
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
      mission_documents: {
        Row: {
          attribution_id: string
          created_at: string
          id: string
          nom_fichier: string
          type_document: string
          uploaded_by: string
          url_fichier: string
        }
        Insert: {
          attribution_id: string
          created_at?: string
          id?: string
          nom_fichier: string
          type_document?: string
          uploaded_by: string
          url_fichier: string
        }
        Update: {
          attribution_id?: string
          created_at?: string
          id?: string
          nom_fichier?: string
          type_document?: string
          uploaded_by?: string
          url_fichier?: string
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
          attribution_id: string
          convoyeur_user_id: string
          created_at: string
          description: string
          gravite: string
          id: string
          latitude: number | null
          longitude: number | null
          photos: Json | null
          reponse_admin: string | null
          resolu_at: string | null
          statut: string
          titre: string
          updated_at: string
        }
        Insert: {
          attribution_id: string
          convoyeur_user_id: string
          created_at?: string
          description: string
          gravite?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          photos?: Json | null
          reponse_admin?: string | null
          resolu_at?: string | null
          statut?: string
          titre: string
          updated_at?: string
        }
        Update: {
          attribution_id?: string
          convoyeur_user_id?: string
          created_at?: string
          description?: string
          gravite?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          photos?: Json | null
          reponse_admin?: string | null
          resolu_at?: string | null
          statut?: string
          titre?: string
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
          convoyeur_id: string
          created_at: string
          id: string
          message: string | null
          prix_propose: number
          prix_suggere_snapshot: number | null
          statut: string
          trajet_id: string
          type_offre: string
          updated_at: string
        }
        Insert: {
          convoyeur_id: string
          created_at?: string
          id?: string
          message?: string | null
          prix_propose: number
          prix_suggere_snapshot?: number | null
          statut?: string
          trajet_id: string
          type_offre?: string
          updated_at?: string
        }
        Update: {
          convoyeur_id?: string
          created_at?: string
          id?: string
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
          {
            foreignKeyName: "mission_offres_trajet_id_fkey"
            columns: ["trajet_id"]
            isOneToOne: false
            referencedRelation: "trajets_publies_safe"
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
          email: string
          fleet_organization_id: string | null
          id: string
          immatriculation: string | null
          marque: string | null
          modele: string | null
          nom: string
          numero: string
          options: Json
          organization_id: string | null
          prenom: string
          prix_total: number
          remarques: string | null
          statut: string
          telephone: string | null
          type_trajet: string
          updated_at: string
          user_id: string
          ville_arrivee: string
          ville_depart: string
          vin: string | null
        }
        Insert: {
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
          email: string
          fleet_organization_id?: string | null
          id?: string
          immatriculation?: string | null
          marque?: string | null
          modele?: string | null
          nom: string
          numero?: string
          options?: Json
          organization_id?: string | null
          prenom: string
          prix_total?: number
          remarques?: string | null
          statut?: string
          telephone?: string | null
          type_trajet?: string
          updated_at?: string
          user_id: string
          ville_arrivee: string
          ville_depart: string
          vin?: string | null
        }
        Update: {
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
          email?: string
          fleet_organization_id?: string | null
          id?: string
          immatriculation?: string | null
          marque?: string | null
          modele?: string | null
          nom?: string
          numero?: string
          options?: Json
          organization_id?: string | null
          prenom?: string
          prix_total?: number
          remarques?: string | null
          statut?: string
          telephone?: string | null
          type_trajet?: string
          updated_at?: string
          user_id?: string
          ville_arrivee?: string
          ville_depart?: string
          vin?: string | null
        }
        Relationships: [
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
      organizations: {
        Row: {
          billing_address: string | null
          billing_email: string | null
          commercial_name: string | null
          created_at: string
          created_by: string | null
          id: string
          legacy_company_id: string | null
          legal_name: string
          notes_internes: string | null
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
          billing_address?: string | null
          billing_email?: string | null
          commercial_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          legacy_company_id?: string | null
          legal_name: string
          notes_internes?: string | null
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
          billing_address?: string | null
          billing_email?: string | null
          commercial_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          legacy_company_id?: string | null
          legal_name?: string
          notes_internes?: string | null
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
      profiles: {
        Row: {
          account_status: string
          adresse: string | null
          adresse_facturation: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          facture_mention_active: boolean
          facture_mention_legale: string | null
          id: string
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
          facture_mention_active?: boolean
          facture_mention_legale?: string | null
          id?: string
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
          facture_mention_active?: boolean
          facture_mention_legale?: string | null
          id?: string
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
          arrivee: string
          arrivee_contact_instructions: string | null
          arrivee_contact_nom: string | null
          arrivee_contact_telephone: string | null
          arrivee_contact_telephone2: string | null
          carte_grise_recto_url: string | null
          carte_grise_verso_url: string | null
          client_email: string | null
          client_nom: string | null
          client_telephone: string | null
          commission_convoyeur_pct: number | null
          contact_arrivee_nom: string | null
          contact_arrivee_note: string | null
          contact_arrivee_tel: string | null
          contact_depart_nom: string | null
          contact_depart_note: string | null
          contact_depart_tel: string | null
          created_at: string
          date_trajet: string | null
          demande_id: string | null
          depart: string
          devis_id: string | null
          heure_trajet: string | null
          id: string
          immatriculation: string | null
          marque: string | null
          modele: string | null
          options_meta: Json
          pricing_mode: string
          prix: number | null
          prix_client: number | null
          prix_convoyeur: number | null
          prix_convoyeur_fixe: number | null
          prix_convoyeur_max: number | null
          prix_convoyeur_min: number | null
          prix_societe: number | null
          prix_suggere: number | null
          published_at: string | null
          statut: string
          statut_publication: string
          tarif_convoyeur: number | null
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
          arrivee: string
          arrivee_contact_instructions?: string | null
          arrivee_contact_nom?: string | null
          arrivee_contact_telephone?: string | null
          arrivee_contact_telephone2?: string | null
          carte_grise_recto_url?: string | null
          carte_grise_verso_url?: string | null
          client_email?: string | null
          client_nom?: string | null
          client_telephone?: string | null
          commission_convoyeur_pct?: number | null
          contact_arrivee_nom?: string | null
          contact_arrivee_note?: string | null
          contact_arrivee_tel?: string | null
          contact_depart_nom?: string | null
          contact_depart_note?: string | null
          contact_depart_tel?: string | null
          created_at?: string
          date_trajet?: string | null
          demande_id?: string | null
          depart: string
          devis_id?: string | null
          heure_trajet?: string | null
          id?: string
          immatriculation?: string | null
          marque?: string | null
          modele?: string | null
          options_meta?: Json
          pricing_mode?: string
          prix?: number | null
          prix_client?: number | null
          prix_convoyeur?: number | null
          prix_convoyeur_fixe?: number | null
          prix_convoyeur_max?: number | null
          prix_convoyeur_min?: number | null
          prix_societe?: number | null
          prix_suggere?: number | null
          published_at?: string | null
          statut?: string
          statut_publication?: string
          tarif_convoyeur?: number | null
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
          arrivee?: string
          arrivee_contact_instructions?: string | null
          arrivee_contact_nom?: string | null
          arrivee_contact_telephone?: string | null
          arrivee_contact_telephone2?: string | null
          carte_grise_recto_url?: string | null
          carte_grise_verso_url?: string | null
          client_email?: string | null
          client_nom?: string | null
          client_telephone?: string | null
          commission_convoyeur_pct?: number | null
          contact_arrivee_nom?: string | null
          contact_arrivee_note?: string | null
          contact_arrivee_tel?: string | null
          contact_depart_nom?: string | null
          contact_depart_note?: string | null
          contact_depart_tel?: string | null
          created_at?: string
          date_trajet?: string | null
          demande_id?: string | null
          depart?: string
          devis_id?: string | null
          heure_trajet?: string | null
          id?: string
          immatriculation?: string | null
          marque?: string | null
          modele?: string | null
          options_meta?: Json
          pricing_mode?: string
          prix?: number | null
          prix_client?: number | null
          prix_convoyeur?: number | null
          prix_convoyeur_fixe?: number | null
          prix_convoyeur_max?: number | null
          prix_convoyeur_min?: number | null
          prix_societe?: number | null
          prix_suggere?: number | null
          published_at?: string | null
          statut?: string
          statut_publication?: string
          tarif_convoyeur?: number | null
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
          {
            foreignKeyName: "trajets_admin_data_trajet_id_fkey"
            columns: ["trajet_id"]
            isOneToOne: true
            referencedRelation: "trajets_publies_safe"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      trajets_publies_safe: {
        Row: {
          arrivee: string | null
          created_at: string | null
          date_trajet: string | null
          depart: string | null
          heure_trajet: string | null
          id: string | null
          marque: string | null
          modele: string | null
          pricing_mode: string | null
          prix_convoyeur_fixe: number | null
          prix_convoyeur_max: number | null
          prix_convoyeur_min: number | null
          prix_suggere: number | null
          statut_publication: string | null
        }
        Insert: {
          arrivee?: string | null
          created_at?: string | null
          date_trajet?: string | null
          depart?: string | null
          heure_trajet?: string | null
          id?: string | null
          marque?: string | null
          modele?: string | null
          pricing_mode?: string | null
          prix_convoyeur_fixe?: number | null
          prix_convoyeur_max?: number | null
          prix_convoyeur_min?: number | null
          prix_suggere?: number | null
          statut_publication?: string | null
        }
        Update: {
          arrivee?: string | null
          created_at?: string | null
          date_trajet?: string | null
          depart?: string | null
          heure_trajet?: string | null
          id?: string | null
          marque?: string | null
          modele?: string | null
          pricing_mode?: string | null
          prix_convoyeur_fixe?: number | null
          prix_convoyeur_max?: number | null
          prix_convoyeur_min?: number | null
          prix_suggere?: number | null
          statut_publication?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_mission_fixe: { Args: { _trajet_id: string }; Returns: string }
      admin_reset_operational_data: { Args: never; Returns: Json }
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
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
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
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      next_document_number: {
        Args: { _doc_prefix: string; _year?: number }
        Returns: string
      }
      next_mission_number: {
        Args: { _prefix: string; _year?: number }
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
