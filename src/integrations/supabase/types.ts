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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      affiliate_settings: {
        Row: {
          bonus_amount: number
          bonus_threshold: number
          commission_per_transaction: number
          id: string
          level1_commission: number
          level2_commission: number
          level3_commission: number
          min_deposit: number
          updated_at: string
        }
        Insert: {
          bonus_amount?: number
          bonus_threshold?: number
          commission_per_transaction?: number
          id?: string
          level1_commission?: number
          level2_commission?: number
          level3_commission?: number
          min_deposit?: number
          updated_at?: string
        }
        Update: {
          bonus_amount?: number
          bonus_threshold?: number
          commission_per_transaction?: number
          id?: string
          level1_commission?: number
          level2_commission?: number
          level3_commission?: number
          min_deposit?: number
          updated_at?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          new_state: Json | null
          old_state: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_state?: Json | null
          old_state?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_state?: Json | null
          old_state?: Json | null
        }
        Relationships: []
      }
      bets: {
        Row: {
          bet_amount: number
          created_at: string
          game_type: string
          id: string
          multiplier: number | null
          payout: number | null
          status: Database["public"]["Enums"]["bet_status"]
          user_id: string
        }
        Insert: {
          bet_amount: number
          created_at?: string
          game_type: string
          id?: string
          multiplier?: number | null
          payout?: number | null
          status?: Database["public"]["Enums"]["bet_status"]
          user_id: string
        }
        Update: {
          bet_amount?: number
          created_at?: string
          game_type?: string
          id?: string
          multiplier?: number | null
          payout?: number | null
          status?: Database["public"]["Enums"]["bet_status"]
          user_id?: string
        }
        Relationships: []
      }
      deposits: {
        Row: {
          amount: number
          copy_paste: string | null
          created_at: string
          id: string
          misticpay_transaction_id: string | null
          qrcode_url: string | null
          status: string
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          copy_paste?: string | null
          created_at?: string
          id?: string
          misticpay_transaction_id?: string | null
          qrcode_url?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          copy_paste?: string | null
          created_at?: string
          id?: string
          misticpay_transaction_id?: string | null
          qrcode_url?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_alerts: {
        Row: {
          alert_type: string
          created_at: string
          description: string
          id: string
          merchant_id: string | null
          metadata: Json
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          transaction_id: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string
          description: string
          id?: string
          merchant_id?: string | null
          metadata?: Json
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          transaction_id?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string
          description?: string
          id?: string
          merchant_id?: string | null
          metadata?: Json
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_alerts_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_alerts_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_alerts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "gateway_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_scores: {
        Row: {
          created_at: string
          decision: string
          flags: Json
          id: string
          ip_address: string | null
          merchant_id: string
          payment_intent_id: string | null
          risk_score: number
          transaction_id: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          decision?: string
          flags?: Json
          id?: string
          ip_address?: string | null
          merchant_id: string
          payment_intent_id?: string | null
          risk_score?: number
          transaction_id?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          decision?: string
          flags?: Json
          id?: string
          ip_address?: string | null
          merchant_id?: string
          payment_intent_id?: string | null
          risk_score?: number
          transaction_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fraud_scores_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_scores_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_scores_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_scores_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "gateway_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_test_runs: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_message: string | null
          executed_by: string | null
          id: string
          result: Json
          status: string
          test_category: string
          test_name: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          executed_by?: string | null
          id?: string
          result?: Json
          status?: string
          test_category?: string
          test_name: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          executed_by?: string | null
          id?: string
          result?: Json
          status?: string
          test_category?: string
          test_name?: string
        }
        Relationships: []
      }
      gateway_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          customer_document: string | null
          customer_email: string | null
          description: string | null
          failed_at: string | null
          id: string
          idempotency_key: string
          merchant_id: string
          metadata: Json | null
          paid_at: string | null
          payment_method: string
          pix_copy_paste: string | null
          pix_qrcode_url: string | null
          provider_transaction_id: string | null
          refunded_at: string | null
          risk_score: number
          status: Database["public"]["Enums"]["gateway_tx_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          customer_document?: string | null
          customer_email?: string | null
          description?: string | null
          failed_at?: string | null
          id?: string
          idempotency_key: string
          merchant_id: string
          metadata?: Json | null
          paid_at?: string | null
          payment_method?: string
          pix_copy_paste?: string | null
          pix_qrcode_url?: string | null
          provider_transaction_id?: string | null
          refunded_at?: string | null
          risk_score?: number
          status?: Database["public"]["Enums"]["gateway_tx_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          customer_document?: string | null
          customer_email?: string | null
          description?: string | null
          failed_at?: string | null
          id?: string
          idempotency_key?: string
          merchant_id?: string
          metadata?: Json | null
          paid_at?: string | null
          payment_method?: string
          pix_copy_paste?: string | null
          pix_qrcode_url?: string | null
          provider_transaction_id?: string | null
          refunded_at?: string | null
          risk_score?: number
          status?: Database["public"]["Enums"]["gateway_tx_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_transactions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gateway_transactions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          created_at: string
          endpoint: string
          expires_at: string
          id: string
          key: string
          merchant_id: string
          request_hash: string | null
          response_body: Json
          response_status: number
        }
        Insert: {
          created_at?: string
          endpoint: string
          expires_at?: string
          id?: string
          key: string
          merchant_id: string
          request_hash?: string | null
          response_body?: Json
          response_status?: number
        }
        Update: {
          created_at?: string
          endpoint?: string
          expires_at?: string
          id?: string
          key?: string
          merchant_id?: string
          request_hash?: string | null
          response_body?: Json
          response_status?: number
        }
        Relationships: [
          {
            foreignKeyName: "idempotency_keys_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idempotency_keys_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          currency: string
          description: string | null
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id: string
          merchant_id: string
          metadata: Json | null
          transaction_id: string | null
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          currency?: string
          description?: string | null
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id?: string
          merchant_id: string
          metadata?: Json | null
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          currency?: string
          description?: string | null
          entry_type?: Database["public"]["Enums"]["ledger_entry_type"]
          id?: string
          merchant_id?: string
          metadata?: Json | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "gateway_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          api_key_hash: string
          api_key_prefix: string
          created_at: string
          id: string
          name: string
          rate_limit_per_minute: number
          status: Database["public"]["Enums"]["merchant_status"]
          updated_at: string
          user_id: string
          webhook_secret: string
          webhook_url: string | null
        }
        Insert: {
          api_key_hash: string
          api_key_prefix: string
          created_at?: string
          id?: string
          name: string
          rate_limit_per_minute?: number
          status?: Database["public"]["Enums"]["merchant_status"]
          updated_at?: string
          user_id: string
          webhook_secret?: string
          webhook_url?: string | null
        }
        Update: {
          api_key_hash?: string
          api_key_prefix?: string
          created_at?: string
          id?: string
          name?: string
          rate_limit_per_minute?: number
          status?: Database["public"]["Enums"]["merchant_status"]
          updated_at?: string
          user_id?: string
          webhook_secret?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      payment_attempts: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          provider: string
          provider_response: Json | null
          status: Database["public"]["Enums"]["payment_attempt_status"]
          transaction_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          provider?: string
          provider_response?: Json | null
          status?: Database["public"]["Enums"]["payment_attempt_status"]
          transaction_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          provider?: string
          provider_response?: Json | null
          status?: Database["public"]["Enums"]["payment_attempt_status"]
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "gateway_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_intents: {
        Row: {
          amount: number
          cancelled_at: string | null
          created_at: string
          currency: string
          customer_document: string | null
          customer_email: string | null
          description: string | null
          failed_at: string | null
          gateway_transaction_id: string | null
          id: string
          idempotency_key: string
          merchant_id: string
          metadata: Json | null
          payment_method: string
          provider: string
          risk_score: number
          status: Database["public"]["Enums"]["payment_intent_status"]
          succeeded_at: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          cancelled_at?: string | null
          created_at?: string
          currency?: string
          customer_document?: string | null
          customer_email?: string | null
          description?: string | null
          failed_at?: string | null
          gateway_transaction_id?: string | null
          id?: string
          idempotency_key: string
          merchant_id: string
          metadata?: Json | null
          payment_method?: string
          provider?: string
          risk_score?: number
          status?: Database["public"]["Enums"]["payment_intent_status"]
          succeeded_at?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          cancelled_at?: string | null
          created_at?: string
          currency?: string
          customer_document?: string | null
          customer_email?: string | null
          description?: string | null
          failed_at?: string | null
          gateway_transaction_id?: string | null
          id?: string
          idempotency_key?: string
          merchant_id?: string
          metadata?: Json | null
          payment_method?: string
          provider?: string
          risk_score?: number
          status?: Database["public"]["Enums"]["payment_intent_status"]
          succeeded_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_intents_gateway_transaction_id_fkey"
            columns: ["gateway_transaction_id"]
            isOneToOne: false
            referencedRelation: "gateway_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_fees: {
        Row: {
          id: string
          pix_fee_fixed: number
          pix_fee_percent: number
          updated_at: string
          withdrawal_fee_fixed: number
          withdrawal_fee_percent: number
        }
        Insert: {
          id?: string
          pix_fee_fixed?: number
          pix_fee_percent?: number
          updated_at?: string
          withdrawal_fee_fixed?: number
          withdrawal_fee_percent?: number
        }
        Update: {
          id?: string
          pix_fee_fixed?: number
          pix_fee_percent?: number
          updated_at?: string
          withdrawal_fee_fixed?: number
          withdrawal_fee_percent?: number
        }
        Relationships: []
      }
      processing_locks: {
        Row: {
          expires_at: string
          id: string
          lock_key: string
          locked_at: string
          locked_by: string
          released_at: string | null
        }
        Insert: {
          expires_at?: string
          id?: string
          lock_key: string
          locked_at?: string
          locked_by?: string
          released_at?: string | null
        }
        Update: {
          expires_at?: string
          id?: string
          lock_key?: string
          locked_at?: string
          locked_by?: string
          released_at?: string | null
        }
        Relationships: []
      }
      processing_queue: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          id: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          priority: number
          queue_name: string
          scheduled_at: string
          status: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          queue_name: string
          scheduled_at?: string
          status?: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          queue_name?: string
          scheduled_at?: string
          status?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          birth_date: string | null
          cpf: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limit_events: {
        Row: {
          blocked: boolean
          created_at: string
          current_count: number
          endpoint: string | null
          event_source: string
          id: string
          identifier_type: string
          identifier_value: string
          ip_address: string | null
          limit_value: number
        }
        Insert: {
          blocked?: boolean
          created_at?: string
          current_count?: number
          endpoint?: string | null
          event_source?: string
          id?: string
          identifier_type?: string
          identifier_value: string
          ip_address?: string | null
          limit_value?: number
        }
        Update: {
          blocked?: boolean
          created_at?: string
          current_count?: number
          endpoint?: string | null
          event_source?: string
          id?: string
          identifier_type?: string
          identifier_value?: string
          ip_address?: string | null
          limit_value?: number
        }
        Relationships: []
      }
      reconciliation_checks: {
        Row: {
          created_at: string
          expected_status: string
          id: string
          mismatch_detected: boolean
          mismatch_type: string
          provider_status: string | null
          provider_transaction_id: string | null
          resolution_details: Json | null
          resolution_method: string | null
          resolved: boolean
          resolved_at: string | null
          transaction_id: string
        }
        Insert: {
          created_at?: string
          expected_status: string
          id?: string
          mismatch_detected?: boolean
          mismatch_type?: string
          provider_status?: string | null
          provider_transaction_id?: string | null
          resolution_details?: Json | null
          resolution_method?: string | null
          resolved?: boolean
          resolved_at?: string | null
          transaction_id: string
        }
        Update: {
          created_at?: string
          expected_status?: string
          id?: string
          mismatch_detected?: boolean
          mismatch_type?: string
          provider_status?: string | null
          provider_transaction_id?: string | null
          resolution_details?: Json | null
          resolution_method?: string | null
          resolved?: boolean
          resolved_at?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_checks_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "gateway_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_commissions: {
        Row: {
          commission_amount: number
          created_at: string
          deposit_id: string
          id: string
          level: number
          referred_id: string
          referrer_id: string
        }
        Insert: {
          commission_amount?: number
          created_at?: string
          deposit_id: string
          id?: string
          level?: number
          referred_id: string
          referrer_id: string
        }
        Update: {
          commission_amount?: number
          created_at?: string
          deposit_id?: string
          id?: string
          level?: number
          referred_id?: string
          referrer_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
        }
        Relationships: []
      }
      scratch_card_prizes: {
        Row: {
          card_id: string
          id: string
          label: string
          sort_order: number
          symbol: string
          value: number
          weight: number
        }
        Insert: {
          card_id: string
          id?: string
          label: string
          sort_order?: number
          symbol: string
          value?: number
          weight?: number
        }
        Update: {
          card_id?: string
          id?: string
          label?: string
          sort_order?: number
          symbol?: string
          value?: number
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "scratch_card_prizes_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "scratch_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      scratch_cards: {
        Row: {
          active: boolean
          badge: string | null
          category: string
          created_at: string
          description: string
          id: string
          image_url: string | null
          is_free: boolean
          max_prize_label: string
          name: string
          price: number
          updated_at: string
          vip: boolean
        }
        Insert: {
          active?: boolean
          badge?: string | null
          category?: string
          created_at?: string
          description?: string
          id: string
          image_url?: string | null
          is_free?: boolean
          max_prize_label?: string
          name: string
          price?: number
          updated_at?: string
          vip?: boolean
        }
        Update: {
          active?: boolean
          badge?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          is_free?: boolean
          max_prize_label?: string
          name?: string
          price?: number
          updated_at?: string
          vip?: boolean
        }
        Relationships: []
      }
      security_events: {
        Row: {
          created_at: string
          event_type: Database["public"]["Enums"]["security_event_type"]
          id: string
          ip_address: string | null
          merchant_id: string | null
          metadata: Json | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          event_type: Database["public"]["Enums"]["security_event_type"]
          id?: string
          ip_address?: string | null
          merchant_id?: string | null
          metadata?: Json | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          event_type?: Database["public"]["Enums"]["security_event_type"]
          id?: string
          ip_address?: string | null
          merchant_id?: string | null
          metadata?: Json | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_events_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_events_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      system_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          message: string
          metadata: Json
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          source: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          message: string
          metadata?: Json
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source?: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          message?: string
          metadata?: Json
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source?: string
        }
        Relationships: []
      }
      system_metrics: {
        Row: {
          created_at: string
          id: string
          metric_name: string
          metric_value: number
          tags: Json
        }
        Insert: {
          created_at?: string
          id?: string
          metric_name: string
          metric_value?: number
          tags?: Json
        }
        Update: {
          created_at?: string
          id?: string
          metric_name?: string
          metric_value?: number
          tags?: Json
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          attempts: number
          created_at: string
          event_type: string
          id: string
          last_error: string | null
          last_response_code: number | null
          max_attempts: number
          merchant_id: string
          next_retry_at: string | null
          payload: Json
          status: Database["public"]["Enums"]["webhook_delivery_status"]
          transaction_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          event_type: string
          id?: string
          last_error?: string | null
          last_response_code?: number | null
          max_attempts?: number
          merchant_id: string
          next_retry_at?: string | null
          payload?: Json
          status?: Database["public"]["Enums"]["webhook_delivery_status"]
          transaction_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          event_type?: string
          id?: string
          last_error?: string | null
          last_response_code?: number | null
          max_attempts?: number
          merchant_id?: string
          next_retry_at?: string | null
          payload?: Json
          status?: Database["public"]["Enums"]["webhook_delivery_status"]
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "gateway_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          processed: boolean
          processed_at: string | null
          signature: string | null
          signature_valid: boolean | null
          source_ip: string | null
          transaction_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          signature?: string | null
          signature_valid?: boolean | null
          source_ip?: string | null
          transaction_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          signature?: string | null
          signature_valid?: boolean | null
          source_ip?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "gateway_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawals: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          pix_key: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          id?: string
          pix_key: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          pix_key?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      api_keys_safe: {
        Row: {
          created_at: string | null
          id: string | null
          key_prefix: string | null
          last_used_at: string | null
          name: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          key_prefix?: string | null
          last_used_at?: string | null
          name?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          key_prefix?: string | null
          last_used_at?: string | null
          name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      merchants_safe: {
        Row: {
          api_key_prefix: string | null
          created_at: string | null
          id: string | null
          name: string | null
          rate_limit_per_minute: number | null
          status: Database["public"]["Enums"]["merchant_status"] | null
          updated_at: string | null
          user_id: string | null
          webhook_url: string | null
        }
        Insert: {
          api_key_prefix?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          rate_limit_per_minute?: number | null
          status?: Database["public"]["Enums"]["merchant_status"] | null
          updated_at?: string | null
          user_id?: string | null
          webhook_url?: string | null
        }
        Update: {
          api_key_prefix?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          rate_limit_per_minute?: number | null
          status?: Database["public"]["Enums"]["merchant_status"] | null
          updated_at?: string | null
          user_id?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      scratch_card_prizes_public: {
        Row: {
          card_id: string | null
          id: string | null
          label: string | null
          sort_order: number | null
          symbol: string | null
          value: number | null
        }
        Insert: {
          card_id?: string | null
          id?: string | null
          label?: string | null
          sort_order?: number | null
          symbol?: string | null
          value?: number | null
        }
        Update: {
          card_id?: string | null
          id?: string | null
          label?: string | null
          sort_order?: number | null
          symbol?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scratch_card_prizes_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "scratch_cards"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      acquire_processing_lock: { Args: { _lock_key: string }; Returns: boolean }
      admin_process_withdrawal: {
        Args: { _action: string; _admin_note?: string; _withdrawal_id: string }
        Returns: undefined
      }
      authenticate_merchant: { Args: { _api_key: string }; Returns: string }
      calculate_enhanced_risk: {
        Args: {
          _amount: number
          _customer_document?: string
          _ip_address?: string
          _merchant_id: string
        }
        Returns: Json
      }
      calculate_risk_score: {
        Args: {
          _amount: number
          _customer_document?: string
          _merchant_id: string
        }
        Returns: number
      }
      create_gateway_transaction: {
        Args: {
          _amount: number
          _customer_document?: string
          _customer_email?: string
          _description?: string
          _idempotency_key: string
          _merchant_id: string
          _metadata?: Json
          _payment_method?: string
        }
        Returns: string
      }
      create_payment_intent: {
        Args: {
          _amount: number
          _customer_document?: string
          _customer_email?: string
          _description?: string
          _idempotency_key: string
          _merchant_id: string
          _metadata?: Json
          _payment_method?: string
        }
        Returns: string
      }
      gateway_valid_transition: {
        Args: {
          _from: Database["public"]["Enums"]["gateway_tx_status"]
          _to: Database["public"]["Enums"]["gateway_tx_status"]
        }
        Returns: boolean
      }
      generate_api_key: { Args: never; Returns: string }
      generate_merchant_api_key: { Args: never; Returns: string }
      generate_referral_code: { Args: never; Returns: string }
      get_merchant_balance: { Args: { _merchant_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      process_deposit_payment: {
        Args: {
          _credit_amount: number
          _deposit_id: string
          _fee_amount: number
        }
        Returns: boolean
      }
      process_game_win: {
        Args: {
          _amount: number
          _bet_id?: string
          _game_type: string
          _user_id: string
        }
        Returns: number
      }
      process_referral_commission: {
        Args: {
          _deposit_amount: number
          _deposit_id: string
          _referred_user_id: string
        }
        Returns: undefined
      }
      process_withdrawal_failure: {
        Args: { _failure_reason?: string; _withdrawal_id: string }
        Returns: boolean
      }
      register_referral: {
        Args: { _referral_code: string; _referred_id: string }
        Returns: undefined
      }
      release_lock: { Args: { _lock_key: string }; Returns: undefined }
      try_acquire_lock: {
        Args: { _lock_key: string; _locked_by?: string; _ttl_seconds?: number }
        Returns: boolean
      }
      update_gateway_tx_status: {
        Args: {
          _new_status: Database["public"]["Enums"]["gateway_tx_status"]
          _provider_tx_id?: string
          _tx_id: string
        }
        Returns: boolean
      }
      update_payment_intent_status: {
        Args: {
          _gateway_tx_id?: string
          _new_status: Database["public"]["Enums"]["payment_intent_status"]
          _pi_id: string
        }
        Returns: boolean
      }
      update_wallet_balance: {
        Args: {
          _amount: number
          _description?: string
          _type: Database["public"]["Enums"]["transaction_type"]
          _user_id: string
        }
        Returns: number
      }
      validate_ledger_balance: { Args: { _merchant_id: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      bet_status: "pending" | "won" | "lost" | "cashout"
      gateway_tx_status:
        | "pending"
        | "processing"
        | "paid"
        | "failed"
        | "refunded"
        | "cancelled"
        | "review_required"
      ledger_entry_type: "credit" | "debit" | "fee" | "refund"
      merchant_status: "active" | "suspended" | "pending_review"
      payment_attempt_status: "pending" | "success" | "failed" | "timeout"
      payment_intent_status:
        | "requires_payment"
        | "processing"
        | "succeeded"
        | "failed"
        | "cancelled"
      security_event_type:
        | "api_key_created"
        | "api_key_rotated"
        | "rate_limit_hit"
        | "suspicious_transaction"
        | "webhook_signature_invalid"
        | "unauthorized_access"
        | "high_risk_transaction"
        | "duplicate_payment"
        | "critical_financial_mismatch"
        | "auto_reconciled"
      transaction_type: "deposit" | "withdrawal" | "bet" | "win" | "bonus"
      webhook_delivery_status: "pending" | "sent" | "failed" | "retrying"
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
      app_role: ["admin", "moderator", "user"],
      bet_status: ["pending", "won", "lost", "cashout"],
      gateway_tx_status: [
        "pending",
        "processing",
        "paid",
        "failed",
        "refunded",
        "cancelled",
        "review_required",
      ],
      ledger_entry_type: ["credit", "debit", "fee", "refund"],
      merchant_status: ["active", "suspended", "pending_review"],
      payment_attempt_status: ["pending", "success", "failed", "timeout"],
      payment_intent_status: [
        "requires_payment",
        "processing",
        "succeeded",
        "failed",
        "cancelled",
      ],
      security_event_type: [
        "api_key_created",
        "api_key_rotated",
        "rate_limit_hit",
        "suspicious_transaction",
        "webhook_signature_invalid",
        "unauthorized_access",
        "high_risk_transaction",
        "duplicate_payment",
        "critical_financial_mismatch",
        "auto_reconciled",
      ],
      transaction_type: ["deposit", "withdrawal", "bet", "win", "bonus"],
      webhook_delivery_status: ["pending", "sent", "failed", "retrying"],
    },
  },
} as const
