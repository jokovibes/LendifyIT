import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase } from './src/lib/supabase'; // Pastikan file ini sudah dibuat
import type { Database } from './src/types/supabase'; // Generated types

// --- Generated Types dari Supabase ---
// Buat file types/supabase.ts dengan isi:
// export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
// export interface Database {
//   public: {
//     Tables: {
//       categories: { Row: { id: number; name: string; created_at: string; updated_at: string } };
//       units: { Row: { id: number; name: string; created_at: string } };
//       users: { Row: { id: number; name: string; unit_id: number; email: string | null; phone: string | null; is_active: boolean; created_at: string; updated_at: string } };
//       admins: { Row: { id: number; username: string; password_hash: string; email: string | null; full_name: string | null; is_super_admin: boolean; created_at: string; last_login: string | null } };
//       items: { Row: { id: number; name: string; description: string | null; image_url: string | null; purchase_date: string | null; category_id: number | null; quantity: number; min_stock: number; location: string | null; serial_number: string | null; is_active: boolean; created_at: string; updated_at: string } };
//       loans: { Row: { id: number; item_id: number; user_id: number; admin_id: number | null; borrow_date: string; expected_return_date: string; actual_return_date: string | null; purpose: string | null; status: string; notes: string | null; created_at: string; updated_at: string } };
//     };
//   };
// }

type Category = Database['public']['Tables']['categories']['Row'];
type Unit = Database['public']['Tables']['units']['Row'];
type User = Database['public']['Tables']['users']['Row'];
type Admin = Database['public']['Tables']['admins']['Row'];
type Item = Database['public']['Tables']['items']['Row'];
type Loan = Database['public']['Tables']['loans']['Row'];

// --- Interfaces untuk Frontend ---
interface Notification {
    id: number;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    onUndo?: () => void;
}

interface LoanRecord extends Loan {
    item_name?: string;
    item_image?: string;
    borrower_name?: string;
    unit_name?: string;
    category_name?: string;
}

interface BorrowedItem extends LoanRecord {
    // Helper interface for active loans
}

// --- Utility Functions ---
const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('id-ID', options);
};

const formatDateTime = (dateString: string) => {
    if (!dateString) return '-';
    const options: Intl.DateTimeFormatOptions = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('id-ID', options);
};

const calculateDuration = (start: string, end: string | null) => {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays === 0 ? '1 Hari' : `${diffDays} Hari`;
};

const calculateOverdueDays = (expectedDate: string) => {
    const expected = new Date(expectedDate);
    const today = new Date();
    
    expected.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffTime = Math.abs(today.getTime() - expected.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return today > expected ? diffDays : 0;
};

// Safe Local Storage Hook
function useLocalStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(`Error reading localStorage key "${key}":`, error);
            return initialValue;
        }
    });

    useEffect(() => {
        try {
            window.localStorage.setItem(key, JSON.stringify(storedValue));
        } catch (error) {
            console.error(`Error setting localStorage key "${key}":`, error);
        }
    }, [key, storedValue]);

    return [storedValue, setStoredValue];
}

// Password hashing utility (simplified - in production use proper bcrypt)
const hashPassword = async (password: string): Promise<string> => {
    // In production, use: return bcrypt.hash(password, 10);
    // For demo, we'll use a simple hash (NOT SECURE FOR PRODUCTION)
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// --- Database Service Functions ---
const DatabaseService = {
    // === AUTHENTICATION ===
    async login(username: string, password: string): Promise<Admin | null> {
        try {
            const { data, error } = await supabase
                .from('admins')
                .select('*')
                .eq('username', username)
                .single();

            if (error) throw error;
            if (!data) return null;

            // Verify password (simplified - use bcrypt.compare in production)
            const hashedInput = await hashPassword(password);
            // For demo, check against 'password' hash
            if (password === 'password' || hashedInput === data.password_hash) {
                // Update last login
                await supabase
                    .from('admins')
                    .update({ last_login: new Date().toISOString() })
                    .eq('id', data.id);
                
                return data;
            }
            return null;
        } catch (error) {
            console.error('Login error:', error);
            return null;
        }
    },

    async createAdmin(username: string, password: string, fullName?: string) {
        const hashedPassword = await hashPassword(password);
        const { data, error } = await supabase
            .from('admins')
            .insert([{
                username,
                password_hash: hashedPassword,
                full_name: fullName,
                is_super_admin: false
            }])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async updateAdmin(id: number, updates: Partial<Admin>) {
        if (updates.password) {
            updates.password_hash = await hashPassword(updates.password);
            delete updates.password;
        }
        
        const { data, error } = await supabase
            .from('admins')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async deleteAdmin(id: number) {
        const { error } = await supabase
            .from('admins')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
    },

    // === CATEGORIES ===
    async getCategories(): Promise<Category[]> {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order('name');
        
        if (error) throw error;
        return data || [];
    },

    async createCategory(name: string): Promise<Category> {
        const { data, error } = await supabase
            .from('categories')
            .insert([{ name }])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async deleteCategory(id: number) {
        const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
    },

    // === UNITS ===
    async getUnits(): Promise<Unit[]> {
        const { data, error } = await supabase
            .from('units')
            .select('*')
            .order('name');
        
        if (error) throw error;
        return data || [];
    },

    async createUnit(name: string): Promise<Unit> {
        const { data, error } = await supabase
            .from('units')
            .insert([{ name }])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async deleteUnit(id: number) {
        const { error } = await supabase
            .from('units')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
    },

    // === USERS ===
    async getUsers(): Promise<User[]> {
        const { data, error } = await supabase
            .from('users')
            .select('*, units(name)')
            .eq('is_active', true)
            .order('name');
        
        if (error) throw error;
        return data || [];
    },

    async createUser(name: string, unitId: number, email?: string, phone?: string): Promise<User> {
        const { data, error } = await supabase
            .from('users')
            .insert([{ 
                name, 
                unit_id: unitId,
                email,
                phone,
                is_active: true
            }])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async updateUser(id: number, updates: Partial<User>) {
        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async deleteUser(id: number) {
        const { error } = await supabase
            .from('users')
            .update({ is_active: false })
            .eq('id', id);
        
        if (error) throw error;
    },

    // === ITEMS ===
    async getItems(): Promise<Item[]> {
        const { data, error } = await supabase
            .from('items')
            .select('*, categories(name)')
            .eq('is_active', true)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
    },

    async createItem(item: Omit<Item, 'id' | 'created_at' | 'updated_at'>): Promise<Item> {
        const { data, error } = await supabase
            .from('items')
            .insert([item])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async updateItem(id: number, updates: Partial<Item>): Promise<Item> {
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

    // === LOANS ===
    async getLoans(status?: string): Promise<LoanRecord[]> {
        let query = supabase
            .from('loans')
            .select(`
                *,
                items(name, image_url, categories(name)),
                users(name, units(name))
            `)
            .order('borrow_date', { ascending: false });
        
        if (status) {
            query = query.eq('status', status);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        // Transform data
        return (data || []).map(loan => ({
            ...loan,
            item_name: loan.items?.name,
            item_image: loan.items?.image_url,
            borrower_name: loan.users?.name,
            unit_name: loan.users?.units?.name,
            category_name: loan.items?.categories?.name
        }));
    },

    async createLoan(
        itemId: number, 
        userId: number, 
        purpose: string, 
        expectedDuration: number,
        adminId?: number
    ): Promise<Loan> {
        const expectedReturn = new Date();
        expectedReturn.setDate(expectedReturn.getDate() + expectedDuration);
        
        const { data, error } = await supabase
            .from('loans')
            .insert([{
                item_id: itemId,
                user_id: userId,
                admin_id: adminId,
                purpose,
                expected_return_date: expectedReturn.toISOString().split('T')[0],
                status: 'borrowed'
            }])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async returnLoan(id: number): Promise<Loan> {
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

    // === REPORTS ===
    async getLoanReports() {
        const { data, error } = await supabase
            .from('loan_reports')
            .select('*')
            .order('borrow_date', { ascending: false });
        
        if (error) throw error;
        return data || [];
    },

    async getActiveLoansByCategory() {
        const { data, error } = await supabase
            .rpc('get_active_loans_by_category');
        
        if (error) throw error;
        return data || [];
    },

    // === STATISTICS ===
    async getStatistics() {
        const [
            totalItemsResult,
            activeLoansResult,
            overdueLoansResult,
            totalUsersResult
        ] = await Promise.all([
            supabase
                .from('items')
                .select('id', { count: 'exact', head: true })
                .eq('is_active', true),
            
            supabase
                .from('loans')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'borrowed'),
            
            supabase
                .from('loans')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'borrowed')
                .lt('expected_return_date', new Date().toISOString().split('T')[0]),
            
            supabase
                .from('users')
                .select('id', { count: 'exact', head: true })
                .eq('is_active', true)
        ]);

        return {
            totalItems: totalItemsResult.count || 0,
            activeLoans: activeLoansResult.count || 0,
            overdueLoans: overdueLoansResult.count || 0,
            totalUsers: totalUsersResult.count || 0
        };
    },

    // === CSV IMPORT/EXPORT ===
    async exportData(table: string) {
        const { data, error } = await supabase
            .from(table)
            .select('*');
        
        if (error) throw error;
        return data;
    },

    async importUsersCSV(csvData: any[]) {
        const users = csvData.map(row => ({
            name: row.name || row.Nama || '',
            unit_id: 1, // Default unit
            email: row.email || null,
            phone: row.phone || null,
            is_active: true
        }));

        const { error } = await supabase
            .from('users')
            .insert(users);
        
        if (error) throw error;
        return users.length;
    },

    async importItemsCSV(csvData: any[]) {
        // Get categories for mapping
        const categories = await DatabaseService.getCategories();
        
        const items = csvData.map(row => {
            const categoryName = row.category || row.kategori || row.Category || '';
            const category = categories.find(c => 
                c.name.toLowerCase() === categoryName.toLowerCase()
            );
            
            return {
                name: row.name || row.Nama || row.item || '',
                description: row.description || row.deskripsi || row.Deskripsi || '',
                image_url: row.image_url || row.image || row.gambar || 'https://via.placeholder.com/150',
                purchase_date: row.purchase_date || row.tanggal_beli || new Date().toISOString().split('T')[0],
                category_id: category?.id || 1,
                quantity: parseInt(row.quantity || row.jumlah || row.qty || '1'),
                min_stock: parseInt(row.min_stock || row.stok_minimum || '1'),
                location: row.location || row.lokasi || null,
                serial_number: row.serial_number || row.serial || null,
                is_active: true
            };
        });

        const { error } = await supabase
            .from('items')
            .insert(items);
        
        if (error) throw error;
        return items.length;
    }
};

// --- Components ---

// Notification Toast Container
const ToastContainer = ({ notifications, removeNotification }: { notifications: Notification[], removeNotification: (id: number) => void }) => {
    return (
        <div className="toast-container">
            {notifications.map(notif => (
                <div key={notif.id} className={`toast-notification ${notif.type}`} onClick={() => removeNotification(notif.id)}>
                    <div className="toast-icon">
                        {notif.type === 'success' && '✅'}
                        {notif.type === 'error' && '⛔'}
                        {notif.type === 'warning' && '⚠️'}
                        {notif.type === 'info' && 'ℹ️'}
                    </div>
                    <div className="toast-message">{notif.message}</div>
                    {notif.onUndo && (
                        <button 
                            className="toast-undo-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                notif.onUndo!();
                                removeNotification(notif.id);
                            }}
                        >
                            UNDO
                        </button>
                    )}
                    <button className="toast-close">×</button>
                </div>
            ))}
        </div>
    );
};

// Edit Modal
const EditModal = ({ item, onSave, onCancel, categories }: { item: Item; onSave: (updatedItem: Item) => void; onCancel: () => void; categories: Category[] }) => {
    const [name, setName] = useState(item.name);
    const [description, setDescription] = useState(item.description || '');
    const [imageUrl, setImageUrl] = useState(item.image_url || '');
    const [purchaseDate, setPurchaseDate] = useState(item.purchase_date || '');
    const [categoryId, setCategoryId] = useState(item.category_id || 1);
    const [quantity, setQuantity] = useState(item.quantity);
    const [minStock, setMinStock] = useState(item.min_stock);
    const [location, setLocation] = useState(item.location || '');
    const [serialNumber, setSerialNumber] = useState(item.serial_number || '');
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onCancel, 300);
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                setImageUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            try {
                const updatedItem = await DatabaseService.updateItem(item.id, {
                    name,
                    description,
                    image_url: imageUrl,
                    purchase_date: purchaseDate,
                    category_id: categoryId,
                    quantity,
                    min_stock: minStock,
                    location: location || null,
                    serial_number: serialNumber || null
                });
                onSave(updatedItem);
            } catch (error) {
                console.error('Failed to update item:', error);
            }
        }
    };

    return (
        <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
            <div className={`modal-content ${isClosing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
                <h2>Edit: {item.name}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="editItemName">Nama Barang *</label>
                        <input type="text" id="editItemName" className="form-control" value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="editItemDesc">Deskripsi</label>
                        <textarea 
                            id="editItemDesc" 
                            className="form-control" 
                            value={description} 
                            onChange={(e) => setDescription(e.target.value)} 
                            rows={3} 
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="editItemImg">Gambar Barang</label>
                        <input type="file" id="editItemImg" className="form-control" onChange={handleImageChange} accept="image/*" />
                        {imageUrl && <img src={imageUrl} alt="Pratinjau Gambar" className="image-preview" />}
                    </div>
                    <div className="form-row-grid" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                        <div className="form-group">
                            <label htmlFor="editItemCategory">Kategori</label>
                            <select id="editItemCategory" className="form-control" value={categoryId} onChange={e => setCategoryId(Number(e.target.value))}>
                                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="editItemPurchaseDate">Tanggal Pembelian</label>
                            <input type="date" id="editItemPurchaseDate" className="form-control" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
                        </div>
                    </div>
                    <div className="form-row-grid" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                        <div className="form-group">
                            <label htmlFor="editItemQuantity">Jumlah Stok</label>
                            <input type="number" id="editItemQuantity" className="form-control" value={quantity} onChange={e => setQuantity(Number(e.target.value))} min="0" required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="editItemMinStock">Stok Minimum</label>
                            <input type="number" id="editItemMinStock" className="form-control" value={minStock} onChange={e => setMinStock(Number(e.target.value))} min="1" required />
                        </div>
                    </div>
                    <div className="form-row-grid" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                        <div className="form-group">
                            <label htmlFor="editItemLocation">Lokasi</label>
                            <input type="text" id="editItemLocation" className="form-control" value={location} onChange={e => setLocation(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="editItemSerial">Nomor Seri</label>
                            <input type="text" id="editItemSerial" className="form-control" value={serialNumber} onChange={e => setSerialNumber(e.target.value)} />
                        </div>
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={handleClose}>Batal</button>
                        <button type="submit" className="btn btn-primary">Simpan</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Borrow Modal
const BorrowModal = ({ item, users, onConfirm, onCancel }: { item: Item, users: User[], onConfirm: (userId: number, purpose: string, duration: number) => void, onCancel: () => void }) => {
    const [selectedUserId, setSelectedUserId] = useState<number | ''>('');
    const [purpose, setPurpose] = useState('');
    const [duration, setDuration] = useState(7); // Default 7 days
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onCancel, 300);
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (selectedUserId && purpose.trim() && duration > 0) {
            onConfirm(Number(selectedUserId), purpose, duration);
        }
    };

    return (
        <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
            <div className={`modal-content ${isClosing ? 'closing' : ''}`} onClick={e => e.stopPropagation()}>
                <h2>Pinjam Barang: {item.name}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Peminjam *</label>
                        <select className="form-control" value={selectedUserId} onChange={e => setSelectedUserId(Number(e.target.value))} required>
                            <option value="">-- Pilih Peminjam --</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Rencana Durasi (Hari) *</label>
                        <input 
                            type="number" 
                            className="form-control" 
                            value={duration} 
                            onChange={e => setDuration(Math.max(1, Number(e.target.value)))} 
                            min="1" 
                            required 
                        />
                        <small style={{color: 'var(--secondary-color)'}}>
                            Estimasi pengembalian: {(() => {
                                const d = new Date();
                                d.setDate(d.getDate() + duration);
                                return formatDate(d.toISOString());
                            })()}
                        </small>
                    </div>
                    <div className="form-group">
                        <label>Keterangan / Keperluan *</label>
                        <textarea 
                            className="form-control" 
                            value={purpose} 
                            onChange={e => setPurpose(e.target.value)} 
                            required 
                            rows={3} 
                            placeholder="Contoh: Untuk meeting dengan klien X" 
                        />
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={handleClose}>Batal</button>
                        <button type="submit" className="btn btn-warning">Pinjam</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Borrower History Modal
const BorrowerHistoryModal = ({ user, onClose }: { user: User, onClose: () => void }) => {
    const [isClosing, setIsClosing] = useState(false);
    const [userLoans, setUserLoans] = useState<LoanRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadUserLoans();
    }, []);

    const loadUserLoans = async () => {
        try {
            const { data, error } = await supabase
                .from('loans')
                .select(`
                    *,
                    items(name, image_url),
                    users(name)
                `)
                .eq('user_id', user.id)
                .order('borrow_date', { ascending: false });
            
            if (error) throw error;
            
            setUserLoans(data || []);
        } catch (error) {
            console.error('Failed to load user loans:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 300);
    };

    const activeLoans = userLoans.filter(loan => loan.status === 'borrowed');
    const pastLoans = userLoans.filter(loan => loan.status === 'returned');

    return (
        <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
            <div className={`modal-content borrower-history-modal ${isClosing ? 'closing' : ''}`} onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
                    <h2>Riwayat Peminjaman</h2>
                    <button onClick={handleClose} className="btn btn-sm btn-secondary" style={{padding: '0.2rem 0.6rem'}}>X</button>
                </div>
                
                <div style={{marginBottom: '1.5rem'}}>
                    <h3 style={{fontSize: '1.4rem', color: 'var(--primary-color)', marginBottom: '0.2rem'}}>{user.name}</h3>
                </div>

                {loading ? (
                    <div style={{textAlign: 'center', padding: '2rem'}}>Memuat data...</div>
                ) : (
                    <>
                        <div className="modal-section">
                            <h4>Sedang Dipinjam ({activeLoans.length})</h4>
                            {activeLoans.length === 0 ? (
                                <p className="empty-state-modal">Tidak ada barang yang sedang dipinjam.</p>
                            ) : (
                                <ul className="borrower-items-list">
                                    {activeLoans.map(loan => (
                                        <li key={loan.id}>
                                            <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%'}}>
                                                {loan.items?.image_url && <img src={loan.items.image_url} alt="" style={{width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px'}} />}
                                                <div style={{flexGrow: 1}}>
                                                    <strong>{loan.items?.name}</strong>
                                                    <small>{formatDate(loan.borrow_date)} ({calculateDuration(loan.borrow_date, null)})</small>
                                                    {loan.purpose && <div className="modal-purpose">{loan.purpose}</div>}
                                                    {loan.expected_return_date && <small style={{display:'block', color: 'var(--info-color)'}}>Rencana: {formatDate(loan.expected_return_date)}</small>}
                                                </div>
                                                <span className="status-badge borrowed">Dipinjam</span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="modal-section">
                            <h4>Riwayat Transaksi</h4>
                            {pastLoans.length === 0 ? (
                                <p className="empty-state-modal">Belum ada riwayat pengembalian.</p>
                            ) : (
                                <ul className="borrower-history-list">
                                    {pastLoans.map(log => (
                                        <li key={log.id} className="history-item-consolidated modal-version">
                                            <div className="history-item-main">
                                                <span className="history-item-name" style={{fontSize: '0.95rem'}}>{log.items?.name}</span>
                                                <div className="history-date-wrapper history-item-details">
                                                    <span>Pinjam: {formatDate(log.borrow_date)}</span>
                                                    <span>Kembali: {formatDate(log.actual_return_date || '')}</span>
                                                    <span style={{color: 'var(--info-color)'}}>Durasi: {calculateDuration(log.borrow_date, log.actual_return_date)}</span>
                                                </div>
                                                {log.purpose && <div className="history-item-purpose modal-purpose">{log.purpose}</div>}
                                            </div>
                                            <span className="status-badge returned" style={{fontSize: '0.7rem'}}>Selesai</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </>
                )}
                
                <div className="modal-actions">
                    <button type="button" className="btn btn-primary" onClick={handleClose}>Tutup</button>
                </div>
            </div>
        </div>
    );
};

// Item History Modal
const ItemHistoryModal = ({ item, onClose }: { item: Item, onClose: () => void }) => {
    const [isClosing, setIsClosing] = useState(false);
    const [itemLoans, setItemLoans] = useState<LoanRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadItemLoans();
    }, []);

    const loadItemLoans = async () => {
        try {
            const { data, error } = await supabase
                .from('loans')
                .select(`
                    *,
                    items(name, image_url),
                    users(name)
                `)
                .eq('item_id', item.id)
                .order('borrow_date', { ascending: false });
            
            if (error) throw error;
            
            setItemLoans(data || []);
        } catch (error) {
            console.error('Failed to load item loans:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 300);
    };

    return (
        <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
            <div className={`modal-content borrower-history-modal ${isClosing ? 'closing' : ''}`} onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
                    <h2>Riwayat Barang</h2>
                    <button onClick={handleClose} className="btn btn-sm btn-secondary" style={{padding: '0.2rem 0.6rem'}}>X</button>
                </div>

                <div style={{marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem'}}>
                    <img src={item.image_url || 'https://via.placeholder.com/150'} alt={item.name} style={{width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px'}} />
                    <div>
                        <h3 style={{fontSize: '1.4rem', color: 'var(--primary-color)', marginBottom: '0.2rem'}}>{item.name}</h3>
                        <span style={{color: 'var(--secondary-color)'}}>Stok Saat Ini: {item.quantity}</span>
                    </div>
                </div>

                {loading ? (
                    <div style={{textAlign: 'center', padding: '2rem'}}>Memuat data...</div>
                ) : (
                    <div className="modal-section" style={{marginTop: '0'}}>
                        <h4>Daftar Peminjaman ({itemLoans.length})</h4>
                        {itemLoans.length === 0 ? (
                            <p className="empty-state-modal">Belum ada riwayat peminjaman untuk barang ini.</p>
                        ) : (
                            <ul className="borrower-history-list">
                                {itemLoans.map(log => (
                                    <li key={log.id} className="history-item-consolidated modal-version">
                                        <div className="history-item-main">
                                            <span className="history-item-name" style={{fontSize: '0.95rem'}}>
                                                {log.users?.name}
                                            </span>
                                            <div className="history-date-wrapper history-item-details">
                                                <span>Pinjam: {formatDate(log.borrow_date)}</span>
                                                {log.actual_return_date ? (
                                                    <>
                                                        <span>Kembali: {formatDate(log.actual_return_date)}</span>
                                                        <span style={{color: 'var(--info-color)'}}>Durasi: {calculateDuration(log.borrow_date, log.actual_return_date)}</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span style={{color: 'var(--warning-color)'}}>Belum dikembalikan</span>
                                                        <span style={{color: 'var(--info-color)'}}>Durasi: {calculateDuration(log.borrow_date, null)}</span>
                                                    </>
                                                )}
                                            </div>
                                            {log.purpose && <div className="history-item-purpose modal-purpose">{log.purpose}</div>}
                                        </div>
                                        <span className={`status-badge ${log.status}`}>
                                            {log.status === 'borrowed' ? 'Dipinjam' : 'Selesai'}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                <div className="modal-actions">
                    <button type="button" className="btn btn-primary" onClick={handleClose}>Tutup</button>
                </div>
            </div>
        </div>
    );
};

// Admin Management Modal
const AdminModal = ({ admin, onSave, onCancel }: { admin: Admin | null, onSave: (data: Partial<Admin>) => void, onCancel: () => void }) => {
    const [username, setUsername] = useState(admin ? admin.username : '');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fullName, setFullName] = useState(admin ? admin.full_name || '' : '');
    const [email, setEmail] = useState(admin ? admin.email || '' : '');
    const [error, setError] = useState('');

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        setError('');

        if (!username.trim()) {
            setError('Username harus diisi');
            return;
        }

        if (!admin && !password) {
            setError('Password wajib diisi untuk admin baru');
            return;
        }

        if (password && password !== confirmPassword) {
            setError('Konfirmasi password tidak cocok');
            return;
        }

        onSave({
            username,
            password: password || undefined,
            full_name: fullName || undefined,
            email: email || undefined
        });
    };

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h2>{admin ? 'Edit Admin / Reset Password' : 'Tambah Admin Baru'}</h2>
                <form onSubmit={handleSubmit}>
                    {error && <div className="login-error" style={{marginBottom: '1rem'}}>{error}</div>}
                    
                    <div className="form-group">
                        <label>Username *</label>
                        <input 
                            type="text" 
                            className="form-control" 
                            value={username} 
                            onChange={e => setUsername(e.target.value)} 
                            required 
                        />
                    </div>
                    
                    <div className="form-group">
                        <label>Nama Lengkap</label>
                        <input 
                            type="text" 
                            className="form-control" 
                            value={fullName} 
                            onChange={e => setFullName(e.target.value)} 
                        />
                    </div>
                    
                    <div className="form-group">
                        <label>Email</label>
                        <input 
                            type="email" 
                            className="form-control" 
                            value={email} 
                            onChange={e => setEmail(e.target.value)} 
                        />
                    </div>
                    
                    <div className="form-group">
                        <label>Password {admin && <span style={{fontSize: '0.8em', color: 'var(--secondary-color)'}}>(Kosongkan jika tidak ingin mengubah)</span>}</label>
                        <input 
                            type="password" 
                            className="form-control" 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            placeholder={admin ? "********" : ""}
                        />
                    </div>
                    
                    <div className="form-group">
                        <label>Konfirmasi Password</label>
                        <input 
                            type="password" 
                            className="form-control" 
                            value={confirmPassword} 
                            onChange={e => setConfirmPassword(e.target.value)} 
                        />
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onCancel}>Batal</button>
                        <button type="submit" className="btn btn-primary">Simpan</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Logout Confirmation Modal
const LogoutConfirmationModal = ({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) => {
    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '400px'}}>
                <h2 style={{color: 'var(--danger-color)'}}>Konfirmasi Logout</h2>
                <p>Apakah Anda yakin ingin keluar dari aplikasi?</p>
                <div className="modal-actions">
                    <button className="btn btn-secondary" onClick={onCancel}>Batal</button>
                    <button className="btn btn-danger" onClick={onConfirm}>Ya, Logout</button>
                </div>
            </div>
        </div>
    );
};

// SVG Chart Components
const SimpleLineChart = ({ data, title }: { data: number[], title: string }) => {
    const height = 150;
    const width = 300;
    const padding = 20;
    const max = Math.max(...data, 1);
    
    const points = data.map((value, index) => {
        const x = (index / (data.length - 1)) * (width - 2 * padding) + padding;
        const y = height - padding - (value / max) * (height - 2 * padding);
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="chart-container">
            <h4 style={{textAlign: 'center', marginBottom: '1rem', color: 'var(--text-color)'}}>{title}</h4>
            <svg viewBox={`0 0 ${width} ${height}`} className="line-chart-svg">
                {[0, 0.25, 0.5, 0.75, 1].map(p => (
                    <line 
                        key={p} 
                        x1={padding} 
                        y1={height - padding - p * (height - 2*padding)} 
                        x2={width - padding} 
                        y2={height - padding - p * (height - 2*padding)} 
                        stroke="var(--border-color)" 
                        strokeWidth="1" 
                    />
                ))}
                
                <polyline 
                    fill="none" 
                    stroke="var(--success-color)" 
                    strokeWidth="3" 
                    points={points} 
                />
                
                {data.map((value, index) => {
                    const x = (index / (data.length - 1)) * (width - 2 * padding) + padding;
                    const y = height - padding - (value / max) * (height - 2 * padding);
                    return (
                        <circle key={index} cx={x} cy={y} r="4" fill="var(--primary-color)" stroke="#fff" strokeWidth="2" />
                    );
                })}
            </svg>
            <div className="chart-labels">
                <span>7 Hari Lalu</span>
                <span>Hari Ini</span>
            </div>
        </div>
    );
};

const SimpleBarChart = ({ data }: { data: { name: string, count: number }[] }) => {
    if (data.length === 0) return <p className="empty-chart">Belum ada data peminjaman.</p>;

    const maxVal = Math.max(...data.map(d => d.count));
    const rowHeight = 40;
    const width = 400;
    const labelWidth = 140;
    const barMaxWidth = width - labelWidth - 40;
    const height = data.length * rowHeight;

    return (
        <div className="chart-container">
            <svg viewBox={`0 0 ${width} ${height}`} className="bar-chart-svg" style={{width: '100%', height: 'auto'}}>
            {data.map((item, index) => {
                const barWidth = (item.count / maxVal) * barMaxWidth;
                const y = index * rowHeight;
                return (
                    <g key={index} transform={`translate(0, ${y})`}>
                        <text x={labelWidth - 10} y={25} textAnchor="end" className="chart-text label" fill="var(--text-color)" fontSize="14">
                            {item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name}
                        </text>

                        <rect x={labelWidth} y={10} width={barMaxWidth} height={20} fill="var(--background-color)" rx="4" />

                        <rect
                            x={labelWidth}
                            y={10}
                            width={Math.max(barWidth, 5)}
                            height={20}
                            fill="var(--primary-color)"
                            rx="4"
                        />

                        <text x={labelWidth + barWidth + 10} y={25} className="chart-text value" fill="var(--text-color)" fontWeight="bold" fontSize="14">
                            {item.count}
                        </text>
                    </g>
                );
            })}
            </svg>
        </div>
    );
};

const SimpleDonutChart = ({ data, title = "Distribusi Kategori" }: { data: { name: string, value: number, color: string }[], title?: string }) => {
    const total = data.reduce((acc, curr) => acc + curr.value, 0);
    let cumulativePercent = 0;
    
    if (total === 0) {
        return <div style={{textAlign: 'center', padding: '1rem', color: 'var(--secondary-color)'}}>Belum ada data untuk ditampilkan.</div>
    }

    const gradient = data.map(item => {
        const start = cumulativePercent;
        const percent = (item.value / total) * 100;
        cumulativePercent += percent;
        return `${item.color} ${start}% ${cumulativePercent}%`;
    }).join(', ');

    return (
        <div className="donut-chart-container">
            <h4 style={{textAlign: 'center', marginBottom: '1rem', color: 'var(--text-color)'}}>{title}</h4>
            <div className="donut-chart-wrapper">
                <div 
                    className="donut-chart" 
                    style={{ background: `conic-gradient(${gradient})` }}
                >
                    <div className="donut-hole">
                        <span>{total}</span>
                        <small>Items</small>
                    </div>
                </div>
                <div className="donut-legend">
                    {data.map((item, idx) => (
                        <div key={idx} className="legend-item">
                            <span className="legend-color" style={{backgroundColor: item.color}}></span>
                            <span className="legend-label">{item.name}</span>
                            <span className="legend-value">{Math.round((item.value / total) * 100)}%</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// Loans Dashboard Component
const LoansSummaryDashboard = ({ loanHistory, items, users, categories }: { 
    loanHistory: LoanRecord[], 
    items: Item[], 
    users: User[], 
    categories: Category[] 
}) => {
    const activeLoans = loanHistory.filter(l => l.status === 'borrowed');
    const overdueLoans = activeLoans.filter(l => {
        if (!l.expected_return_date) return false;
        return calculateOverdueDays(l.expected_return_date) > 0;
    });

    const getActiveLoanCategoryData = () => {
        const colors = ['#0d47a1', '#ef5350', '#26a69a', '#ffca28', '#5c6bc0', '#90a4ae'];
        const data: any[] = [];
        
        categories.forEach((cat, idx) => {
            const catItemIds = items.filter(i => i.category_id === cat.id).map(i => i.id);
            const count = activeLoans.filter(l => catItemIds.includes(l.item_id)).length;
            
            if (count > 0) {
                data.push({
                    name: cat.name,
                    value: count,
                    color: colors[idx % colors.length]
                });
            }
        });
        return data;
    };

    return (
        <div className="loans-dashboard-summary">
            <h2>Dashboard Analisis Peminjaman</h2>
            
            <div className="loans-analytics-container">
                <div className="analytics-header-stats">
                    <div className="stat-card-modern warning">
                        <div className="stat-icon">📦</div>
                        <div className="stat-content">
                            <h3>{activeLoans.length}</h3>
                            <p>Sedang Dipinjam</p>
                        </div>
                    </div>
                    <div className="stat-card-modern danger">
                        <div className="stat-icon">⚠️</div>
                        <div className="stat-content">
                            <h3>{overdueLoans.length}</h3>
                            <p>Terlambat (Overdue)</p>
                        </div>
                    </div>
                    <div className="stat-card-modern info">
                        <div className="stat-icon">📊</div>
                        <div className="stat-content">
                            <h3>{items.reduce((acc, i) => acc + i.quantity, 0) + activeLoans.length}</h3>
                            <p>Total Aset Fisik</p>
                        </div>
                    </div>
                </div>

                <div className="analytics-split-view">
                    <div className="analytics-card chart-section">
                        <SimpleDonutChart data={getActiveLoanCategoryData()} title="Kategori Barang Dipinjam" />
                    </div>

                    <div className="analytics-card overdue-section">
                        <div className="overdue-header">
                            <h3>⚠️ Perlu Tindakan</h3>
                            <span className="badge">{overdueLoans.length} Items</span>
                        </div>
                        {overdueLoans.length === 0 ? (
                            <div className="empty-state-text">
                                <span style={{fontSize: '2rem', display:'block', marginBottom:'0.5rem'}}>👍</span>
                                Tidak ada barang terlambat.
                            </div>
                        ) : (
                            <ul className="overdue-list-modern">
                                {overdueLoans.map(loan => (
                                    <li key={loan.id}>
                                        <div className="overdue-item-top">
                                            <strong>{loan.item_name}</strong>
                                            <span className="overdue-days" style={{color: 'var(--danger-color)', fontWeight: 'bold'}}>
                                                {calculateOverdueDays(loan.expected_return_date!)} hari
                                            </span>
                                        </div>
                                        <div className="overdue-item-details">
                                            <span>👤 {loan.borrower_name}</span>
                                            <span>📅 {formatDate(loan.expected_return_date!)}</span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Main App Component
const App = () => {
    // --- State ---
    const [currentUser, setCurrentUser] = useState<Admin | null>(() => {
        const stored = sessionStorage.getItem('currentUser');
        return stored ? JSON.parse(stored) : null;
    });
    
    // Data
    const [items, setItems] = useState<Item[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [admins, setAdmins] = useState<Admin[]>([]);
    const [loanHistory, setLoanHistory] = useState<LoanRecord[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    
    // UI State
    const [activeTab, setActiveTab] = useState('inventory');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState<number | 'all'>('all');
    const [sortBy, setSortBy] = useState('name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    // Login State
    const [loginUsername, setLoginUsername] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginError, setLoginError] = useState('');

    // Modals
    const [editingItem, setEditingItem] = useState<Item | null>(null);
    const [borrowingItem, setBorrowingItem] = useState<Item | null>(null);
    const [newItem, setNewItem] = useState<Partial<Item>>({
        name: '', 
        description: '', 
        image_url: '', 
        purchase_date: new Date().toISOString().split('T')[0], 
        category_id: 1, 
        quantity: 1,
        min_stock: 1,
        is_active: true
    });
    const [viewingHistoryUser, setViewingHistoryUser] = useState<User | null>(null);
    const [viewingHistoryItem, setViewingHistoryItem] = useState<Item | null>(null);
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const [selectedAdminForEdit, setSelectedAdminForEdit] = useState<Admin | null>(null);
    const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

    // New Data Management State
    const [newUserName, setNewUserName] = useState('');
    const [newUserUnit, setNewUserUnit] = useState<number>(1);
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPhone, setNewUserPhone] = useState('');
    const [newUnitName, setNewUnitName] = useState('');
    const [newCategoryName, setNewCategoryName] = useState('');
    const [loading, setLoading] = useState(false);

    // --- Effects ---
    useEffect(() => {
        if (currentUser) {
            loadAllData();
            checkForOverdueItems();
        }
    }, [currentUser]);

    // --- Notification System ---
    const addNotification = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', onUndo?: () => void) => {
        const id = Date.now();
        setNotifications(prev => [...prev, { id, message, type, onUndo }]);
        
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 5000);
    };

    const removeNotification = (id: number) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    // --- Data Loading ---
    const loadAllData = async () => {
        setLoading(true);
        try {
            const [
                itemsData, 
                categoriesData, 
                usersData, 
                unitsData, 
                loansData,
                adminsData
            ] = await Promise.all([
                DatabaseService.getItems(),
                DatabaseService.getCategories(),
                DatabaseService.getUsers(),
                DatabaseService.getUnits(),
                DatabaseService.getLoans(),
                supabase.from('admins').select('*').then(({ data }) => data || [])
            ]);
            
            setItems(itemsData);
            setCategories(categoriesData);
            setUsers(usersData);
            setUnits(unitsData);
            setLoanHistory(loansData);
            setAdmins(adminsData);
            
        } catch (error) {
            console.error('Failed to load data:', error);
            addNotification('Gagal memuat data dari server', 'error');
        } finally {
            setLoading(false);
        }
    };

    const checkForOverdueItems = async () => {
        try {
            const { data } = await supabase
                .from('loans')
                .select('*')
                .eq('status', 'borrowed')
                .lt('expected_return_date', new Date().toISOString().split('T')[0]);
            
            if (data && data.length > 0) {
                addNotification(`${data.length} barang terlambat dikembalikan! Periksa Dashboard.`, 'warning');
            }
        } catch (error) {
            console.error('Failed to check overdue items:', error);
        }
    };

    // --- Handlers ---
    const handleLogin = async (e: FormEvent) => {
        e.preventDefault();
        setLoginError('');
        
        try {
            const admin = await DatabaseService.login(loginUsername, loginPassword);
            if (admin) {
                sessionStorage.setItem('currentUser', JSON.stringify(admin));
                setCurrentUser(admin);
                addNotification(`Selamat datang kembali, ${admin.username}!`, 'success');
            } else {
                setLoginError('Username atau password salah');
                addNotification('Login gagal. Periksa username atau password.', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            setLoginError('Terjadi kesalahan saat login');
            addNotification('Terjadi kesalahan saat login', 'error');
        }
    };

    const initiateLogout = () => {
        setIsLogoutModalOpen(true);
    };

    const confirmLogout = () => {
        sessionStorage.removeItem('currentUser');
        setCurrentUser(null);
        setIsLogoutModalOpen(false);
        addNotification('Anda telah berhasil logout.', 'info');
    };

    // Admin Management
    const handleSaveAdmin = async (data: Partial<Admin>) => {
        try {
            if (selectedAdminForEdit) {
                const updatedAdmin = await DatabaseService.updateAdmin(selectedAdminForEdit.id, data);
                setAdmins(admins.map(a => a.id === updatedAdmin.id ? updatedAdmin : a));
                addNotification('Data admin berhasil diperbarui.', 'success');
                
                if (currentUser?.id === selectedAdminForEdit.id && data.username) {
                    const updatedCurrentUser = { ...currentUser, username: data.username };
                    setCurrentUser(updatedCurrentUser);
                    sessionStorage.setItem('currentUser', JSON.stringify(updatedCurrentUser));
                }
            } else {
                if (!data.password) {
                    addNotification('Password harus diisi untuk admin baru', 'error');
                    return;
                }
                
                const newAdmin = await DatabaseService.createAdmin(
                    data.username!, 
                    data.password!,
                    data.full_name
                );
                setAdmins([...admins, newAdmin]);
                addNotification('Admin baru berhasil ditambahkan.', 'success');
            }
            
            setIsAdminModalOpen(false);
            setSelectedAdminForEdit(null);
        } catch (error) {
            console.error('Failed to save admin:', error);
            addNotification('Gagal menyimpan data admin', 'error');
        }
    };

    const handleDeleteAdmin = async (id: number) => {
        const adminToDelete = admins.find(a => a.id === id);
        if (!adminToDelete) return;

        if (adminToDelete.id === currentUser?.id) {
            addNotification('Anda tidak dapat menghapus akun Anda sendiri.', 'error');
            return;
        }
        
        if (admins.length <= 1) {
            addNotification('Sistem harus memiliki minimal satu admin.', 'error');
            return;
        }

        if (confirm(`Hapus akses admin untuk "${adminToDelete.username}"?`)) {
            try {
                await DatabaseService.deleteAdmin(id);
                setAdmins(admins.filter(a => a.id !== id));
                addNotification('Admin dihapus.', 'info');
            } catch (error) {
                console.error('Failed to delete admin:', error);
                addNotification('Gagal menghapus admin', 'error');
            }
        }
    };

    // Items
    const handleAddItem = async (e: FormEvent) => {
        e.preventDefault();
        if (!newItem.name) {
            addNotification('Nama barang harus diisi', 'error');
            return;
        }

        try {
            const itemData: Omit<Item, 'id' | 'created_at' | 'updated_at'> = {
                name: newItem.name!,
                description: newItem.description || '',
                image_url: newItem.image_url || 'https://via.placeholder.com/150',
                purchase_date: newItem.purchase_date || null,
                category_id: newItem.category_id || 1,
                quantity: newItem.quantity || 1,
                min_stock: newItem.min_stock || 1,
                location: newItem.location || null,
                serial_number: newItem.serial_number || null,
                is_active: true
            };

            const createdItem = await DatabaseService.createItem(itemData);
            setItems([createdItem, ...items]);
            
            setNewItem({
                name: '', 
                description: '', 
                image_url: '', 
                purchase_date: new Date().toISOString().split('T')[0], 
                category_id: 1, 
                quantity: 1,
                min_stock: 1
            });
            
            addNotification(`Barang baru "${createdItem.name}" berhasil ditambahkan!`, 'success');
        } catch (error) {
            console.error('Failed to add item:', error);
            addNotification('Gagal menambahkan barang', 'error');
        }
    };

    const handleDeleteItem = async (id: number) => {
        if (confirm('Apakah Anda yakin ingin menghapus barang ini?')) {
            const itemToDelete = items.find(i => i.id === id);
            if (!itemToDelete) return;

            try {
                await DatabaseService.deleteItem(id);
                setItems(items.filter(i => i.id !== id));
                
                addNotification(`Barang "${itemToDelete.name}" berhasil dihapus.`, 'info', async () => {
                    try {
                        await DatabaseService.updateItem(id, { is_active: true });
                        setItems(prevItems => [...prevItems, itemToDelete]);
                        addNotification(`Barang "${itemToDelete.name}" dikembalikan.`, 'success');
                    } catch (error) {
                        addNotification('Gagal mengembalikan barang', 'error');
                    }
                });
            } catch (error) {
                console.error('Failed to delete item:', error);
                addNotification('Gagal menghapus barang', 'error');
            }
        }
    };

    const handleUpdateItem = async (updatedItem: Item) => {
        try {
            setItems(items.map(i => i.id === updatedItem.id ? updatedItem : i));
            setEditingItem(null);
            addNotification('Data barang berhasil diperbarui.', 'success');
        } catch (error) {
            console.error('Failed to update item:', error);
            addNotification('Gagal memperbarui barang', 'error');
        }
    };

    const handleBorrowItem = async (userId: number, purpose: string, duration: number) => {
        if (!borrowingItem || borrowingItem.quantity <= 0) return;

        try {
            const loan = await DatabaseService.createLoan(
                borrowingItem.id,
                userId,
                purpose,
                duration,
                currentUser?.id
            );

            // Update item quantity locally
            setItems(items.map(i => 
                i.id === borrowingItem.id 
                ? { ...i, quantity: i.quantity - 1 }
                : i
            ));

            // Add to loan history
            const loanWithDetails: LoanRecord = {
                ...loan,
                item_name: borrowingItem.name,
                item_image: borrowingItem.image_url,
                borrower_name: users.find(u => u.id === userId)?.name
            };
            
            setLoanHistory([loanWithDetails, ...loanHistory]);
            setBorrowingItem(null);
            
            addNotification(`Peminjaman "${borrowingItem.name}" berhasil dicatat.`, 'success');
        } catch (error) {
            console.error('Failed to create loan:', error);
            addNotification('Gagal mencatat peminjaman', 'error');
        }
    };

    const handleReturnItem = async (loanId: number) => {
        try {
            await DatabaseService.returnLoan(loanId);
            
            // Update local state
            const updatedLoans = loanHistory.map(loan => 
                loan.id === loanId 
                ? { ...loan, status: 'returned', actual_return_date: new Date().toISOString() }
                : loan
            );
            setLoanHistory(updatedLoans);

            // Update item quantity
            const loan = loanHistory.find(l => l.id === loanId);
            if (loan) {
                setItems(items.map(item => 
                    item.id === loan.item_id 
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
                ));
            }

            // Check if late
            const loanRecord = loanHistory.find(l => l.id === loanId);
            if (loanRecord?.expected_return_date) {
                const overdueDays = calculateOverdueDays(loanRecord.expected_return_date);
                if (overdueDays > 0) {
                    addNotification(`Barang "${loanRecord.item_name}" dikembalikan TERLAMBAT (${overdueDays} hari).`, 'warning');
                } else {
                    addNotification(`Barang "${loanRecord.item_name}" berhasil dikembalikan.`, 'success');
                }
            }
        } catch (error) {
            console.error('Failed to return item:', error);
            addNotification('Gagal mengembalikan barang', 'error');
        }
    };

    // Categories
    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) {
            addNotification('Nama kategori harus diisi', 'error');
            return;
        }

        try {
            const category = await DatabaseService.createCategory(newCategoryName.trim());
            setCategories([...categories, category]);
            setNewCategoryName('');
            addNotification('Kategori baru ditambahkan.', 'success');
        } catch (error) {
            console.error('Failed to add category:', error);
            addNotification('Gagal menambahkan kategori', 'error');
        }
    };

    const handleDeleteCategory = async (id: number) => {
        if (confirm('Menghapus kategori akan mempengaruhi barang yang terhubung. Lanjutkan?')) {
            try {
                // Check if any items use this category
                const itemsInCategory = items.filter(i => i.category_id === id);
                if (itemsInCategory.length > 0) {
                    if (!confirm(`${itemsInCategory.length} barang menggunakan kategori ini. Tetap hapus?`)) {
                        return;
                    }
                }

                await DatabaseService.deleteCategory(id);
                setCategories(categories.filter(c => c.id !== id));
                addNotification('Kategori dihapus.', 'info');
            } catch (error) {
                console.error('Failed to delete category:', error);
                addNotification('Gagal menghapus kategori', 'error');
            }
        }
    };

    // Users & Units
    const handleAddUser = async () => {
        if (!newUserName.trim()) {
            addNotification('Nama user harus diisi', 'error');
            return;
        }

        try {
            const user = await DatabaseService.createUser(
                newUserName.trim(),
                newUserUnit,
                newUserEmail || undefined,
                newUserPhone || undefined
            );
            
            setUsers([...users, user]);
            setNewUserName('');
            setNewUserEmail('');
            setNewUserPhone('');
            addNotification('User baru ditambahkan.', 'success');
        } catch (error) {
            console.error('Failed to add user:', error);
            addNotification('Gagal menambahkan user', 'error');
        }
    };

    const handleAddUnit = async () => {
        if (!newUnitName.trim()) {
            addNotification('Nama unit harus diisi', 'error');
            return;
        }

        try {
            const unit = await DatabaseService.createUnit(newUnitName.trim());
            setUnits([...units, unit]);
            setNewUnitName('');
            addNotification('Unit baru ditambahkan.', 'success');
        } catch (error) {
            console.error('Failed to add unit:', error);
            addNotification('Gagal menambahkan unit', 'error');
        }
    };

    // CSV Import/Export
    const parseCSV = (content: string) => {
        const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) return [];
        
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        return lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim());
            const row: any = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            return row;
        });
    };

    const handleUserCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return;

        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = async (evt) => {
            try {
                const text = evt.target?.result as string;
                const csvData = parseCSV(text);
                
                if (csvData.length === 0) {
                    addNotification('File CSV kosong', 'warning');
                    return;
                }

                const importedCount = await DatabaseService.importUsersCSV(csvData);
                await loadAllData(); // Reload data
                addNotification(`${importedCount} pengguna berhasil diimpor!`, 'success');
            } catch (error) {
                console.error('Failed to import users:', error);
                addNotification('Gagal mengimpor data user', 'error');
            }
        };
        
        reader.readAsText(file);
    };

    const handleItemCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return;

        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = async (evt) => {
            try {
                const text = evt.target?.result as string;
                const csvData = parseCSV(text);
                
                if (csvData.length === 0) {
                    addNotification('File CSV kosong', 'warning');
                    return;
                }

                const importedCount = await DatabaseService.importItemsCSV(csvData);
                await loadAllData(); // Reload data
                addNotification(`${importedCount} barang berhasil diimpor!`, 'success');
            } catch (error) {
                console.error('Failed to import items:', error);
                addNotification('Gagal mengimpor data barang', 'error');
            }
        };
        
        reader.readAsText(file);
    };

    const exportToCSV = (data: any[], filename: string) => {
        if (data.length === 0) {
            addNotification('Tidak ada data untuk diexport', 'warning');
            return;
        }

        const headers = Object.keys(data[0]).join(',');
        const rows = data.map(obj => 
            Object.values(obj).map(val => 
                typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val
            ).join(',')
        );
        
        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        addNotification(`Data berhasil diexport ke ${filename}`, 'success');
    };

    // Printing and PDF
    const handlePrint = () => {
        window.print();
    };

    const handleExportPDF = async () => {
        const reportElement = document.querySelector('.report-container') as HTMLElement;
        if (!reportElement) {
            addNotification('Elemen laporan tidak ditemukan', 'error');
            return;
        }

        addNotification('Sedang membuat PDF...', 'info');
        
        try {
            // @ts-ignore
            const { jsPDF } = window.jspdf;
            // @ts-ignore
            const html2canvas = window.html2canvas;
            
            const canvas = await html2canvas(reportElement, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`LendifyIT-Laporan-${new Date().toISOString().split('T')[0]}.pdf`);
            addNotification('PDF berhasil diunduh.', 'success');
        } catch (error) {
            console.error('Failed to export PDF:', error);
            addNotification('Gagal membuat PDF', 'error');
        }
    };

    // --- Filtered Data ---
    const filteredItems = items
        .filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                (item.description || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = filterCategory === 'all' || item.category_id === filterCategory;
            return matchesSearch && matchesCategory;
        })
        .sort((a, b) => {
            let valA: any = a[sortBy as keyof Item];
            let valB: any = b[sortBy as keyof Item];
            
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            
            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

    // Calculate Popular Items for Reports
    const itemPopularity = loanHistory.reduce((acc, loan) => {
        acc[loan.item_id] = (acc[loan.item_id] || 0) + 1;
        return acc;
    }, {} as Record<number, number>);

    const popularItems = (Object.entries(itemPopularity)
        .map(([itemId, count]) => {
            const item = items.find(i => i.id === Number(itemId));
            return item ? { name: item.name, count } : null;
        })
        .filter(item => item !== null) as { name: string, count: number }[])
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    // Calculate Trends for Reports
    const getLast7DaysData = () => {
        const data = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            
            const count = loanHistory.filter(l => l.borrow_date.startsWith(dateStr)).length;
            data.push(count);
        }
        return data;
    };

    const getCategoryData = () => {
        const colors = ['#0d47a1', '#26a69a', '#ef5350', '#ffca28', '#5c6bc0', '#90a4ae'];
        const data: any[] = [];
        categories.forEach((cat, idx) => {
            const count = items.filter(i => i.category_id === cat.id).length;
            if (count > 0) {
                data.push({
                    name: cat.name,
                    value: count,
                    color: colors[idx % colors.length]
                });
            }
        });
        return data;
    };

    // --- Login View ---
    if (!currentUser) {
        return (
            <div className="login-container">
                <ToastContainer notifications={notifications} removeNotification={removeNotification} />
                <form className="login-form" onSubmit={handleLogin}>
                    <div className="login-logo">
                        <h2>LendifyIT Login</h2>
                    </div>
                    {loginError && <div className="login-error">{loginError}</div>}
                    <div className="form-group">
                        <label>Username</label>
                        <input 
                            type="text" 
                            className="form-control" 
                            value={loginUsername} 
                            onChange={e => setLoginUsername(e.target.value)} 
                            required 
                        />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input 
                            type="password" 
                            className="form-control" 
                            value={loginPassword} 
                            onChange={e => setLoginPassword(e.target.value)} 
                            required 
                        />
                    </div>
                    <button type="submit" className="btn btn-primary">
                        {loading ? 'Loading...' : 'Login'}
                    </button>
                    <p style={{marginTop: '1rem', fontSize: '0.9rem', color: 'var(--secondary-color)', textAlign: 'center'}}>
                        Demo: admin / password
                    </p>
                </form>
            </div>
        );
    }

    // --- Main View ---
    return (
        <div className="app">
            <ToastContainer notifications={notifications} removeNotification={removeNotification} />
            
            {/* HEADER */}
            <header>
                <div className="header-user-info">
                    <span className="username">
                        Welcome, <strong>{currentUser.full_name || currentUser.username}</strong>
                        {currentUser.is_super_admin && <span style={{color: 'var(--warning-color)', marginLeft: '0.5rem'}}>(Super Admin)</span>}
                    </span>
                    <button onClick={initiateLogout} className="btn btn-sm btn-logout">Logout</button>
                </div>
                <div className="header-title-container">
                    <div className="header-logo">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M4 6H20M4 12H20M4 18H20" stroke="#0d47a1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </div>
                    <h1>LendifyIT</h1>
                </div>
                <p>Sistem Peminjaman Barang IT</p>
            </header>

            <main>
                {/* NAVIGATION */}
                <nav className="main-nav">
                    <a href="#" className={activeTab === 'inventory' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveTab('inventory'); }}>
                        Inventaris
                    </a>
                    <a href="#" className={activeTab === 'loans' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveTab('loans'); }}>
                        Peminjaman
                    </a>
                    <a href="#" className={activeTab === 'history' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveTab('history'); }}>
                        Riwayat
                    </a>
                    <a href="#" className={activeTab === 'management' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveTab('management'); }}>
                        Pengguna & Unit
                    </a>
                    <a href="#" className={activeTab === 'reports' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveTab('reports'); }}>
                        Laporan
                    </a>
                    <a href="#" className={activeTab === 'settings' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveTab('settings'); }}>
                        Pengaturan
                    </a>
                </nav>

                <div className="page-container">
                    {/* --- INVENTORY TAB --- */}
                    {activeTab === 'inventory' && (
                        <>
                            <div className="global-controls">
                                <div className="view-mode-toggle">
                                    <button className={`btn ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('grid')} title="Tampilan Grid">
                                        Grid
                                    </button>
                                    <button className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('list')} title="Tampilan List">
                                        List
                                    </button>
                                </div>
                            </div>

                            <div className="item-section">
                                <div className="filter-controls">
                                    <div className="search-input-wrapper">
                                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                        <input type="text" className="form-control" placeholder="Cari barang..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                    </div>
                                    <select className="form-control" style={{ width: 'auto' }} value={filterCategory} onChange={e => setFilterCategory(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
                                        <option value="all">Semua Kategori</option>
                                        {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                    </select>
                                </div>

                                {loading ? (
                                    <div style={{textAlign: 'center', padding: '3rem', color: 'var(--secondary-color)'}}>
                                        Memuat data inventaris...
                                    </div>
                                ) : (
                                    <div className={`item-container view-mode-${viewMode}`}>
                                        {filteredItems.map(item => (
                                            <div key={item.id} className={`item-card view-${viewMode} ${item.quantity === 0 ? 'out-of-stock' : ''}`}>
                                                <img src={item.image_url || 'https://via.placeholder.com/150'} alt={item.name} className="item-card-image" />
                                                <div className="item-card-content">
                                                    <div className="item-card-info-wrapper">
                                                        <div className="item-card-header">
                                                            <h3>{item.name}</h3>
                                                            {item.quantity === 0 && <span className="item-card-quantity-badge" style={{backgroundColor: '#ef5350'}}>Stok Habis</span>}
                                                            {item.quantity > 0 && item.quantity <= (item.min_stock || 1) && (
                                                                <span className="item-card-quantity-badge" style={{backgroundColor: 'var(--warning-color)'}}>Stok Menipis</span>
                                                            )}
                                                        </div>
                                                        <div className="item-card-badges">
                                                            <span className="item-card-category-badge">
                                                                {categories.find(c => c.id === item.category_id)?.name || 'Unknown'}
                                                            </span>
                                                            <span className="item-card-quantity-badge">Stok: {item.quantity}</span>
                                                        </div>
                                                        <p className="item-card-description">{item.description || 'Tidak ada deskripsi'}</p>
                                                        {item.location && <p style={{fontSize: '0.9rem', color: 'var(--secondary-color)'}}>📍 {item.location}</p>}
                                                        {item.serial_number && <p style={{fontSize: '0.85rem', color: 'var(--secondary-color)'}}>🔢 SN: {item.serial_number}</p>}
                                                    </div>
                                                    <div className="item-card-actions">
                                                        <button 
                                                            className="btn btn-warning btn-sm" 
                                                            onClick={() => setBorrowingItem(item)} 
                                                            disabled={item.quantity === 0}
                                                        >
                                                            Pinjam
                                                        </button>
                                                        <button className="btn btn-info btn-sm" onClick={() => setViewingHistoryItem(item)}>Riwayat</button>
                                                        <button className="btn btn-primary btn-sm" onClick={() => setEditingItem(item)}>Edit</button>
                                                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteItem(item.id)}>Hapus</button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {filteredItems.length === 0 && (
                                            <div className="empty-state">
                                                {searchTerm || filterCategory !== 'all' ? 'Tidak ada barang ditemukan.' : 'Belum ada barang.'}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* --- LOANS TAB --- */}
                    {activeTab === 'loans' && (
                        <>
                            <LoansSummaryDashboard 
                                loanHistory={loanHistory} 
                                items={items} 
                                users={users} 
                                categories={categories} 
                            />
                            
                            <div className="item-section">
                                <h2>Barang Sedang Dipinjam</h2>
                                {loading ? (
                                    <div style={{textAlign: 'center', padding: '3rem', color: 'var(--secondary-color)'}}>
                                        Memuat data peminjaman...
                                    </div>
                                ) : loanHistory.filter(l => l.status === 'borrowed').length === 0 ? (
                                    <div className="empty-state">Tidak ada barang yang sedang dipinjam.</div>
                                ) : (
                                    <div className="item-container view-mode-grid">
                                        {loanHistory
                                            .filter(l => l.status === 'borrowed')
                                            .map(loan => {
                                                const isOverdue = loan.expected_return_date ? 
                                                    calculateOverdueDays(loan.expected_return_date) > 0 : false;
                                                
                                                return (
                                                    <div key={loan.id} className={`item-card view-grid ${isOverdue ? 'out-of-stock' : ''}`}>
                                                        <img src={loan.item_image || 'https://via.placeholder.com/150'} alt={loan.item_name} className="item-card-image" style={{height: '150px'}} />
                                                        <div className="item-card-content">
                                                            <div className="item-card-header">
                                                                <h3>{loan.item_name}</h3>
                                                                <span className="item-card-borrower-badge">
                                                                    {loan.borrower_name}
                                                                </span>
                                                            </div>
                                                            <div className="borrowed-info">
                                                                <p><strong>Tanggal Pinjam:</strong> {formatDateTime(loan.borrow_date)}</p>
                                                                {loan.expected_return_date && (
                                                                    <p>
                                                                        <strong>Batas Pengembalian:</strong> {formatDate(loan.expected_return_date)}
                                                                        {isOverdue && (
                                                                            <span style={{color: 'var(--danger-color)', fontWeight: 'bold', marginLeft: '0.5rem'}}>
                                                                                (Terlambat {calculateOverdueDays(loan.expected_return_date)} hari)
                                                                            </span>
                                                                        )}
                                                                    </p>
                                                                )}
                                                                {loan.purpose && (
                                                                    <div className="borrowed-purpose">
                                                                        <strong>Keperluan:</strong><br/>
                                                                        {loan.purpose}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="item-card-actions">
                                                                <button className="btn btn-success btn-sm" onClick={() => handleReturnItem(loan.id)}>
                                                                    Kembalikan
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* --- HISTORY TAB --- */}
                    {activeTab === 'history' && (
                        <div className="history-section">
                            <h2>Riwayat Transaksi</h2>
                            {loading ? (
                                <div style={{textAlign: 'center', padding: '3rem', color: 'var(--secondary-color)'}}>
                                    Memuat riwayat transaksi...
                                </div>
                            ) : (
                                <div className="history-log">
                                    <ul>
                                        {loanHistory.map(log => (
                                            <li key={log.id} className="history-item-consolidated">
                                                <div className="history-img-wrapper">
                                                    <img src={log.item_image || 'https://via.placeholder.com/150'} alt={log.item_name} />
                                                </div>
                                                
                                                <div className="history-info-wrapper">
                                                    <span className="history-item-name">{log.item_name}</span>
                                                    <span className="history-item-borrower">
                                                        Oleh: {log.borrower_name}
                                                    </span>
                                                    {log.purpose && <div className="history-item-purpose">{log.purpose}</div>}
                                                </div>

                                                <div className="history-date-wrapper">
                                                    <div className="date-row">
                                                        <span className="date-label">Pinjam:</span>
                                                        <span>{formatDateTime(log.borrow_date)}</span>
                                                    </div>
                                                    {log.actual_return_date && (
                                                        <div className="date-row">
                                                            <span className="date-label">Kembali:</span>
                                                            <span>{formatDateTime(log.actual_return_date)}</span>
                                                        </div>
                                                    )}
                                                    <span className="history-duration">
                                                        Durasi: {calculateDuration(log.borrow_date, log.actual_return_date)}
                                                    </span>
                                                </div>

                                                <div className="history-status-wrapper">
                                                    <span className={`history-item-status ${log.status === 'borrowed' ? 'status-borrowed' : 'status-completed'}`}>
                                                        {log.status === 'borrowed' ? 'Dipinjam' : 'Selesai'}
                                                    </span>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                    {loanHistory.length === 0 && <div className="empty-state">Belum ada riwayat transaksi.</div>}
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- MANAGEMENT TAB (USERS & UNITS) --- */}
                    {activeTab === 'management' && (
                        <div className="user-admin-grid">
                            <div className="management-section">
                                <div className="manager-header">
                                    <h3>Manajemen Pengguna</h3>
                                    <button 
                                        className="btn btn-secondary btn-sm" 
                                        onClick={() => exportToCSV(users, 'users.csv')}
                                        disabled={users.length === 0}
                                    >
                                        Export CSV
                                    </button>
                                </div>
                                <div className="form-inline" style={{marginBottom: '1rem'}}>
                                    <input 
                                        type="text" 
                                        className="form-control" 
                                        placeholder="Nama User Baru" 
                                        value={newUserName} 
                                        onChange={e => setNewUserName(e.target.value)} 
                                    />
                                    <select className="form-control" value={newUserUnit} onChange={e => setNewUserUnit(Number(e.target.value))}>
                                        {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                    <button className="btn btn-primary" onClick={handleAddUser} disabled={!newUserName.trim()}>
                                        Tambah
                                    </button>
                                </div>
                                
                                <div className="form-row-grid" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem'}}>
                                    <input 
                                        type="email" 
                                        className="form-control" 
                                        placeholder="Email (opsional)" 
                                        value={newUserEmail} 
                                        onChange={e => setNewUserEmail(e.target.value)} 
                                    />
                                    <input 
                                        type="tel" 
                                        className="form-control" 
                                        placeholder="Telepon (opsional)" 
                                        value={newUserPhone} 
                                        onChange={e => setNewUserPhone(e.target.value)} 
                                    />
                                </div>
                                
                                <div className="data-manager-section" style={{marginBottom: '1rem'}}>
                                    <label style={{fontSize: '0.9rem', display: 'block', marginBottom: '0.5rem'}}>Import dari CSV:</label>
                                    <input type="file" accept=".csv" onChange={handleUserCSVUpload} />
                                </div>

                                {loading ? (
                                    <div style={{textAlign: 'center', padding: '2rem', color: 'var(--secondary-color)'}}>
                                        Memuat data pengguna...
                                    </div>
                                ) : (
                                    <ul className="category-list">
                                        {users.map(u => {
                                            const unit = units.find(un => un.id === u.unit_id);
                                            return (
                                                <li key={u.id} className="category-list-item">
                                                    <div>
                                                        <strong>{u.name}</strong> <br/>
                                                        <small style={{color: '#90a4ae'}}>
                                                            {unit?.name || 'Unknown Unit'}
                                                            {u.email && ` • ${u.email}`}
                                                            {u.phone && ` • 📞 ${u.phone}`}
                                                        </small>
                                                    </div>
                                                    <div className="category-actions">
                                                        <button className="btn btn-info btn-sm" onClick={() => setViewingHistoryUser(u)}>Riwayat</button>
                                                        <button className="btn btn-danger btn-sm" onClick={() => {
                                                            if(confirm('Hapus user ini?')) {
                                                                DatabaseService.deleteUser(u.id)
                                                                    .then(() => setUsers(users.filter(x => x.id !== u.id)))
                                                                    .catch(error => console.error('Failed to delete user:', error));
                                                            }
                                                        }}>Hapus</button>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>

                            <div className="management-section">
                                <div className="manager-header">
                                    <h3>Manajemen Unit/Divisi</h3>
                                    <button 
                                        className="btn btn-secondary btn-sm" 
                                        onClick={() => exportToCSV(units, 'units.csv')}
                                        disabled={units.length === 0}
                                    >
                                        Export CSV
                                    </button>
                                </div>
                                <div className="form-inline" style={{marginBottom: '1rem'}}>
                                    <input 
                                        type="text" 
                                        className="form-control" 
                                        placeholder="Nama Unit Baru" 
                                        value={newUnitName} 
                                        onChange={e => setNewUnitName(e.target.value)} 
                                    />
                                    <button className="btn btn-primary" onClick={handleAddUnit} disabled={!newUnitName.trim()}>
                                        Tambah
                                    </button>
                                </div>

                                {loading ? (
                                    <div style={{textAlign: 'center', padding: '2rem', color: 'var(--secondary-color)'}}>
                                        Memuat data unit...
                                    </div>
                                ) : (
                                    <ul className="category-list">
                                        {units.map(u => (
                                            <li key={u.id} className="category-list-item">
                                                <span>{u.name}</span>
                                                <button className="btn btn-danger btn-sm" onClick={() => {
                                                    if(confirm('Hapus unit ini?')) {
                                                        DatabaseService.deleteUnit(u.id)
                                                            .then(() => setUnits(units.filter(x => x.id !== u.id)))
                                                            .catch(error => console.error('Failed to delete unit:', error));
                                                    }
                                                }}>Hapus</button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    )}
                    
                    {/* --- SETTINGS TAB --- */}
                    {activeTab === 'settings' && (
                        <div className="user-admin-grid">
                            <div className="add-item-section full-width-grid-item">
                                <div className="manager-header">
                                    <h3>Tambah Barang Baru</h3>
                                    <button 
                                        className="btn btn-secondary btn-sm" 
                                        onClick={() => exportToCSV(items, 'items.csv')}
                                        disabled={items.length === 0}
                                    >
                                        Export CSV
                                    </button>
                                </div>
                                
                                <form className="add-item-form" onSubmit={handleAddItem}>
                                    <div className="form-row-grid" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                                        <div className="form-group">
                                            <label>Nama Barang *</label>
                                            <input 
                                                type="text" 
                                                className="form-control" 
                                                value={newItem.name} 
                                                onChange={e => setNewItem({ ...newItem, name: e.target.value })} 
                                                required 
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Kategori</label>
                                            <select 
                                                className="form-control" 
                                                value={newItem.category_id} 
                                                onChange={e => setNewItem({ ...newItem, category_id: Number(e.target.value) })}
                                            >
                                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>Deskripsi</label>
                                        <textarea 
                                            className="form-control" 
                                            value={newItem.description} 
                                            onChange={e => setNewItem({ ...newItem, description: e.target.value })} 
                                            rows={3}
                                        />
                                    </div>
                                    <div className="form-row-grid" style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem'}}>
                                        <div className="form-group">
                                            <label>Jumlah Stok *</label>
                                            <input 
                                                type="number" 
                                                className="form-control" 
                                                value={newItem.quantity} 
                                                onChange={e => setNewItem({ ...newItem, quantity: Number(e.target.value) })} 
                                                min="1" 
                                                required 
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Stok Minimum</label>
                                            <input 
                                                type="number" 
                                                className="form-control" 
                                                value={newItem.min_stock || 1} 
                                                onChange={e => setNewItem({ ...newItem, min_stock: Number(e.target.value) })} 
                                                min="1" 
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Tanggal Pembelian</label>
                                            <input 
                                                type="date" 
                                                className="form-control" 
                                                value={newItem.purchase_date} 
                                                onChange={e => setNewItem({ ...newItem, purchase_date: e.target.value })} 
                                            />
                                        </div>
                                    </div>
                                    <div className="form-row-grid" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                                        <div className="form-group">
                                            <label>Lokasi</label>
                                            <input 
                                                type="text" 
                                                className="form-control" 
                                                value={newItem.location || ''} 
                                                onChange={e => setNewItem({ ...newItem, location: e.target.value })} 
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Nomor Seri</label>
                                            <input 
                                                type="text" 
                                                className="form-control" 
                                                value={newItem.serial_number || ''} 
                                                onChange={e => setNewItem({ ...newItem, serial_number: e.target.value })} 
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>Gambar Barang</label>
                                        <input 
                                            type="file" 
                                            className="form-control" 
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files[0]) {
                                                    const file = e.target.files[0];
                                                    const reader = new FileReader();
                                                    reader.onloadend = () => {
                                                        setNewItem({ ...newItem, image_url: reader.result as string });
                                                    };
                                                    reader.readAsDataURL(file);
                                                }
                                            }} 
                                            accept="image/*" 
                                        />
                                        {newItem.image_url && (
                                            <div style={{marginTop: '0.5rem'}}>
                                                <img src={newItem.image_url} alt="Preview" style={{maxHeight: '80px', borderRadius: '4px'}} />
                                            </div>
                                        )}
                                    </div>
                                    <button type="submit" className="btn btn-success" style={{marginTop: '1rem', width: '100%'}}>
                                        Simpan Barang
                                    </button>
                                </form>

                                <div className="data-manager-section" style={{marginTop: '2rem'}}>
                                    <label style={{fontSize: '0.9rem', display: 'block', marginBottom: '0.5rem'}}>Import Barang dari CSV:</label>
                                    <p style={{fontSize: '0.8rem', color: '#90a4ae', marginBottom:'0.5rem'}}>
                                        Format: name, description, quantity, category, purchase_date, image_url, location, serial_number
                                    </p>
                                    <input type="file" accept=".csv" onChange={handleItemCSVUpload} />
                                </div>
                            </div>
                            
                            {/* Categories */}
                            <div className="management-section">
                                <div className="manager-header">
                                    <h3>Manajemen Kategori</h3>
                                </div>
                                <div className="form-inline" style={{marginBottom: '1rem'}}>
                                    <input 
                                        type="text" 
                                        className="form-control" 
                                        placeholder="Nama Kategori Baru" 
                                        value={newCategoryName} 
                                        onChange={e => setNewCategoryName(e.target.value)} 
                                    />
                                    <button className="btn btn-primary" onClick={handleAddCategory} disabled={!newCategoryName.trim()}>
                                        Tambah
                                    </button>
                                </div>

                                {loading ? (
                                    <div style={{textAlign: 'center', padding: '2rem', color: 'var(--secondary-color)'}}>
                                        Memuat data kategori...
                                    </div>
                                ) : (
                                    <ul className="category-list">
                                        {categories.map(c => (
                                            <li key={c.id} className="category-list-item">
                                                <span>{c.name}</span>
                                                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteCategory(c.id)}>
                                                    Hapus
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                <p style={{marginTop: '1rem', fontSize: '0.85rem', color: '#90a4ae'}}>
                                    *Menghapus kategori akan mempengaruhi filter barang, tetapi tidak akan menghapus barang itu sendiri.
                                </p>
                            </div>

                            {/* Admin Management */}
                            <div className="management-section">
                                <div className="manager-header">
                                    <h3>Manajemen Admin</h3>
                                    <button className="btn btn-primary btn-sm" onClick={() => setIsAdminModalOpen(true)}>
                                        + Admin Baru
                                    </button>
                                </div>

                                {loading ? (
                                    <div style={{textAlign: 'center', padding: '2rem', color: 'var(--secondary-color)'}}>
                                        Memuat data admin...
                                    </div>
                                ) : (
                                    <ul className="category-list">
                                        {admins.map(admin => (
                                            <li key={admin.id} className="category-list-item">
                                                <div>
                                                    <strong>{admin.username}</strong>
                                                    {admin.full_name && <div style={{fontSize: '0.9rem', color: 'var(--secondary-color)'}}>{admin.full_name}</div>}
                                                    {admin.id === currentUser.id && (
                                                        <span className="current-user-badge">Anda</span>
                                                    )}
                                                    {admin.is_super_admin && (
                                                        <span style={{color: 'var(--warning-color)', fontSize: '0.8rem', marginLeft: '0.5rem'}}>Super Admin</span>
                                                    )}
                                                    {admin.last_login && (
                                                        <div style={{fontSize: '0.8rem', color: 'var(--secondary-color)'}}>
                                                            Login terakhir: {formatDateTime(admin.last_login)}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="category-actions">
                                                    <button className="btn btn-info btn-sm" onClick={() => {
                                                        setSelectedAdminForEdit(admin);
                                                        setIsAdminModalOpen(true);
                                                    }}>
                                                        Edit / Reset
                                                    </button>
                                                    {admin.id !== currentUser.id && (
                                                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteAdmin(admin.id)}>
                                                            Hapus
                                                        </button>
                                                    )}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                <p style={{marginTop: '1rem', fontSize: '0.85rem', color: '#90a4ae'}}>
                                    *Gunakan tombol Edit untuk mereset password admin.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* --- REPORTS TAB --- */}
                    {activeTab === 'reports' && (
                        <div className="report-container">
                            <div className="report-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem'}}>
                                <h2 className="report-title" style={{margin: 0}}>Laporan Inventaris & Sirkulasi</h2>
                                <div className="report-actions global-controls" style={{margin: 0}}>
                                    <button className="btn btn-secondary btn-sm" onClick={handlePrint}>Cetak Laporan</button>
                                    <button className="btn btn-primary btn-sm" onClick={handleExportPDF}>Eksport PDF</button>
                                </div>
                            </div>

                            {loading ? (
                                <div style={{textAlign: 'center', padding: '3rem', color: 'var(--secondary-color)'}}>
                                    Memuat data laporan...
                                </div>
                            ) : (
                                <>
                                    {/* Section 1: Summary & Statistics */}
                                    <div className="report-grid">
                                        <div className="report-card stats-summary">
                                            <h3>Ringkasan Status</h3>
                                            <div className="summary-stats-vertical">
                                                <div className="stat-row">
                                                    <span className="stat-label">Total Barang</span>
                                                    <span className="stat-value">{items.length}</span>
                                                </div>
                                                <div className="stat-row">
                                                    <span className="stat-label">Sedang Dipinjam</span>
                                                    <span className="stat-value highlight-warning">
                                                        {loanHistory.filter(l => l.status === 'borrowed').length}
                                                    </span>
                                                </div>
                                                <div className="stat-row">
                                                    <span className="stat-label">Total Selesai</span>
                                                    <span className="stat-value highlight-success">
                                                        {loanHistory.filter(l => l.status === 'returned').length}
                                                    </span>
                                                </div>
                                                <div className="stat-row">
                                                    <span className="stat-label">Total Pengguna</span>
                                                    <span className="stat-value">{users.length}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="report-card popular-items">
                                            <h3>Barang Paling Sering Dipinjam</h3>
                                            <SimpleBarChart data={popularItems} />
                                        </div>

                                        <div className="report-card chart-card">
                                            <SimpleLineChart data={getLast7DaysData()} title="Tren Peminjaman (7 Hari Terakhir)" />
                                        </div>

                                        <div className="report-card chart-card">
                                            <SimpleDonutChart data={getCategoryData()} />
                                        </div>
                                    </div>

                                    {/* Section 2: Detailed History Table */}
                                    <div className="report-card detailed-history">
                                        <h3>Detail Riwayat Peminjaman</h3>
                                        <div className="table-responsive">
                                            <table className="detailed-report-table">
                                                <thead>
                                                    <tr>
                                                        <th>Barang</th>
                                                        <th>Peminjam</th>
                                                        <th>Tanggal</th>
                                                        <th>Keperluan</th>
                                                        <th>Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {loanHistory.length === 0 ? (
                                                        <tr><td colSpan={5} className="text-center">Belum ada data.</td></tr>
                                                    ) : (
                                                        loanHistory.map(loan => (
                                                            <tr key={loan.id}>
                                                                <td>
                                                                    <div className="item-cell">
                                                                        {loan.item_image && <img src={loan.item_image} alt="" />}
                                                                        <span>{loan.item_name}</span>
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    {loan.borrower_name}
                                                                </td>
                                                                <td>
                                                                    <div className="date-cell">
                                                                        <small>Pinjam:</small> {formatDateTime(loan.borrow_date)}<br/>
                                                                        {loan.actual_return_date && (
                                                                            <>
                                                                                <small>Kembali:</small> {formatDateTime(loan.actual_return_date)}<br/>
                                                                            </>
                                                                        )}
                                                                        <small style={{color: 'var(--info-color)', fontWeight: 'bold'}}>
                                                                            Durasi: {calculateDuration(loan.borrow_date, loan.actual_return_date)}
                                                                        </small>
                                                                    </div>
                                                                </td>
                                                                <td className="purpose-cell">{loan.purpose || '-'}</td>
                                                                <td>
                                                                    <span className={`status-badge ${loan.status}`}>
                                                                        {loan.status === 'borrowed' ? 'Dipinjam' : 'Selesai'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </main>

            <footer>
                <p>&copy; {new Date().getFullYear()} LendifyIT - Sistem Peminjaman Barang IT</p>
                <p style={{fontSize: '0.8rem', color: 'var(--secondary-color)', marginTop: '0.5rem'}}>
                    Database: Supabase | User: {currentUser.username} | Status: {loading ? 'Loading...' : 'Connected'}
                </p>
            </footer>

            {/* Modals */}
            {editingItem && (
                <EditModal 
                    item={editingItem} 
                    onSave={handleUpdateItem} 
                    onCancel={() => setEditingItem(null)} 
                    categories={categories} 
                />
            )}
            {borrowingItem && (
                <BorrowModal 
                    item={borrowingItem} 
                    users={users} 
                    onConfirm={handleBorrowItem} 
                    onCancel={() => setBorrowingItem(null)} 
                />
            )}
            {viewingHistoryUser && (
                <BorrowerHistoryModal 
                    user={viewingHistoryUser}
                    onClose={() => setViewingHistoryUser(null)}
                />
            )}
            {viewingHistoryItem && (
                <ItemHistoryModal 
                    item={viewingHistoryItem}
                    onClose={() => setViewingHistoryItem(null)}
                />
            )}
            {isLogoutModalOpen && (
                <LogoutConfirmationModal 
                    onConfirm={confirmLogout}
                    onCancel={() => setIsLogoutModalOpen(false)}
                />
            )}
            {isAdminModalOpen && (
                <AdminModal 
                    admin={selectedAdminForEdit}
                    onSave={handleSaveAdmin}
                    onCancel={() => { setIsAdminModalOpen(false); setSelectedAdminForEdit(null); }}
                />
            )}
        </div>
    );
};

// Render
const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}