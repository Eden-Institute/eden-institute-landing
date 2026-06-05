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
      actions: {
        Row: {
          action_id: string
          action_name: string
          clinical_examples: string | null
          description: string | null
        }
        Insert: {
          action_id: string
          action_name: string
          clinical_examples?: string | null
          description?: string | null
        }
        Update: {
          action_id?: string
          action_name?: string
          clinical_examples?: string | null
          description?: string | null
        }
        Relationships: []
      }
      analytics_salt: {
        Row: {
          id: number
          salt: string
        }
        Insert: {
          id?: number
          salt?: string
        }
        Update: {
          id?: number
          salt?: string
        }
        Relationships: []
      }
      body_systems: {
        Row: {
          clinical_canonical: boolean
          description: string | null
          system_id: string
          system_name: string
        }
        Insert: {
          clinical_canonical?: boolean
          description?: string | null
          system_id: string
          system_name: string
        }
        Update: {
          clinical_canonical?: boolean
          description?: string | null
          system_id?: string
          system_name?: string
        }
        Relationships: []
      }
      citations: {
        Row: {
          citation_id: string
          page_section: string | null
          quote: string
          source_id: string
        }
        Insert: {
          citation_id: string
          page_section?: string | null
          quote: string
          source_id: string
        }
        Update: {
          citation_id?: string
          page_section?: string | null
          quote?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "citations_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["source_id"]
          },
        ]
      }
      citations_herbs: {
        Row: {
          citation_id: string
          field_cited: string | null
          herb_id: string
          link_id: number
        }
        Insert: {
          citation_id: string
          field_cited?: string | null
          herb_id: string
          link_id?: number
        }
        Update: {
          citation_id?: string
          field_cited?: string | null
          herb_id?: string
          link_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "citations_herbs_citation_id_fkey"
            columns: ["citation_id"]
            isOneToOne: false
            referencedRelation: "citations"
            referencedColumns: ["citation_id"]
          },
          {
            foreignKeyName: "citations_herbs_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "citations_herbs_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_clinical_v"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "citations_herbs_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_directory_v"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "citations_herbs_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_public"
            referencedColumns: ["herb_id"]
          },
        ]
      }
      complaint_synonyms: {
        Row: {
          complaint_id: string
          synonym_id: string
          synonym_phrase: string
        }
        Insert: {
          complaint_id: string
          synonym_id: string
          synonym_phrase: string
        }
        Update: {
          complaint_id?: string
          synonym_id?: string
          synonym_phrase?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_synonyms_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["complaint_id"]
          },
        ]
      }
      complaints: {
        Row: {
          acuity: string | null
          body_system_id: string | null
          complaint_id: string
          complaint_name: string
          description: string | null
          refer_threshold: string | null
          status: string | null
          stewardship_note: string | null
        }
        Insert: {
          acuity?: string | null
          body_system_id?: string | null
          complaint_id: string
          complaint_name: string
          description?: string | null
          refer_threshold?: string | null
          status?: string | null
          stewardship_note?: string | null
        }
        Update: {
          acuity?: string | null
          body_system_id?: string | null
          complaint_id?: string
          complaint_name?: string
          description?: string | null
          refer_threshold?: string | null
          status?: string | null
          stewardship_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaints_body_system_id_fkey"
            columns: ["body_system_id"]
            isOneToOne: false
            referencedRelation: "body_systems"
            referencedColumns: ["system_id"]
          },
        ]
      }
      conditions: {
        Row: {
          body_system_id: string | null
          condition_id: string
          description: string | null
          icd_10: string | null
          name: string
          refer_threshold: string | null
        }
        Insert: {
          body_system_id?: string | null
          condition_id: string
          description?: string | null
          icd_10?: string | null
          name: string
          refer_threshold?: string | null
        }
        Update: {
          body_system_id?: string | null
          condition_id?: string
          description?: string | null
          icd_10?: string | null
          name?: string
          refer_threshold?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conditions_body_system_id_fkey"
            columns: ["body_system_id"]
            isOneToOne: false
            referencedRelation: "body_systems"
            referencedColumns: ["system_id"]
          },
        ]
      }
      constitutions: {
        Row: {
          constitution_id: string
          description: string | null
          name: string
          system: string | null
        }
        Insert: {
          constitution_id: string
          description?: string | null
          name: string
          system?: string | null
        }
        Update: {
          constitution_id?: string
          description?: string | null
          name?: string
          system?: string | null
        }
        Relationships: []
      }
      contraindications: {
        Row: {
          clinical_guidance: string | null
          contraindication_id: string
          herb_id: string
          interacting_entity: string
          mechanism_rationale: string | null
          severity: Database["public"]["Enums"]["severity_level"]
          source_citation: string | null
          type: Database["public"]["Enums"]["contraindication_kind"]
        }
        Insert: {
          clinical_guidance?: string | null
          contraindication_id: string
          herb_id: string
          interacting_entity: string
          mechanism_rationale?: string | null
          severity: Database["public"]["Enums"]["severity_level"]
          source_citation?: string | null
          type: Database["public"]["Enums"]["contraindication_kind"]
        }
        Update: {
          clinical_guidance?: string | null
          contraindication_id?: string
          herb_id?: string
          interacting_entity?: string
          mechanism_rationale?: string | null
          severity?: Database["public"]["Enums"]["severity_level"]
          source_citation?: string | null
          type?: Database["public"]["Enums"]["contraindication_kind"]
        }
        Relationships: [
          {
            foreignKeyName: "contraindications_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "contraindications_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_clinical_v"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "contraindications_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_directory_v"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "contraindications_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_public"
            referencedColumns: ["herb_id"]
          },
        ]
      }
      diagnostic_completions: {
        Row: {
          completed_at: string
          created_at: string
          eden_constitution: string | null
          galenic_temperament:
            | Database["public"]["Enums"]["galenic_temperament_type"]
            | null
          id: string
          person_profile_id: string
          quiz_version: string
          raw_responses: Json | null
          tissue_state_profile: Json | null
          user_id: string
          vital_force_reading:
            | Database["public"]["Enums"]["vital_force_reading_type"]
            | null
        }
        Insert: {
          completed_at?: string
          created_at?: string
          eden_constitution?: string | null
          galenic_temperament?:
            | Database["public"]["Enums"]["galenic_temperament_type"]
            | null
          id?: string
          person_profile_id: string
          quiz_version?: string
          raw_responses?: Json | null
          tissue_state_profile?: Json | null
          user_id: string
          vital_force_reading?:
            | Database["public"]["Enums"]["vital_force_reading_type"]
            | null
        }
        Update: {
          completed_at?: string
          created_at?: string
          eden_constitution?: string | null
          galenic_temperament?:
            | Database["public"]["Enums"]["galenic_temperament_type"]
            | null
          id?: string
          person_profile_id?: string
          quiz_version?: string
          raw_responses?: Json | null
          tissue_state_profile?: Json | null
          user_id?: string
          vital_force_reading?:
            | Database["public"]["Enums"]["vital_force_reading_type"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_completions_person_profile_id_fkey"
            columns: ["person_profile_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_profile_v"
            referencedColumns: ["person_profile_id"]
          },
          {
            foreignKeyName: "diagnostic_completions_person_profile_id_fkey"
            columns: ["person_profile_id"]
            isOneToOne: false
            referencedRelation: "person_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      digest_runs: {
        Row: {
          captures_count: number | null
          completed_at: string | null
          created_at: string
          digest_date: string
          error_message: string | null
          id: string
          status: string
          triggered_at: string
          window_end: string
          window_start: string
        }
        Insert: {
          captures_count?: number | null
          completed_at?: string | null
          created_at?: string
          digest_date: string
          error_message?: string | null
          id?: string
          status?: string
          triggered_at?: string
          window_end: string
          window_start: string
        }
        Update: {
          captures_count?: number | null
          completed_at?: string | null
          created_at?: string
          digest_date?: string
          error_message?: string | null
          id?: string
          status?: string
          triggered_at?: string
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
      doshas: {
        Row: {
          description: string | null
          dosha_id: string
          dosha_name: string
          system: string
        }
        Insert: {
          description?: string | null
          dosha_id: string
          dosha_name: string
          system?: string
        }
        Update: {
          description?: string | null
          dosha_id?: string
          dosha_name?: string
          system?: string
        }
        Relationships: []
      }
      feedback_submissions: {
        Row: {
          auth_user_id: string | null
          context: Json
          created_at: string
          email: string | null
          id: string
          message: string
          page_url: string | null
          user_agent: string | null
        }
        Insert: {
          auth_user_id?: string | null
          context?: Json
          created_at?: string
          email?: string | null
          id?: string
          message: string
          page_url?: string | null
          user_agent?: string | null
        }
        Update: {
          auth_user_id?: string | null
          context?: Json
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          page_url?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      herb_favorites: {
        Row: {
          created_at: string
          herb_id: string
          id: string
          person_profile_id: string
        }
        Insert: {
          created_at?: string
          herb_id: string
          id?: string
          person_profile_id: string
        }
        Update: {
          created_at?: string
          herb_id?: string
          id?: string
          person_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "herb_favorites_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herb_favorites_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_clinical_v"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herb_favorites_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_directory_v"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herb_favorites_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_public"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herb_favorites_person_profile_id_fkey"
            columns: ["person_profile_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_profile_v"
            referencedColumns: ["person_profile_id"]
          },
          {
            foreignKeyName: "herb_favorites_person_profile_id_fkey"
            columns: ["person_profile_id"]
            isOneToOne: false
            referencedRelation: "person_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      herb_synonyms: {
        Row: {
          herb_id: string
          synonym_id: string
          synonym_phrase: string
          type: string | null
        }
        Insert: {
          herb_id: string
          synonym_id: string
          synonym_phrase: string
          type?: string | null
        }
        Update: {
          herb_id?: string
          synonym_id?: string
          synonym_phrase?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "herb_synonyms_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herb_synonyms_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_clinical_v"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herb_synonyms_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_directory_v"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herb_synonyms_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_public"
            referencedColumns: ["herb_id"]
          },
        ]
      }
      herbs: {
        Row: {
          ayurvedic_dosha_aggravates: string | null
          ayurvedic_dosha_match: string | null
          biblical_traditional_reference: string | null
          breastfeeding_safety: string | null
          cautions: string | null
          chief_complaints: string | null
          children_safety: string | null
          common_name: string
          contraindications_general: string | null
          created_date: string | null
          dosage_notes: string | null
          drug_interactions: string | null
          energetics_summary: string | null
          herb_id: string
          image_filename: string | null
          last_updated: string
          latin_name: string
          moisture: string | null
          notes: string | null
          part_used: string | null
          plant_family: string | null
          pregnancy_safety: string | null
          preparation_methods: string | null
          primary_sources: string | null
          primary_text_citation: Json | null
          pronunciation: string | null
          refer_threshold: string | null
          secondary_citation: Json | null
          secondary_sources: string | null
          status: string | null
          stewardship_note: string | null
          system_affinity: string | null
          taste: string | null
          tcm_contraindicated_patterns: string | null
          tcm_pattern_match: string | null
          temperature: string | null
          tier_visibility: Database["public"]["Enums"]["subscription_tier"]
          tissue_states_contraindicated: string | null
          tissue_states_indicated: string | null
          traditional_observations: Json | null
          western_constitution_match: string | null
        }
        Insert: {
          ayurvedic_dosha_aggravates?: string | null
          ayurvedic_dosha_match?: string | null
          biblical_traditional_reference?: string | null
          breastfeeding_safety?: string | null
          cautions?: string | null
          chief_complaints?: string | null
          children_safety?: string | null
          common_name: string
          contraindications_general?: string | null
          created_date?: string | null
          dosage_notes?: string | null
          drug_interactions?: string | null
          energetics_summary?: string | null
          herb_id: string
          image_filename?: string | null
          last_updated?: string
          latin_name: string
          moisture?: string | null
          notes?: string | null
          part_used?: string | null
          plant_family?: string | null
          pregnancy_safety?: string | null
          preparation_methods?: string | null
          primary_sources?: string | null
          primary_text_citation?: Json | null
          pronunciation?: string | null
          refer_threshold?: string | null
          secondary_citation?: Json | null
          secondary_sources?: string | null
          status?: string | null
          stewardship_note?: string | null
          system_affinity?: string | null
          taste?: string | null
          tcm_contraindicated_patterns?: string | null
          tcm_pattern_match?: string | null
          temperature?: string | null
          tier_visibility?: Database["public"]["Enums"]["subscription_tier"]
          tissue_states_contraindicated?: string | null
          tissue_states_indicated?: string | null
          traditional_observations?: Json | null
          western_constitution_match?: string | null
        }
        Update: {
          ayurvedic_dosha_aggravates?: string | null
          ayurvedic_dosha_match?: string | null
          biblical_traditional_reference?: string | null
          breastfeeding_safety?: string | null
          cautions?: string | null
          chief_complaints?: string | null
          children_safety?: string | null
          common_name?: string
          contraindications_general?: string | null
          created_date?: string | null
          dosage_notes?: string | null
          drug_interactions?: string | null
          energetics_summary?: string | null
          herb_id?: string
          image_filename?: string | null
          last_updated?: string
          latin_name?: string
          moisture?: string | null
          notes?: string | null
          part_used?: string | null
          plant_family?: string | null
          pregnancy_safety?: string | null
          preparation_methods?: string | null
          primary_sources?: string | null
          primary_text_citation?: Json | null
          pronunciation?: string | null
          refer_threshold?: string | null
          secondary_citation?: Json | null
          secondary_sources?: string | null
          status?: string | null
          stewardship_note?: string | null
          system_affinity?: string | null
          taste?: string | null
          tcm_contraindicated_patterns?: string | null
          tcm_pattern_match?: string | null
          temperature?: string | null
          tier_visibility?: Database["public"]["Enums"]["subscription_tier"]
          tissue_states_contraindicated?: string | null
          tissue_states_indicated?: string | null
          traditional_observations?: Json | null
          western_constitution_match?: string | null
        }
        Relationships: []
      }
      herbs_actions: {
        Row: {
          action_id: string
          herb_id: string
          link_id: number
          notes: string | null
          strength_of_indication: string | null
        }
        Insert: {
          action_id: string
          herb_id: string
          link_id?: number
          notes?: string | null
          strength_of_indication?: string | null
        }
        Update: {
          action_id?: string
          herb_id?: string
          link_id?: number
          notes?: string | null
          strength_of_indication?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "herbs_actions_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["action_id"]
          },
          {
            foreignKeyName: "herbs_actions_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_actions_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_clinical_v"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_actions_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_directory_v"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_actions_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_public"
            referencedColumns: ["herb_id"]
          },
        ]
      }
      herbs_complaints: {
        Row: {
          complaint_id: string
          herb_id: string
          link_id: number
          notes: string | null
          strength_of_indication: string | null
        }
        Insert: {
          complaint_id: string
          herb_id: string
          link_id?: number
          notes?: string | null
          strength_of_indication?: string | null
        }
        Update: {
          complaint_id?: string
          herb_id?: string
          link_id?: number
          notes?: string | null
          strength_of_indication?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "herbs_complaints_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["complaint_id"]
          },
          {
            foreignKeyName: "herbs_complaints_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_complaints_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_clinical_v"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_complaints_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_directory_v"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_complaints_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_public"
            referencedColumns: ["herb_id"]
          },
        ]
      }
      herbs_constitutions: {
        Row: {
          constitution_id: string
          herb_id: string
          link_id: number
          notes: string | null
          relationship: string | null
          strength_of_indication: string | null
        }
        Insert: {
          constitution_id: string
          herb_id: string
          link_id?: number
          notes?: string | null
          relationship?: string | null
          strength_of_indication?: string | null
        }
        Update: {
          constitution_id?: string
          herb_id?: string
          link_id?: number
          notes?: string | null
          relationship?: string | null
          strength_of_indication?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "herbs_constitutions_constitution_id_fkey"
            columns: ["constitution_id"]
            isOneToOne: false
            referencedRelation: "constitutions"
            referencedColumns: ["constitution_id"]
          },
          {
            foreignKeyName: "herbs_constitutions_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_constitutions_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_clinical_v"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_constitutions_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_directory_v"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_constitutions_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_public"
            referencedColumns: ["herb_id"]
          },
        ]
      }
      herbs_doshas_aggravates: {
        Row: {
          dosha_id: string
          herb_id: string
          link_id: number
          notes: string | null
          strength_of_indication: string | null
        }
        Insert: {
          dosha_id: string
          herb_id: string
          link_id?: number
          notes?: string | null
          strength_of_indication?: string | null
        }
        Update: {
          dosha_id?: string
          herb_id?: string
          link_id?: number
          notes?: string | null
          strength_of_indication?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "herbs_doshas_aggravates_dosha_id_fkey"
            columns: ["dosha_id"]
            isOneToOne: false
            referencedRelation: "doshas"
            referencedColumns: ["dosha_id"]
          },
          {
            foreignKeyName: "herbs_doshas_aggravates_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_doshas_aggravates_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_clinical_v"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_doshas_aggravates_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_directory_v"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_doshas_aggravates_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_public"
            referencedColumns: ["herb_id"]
          },
        ]
      }
      herbs_doshas_match: {
        Row: {
          dosha_id: string
          herb_id: string
          link_id: number
          notes: string | null
          strength_of_indication: string | null
        }
        Insert: {
          dosha_id: string
          herb_id: string
          link_id?: number
          notes?: string | null
          strength_of_indication?: string | null
        }
        Update: {
          dosha_id?: string
          herb_id?: string
          link_id?: number
          notes?: string | null
          strength_of_indication?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "herbs_doshas_match_dosha_id_fkey"
            columns: ["dosha_id"]
            isOneToOne: false
            referencedRelation: "doshas"
            referencedColumns: ["dosha_id"]
          },
          {
            foreignKeyName: "herbs_doshas_match_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_doshas_match_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_clinical_v"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_doshas_match_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_directory_v"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_doshas_match_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_public"
            referencedColumns: ["herb_id"]
          },
        ]
      }
      herbs_preparations: {
        Row: {
          herb_id: string
          link_id: number
          notes: string | null
          prep_id: string
          strength_of_indication: string | null
        }
        Insert: {
          herb_id: string
          link_id?: number
          notes?: string | null
          prep_id: string
          strength_of_indication?: string | null
        }
        Update: {
          herb_id?: string
          link_id?: number
          notes?: string | null
          prep_id?: string
          strength_of_indication?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "herbs_preparations_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_preparations_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_clinical_v"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_preparations_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_directory_v"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_preparations_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_public"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_preparations_prep_id_fkey"
            columns: ["prep_id"]
            isOneToOne: false
            referencedRelation: "preparations"
            referencedColumns: ["prep_id"]
          },
        ]
      }
      herbs_systems: {
        Row: {
          herb_id: string
          link_id: number
          notes: string | null
          strength_of_indication: string | null
          system_id: string
        }
        Insert: {
          herb_id: string
          link_id?: number
          notes?: string | null
          strength_of_indication?: string | null
          system_id: string
        }
        Update: {
          herb_id?: string
          link_id?: number
          notes?: string | null
          strength_of_indication?: string | null
          system_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "herbs_systems_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_systems_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_clinical_v"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_systems_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_directory_v"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_systems_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_public"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_systems_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "body_systems"
            referencedColumns: ["system_id"]
          },
        ]
      }
      herbs_tastes: {
        Row: {
          herb_id: string
          link_id: number
          taste_id: string
        }
        Insert: {
          herb_id: string
          link_id?: number
          taste_id: string
        }
        Update: {
          herb_id?: string
          link_id?: number
          taste_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "herbs_tastes_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_tastes_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_clinical_v"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_tastes_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_directory_v"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_tastes_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_public"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_tastes_taste_id_fkey"
            columns: ["taste_id"]
            isOneToOne: false
            referencedRelation: "tastes"
            referencedColumns: ["taste_id"]
          },
        ]
      }
      herbs_tcm_contraindicated: {
        Row: {
          herb_id: string
          link_id: number
          notes: string | null
          pattern_id: string
          strength_of_indication: string | null
        }
        Insert: {
          herb_id: string
          link_id?: number
          notes?: string | null
          pattern_id: string
          strength_of_indication?: string | null
        }
        Update: {
          herb_id?: string
          link_id?: number
          notes?: string | null
          pattern_id?: string
          strength_of_indication?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "herbs_tcm_contraindicated_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_tcm_contraindicated_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_clinical_v"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_tcm_contraindicated_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_directory_v"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_tcm_contraindicated_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_public"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_tcm_contraindicated_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "tcm_patterns"
            referencedColumns: ["pattern_id"]
          },
        ]
      }
      herbs_tcm_indicated: {
        Row: {
          herb_id: string
          link_id: number
          notes: string | null
          pattern_id: string
          strength_of_indication: string | null
        }
        Insert: {
          herb_id: string
          link_id?: number
          notes?: string | null
          pattern_id: string
          strength_of_indication?: string | null
        }
        Update: {
          herb_id?: string
          link_id?: number
          notes?: string | null
          pattern_id?: string
          strength_of_indication?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "herbs_tcm_indicated_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_tcm_indicated_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_clinical_v"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_tcm_indicated_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_directory_v"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_tcm_indicated_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_public"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_tcm_indicated_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "tcm_patterns"
            referencedColumns: ["pattern_id"]
          },
        ]
      }
      herbs_tissue_states_contraindicated: {
        Row: {
          herb_id: string
          link_id: number
          notes: string | null
          state_id: string
          strength_of_indication: string | null
        }
        Insert: {
          herb_id: string
          link_id?: number
          notes?: string | null
          state_id: string
          strength_of_indication?: string | null
        }
        Update: {
          herb_id?: string
          link_id?: number
          notes?: string | null
          state_id?: string
          strength_of_indication?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "herbs_tissue_states_contraindicated_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_tissue_states_contraindicated_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_clinical_v"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_tissue_states_contraindicated_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_directory_v"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_tissue_states_contraindicated_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_public"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_tissue_states_contraindicated_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "tissue_states"
            referencedColumns: ["state_id"]
          },
        ]
      }
      herbs_tissue_states_indicated: {
        Row: {
          herb_id: string
          link_id: number
          notes: string | null
          state_id: string
          strength_of_indication: string | null
        }
        Insert: {
          herb_id: string
          link_id?: number
          notes?: string | null
          state_id: string
          strength_of_indication?: string | null
        }
        Update: {
          herb_id?: string
          link_id?: number
          notes?: string | null
          state_id?: string
          strength_of_indication?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "herbs_tissue_states_indicated_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_tissue_states_indicated_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_clinical_v"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_tissue_states_indicated_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_directory_v"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_tissue_states_indicated_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_public"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "herbs_tissue_states_indicated_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "tissue_states"
            referencedColumns: ["state_id"]
          },
        ]
      }
      internal_testers: {
        Row: {
          created_at: string
          email: string
          note: string | null
        }
        Insert: {
          created_at?: string
          email: string
          note?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          note?: string | null
        }
        Relationships: []
      }
      magnet_email_queue: {
        Row: {
          band: string
          created_at: string
          error_message: string | null
          first_name: string | null
          id: string
          recipient_email: string
          retry_count: number
          scheduled_for: string
          sent_at: string | null
          sequence_position: number
          status: string
          updated_at: string
        }
        Insert: {
          band: string
          created_at?: string
          error_message?: string | null
          first_name?: string | null
          id?: string
          recipient_email: string
          retry_count?: number
          scheduled_for: string
          sent_at?: string | null
          sequence_position: number
          status?: string
          updated_at?: string
        }
        Update: {
          band?: string
          created_at?: string
          error_message?: string | null
          first_name?: string | null
          id?: string
          recipient_email?: string
          retry_count?: number
          scheduled_for?: string
          sent_at?: string | null
          sequence_position?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      nurture_email_queue: {
        Row: {
          constitution_pattern: string | null
          created_at: string
          error_message: string | null
          id: string
          recipient_email: string
          retry_count: number
          scheduled_for: string
          sent_at: string | null
          sequence_position: number
          status: string
          updated_at: string
        }
        Insert: {
          constitution_pattern?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          recipient_email: string
          retry_count?: number
          scheduled_for: string
          sent_at?: string | null
          sequence_position: number
          status?: string
          updated_at?: string
        }
        Update: {
          constitution_pattern?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          recipient_email?: string
          retry_count?: number
          scheduled_for?: string
          sent_at?: string | null
          sequence_position?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      page_views: {
        Row: {
          id: string
          is_bot: boolean
          occurred_at: string
          path: string
          referrer_host: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          visitor_hash: string | null
        }
        Insert: {
          id?: string
          is_bot?: boolean
          occurred_at?: string
          path: string
          referrer_host?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visitor_hash?: string | null
        }
        Update: {
          id?: string
          is_bot?: boolean
          occurred_at?: string
          path?: string
          referrer_host?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visitor_hash?: string | null
        }
        Relationships: []
      }
      person_profile_tissue_states: {
        Row: {
          body_system_id: string
          completion_id: string | null
          person_profile_id: string
          recorded_at: string
          tissue_state_id: string
          updated_at: string
        }
        Insert: {
          body_system_id: string
          completion_id?: string | null
          person_profile_id: string
          recorded_at?: string
          tissue_state_id: string
          updated_at?: string
        }
        Update: {
          body_system_id?: string
          completion_id?: string | null
          person_profile_id?: string
          recorded_at?: string
          tissue_state_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_profile_tissue_states_body_system_id_fkey"
            columns: ["body_system_id"]
            isOneToOne: false
            referencedRelation: "body_systems"
            referencedColumns: ["system_id"]
          },
          {
            foreignKeyName: "person_profile_tissue_states_completion_id_fkey"
            columns: ["completion_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_completions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_profile_tissue_states_person_profile_id_fkey"
            columns: ["person_profile_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_profile_v"
            referencedColumns: ["person_profile_id"]
          },
          {
            foreignKeyName: "person_profile_tissue_states_person_profile_id_fkey"
            columns: ["person_profile_id"]
            isOneToOne: false
            referencedRelation: "person_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_profile_tissue_states_tissue_state_id_fkey"
            columns: ["tissue_state_id"]
            isOneToOne: false
            referencedRelation: "tissue_states"
            referencedColumns: ["state_id"]
          },
        ]
      }
      person_profiles: {
        Row: {
          allergies: string | null
          biological_sex:
            | Database["public"]["Enums"]["biological_sex_enum"]
            | null
          conditions: string | null
          created_at: string
          date_of_birth: string | null
          diagnostic_completed_at: string | null
          eden_constitution: string | null
          galenic_temperament:
            | Database["public"]["Enums"]["galenic_temperament_type"]
            | null
          id: string
          is_self: boolean
          medications: string | null
          name: string
          notes: string | null
          profile_kind: Database["public"]["Enums"]["profile_kind_enum"] | null
          updated_at: string
          user_id: string
          vital_force_reading:
            | Database["public"]["Enums"]["vital_force_reading_type"]
            | null
        }
        Insert: {
          allergies?: string | null
          biological_sex?:
            | Database["public"]["Enums"]["biological_sex_enum"]
            | null
          conditions?: string | null
          created_at?: string
          date_of_birth?: string | null
          diagnostic_completed_at?: string | null
          eden_constitution?: string | null
          galenic_temperament?:
            | Database["public"]["Enums"]["galenic_temperament_type"]
            | null
          id?: string
          is_self?: boolean
          medications?: string | null
          name: string
          notes?: string | null
          profile_kind?: Database["public"]["Enums"]["profile_kind_enum"] | null
          updated_at?: string
          user_id: string
          vital_force_reading?:
            | Database["public"]["Enums"]["vital_force_reading_type"]
            | null
        }
        Update: {
          allergies?: string | null
          biological_sex?:
            | Database["public"]["Enums"]["biological_sex_enum"]
            | null
          conditions?: string | null
          created_at?: string
          date_of_birth?: string | null
          diagnostic_completed_at?: string | null
          eden_constitution?: string | null
          galenic_temperament?:
            | Database["public"]["Enums"]["galenic_temperament_type"]
            | null
          id?: string
          is_self?: boolean
          medications?: string | null
          name?: string
          notes?: string | null
          profile_kind?: Database["public"]["Enums"]["profile_kind_enum"] | null
          updated_at?: string
          user_id?: string
          vital_force_reading?:
            | Database["public"]["Enums"]["vital_force_reading_type"]
            | null
        }
        Relationships: []
      }
      preparations: {
        Row: {
          description: string | null
          prep_id: string
          preparation_name: string
        }
        Insert: {
          description?: string | null
          prep_id: string
          preparation_name: string
        }
        Update: {
          description?: string | null
          prep_id?: string
          preparation_name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          cancel_at_period_end: boolean | null
          constitution_type: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          display_name: string | null
          email: string | null
          founding_rate_price_id: string | null
          is_founding_member: boolean
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          constitution_type?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          display_name?: string | null
          email?: string | null
          founding_rate_price_id?: string | null
          is_founding_member?: boolean
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          constitution_type?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          display_name?: string | null
          email?: string | null
          founding_rate_price_id?: string | null
          is_founding_member?: boolean
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quiz_completion_failures: {
        Row: {
          ef_error_message: string | null
          id: string
          last_retry_at: string | null
          last_retry_body: string | null
          last_retry_status: number | null
          notes: string | null
          postgrest_body: string | null
          postgrest_status: number | null
          raw_payload: Json
          received_at: string
          resolved_at: string | null
          resolved_quiz_completion_id: string | null
          retry_count: number
        }
        Insert: {
          ef_error_message?: string | null
          id?: string
          last_retry_at?: string | null
          last_retry_body?: string | null
          last_retry_status?: number | null
          notes?: string | null
          postgrest_body?: string | null
          postgrest_status?: number | null
          raw_payload: Json
          received_at?: string
          resolved_at?: string | null
          resolved_quiz_completion_id?: string | null
          retry_count?: number
        }
        Update: {
          ef_error_message?: string | null
          id?: string
          last_retry_at?: string | null
          last_retry_body?: string | null
          last_retry_status?: number | null
          notes?: string | null
          postgrest_body?: string | null
          postgrest_status?: number | null
          raw_payload?: Json
          received_at?: string
          resolved_at?: string | null
          resolved_quiz_completion_id?: string | null
          retry_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_completion_failures_resolved_quiz_completion_id_fkey"
            columns: ["resolved_quiz_completion_id"]
            isOneToOne: false
            referencedRelation: "quiz_completions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_completions: {
        Row: {
          completed_at: string
          constitution_name: string | null
          constitution_nickname: string | null
          constitution_type: string | null
          email: string
          email_1_sent_at: string | null
          email_2_sent_at: string | null
          email_3_sent_at: string | null
          email_4_sent_at: string | null
          email_5_sent_at: string | null
          first_name: string | null
          id: string
          purchased_course: boolean
          purchased_guide: boolean
        }
        Insert: {
          completed_at?: string
          constitution_name?: string | null
          constitution_nickname?: string | null
          constitution_type?: string | null
          email: string
          email_1_sent_at?: string | null
          email_2_sent_at?: string | null
          email_3_sent_at?: string | null
          email_4_sent_at?: string | null
          email_5_sent_at?: string | null
          first_name?: string | null
          id?: string
          purchased_course?: boolean
          purchased_guide?: boolean
        }
        Update: {
          completed_at?: string
          constitution_name?: string | null
          constitution_nickname?: string | null
          constitution_type?: string | null
          email?: string
          email_1_sent_at?: string | null
          email_2_sent_at?: string | null
          email_3_sent_at?: string | null
          email_4_sent_at?: string | null
          email_5_sent_at?: string | null
          first_name?: string | null
          id?: string
          purchased_course?: boolean
          purchased_guide?: boolean
        }
        Relationships: []
      }
      refer_out_triggers: {
        Row: {
          action: string
          severity: Database["public"]["Enums"]["severity_level"]
          trigger_description: string
          trigger_id: string
        }
        Insert: {
          action: string
          severity: Database["public"]["Enums"]["severity_level"]
          trigger_description: string
          trigger_id: string
        }
        Update: {
          action?: string
          severity?: Database["public"]["Enums"]["severity_level"]
          trigger_description?: string
          trigger_id?: string
        }
        Relationships: []
      }
      schema_fields: {
        Row: {
          column_name: string | null
          description: string | null
          display_name: string | null
          field_id: string
          sheet: string | null
          tier: string | null
        }
        Insert: {
          column_name?: string | null
          description?: string | null
          display_name?: string | null
          field_id: string
          sheet?: string | null
          tier?: string | null
        }
        Update: {
          column_name?: string | null
          description?: string | null
          display_name?: string | null
          field_id?: string
          sheet?: string | null
          tier?: string | null
        }
        Relationships: []
      }
      schema_version: {
        Row: {
          description: string | null
          migration_notes: string | null
          release_date: string | null
          version: string
        }
        Insert: {
          description?: string | null
          migration_notes?: string | null
          release_date?: string | null
          version: string
        }
        Update: {
          description?: string | null
          migration_notes?: string | null
          release_date?: string | null
          version?: string
        }
        Relationships: []
      }
      sources: {
        Row: {
          full_citation: string
          public_domain:
            | Database["public"]["Enums"]["public_domain_flag"]
            | null
          short_name: string
          source_id: string
          tradition: string | null
          url: string | null
          year: string | null
        }
        Insert: {
          full_citation: string
          public_domain?:
            | Database["public"]["Enums"]["public_domain_flag"]
            | null
          short_name: string
          source_id: string
          tradition?: string | null
          url?: string | null
          year?: string | null
        }
        Update: {
          full_citation?: string
          public_domain?:
            | Database["public"]["Enums"]["public_domain_flag"]
            | null
          short_name?: string
          source_id?: string
          tradition?: string | null
          url?: string | null
          year?: string | null
        }
        Relationships: []
      }
      subscription_events: {
        Row: {
          event_id: string
          payload: Json
          received_at: string
          stripe_event_id: string | null
          stripe_event_type: string
          user_id: string | null
        }
        Insert: {
          event_id?: string
          payload: Json
          received_at?: string
          stripe_event_id?: string | null
          stripe_event_type: string
          user_id?: string | null
        }
        Update: {
          event_id?: string
          payload?: Json
          received_at?: string
          stripe_event_id?: string | null
          stripe_event_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tastes: {
        Row: {
          taste_id: string
          taste_name: string
        }
        Insert: {
          taste_id: string
          taste_name: string
        }
        Update: {
          taste_id?: string
          taste_name?: string
        }
        Relationships: []
      }
      tcm_patterns: {
        Row: {
          category: string | null
          description: string | null
          pattern_id: string
          pattern_name: string
        }
        Insert: {
          category?: string | null
          description?: string | null
          pattern_id: string
          pattern_name: string
        }
        Update: {
          category?: string | null
          description?: string | null
          pattern_id?: string
          pattern_name?: string
        }
        Relationships: []
      }
      tissue_states: {
        Row: {
          clinical_canonical: boolean
          description: string | null
          opposing_state_id: string | null
          state_id: string
          state_name: string
        }
        Insert: {
          clinical_canonical?: boolean
          description?: string | null
          opposing_state_id?: string | null
          state_id: string
          state_name: string
        }
        Update: {
          clinical_canonical?: boolean
          description?: string | null
          opposing_state_id?: string | null
          state_id?: string
          state_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tissue_states_opposing_state_id_fkey"
            columns: ["opposing_state_id"]
            isOneToOne: false
            referencedRelation: "tissue_states"
            referencedColumns: ["state_id"]
          },
        ]
      }
      waitlist_signups: {
        Row: {
          consents: Json
          created_at: string
          email: string
          entered_at: string
          entry_funnel: Database["public"]["Enums"]["entry_funnel"]
          first_name: string | null
          id: string
          last_name: string | null
          metadata: Json
          referrer: string | null
          resend_contact_id: string | null
          resend_synced_at: string | null
          source: string | null
          source_url: string | null
          unsubscribed_at: string | null
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          consents?: Json
          created_at?: string
          email: string
          entered_at?: string
          entry_funnel: Database["public"]["Enums"]["entry_funnel"]
          first_name?: string | null
          id?: string
          last_name?: string | null
          metadata?: Json
          referrer?: string | null
          resend_contact_id?: string | null
          resend_synced_at?: string | null
          source?: string | null
          source_url?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          consents?: Json
          created_at?: string
          email?: string
          entered_at?: string
          entry_funnel?: Database["public"]["Enums"]["entry_funnel"]
          first_name?: string | null
          id?: string
          last_name?: string | null
          metadata?: Json
          referrer?: string | null
          resend_contact_id?: string | null
          resend_synced_at?: string | null
          source?: string | null
          source_url?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      weekly_trends_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          leads_this_week: number | null
          run_date: string
          status: string
          triggered_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          leads_this_week?: number | null
          run_date: string
          status?: string
          triggered_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          leads_this_week?: number | null
          run_date?: string
          status?: string
          triggered_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      contraindications_safety_v: {
        Row: {
          clinical_guidance: string | null
          contraindication_id: string | null
          herb_id: string | null
          interacting_entity: string | null
          severity: Database["public"]["Enums"]["severity_level"] | null
          type: Database["public"]["Enums"]["contraindication_kind"] | null
        }
        Insert: {
          clinical_guidance?: string | null
          contraindication_id?: string | null
          herb_id?: string | null
          interacting_entity?: string | null
          severity?: Database["public"]["Enums"]["severity_level"] | null
          type?: Database["public"]["Enums"]["contraindication_kind"] | null
        }
        Update: {
          clinical_guidance?: string | null
          contraindication_id?: string | null
          herb_id?: string | null
          interacting_entity?: string | null
          severity?: Database["public"]["Enums"]["severity_level"] | null
          type?: Database["public"]["Enums"]["contraindication_kind"] | null
        }
        Relationships: [
          {
            foreignKeyName: "contraindications_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "contraindications_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_clinical_v"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "contraindications_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_directory_v"
            referencedColumns: ["herb_id"]
          },
          {
            foreignKeyName: "contraindications_herb_id_fkey"
            columns: ["herb_id"]
            isOneToOne: false
            referencedRelation: "herbs_public"
            referencedColumns: ["herb_id"]
          },
        ]
      }
      diagnostic_profile_v: {
        Row: {
          diagnostic_completed_at: string | null
          galenic_temperament:
            | Database["public"]["Enums"]["galenic_temperament_type"]
            | null
          has_full_diagnostic_depth: boolean | null
          pattern: string | null
          person_profile_id: string | null
          tissue_state_profile: Json | null
          user_id: string | null
          vital_force_reading:
            | Database["public"]["Enums"]["vital_force_reading_type"]
            | null
        }
        Insert: {
          diagnostic_completed_at?: string | null
          galenic_temperament?:
            | Database["public"]["Enums"]["galenic_temperament_type"]
            | null
          has_full_diagnostic_depth?: never
          pattern?: string | null
          person_profile_id?: string | null
          tissue_state_profile?: never
          user_id?: string | null
          vital_force_reading?:
            | Database["public"]["Enums"]["vital_force_reading_type"]
            | null
        }
        Update: {
          diagnostic_completed_at?: string | null
          galenic_temperament?:
            | Database["public"]["Enums"]["galenic_temperament_type"]
            | null
          has_full_diagnostic_depth?: never
          pattern?: string | null
          person_profile_id?: string | null
          tissue_state_profile?: never
          user_id?: string | null
          vital_force_reading?:
            | Database["public"]["Enums"]["vital_force_reading_type"]
            | null
        }
        Relationships: []
      }
      herbs_clinical_v: {
        Row: {
          actions: Json | null
          ayurvedic_dosha_aggravates: string | null
          ayurvedic_dosha_match: string | null
          biblical_traditional_reference: string | null
          breastfeeding_safety: string | null
          cautions: string | null
          chief_complaints: string | null
          children_safety: string | null
          common_name: string | null
          complaints_rel: Json | null
          constitutions_rel: Json | null
          contraindications_general: string | null
          dosage_notes: string | null
          doshas_aggravates_rel: Json | null
          doshas_match_rel: Json | null
          drug_interactions: string | null
          energetics_summary: string | null
          herb_id: string | null
          image_filename: string | null
          latin_name: string | null
          moisture: string | null
          notes: string | null
          part_used: string | null
          plant_family: string | null
          pregnancy_safety: string | null
          preparation_methods: string | null
          preparations_rel: Json | null
          primary_sources: string | null
          pronunciation: string | null
          refer_threshold: string | null
          secondary_sources: string | null
          status: string | null
          stewardship_note: string | null
          system_affinity: string | null
          systems_rel: Json | null
          taste: string | null
          tastes_rel: Json | null
          tcm_contraindicated_patterns: string | null
          tcm_contraindicated_rel: Json | null
          tcm_indicated_rel: Json | null
          tcm_pattern_match: string | null
          temperature: string | null
          tier_visibility:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          tissue_states_contraindicated: string | null
          tissue_states_contraindicated_rel: Json | null
          tissue_states_indicated: string | null
          tissue_states_indicated_rel: Json | null
          western_constitution_match: string | null
        }
        Insert: {
          actions?: never
          ayurvedic_dosha_aggravates?: string | null
          ayurvedic_dosha_match?: string | null
          biblical_traditional_reference?: string | null
          breastfeeding_safety?: string | null
          cautions?: string | null
          chief_complaints?: string | null
          children_safety?: string | null
          common_name?: string | null
          complaints_rel?: never
          constitutions_rel?: never
          contraindications_general?: string | null
          dosage_notes?: string | null
          doshas_aggravates_rel?: never
          doshas_match_rel?: never
          drug_interactions?: string | null
          energetics_summary?: string | null
          herb_id?: string | null
          image_filename?: string | null
          latin_name?: string | null
          moisture?: string | null
          notes?: string | null
          part_used?: string | null
          plant_family?: string | null
          pregnancy_safety?: string | null
          preparation_methods?: string | null
          preparations_rel?: never
          primary_sources?: string | null
          pronunciation?: string | null
          refer_threshold?: string | null
          secondary_sources?: string | null
          status?: string | null
          stewardship_note?: string | null
          system_affinity?: string | null
          systems_rel?: never
          taste?: string | null
          tastes_rel?: never
          tcm_contraindicated_patterns?: string | null
          tcm_contraindicated_rel?: never
          tcm_indicated_rel?: never
          tcm_pattern_match?: string | null
          temperature?: string | null
          tier_visibility?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          tissue_states_contraindicated?: string | null
          tissue_states_contraindicated_rel?: never
          tissue_states_indicated?: string | null
          tissue_states_indicated_rel?: never
          western_constitution_match?: string | null
        }
        Update: {
          actions?: never
          ayurvedic_dosha_aggravates?: string | null
          ayurvedic_dosha_match?: string | null
          biblical_traditional_reference?: string | null
          breastfeeding_safety?: string | null
          cautions?: string | null
          chief_complaints?: string | null
          children_safety?: string | null
          common_name?: string | null
          complaints_rel?: never
          constitutions_rel?: never
          contraindications_general?: string | null
          dosage_notes?: string | null
          doshas_aggravates_rel?: never
          doshas_match_rel?: never
          drug_interactions?: string | null
          energetics_summary?: string | null
          herb_id?: string | null
          image_filename?: string | null
          latin_name?: string | null
          moisture?: string | null
          notes?: string | null
          part_used?: string | null
          plant_family?: string | null
          pregnancy_safety?: string | null
          preparation_methods?: string | null
          preparations_rel?: never
          primary_sources?: string | null
          pronunciation?: string | null
          refer_threshold?: string | null
          secondary_sources?: string | null
          status?: string | null
          stewardship_note?: string | null
          system_affinity?: string | null
          systems_rel?: never
          taste?: string | null
          tastes_rel?: never
          tcm_contraindicated_patterns?: string | null
          tcm_contraindicated_rel?: never
          tcm_indicated_rel?: never
          tcm_pattern_match?: string | null
          temperature?: string | null
          tier_visibility?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          tissue_states_contraindicated?: string | null
          tissue_states_contraindicated_rel?: never
          tissue_states_indicated?: string | null
          tissue_states_indicated_rel?: never
          western_constitution_match?: string | null
        }
        Relationships: []
      }
      herbs_directory_v: {
        Row: {
          actions_rel: Json | null
          ayurvedic_dosha_aggravates: string | null
          ayurvedic_dosha_match: string | null
          biblical_traditional_reference: string | null
          breastfeeding_safety: string | null
          cautions: string | null
          chief_complaints: string | null
          children_safety: string | null
          common_name: string | null
          complaint_names: string[] | null
          complaints_rel: Json | null
          constitutions_rel: Json | null
          contraindications_general: string | null
          dosage_notes: string | null
          doshas_aggravates_rel: Json | null
          doshas_match_rel: Json | null
          drug_interactions: string | null
          energetics_summary: string | null
          herb_id: string | null
          image_filename: string | null
          is_locked: boolean | null
          latin_name: string | null
          moisture: string | null
          notes: string | null
          part_used: string | null
          plant_family: string | null
          pregnancy_safety: string | null
          preparation_methods: string | null
          preparations_rel: Json | null
          primary_sources: string | null
          primary_text_citation: Json | null
          pronunciation: string | null
          refer_threshold: string | null
          secondary_citation: Json | null
          secondary_sources: string | null
          status: string | null
          stewardship_note: string | null
          system_affinity: string | null
          systems_rel: Json | null
          taste: string | null
          tastes_rel: Json | null
          tcm_contraindicated_patterns: string | null
          tcm_contraindicated_rel: Json | null
          tcm_indicated_rel: Json | null
          tcm_pattern_match: string | null
          temperature: string | null
          tier_visibility:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          tissue_states_contraindicated: string | null
          tissue_states_contraindicated_rel: Json | null
          tissue_states_indicated: string | null
          tissue_states_indicated_rel: Json | null
          traditional_observations: Json | null
          western_constitution_match: string | null
        }
        Insert: {
          actions_rel?: never
          ayurvedic_dosha_aggravates?: never
          ayurvedic_dosha_match?: never
          biblical_traditional_reference?: never
          breastfeeding_safety?: never
          cautions?: never
          chief_complaints?: never
          children_safety?: never
          common_name?: string | null
          complaint_names?: never
          complaints_rel?: never
          constitutions_rel?: never
          contraindications_general?: never
          dosage_notes?: never
          doshas_aggravates_rel?: never
          doshas_match_rel?: never
          drug_interactions?: never
          energetics_summary?: never
          herb_id?: string | null
          image_filename?: string | null
          is_locked?: never
          latin_name?: string | null
          moisture?: never
          notes?: never
          part_used?: string | null
          plant_family?: string | null
          pregnancy_safety?: never
          preparation_methods?: never
          preparations_rel?: never
          primary_sources?: never
          primary_text_citation?: never
          pronunciation?: string | null
          refer_threshold?: never
          secondary_citation?: never
          secondary_sources?: never
          status?: string | null
          stewardship_note?: never
          system_affinity?: never
          systems_rel?: never
          taste?: never
          tastes_rel?: never
          tcm_contraindicated_patterns?: never
          tcm_contraindicated_rel?: never
          tcm_indicated_rel?: never
          tcm_pattern_match?: never
          temperature?: never
          tier_visibility?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          tissue_states_contraindicated?: never
          tissue_states_contraindicated_rel?: never
          tissue_states_indicated?: never
          tissue_states_indicated_rel?: never
          traditional_observations?: never
          western_constitution_match?: never
        }
        Update: {
          actions_rel?: never
          ayurvedic_dosha_aggravates?: never
          ayurvedic_dosha_match?: never
          biblical_traditional_reference?: never
          breastfeeding_safety?: never
          cautions?: never
          chief_complaints?: never
          children_safety?: never
          common_name?: string | null
          complaint_names?: never
          complaints_rel?: never
          constitutions_rel?: never
          contraindications_general?: never
          dosage_notes?: never
          doshas_aggravates_rel?: never
          doshas_match_rel?: never
          drug_interactions?: never
          energetics_summary?: never
          herb_id?: string | null
          image_filename?: string | null
          is_locked?: never
          latin_name?: string | null
          moisture?: never
          notes?: never
          part_used?: string | null
          plant_family?: string | null
          pregnancy_safety?: never
          preparation_methods?: never
          preparations_rel?: never
          primary_sources?: never
          primary_text_citation?: never
          pronunciation?: string | null
          refer_threshold?: never
          secondary_citation?: never
          secondary_sources?: never
          status?: string | null
          stewardship_note?: never
          system_affinity?: never
          systems_rel?: never
          taste?: never
          tastes_rel?: never
          tcm_contraindicated_patterns?: never
          tcm_contraindicated_rel?: never
          tcm_indicated_rel?: never
          tcm_pattern_match?: never
          temperature?: never
          tier_visibility?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          tissue_states_contraindicated?: never
          tissue_states_contraindicated_rel?: never
          tissue_states_indicated?: never
          tissue_states_indicated_rel?: never
          traditional_observations?: never
          western_constitution_match?: never
        }
        Relationships: []
      }
      herbs_public: {
        Row: {
          biblical_traditional_reference: string | null
          breastfeeding_safety: string | null
          cautions: string | null
          children_safety: string | null
          common_name: string | null
          contraindications_general: string | null
          energetics_summary: string | null
          herb_id: string | null
          image_filename: string | null
          latin_name: string | null
          moisture: string | null
          part_used: string | null
          plant_family: string | null
          pregnancy_safety: string | null
          pronunciation: string | null
          status: string | null
          stewardship_note: string | null
          taste: string | null
          temperature: string | null
          tier_visibility:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
        }
        Insert: {
          biblical_traditional_reference?: string | null
          breastfeeding_safety?: string | null
          cautions?: string | null
          children_safety?: string | null
          common_name?: string | null
          contraindications_general?: string | null
          energetics_summary?: string | null
          herb_id?: string | null
          image_filename?: string | null
          latin_name?: string | null
          moisture?: string | null
          part_used?: string | null
          plant_family?: string | null
          pregnancy_safety?: string | null
          pronunciation?: string | null
          status?: string | null
          stewardship_note?: string | null
          taste?: string | null
          temperature?: string | null
          tier_visibility?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
        }
        Update: {
          biblical_traditional_reference?: string | null
          breastfeeding_safety?: string | null
          cautions?: string | null
          children_safety?: string | null
          common_name?: string | null
          contraindications_general?: string | null
          energetics_summary?: string | null
          herb_id?: string | null
          image_filename?: string | null
          latin_name?: string | null
          moisture?: string | null
          part_used?: string | null
          plant_family?: string | null
          pregnancy_safety?: string | null
          pronunciation?: string | null
          status?: string | null
          stewardship_note?: string | null
          taste?: string | null
          temperature?: string | null
          tier_visibility?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
        }
        Relationships: []
      }
      quiz_completion_failure_stats: {
        Row: {
          last_24h_count: number | null
          last_24h_pending: number | null
          max_retries_seen: number | null
          most_recent_failure_at: string | null
          oldest_pending_received_at: string | null
          pending_count: number | null
          resolved_count: number | null
          total_count: number | null
        }
        Relationships: []
      }
      tier_2_waitlist: {
        Row: {
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string | null
        }
        Relationships: []
      }
      v_lead_magnet_stats: {
        Row: {
          capture_day: string | null
          captures: number | null
          funnel: string | null
          source: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      current_tier: {
        Args: never
        Returns: Database["public"]["Enums"]["subscription_tier"]
      }
      current_user_at_least: { Args: { min_tier: string }; Returns: boolean }
      current_user_tier: { Args: never; Returns: string }
      founder_lead_feed: {
        Args: { p_since?: string }
        Returns: {
          email: string
          entered_at: string
          first_name: string
          funnel: string
          source: string
          source_url: string
          unsubscribed: boolean
          utm_campaign: string
          utm_source: string
        }[]
      }
      founder_traffic: { Args: { p_since?: string }; Returns: Json }
      has_tier: {
        Args: { required: Database["public"]["Enums"]["subscription_tier"] }
        Returns: boolean
      }
      is_founder: { Args: never; Returns: boolean }
      is_internal_tester: { Args: { p_email: string }; Returns: boolean }
      lead_capture_digest_window: {
        Args: { p_window_end: string; p_window_start: string }
        Returns: {
          email: string
          entered_at: string
          first_name: string
          funnel: string
          source: string
          source_url: string
          utm_campaign: string
          utm_source: string
        }[]
      }
      person_profile_cap_for_tier: { Args: { tier: string }; Returns: number }
      record_page_view: {
        Args: {
          p_path: string
          p_referrer?: string
          p_utm_campaign?: string
          p_utm_medium?: string
          p_utm_source?: string
        }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      tier_rank: {
        Args: { t: Database["public"]["Enums"]["subscription_tier"] }
        Returns: number
      }
      waitlist_apply_resend_event: {
        Args: {
          p_contact_id: string
          p_email: string
          p_event_type: string
          p_metadata_patch: Json
        }
        Returns: number
      }
      weekly_trends_snapshot: { Args: never; Returns: Json }
    }
    Enums: {
      biological_sex_enum: "male" | "female"
      contraindication_kind:
        | "drug_interaction"
        | "condition"
        | "population"
        | "pregnancy"
        | "breastfeeding"
        | "pediatric"
        | "geriatric"
        | "other"
      entry_funnel:
        | "app_beta"
        | "course_tier2"
        | "edens_table"
        | "homeschool"
        | "community"
        | "quiz_funnel"
        | "practitioner_waitlist"
      galenic_temperament_type:
        | "eukrasia"
        | "simple_dyskrasia_hot"
        | "simple_dyskrasia_cold"
        | "simple_dyskrasia_dry"
        | "simple_dyskrasia_wet"
        | "compound_dyskrasia_hot_dry"
        | "compound_dyskrasia_hot_wet"
        | "compound_dyskrasia_cold_dry"
        | "compound_dyskrasia_cold_wet"
      profile_kind_enum: "adult" | "child"
      public_domain_flag: "yes" | "no" | "partial"
      severity_level: "low" | "moderate" | "high" | "absolute"
      subscription_tier: "free" | "seed" | "root" | "practitioner"
      vital_force_reading_type: "sthenic" | "balanced" | "asthenic"
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
      biological_sex_enum: ["male", "female"],
      contraindication_kind: [
        "drug_interaction",
        "condition",
        "population",
        "pregnancy",
        "breastfeeding",
        "pediatric",
        "geriatric",
        "other",
      ],
      entry_funnel: [
        "app_beta",
        "course_tier2",
        "edens_table",
        "homeschool",
        "community",
        "quiz_funnel",
        "practitioner_waitlist",
      ],
      galenic_temperament_type: [
        "eukrasia",
        "simple_dyskrasia_hot",
        "simple_dyskrasia_cold",
        "simple_dyskrasia_dry",
        "simple_dyskrasia_wet",
        "compound_dyskrasia_hot_dry",
        "compound_dyskrasia_hot_wet",
        "compound_dyskrasia_cold_dry",
        "compound_dyskrasia_cold_wet",
      ],
      profile_kind_enum: ["adult", "child"],
      public_domain_flag: ["yes", "no", "partial"],
      severity_level: ["low", "moderate", "high", "absolute"],
      subscription_tier: ["free", "seed", "root", "practitioner"],
      vital_force_reading_type: ["sthenic", "balanced", "asthenic"],
    },
  },
} as const
