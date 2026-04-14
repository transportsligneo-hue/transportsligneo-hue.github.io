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
      attributions: {
        Row: {
          convoyeur_id: string
          created_at: string
          id: string
          statut: string
          trajet_id: string
          updated_at: string
        }
        Insert: {
          convoyeur_id: string
          created_at?: string
          id?: string
          statut?: string
          trajet_id: string
          updated_at?: string
        }
        Update: {
          convoyeur_id?: string
          created_at?: string
          id?: string
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
        ]
      }
      convoyeurs: {
        Row: {
          created_at: string
          email: string
          id: string
          nom: string
          prenom: string
          statut: string
          telephone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          nom: string
          prenom: string
          statut?: string
          telephone: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nom?: string
          prenom?: string
          statut?: string
          telephone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      demandes_convoyage: {
        Row: {
          arrivee: string
          carburant: string | null
          created_at: string
          date_souhaitee: string | null
          depart: string
          email: string
          heure_souhaitee: string | null
          id: string
          immatriculation: string | null
          marque: string | null
          message: string | null
          modele: string | null
          nom: string
          options: string | null
          prenom: string
          statut: string
          telephone: string | null
          updated_at: string
        }
        Insert: {
          arrivee: string
          carburant?: string | null
          created_at?: string
          date_souhaitee?: string | null
          depart: string
          email: string
          heure_souhaitee?: string | null
          id?: string
          immatriculation?: string | null
          marque?: string | null
          message?: string | null
          modele?: string | null
          nom: string
          options?: string | null
          prenom: string
          statut?: string
          telephone?: string | null
          updated_at?: string
        }
        Update: {
          arrivee?: string
          carburant?: string | null
          created_at?: string
          date_souhaitee?: string | null
          depart?: string
          email?: string
          heure_souhaitee?: string | null
          id?: string
          immatriculation?: string | null
          marque?: string | null
          message?: string | null
          modele?: string | null
          nom?: string
          options?: string | null
          prenom?: string
          statut?: string
          telephone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      documents_convoyeurs: {
        Row: {
          convoyeur_id: string
          created_at: string
          id: string
          nom_fichier: string
          type_document: string
          url_fichier: string
        }
        Insert: {
          convoyeur_id: string
          created_at?: string
          id?: string
          nom_fichier: string
          type_document: string
          url_fichier: string
        }
        Update: {
          convoyeur_id?: string
          created_at?: string
          id?: string
          nom_fichier?: string
          type_document?: string
          url_fichier?: string
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
      inspection_photos: {
        Row: {
          created_at: string
          id: string
          inspection_id: string
          notes: string | null
          url_photo: string
          vue_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          inspection_id: string
          notes?: string | null
          url_photo: string
          vue_type: string
        }
        Update: {
          created_at?: string
          id?: string
          inspection_id?: string
          notes?: string | null
          url_photo?: string
          vue_type?: string
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
          id: string
          notes: string | null
          statut: string
          type: string
          updated_at: string
        }
        Insert: {
          attribution_id: string
          created_at?: string
          id?: string
          notes?: string | null
          statut?: string
          type: string
          updated_at?: string
        }
        Update: {
          attribution_id?: string
          created_at?: string
          id?: string
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
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nom: string
          prenom: string
          telephone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          nom?: string
          prenom?: string
          telephone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nom?: string
          prenom?: string
          telephone?: string | null
          updated_at?: string
          user_id?: string
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
          client_email: string | null
          client_nom: string | null
          client_telephone: string | null
          created_at: string
          date_trajet: string | null
          demande_id: string | null
          depart: string
          heure_trajet: string | null
          id: string
          immatriculation: string | null
          marque: string | null
          modele: string | null
          notes_internes: string | null
          prix: number | null
          statut: string
          updated_at: string
        }
        Insert: {
          arrivee: string
          client_email?: string | null
          client_nom?: string | null
          client_telephone?: string | null
          created_at?: string
          date_trajet?: string | null
          demande_id?: string | null
          depart: string
          heure_trajet?: string | null
          id?: string
          immatriculation?: string | null
          marque?: string | null
          modele?: string | null
          notes_internes?: string | null
          prix?: number | null
          statut?: string
          updated_at?: string
        }
        Update: {
          arrivee?: string
          client_email?: string | null
          client_nom?: string | null
          client_telephone?: string | null
          created_at?: string
          date_trajet?: string | null
          demande_id?: string | null
          depart?: string
          heure_trajet?: string | null
          id?: string
          immatriculation?: string | null
          marque?: string | null
          modele?: string | null
          notes_internes?: string | null
          prix?: number | null
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trajets_demande_id_fkey"
            columns: ["demande_id"]
            isOneToOne: false
            referencedRelation: "demandes_convoyage"
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
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "convoyeur"
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
      app_role: ["admin", "convoyeur"],
    },
  },
} as const
