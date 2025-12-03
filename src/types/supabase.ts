export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: number;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      units: {
        Row: {
          id: number;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          created_at?: string;
        };
      };
      users: {
        Row: {
          id: number;
          name: string;
          unit_id: number;
          email: string | null;
          phone: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          unit_id: number;
          email?: string | null;
          phone?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          unit_id?: number;
          email?: string | null;
          phone?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      admins: {
        Row: {
          id: number;
          username: string;
          password_hash: string;
          email: string | null;
          full_name: string | null;
          is_super_admin: boolean;
          created_at: string;
          last_login: string | null;
        };
        Insert: {
          id?: number;
          username: string;
          password_hash: string;
          email?: string | null;
          full_name?: string | null;
          is_super_admin?: boolean;
          created_at?: string;
          last_login?: string | null;
        };
        Update: {
          id?: number;
          username?: string;
          password_hash?: string;
          email?: string | null;
          full_name?: string | null;
          is_super_admin?: boolean;
          created_at?: string;
          last_login?: string | null;
        };
      };
      items: {
        Row: {
          id: number;
          name: string;
          description: string | null;
          image_url: string | null;
          purchase_date: string | null;
          category_id: number | null;
          quantity: number;
          min_stock: number;
          location: string | null;
          serial_number: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          description?: string | null;
          image_url?: string | null;
          purchase_date?: string | null;
          category_id?: number | null;
          quantity?: number;
          min_stock?: number;
          location?: string | null;
          serial_number?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          description?: string | null;
          image_url?: string | null;
          purchase_date?: string | null;
          category_id?: number | null;
          quantity?: number;
          min_stock?: number;
          location?: string | null;
          serial_number?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      loans: {
        Row: {
          id: number;
          item_id: number;
          user_id: number;
          admin_id: number | null;
          borrow_date: string;
          expected_return_date: string;
          actual_return_date: string | null;
          purpose: string | null;
          status: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          item_id: number;
          user_id: number;
          admin_id?: number | null;
          borrow_date?: string;
          expected_return_date: string;
          actual_return_date?: string | null;
          purpose?: string | null;
          status?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          item_id?: number;
          user_id?: number;
          admin_id?: number | null;
          borrow_date?: string;
          expected_return_date?: string;
          actual_return_date?: string | null;
          purpose?: string | null;
          status?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      history_logs: {
        Row: {
          id: number;
          table_name: string;
          record_id: number;
          action: string;
          old_data: Json | null;
          new_data: Json | null;
          admin_id: number | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          table_name: string;
          record_id: number;
          action: string;
          old_data?: Json | null;
          new_data?: Json | null;
          admin_id?: number | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          table_name?: string;
          record_id?: number;
          action?: string;
          old_data?: Json | null;
          new_data?: Json | null;
          admin_id?: number | null;
          created_at?: string;
        };
      };
    };
    Views: {
      loan_reports: {
        Row: {
          id: number;
          item_name: string | null;
          category_id: number | null;
          category_name: string | null;
          user_name: string | null;
          unit_name: string | null;
          borrow_date: string | null;
          expected_return_date: string | null;
          actual_return_date: string | null;
          status: string | null;
          purpose: string | null;
          return_status: string | null;
          duration_days: number | null;
        };
      };
    };
    Functions: {
      get_active_loans_by_category: {
        Args: Record<PropertyKey, never>;
        Returns: Array<{
          category_name: string;
          active_loans: number;
        }>;
      };
    };
  };
}