export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      announcements: {
        Row: {
          created_at: string
          id: string
          message: string
          subject: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          subject: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          subject?: string
        }
        Relationships: []
      }
      "hermes-tg-counters": {
        Row: {
          bot_name: string
          chainid: number
          counter: number | null
        }
        Insert: {
          bot_name: string
          chainid: number
          counter?: number | null
        }
        Update: {
          bot_name?: string
          chainid?: number
          counter?: number | null
        }
        Relationships: []
      }
      "sendgrid-scheduler": {
        Row: {
          address: string
          chain_id: number | null
          created_at: string | null
          dapp: string | null
          dynamic_template_data: Json | null
          email_delivered: boolean
          email_desired: boolean
          expiry: string | null
          index: number
          template_id: string | null
          tx: string
        }
        Insert: {
          address: string
          chain_id?: number | null
          created_at?: string | null
          dapp?: string | null
          dynamic_template_data?: Json | null
          email_delivered?: boolean
          email_desired: boolean
          expiry?: string | null
          index: number
          template_id?: string | null
          tx: string
        }
        Update: {
          address?: string
          chain_id?: number | null
          created_at?: string | null
          dapp?: string | null
          dynamic_template_data?: Json | null
          email_delivered?: boolean
          email_desired?: boolean
          expiry?: string | null
          index?: number
          template_id?: string | null
          tx?: string
        }
        Relationships: []
      }
      "tg-juror-subscriptions": {
        Row: {
          juror_address: string
          tg_user_id: number
        }
        Insert: {
          juror_address: string
          tg_user_id: number
        }
        Update: {
          juror_address?: string
          tg_user_id?: number
        }
        Relationships: []
      }
      "user-public-messages": {
        Row: {
          address: string
          chain_id: number | null
          created_at: string | null
          dapp: string | null
          id: string
          message: string
          tx: string | null
        }
        Insert: {
          address: string
          chain_id?: number | null
          created_at?: string | null
          dapp?: string | null
          id?: string
          message: string
          tx?: string | null
        }
        Update: {
          address?: string
          chain_id?: number | null
          created_at?: string | null
          dapp?: string | null
          id?: string
          message?: string
          tx?: string | null
        }
        Relationships: []
      }
      "user-settings": {
        Row: {
          address: string
          email: string | null
          push: boolean | null
          telegram: string | null
        }
        Insert: {
          address: string
          email?: string | null
          push?: boolean | null
          telegram?: string | null
        }
        Update: {
          address?: string
          email?: string | null
          push?: boolean | null
          telegram?: string | null
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
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
