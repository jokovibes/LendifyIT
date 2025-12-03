import { supabase } from '../lib/supabase';

// Types matching database
export interface Category {
  id: number;
  name: string;
  created_at: string;
}

export interface Item {
  id: number;
  name: string;
  description: string;
  image_url: string;
  purchase_date: string;
  category_id: number;
  quantity: number;
  min_stock: number;
  location?: string;
  serial_number?: string;
  is_active: boolean;
  created_at: string;
}

export interface User {
  id: number;
  name: string;
  unit_id: number;
  email?: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
}

export interface Loan {
  id: number;
  item_id: number;
  user_id: number;
  admin_id?: number;
  borrow_date: string;
  expected_return_date: string;
  actual_return_date?: string;
  purpose?: string;
  status: 'borrowed' | 'returned' | 'overdue' | 'cancelled';
  notes?: string;
  created_at: string;
}

// Service functions
export const DatabaseService = {
  // Items
  async getItems() {
    const { data, error } = await supabase
      .from('items')
      .select('*, categories(name)')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async createItem(item: Omit<Item, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('items')
      .insert([item])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateItem(id: number, updates: Partial<Item>) {
    const { data, error } = await supabase
      .from('items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteItem(id: number) {
    const { error } = await supabase
      .from('items')
      .update({ is_active: false })
      .eq('id', id);
    
    if (error) throw error;
  },

  // Categories
  async getCategories() {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data;
  },

  // Users
  async getUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('*, units(name)')
      .eq('is_active', true)
      .order('name');
    
    if (error) throw error;
    return data;
  },

  // Loans
  async getActiveLoans() {
    const { data, error } = await supabase
      .from('loans')
      .select(`
        *,
        items(name, image_url),
        users(name, units(name))
      `)
      .eq('status', 'borrowed')
      .order('borrow_date', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async createLoan(loan: Omit<Loan, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('loans')
      .insert([loan])
      .select(`
        *,
        items(name, image_url),
        users(name)
      `)
      .single();
    
    if (error) throw error;
    return data;
  },

  async returnLoan(id: number) {
    const { data, error } = await supabase
      .from('loans')
      .update({ 
        status: 'returned',
        actual_return_date: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Reports
  async getLoanReports() {
    const { data, error } = await supabase
      .from('loan_reports')
      .select('*')
      .order('borrow_date', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Authentication
  async loginAdmin(username: string, password: string) {
    // Note: For security, implement proper auth with Supabase Auth
    // This is a simplified version
    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .eq('username', username)
      .single();
    
    if (error) throw error;
    
    // In production, use proper password hashing comparison
    // This is just for demo
    if (password === 'password') { // Replace with bcrypt comparison
      return data;
    }
    throw new Error('Invalid credentials');
  }
};