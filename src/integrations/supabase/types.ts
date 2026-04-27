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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
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
      body_systems: {
        Row: {
          description: string | null
          system_id: string
          system_name: string
        }
        Insert: {
          description?: string | null
          system_id: string
          system_name: string
        }
        Update: {
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
            referencedRelation: "herbs_public"
            referencedColumns: ["herb_id"]
          },
        ]
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
      tier_2_waitlist: {
        Row: {
          created_at: string
          email: string
          first_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
        }
        Relationships: []
      }
      tissue_states: {
        Row: {
          description: string | null
          opposing_state_id: string | null
          state_id: string
          state_name: string
        }
        Insert: {
          description?: string | null
          opposing_state_id?: string | null
          state_id: string
          state_name: string
        }
        Update: {
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
            referencedRelation: "herbs_public"
            referencedColumns: ["herb_id"]
          },
        ]
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
          ayurvedic_dosha_aggravates?: string | null
          ayurvedic_dosha_match?: string | null
          biblical_traditional_reference?: string | null
          breastfeeding_safety?: string | null
          cautions?: string | null
          chief_complaints?: string | null
          children_safety?: string | null
          common_name?: string | null
          complaint_names?: never
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
          is_locked?: never
          latin_name?: string | null
          moisture?: string | null
          notes?: string | null
          part_used?: string | null
          plant_family?: string | null
          pregnancy_safety?: string | null
          preparation_methods?: string | null
          preparations_rel?: never
          primary_sources?: string | null
          primary_text_citation?: never
          pronunciation?: string | null
          refer_threshold?: string | null
          secondary_citation?: never
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
          traditional_observations?: never
          western_constitution_match?: string | null
        }
        Update: {
          actions_rel?: never
          ayurvedic_dosha_aggravates?: string | null
          ayurvedic_dosha_match?: string | null
          biblical_traditional_reference?: string | null
          breastfeeding_safety?: string | null
          cautions?: string | null
          chief_complaints?: string | null
          children_safety?: string | null
          common_name?: string | null
          complaint_names?: never
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
          is_locked?: never
          latin_name?: string | null
          moisture?: string | null
          notes?: string | null
          part_used?: string | null
          plant_family?: string | null
          pregnancy_safety?: string | null
          preparation_methods?: string | null
          preparations_rel?: never
          primary_sources?: string | null
          primary_text_citation?: never
          pronunciation?: string | null
          refer_threshold?: string | null
          secondary_citation?: never
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
          traditional_observations?: never
          western_constitution_match?: string | null
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
     
