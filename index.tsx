import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { createRoot } from 'react-dom/client';

// --- Interfaces ---

interface Category {
  id: number;
  name: string;
}

interface Item {
  id: number;
  name: string;
  description: string;
  imageUrl: string;
  purchaseDate: string;
  categoryId: number;
  quantity: number;
}

interface Unit {
  id: number;
  name: string;
}

interface User {
  id: number;
  name: string;
  unitId: number;
}

interface Admin {
  id: number;
  username: string;
  password: string; // In a real app, hash this!
}

interface LoanRecord {
  id: number;
  itemId: number;
  itemName: string;
  itemImage?: string;
  borrowerName: string; // Legacy string support
  borrowerId?: number; // Linked user
  borrowDate: string;
  returnDate: string | null;
  status: 'borrowed' | 'returned';
  purpose?: string;
  expectedDuration?: number; // Planned duration in days
}

interface BorrowedItem extends LoanRecord {
    // Helper interface for active loans
}

interface Notification {
    id: number;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    onUndo?: () => void;
}

// --- Utility Functions ---

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(dateString).toLocaleDateString('id-ID', options);
};

const calculateDuration = (start: string, end: string | null) => {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    
    // Set hours to midnight for accurate day calculation
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // If same day, count as 1 day
    return diffDays === 0 ? '1 Hari' : `${diffDays} Hari`;
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

const parseCSV = (content: string) => {
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return []; // Need header and data
  
  // Assume header is first line, we just want the data
  // Simple parsing assuming no commas in values for this demo
  return lines.slice(1).map(line => line.trim());
};

// --- Mock Data ---

const initialCategories: Category[] = [
  { id: 1, name: 'Laptop' },
  { id: 2, name: 'Peripherals' },
  { id: 3, name: 'Kabel & Adaptor' },
  { id: 4, name: 'Monitor' },
  { id: 5, name: 'Lainnya' },
];

const initialItems: Item[] = [
  { id: 1, name: 'MacBook Pro M1', description: 'Laptop untuk tim desain', imageUrl: 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&w=500&q=80', purchaseDate: '2023-01-15', categoryId: 1, quantity: 5 },
  { id: 2, name: 'Logitech MX Master 3', description: 'Mouse wireless ergonomis', imageUrl: 'https://images.unsplash.com/photo-1605773527852-c546a8584ea3?auto=format&fit=crop&w=500&q=80', purchaseDate: '2023-03-10', categoryId: 2, quantity: 10 },
  { id: 3, name: 'Dell UltraSharp 27"', description: 'Monitor 4K USB-C', imageUrl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=500&q=80', purchaseDate: '2022-11-20', categoryId: 4, quantity: 3 },
];

const initialUnits: Unit[] = [
    { id: 1, name: 'IT Development' },
    { id: 2, name: 'Human Resources' },
    { id: 3, name: 'Finance' },
    { id: 4, name: 'Marketing' },
];

const initialUsers: User[] = [
    { id: 1, name: 'Budi Santoso', unitId: 1 },
    { id: 2, name: 'Siti Aminah', unitId: 2 },
    { id: 3, name: 'Andi Wijaya', unitId: 1 },
];

const initialAdmins: Admin[] = [
    { id: 1, username: 'admin', password: 'password' }
];

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

// 1. Edit Modal (Fixed Textarea)
const EditModal = ({ item, onSave, onCancel, categories }: { item: Item; onSave: (updatedItem: Item) => void; onCancel: () => void; categories: Category[] }) => {
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description);
  const [imageUrl, setImageUrl] = useState(item.imageUrl);
  const [purchaseDate, setPurchaseDate] = useState(item.purchaseDate);
  const [categoryId, setCategoryId] = useState(item.categoryId);
  const [quantity, setQuantity] = useState(item.quantity);
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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim() && description.trim() && purchaseDate && quantity >= 0) {
      onSave({ ...item, name, description, imageUrl, purchaseDate, categoryId, quantity });
    }
  };

  return (
    <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
      <div className={`modal-content ${isClosing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
        <h2>Edit: {item.name}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="editItemName">Nama Barang</label>
            <input type="text" id="editItemName" className="form-control" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="editItemDesc">Deskripsi</label>
            <textarea 
                id="editItemDesc" 
                className="form-control" 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                required 
                rows={3} 
            />
          </div>
           <div className="form-group">
            <label htmlFor="editItemImg">Gambar Barang</label>
            <input type="file" id="editItemImg" className="form-control" onChange={handleImageChange} accept="image/*" />
            {imageUrl && <img src={imageUrl} alt="Pratinjau Gambar" className="image-preview" />}
          </div>
           <div className="form-group">
                <label htmlFor="editItemPurchaseDate">Tanggal Pembelian</label>
                <input type="date" id="editItemPurchaseDate" className="form-control" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} required />
            </div>
             <div className="form-group">
                <label htmlFor="editItemCategory">Kategori</label>
                <select id="editItemCategory" className="form-control" value={categoryId} onChange={e => setCategoryId(Number(e.target.value))} required>
                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
            </div>
            <div className="form-group">
                <label htmlFor="editItemQuantity">Jumlah</label>
                <input type="number" id="editItemQuantity" className="form-control" value={quantity} onChange={e => setQuantity(Number(e.target.value))} required min="0" />
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

// 2. Borrow Modal (With Duration)
const BorrowModal = ({ item, users, onConfirm, onCancel }: { item: Item, users: User[], onConfirm: (userId: number, purpose: string, duration: number) => void, onCancel: () => void }) => {
    const [selectedUserId, setSelectedUserId] = useState<number | ''>('');
    const [purpose, setPurpose] = useState('');
    const [duration, setDuration] = useState(1); // Default 1 day
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
                        <label>Peminjam</label>
                        <select className="form-control" value={selectedUserId} onChange={e => setSelectedUserId(Number(e.target.value))} required>
                            <option value="">-- Pilih Peminjam --</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Rencana Durasi (Hari)</label>
                        <input 
                            type="number" 
                            className="form-control" 
                            value={duration} 
                            onChange={e => setDuration(Math.max(1, Number(e.target.value)))} 
                            min="1" 
                            required 
                        />
                        <small style={{color: 'var(--secondary-color)'}}>Estimasi pengembalian: {(() => {
                            const d = new Date();
                            d.setDate(d.getDate() + duration);
                            return formatDate(d.toISOString());
                        })()}</small>
                    </div>
                    <div className="form-group">
                        <label>Keterangan / Keperluan</label>
                        <textarea className="form-control" value={purpose} onChange={e => setPurpose(e.target.value)} required rows={3} placeholder="Contoh: Untuk meeting dengan klien X" />
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

// 3. New Borrower History Modal
const BorrowerHistoryModal = ({ user, loanHistory, units, onClose }: { user: User, loanHistory: LoanRecord[], units: Unit[], onClose: () => void }) => {
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 300);
    };

    // Filter history for this specific user
    const userHistory = loanHistory.filter(loan => loan.borrowerId === user.id);
    const activeLoans = userHistory.filter(loan => loan.status === 'borrowed');
    const pastLoans = userHistory.filter(loan => loan.status === 'returned');
    const userUnit = units.find(u => u.id === user.unitId)?.name || 'Unknown Unit';

    return (
        <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
            <div className={`modal-content borrower-history-modal ${isClosing ? 'closing' : ''}`} onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
                    <h2>Riwayat Peminjaman</h2>
                    <button onClick={handleClose} className="btn btn-sm btn-secondary" style={{padding: '0.2rem 0.6rem'}}>X</button>
                </div>
                
                <div style={{marginBottom: '1.5rem'}}>
                    <h3 style={{fontSize: '1.4rem', color: 'var(--primary-color)', marginBottom: '0.2rem'}}>{user.name}</h3>
                    <div className="borrower-unit-display">{userUnit}</div>
                </div>

                <div className="modal-section">
                    <h4>Sedang Dipinjam ({activeLoans.length})</h4>
                    {activeLoans.length === 0 ? (
                        <p className="empty-state-modal">Tidak ada barang yang sedang dipinjam.</p>
                    ) : (
                        <ul className="borrower-items-list">
                            {activeLoans.map(loan => (
                                <li key={loan.id}>
                                    <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%'}}>
                                        {loan.itemImage && <img src={loan.itemImage} alt="" style={{width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px'}} />}
                                        <div style={{flexGrow: 1}}>
                                            <strong>{loan.itemName}</strong>
                                            <small>{formatDate(loan.borrowDate)} ({calculateDuration(loan.borrowDate, null)})</small>
                                            {loan.purpose && <div className="modal-purpose">{loan.purpose}</div>}
                                            {loan.expectedDuration && <small style={{display:'block', color: 'var(--info-color)'}}>Rencana: {loan.expectedDuration} Hari</small>}
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
                                        <span className="history-item-name" style={{fontSize: '0.95rem'}}>{log.itemName}</span>
                                        <div className="history-date-wrapper history-item-details">
                                            <span>Pinjam: {formatDate(log.borrowDate)}</span>
                                            <span>Kembali: {formatDate(log.returnDate || '')}</span>
                                            <span style={{color: 'var(--info-color)'}}>Durasi: {calculateDuration(log.borrowDate, log.returnDate)}</span>
                                        </div>
                                        {log.purpose && <div className="history-item-purpose modal-purpose">{log.purpose}</div>}
                                    </div>
                                    <span className="status-badge returned" style={{fontSize: '0.7rem'}}>Selesai</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                
                <div className="modal-actions">
                     <button type="button" className="btn btn-primary" onClick={handleClose}>Tutup</button>
                </div>
            </div>
        </div>
    );
};

// 4. Logout Confirmation Modal
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

// 5. Item History Modal (New)
const ItemHistoryModal = ({ item, loanHistory, users, onClose }: { item: Item, loanHistory: LoanRecord[], users: User[], onClose: () => void }) => {
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 300);
    };

    // Filter history for this item
    const itemHistory = loanHistory.filter(loan => loan.itemId === item.id);
    // Sort by date descending (newest first)
    itemHistory.sort((a, b) => new Date(b.borrowDate).getTime() - new Date(a.borrowDate).getTime());

    return (
        <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
             <div className={`modal-content borrower-history-modal ${isClosing ? 'closing' : ''}`} onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
                    <h2>Riwayat Barang</h2>
                    <button onClick={handleClose} className="btn btn-sm btn-secondary" style={{padding: '0.2rem 0.6rem'}}>X</button>
                </div>

                <div style={{marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem'}}>
                    <img src={item.imageUrl} alt={item.name} style={{width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px'}} />
                    <div>
                         <h3 style={{fontSize: '1.4rem', color: 'var(--primary-color)', marginBottom: '0.2rem'}}>{item.name}</h3>
                         <span style={{color: 'var(--secondary-color)'}}>Stok Saat Ini: {item.quantity}</span>
                    </div>
                </div>

                <div className="modal-section" style={{marginTop: '0'}}>
                    <h4>Daftar Peminjaman</h4>
                    {itemHistory.length === 0 ? (
                        <p className="empty-state-modal">Belum ada riwayat peminjaman untuk barang ini.</p>
                    ) : (
                         <ul className="borrower-history-list">
                             {itemHistory.map(log => (
                                <li key={log.id} className="history-item-consolidated modal-version">
                                    <div className="history-item-main">
                                        <span className="history-item-name" style={{fontSize: '0.95rem'}}>
                                            {users.find(u => u.id === log.borrowerId)?.name || log.borrowerName}
                                        </span>
                                        <div className="history-date-wrapper history-item-details">
                                            <span>Pinjam: {formatDate(log.borrowDate)}</span>
                                            {log.returnDate ? (
                                                <>
                                                <span>Kembali: {formatDate(log.returnDate)}</span>
                                                <span style={{color: 'var(--info-color)'}}>Durasi: {calculateDuration(log.borrowDate, log.returnDate)}</span>
                                                </>
                                            ) : (
                                                <>
                                                <span style={{color: 'var(--warning-color)'}}>Belum dikembalikan</span>
                                                <span style={{color: 'var(--info-color)'}}>Durasi: {calculateDuration(log.borrowDate, null)}</span>
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

                <div className="modal-actions">
                     <button type="button" className="btn btn-primary" onClick={handleClose}>Tutup</button>
                </div>
            </div>
        </div>
    );
};

// 6. Admin Management Modal (New)
const AdminModal = ({ admin, onSave, onCancel }: { admin: Admin | null, onSave: (data: Partial<Admin>) => void, onCancel: () => void }) => {
    const [username, setUsername] = useState(admin ? admin.username : '');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        setError('');

        if (!username.trim()) {
            setError('Username harus diisi');
            return;
        }

        // If adding new admin, password is required
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
            password: password || undefined // Only send password if changed
        });
    };

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h2>{admin ? 'Edit Admin / Reset Password' : 'Tambah Admin Baru'}</h2>
                <form onSubmit={handleSubmit}>
                    {error && <div className="login-error" style={{marginBottom: '1rem'}}>{error}</div>}
                    
                    <div className="form-group">
                        <label>Username</label>
                        <input 
                            type="text" 
                            className="form-control" 
                            value={username} 
                            onChange={e => setUsername(e.target.value)} 
                            required 
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

// 7. Simple SVG Charts (Defined before LoansSummaryDashboard)

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
                {/* Grid lines */}
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
                
                {/* The Line */}
                <polyline 
                    fill="none" 
                    stroke="var(--success-color)" 
                    strokeWidth="3" 
                    points={points} 
                />
                
                {/* Data Points */}
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
    const width = 400; // viewbox width
    const labelWidth = 140; // reserved for text
    const barMaxWidth = width - labelWidth - 40; // 40 for value text
    const height = data.length * rowHeight;

    return (
        <div className="chart-container">
            <svg viewBox={`0 0 ${width} ${height}`} className="bar-chart-svg" style={{width: '100%', height: 'auto'}}>
            {data.map((item, index) => {
                const barWidth = (item.count / maxVal) * barMaxWidth;
                const y = index * rowHeight;
                return (
                    <g key={index} transform={`translate(0, ${y})`}>
                        {/* Label */}
                        <text x={labelWidth - 10} y={25} textAnchor="end" className="chart-text label" fill="var(--text-color)" fontSize="14">
                            {item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name}
                        </text>

                        {/* Bar Background (optional) */}
                        <rect x={labelWidth} y={10} width={barMaxWidth} height={20} fill="var(--background-color)" rx="4" />

                        {/* Bar Fill */}
                        <rect
                            x={labelWidth}
                            y={10}
                            width={Math.max(barWidth, 5)} // min width visibility
                            height={20}
                            fill="var(--primary-color)"
                            rx="4"
                        />

                        {/* Value */}
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

// 8. Loans Dashboard Component (Redesigned)
const LoansSummaryDashboard = ({ loanHistory, items, users, categories }: { loanHistory: LoanRecord[], items: Item[], users: User[], categories: Category[] }) => {
    const activeLoans = loanHistory.filter(l => l.status === 'borrowed');
    
    // Calculate overdue
    const overdueLoans = activeLoans.filter(l => {
        const borrowDate = new Date(l.borrowDate);
        const today = new Date();
        const diffTime = Math.abs(today.getTime() - borrowDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        // Use expectedDuration if available, else default to 7
        const limit = l.expectedDuration || 7;
        return diffDays > limit; 
    });

    // Data for Active Loans by Category (for Donut Chart)
    const getActiveLoanCategoryData = () => {
        const colors = ['#0d47a1', '#ef5350', '#26a69a', '#ffca28', '#5c6bc0', '#90a4ae'];
        const data: any[] = [];
        
        categories.forEach((cat, idx) => {
            // Find items belonging to this category
            const catItemIds = items.filter(i => i.categoryId === cat.id).map(i => i.id);
            // Count active loans for these items
            const count = activeLoans.filter(l => catItemIds.includes(l.itemId)).length;
            
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

    const getUserName = (id?: number) => users.find(u => u.id === id)?.name || 'Unknown';

    return (
        <div className="loans-dashboard-summary">
            <h2>Dashboard Analisis Peminjaman</h2>
            
            <div className="loans-analytics-container">
                {/* Top Row: Stat Cards */}
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

                {/* Main Content Split */}
                <div className="analytics-split-view">
                    {/* Left: Chart */}
                    <div className="analytics-card chart-section">
                        <SimpleDonutChart data={getActiveLoanCategoryData()} title="Kategori Barang Dipinjam" />
                    </div>

                    {/* Right: Overdue List */}
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
                                            <strong>{loan.itemName}</strong>
                                            <span className="overdue-days" style={{color: 'var(--danger-color)', fontWeight: 'bold'}}>{calculateDuration(loan.borrowDate, null)}</span>
                                        </div>
                                        <div className="overdue-item-details">
                                            <span>👤 {getUserName(loan.borrowerId)}</span>
                                            <span>📅 {formatDate(loan.borrowDate)}</span>
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


// 9. Main App Component
const App = () => {
  // --- State ---
  const [currentUser, setCurrentUser] = useState<string | null>(() => sessionStorage.getItem('currentUser'));
  const [admins, setAdmins] = useLocalStorage<Admin[]>('admins', initialAdmins);
  
  // Data
  const [items, setItems] = useLocalStorage<Item[]>('inventory_items', initialItems);
  const [categories, setCategories] = useLocalStorage<Category[]>('inventory_categories', initialCategories);
  const [users, setUsers] = useLocalStorage<User[]>('app_users', initialUsers);
  const [units, setUnits] = useLocalStorage<Unit[]>('app_units', initialUnits);
  const [loanHistory, setLoanHistory] = useLocalStorage<LoanRecord[]>('loan_history', []);
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
      name: '', description: '', imageUrl: '', purchaseDate: new Date().toISOString().split('T')[0], categoryId: 1, quantity: 1
  });
  const [viewingHistoryUser, setViewingHistoryUser] = useState<User | null>(null);
  const [viewingHistoryItem, setViewingHistoryItem] = useState<Item | null>(null);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  
  // Admin Management Modal State
  const [selectedAdminForEdit, setSelectedAdminForEdit] = useState<Admin | null>(null);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);


  // New Data Management State
  const [newUserName, setNewUserName] = useState('');
  const [newUserUnit, setNewUserUnit] = useState<number>(1);
  const [newUnitName, setNewUnitName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');

  // --- Notification System ---
  const addNotification = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', onUndo?: () => void) => {
      const id = Date.now();
      setNotifications(prev => [...prev, { id, message, type, onUndo }]);
      
      // Auto dismiss
      setTimeout(() => {
          setNotifications(prev => prev.filter(n => n.id !== id));
      }, 5000);
  };

  const removeNotification = (id: number) => {
      setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Check for overdue items on login or load
  useEffect(() => {
      if (currentUser) {
        const activeLoans = loanHistory.filter(l => l.status === 'borrowed');
        const overdueLoans = activeLoans.filter(l => {
            const borrowDate = new Date(l.borrowDate);
            const today = new Date();
            const diffTime = Math.abs(today.getTime() - borrowDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            const limit = l.expectedDuration || 7;
            return diffDays > limit; 
        });

        if (overdueLoans.length > 0) {
            addNotification(`${overdueLoans.length} Barang terlambat dikembalikan! Periksa Dashboard.`, 'warning');
        }
      }
  }, [currentUser]); // Run only when user logs in

  // --- Handlers ---

  const handleLogin = (e: FormEvent) => {
      e.preventDefault();
      const admin = admins.find(a => a.username === loginUsername && a.password === loginPassword);
      if (admin) {
          sessionStorage.setItem('currentUser', admin.username);
          setCurrentUser(admin.username);
          setLoginError('');
          addNotification(`Selamat datang kembali, ${admin.username}!`, 'success');
      } else {
          setLoginError('Username atau password salah');
          addNotification('Login gagal. Periksa username atau password.', 'error');
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

  // Admin Management Handlers
  const handleSaveAdmin = (data: Partial<Admin>) => {
      if (selectedAdminForEdit) {
          // Edit Mode
          setAdmins(admins.map(a => 
              a.id === selectedAdminForEdit.id 
                  ? { ...a, username: data.username || a.username, password: data.password || a.password } 
                  : a
          ));
          addNotification('Data admin berhasil diperbarui.', 'success');
          
          // If editing self, update current user display
          if (currentUser === selectedAdminForEdit.username && data.username) {
              setCurrentUser(data.username);
              sessionStorage.setItem('currentUser', data.username);
          }
      } else {
          // Add Mode
          if (admins.some(a => a.username === data.username)) {
              addNotification('Username sudah digunakan.', 'error');
              return;
          }
          const newAdmin: Admin = {
              id: Date.now(),
              username: data.username!,
              password: data.password!
          };
          setAdmins([...admins, newAdmin]);
          addNotification('Admin baru berhasil ditambahkan.', 'success');
      }
      setIsAdminModalOpen(false);
      setSelectedAdminForEdit(null);
  };

  const handleDeleteAdmin = (id: number) => {
      const adminToDelete = admins.find(a => a.id === id);
      if (!adminToDelete) return;

      if (adminToDelete.username === currentUser) {
          addNotification('Anda tidak dapat menghapus akun Anda sendiri.', 'error');
          return;
      }
      if (admins.length <= 1) {
          addNotification('Sistem harus memiliki minimal satu admin.', 'error');
          return;
      }

      if (confirm(`Hapus akses admin untuk "${adminToDelete.username}"?`)) {
          setAdmins(admins.filter(a => a.id !== id));
          addNotification('Admin dihapus.', 'info');
      }
  };

  const handleAddItem = (e: FormEvent) => {
      e.preventDefault();
      if (newItem.name && newItem.description && newItem.imageUrl) {
          const item: Item = {
              id: Date.now(),
              name: newItem.name,
              description: newItem.description,
              imageUrl: newItem.imageUrl,
              purchaseDate: newItem.purchaseDate || new Date().toISOString(),
              categoryId: newItem.categoryId || 1,
              quantity: newItem.quantity || 1
          };
          setItems([...items, item]);
          setNewItem({ name: '', description: '', imageUrl: '', purchaseDate: new Date().toISOString().split('T')[0], categoryId: 1, quantity: 1 });
          addNotification(`Barang baru "${item.name}" berhasil ditambahkan!`, 'success');
      }
  };

  const handleDeleteItem = (id: number) => {
      if (confirm('Apakah Anda yakin ingin menghapus barang ini?')) {
          const itemToDelete = items.find(i => i.id === id);
          if (itemToDelete) {
              setItems(items.filter(i => i.id !== id));
              addNotification(`Barang "${itemToDelete.name}" berhasil dihapus.`, 'info', () => {
                  setItems(prevItems => [...prevItems, itemToDelete]);
                  addNotification(`Barang "${itemToDelete.name}" dikembalikan.`, 'success');
              });
          }
      }
  };

  const handleUpdateItem = (updatedItem: Item) => {
      setItems(items.map(i => i.id === updatedItem.id ? updatedItem : i));
      setEditingItem(null);
      addNotification('Data barang berhasil diperbarui.', 'success');
  };

  const handleBorrowItem = (userId: number, purpose: string, duration: number) => {
    if (borrowingItem && borrowingItem.quantity > 0) {
        const user = users.find(u => u.id === userId);
        const record: LoanRecord = {
            id: Date.now(),
            itemId: borrowingItem.id,
            itemName: borrowingItem.name,
            itemImage: borrowingItem.imageUrl,
            borrowerId: userId,
            borrowerName: user ? user.name : 'Unknown',
            borrowDate: new Date().toISOString(),
            returnDate: null,
            status: 'borrowed',
            purpose: purpose,
            expectedDuration: duration
        };
        setLoanHistory([record, ...loanHistory]);
        setItems(items.map(i => i.id === borrowingItem.id ? { ...i, quantity: i.quantity - 1 } : i));
        setBorrowingItem(null);
        addNotification(`Peminjaman "${borrowingItem.name}" berhasil dicatat.`, 'success');
    }
  };

  const handleReturnItem = (loanId: number) => {
      const loan = loanHistory.find(l => l.id === loanId);
      if (loan && loan.status === 'borrowed') {
          setLoanHistory(loanHistory.map(l => l.id === loanId ? { ...l, returnDate: new Date().toISOString(), status: 'returned' } : l));
          const item = items.find(i => i.id === loan.itemId);
          if (item) {
              setItems(items.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
          }
          
          // Check if late (for notification)
          const borrowDate = new Date(loan.borrowDate);
          const today = new Date();
          const diffTime = Math.abs(today.getTime() - borrowDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const limit = loan.expectedDuration || 7;
          
          if (diffDays > limit) {
              addNotification(`Barang "${loan.itemName}" dikembalikan TERLAMBAT (${diffDays} hari).`, 'warning');
          } else {
              addNotification(`Barang "${loan.itemName}" berhasil dikembalikan.`, 'success');
          }
      }
  };

  const handleAddCategory = () => {
      if (newCategoryName.trim()) {
          setCategories([...categories, { id: Date.now(), name: newCategoryName }]);
          setNewCategoryName('');
          addNotification('Kategori baru ditambahkan.', 'success');
      }
  };

  const handleDeleteCategory = (id: number) => {
      if (confirm('Menghapus kategori akan mempengaruhi barang yang terhubung. Lanjutkan?')) {
          setCategories(categories.filter(c => c.id !== id));
          addNotification('Kategori dihapus.', 'info');
      }
  };

  // New Item Image Upload Handler
  const handleNewItemImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onloadend = () => {
              setNewItem({ ...newItem, imageUrl: reader.result as string });
          };
          reader.readAsDataURL(file);
      }
  };

  // CSV Import Handlers
  const handleUserCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const reader = new FileReader();
          reader.onload = (evt) => {
              const text = evt.target?.result as string;
              const names = parseCSV(text);
              const newUsers = names.map((name, idx) => ({
                  id: Date.now() + idx,
                  name,
                  unitId: 1 // Default to first unit
              }));
              setUsers([...users, ...newUsers]);
              addNotification(`${newUsers.length} pengguna berhasil diimpor!`, 'success');
          };
          reader.readAsText(e.target.files[0]);
      }
  };

  const handleUnitCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const reader = new FileReader();
          reader.onload = (evt) => {
              const text = evt.target?.result as string;
              const names = parseCSV(text);
              const newUnits = names.map((name, idx) => ({
                  id: Date.now() + idx,
                  name
              }));
              setUnits([...units, ...newUnits]);
              addNotification(`${newUnits.length} unit berhasil diimpor!`, 'success');
          };
          reader.readAsText(e.target.files[0]);
      }
  };

  const handleItemCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const reader = new FileReader();
          reader.onload = (evt) => {
              const text = evt.target?.result as string;
              // parseCSV just gets lines, we need to split by comma for items
              const rows = parseCSV(text); 
              
              const newItems: Item[] = rows.map((row, idx) => {
                  const cols = row.split(',').map(c => c.trim());
                  // Mapping: 0=Name, 1=Desc, 2=Qty, 3=CategoryName, 4=Date, 5=Image
                  
                  const catName = cols[3] || '';
                  const cat = categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
                  const categoryId = cat ? cat.id : 1;

                  return {
                      id: Date.now() + idx,
                      name: cols[0] || 'New Item',
                      description: cols[1] || '-',
                      quantity: Number(cols[2]) || 1,
                      categoryId: categoryId,
                      purchaseDate: cols[4] || new Date().toISOString().split('T')[0],
                      imageUrl: cols[5] || 'https://via.placeholder.com/150'
                  };
              });
              setItems([...items, ...newItems]);
              addNotification(`${newItems.length} barang berhasil diimpor!`, 'success');
          };
          reader.readAsText(e.target.files[0]);
      }
  };

  // CSV Export Handlers
  const exportToCSV = (data: any[], filename: string) => {
      const headers = Object.keys(data[0]).join(',');
      const rows = data.map(obj => Object.values(obj).map(val => `"${val}"`).join(','));
      const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };
  
  const handleExportItems = () => {
    const data = items.map(i => ({
        ID: i.id,
        Nama: i.name,
        Deskripsi: i.description,
        Kategori: categories.find(c => c.id === i.categoryId)?.name || 'Unknown',
        Jumlah: i.quantity,
        TanggalBeli: i.purchaseDate,
        Gambar: i.imageUrl
    }));
    exportToCSV(data, 'inventaris.csv');
  };

  // Printing and PDF Handlers
  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    const reportElement = document.querySelector('.report-container') as HTMLElement;
    if (reportElement) {
        addNotification('Sedang membuat PDF...', 'info');
        // @ts-ignore
        const { jsPDF } = window.jspdf;
        // @ts-ignore
        html2canvas(reportElement, { scale: 2 }).then((canvas) => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`LendifyIT-Laporan-${new Date().toISOString().split('T')[0]}.pdf`);
            addNotification('PDF berhasil diunduh.', 'success');
        });
    }
  };


  // --- Filtered Data ---
  const filteredItems = items
    .filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              item.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = filterCategory === 'all' || item.categoryId === filterCategory;
        return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
        let valA = a[sortBy as keyof Item];
        let valB = b[sortBy as keyof Item];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });

  // Calculate Popular Items for Reports
  const itemPopularity = loanHistory.reduce((acc, loan) => {
        acc[loan.itemId] = (acc[loan.itemId] || 0) + 1;
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
        
        const count = loanHistory.filter(l => l.borrowDate.startsWith(dateStr)).length;
        data.push(count);
    }
    return data;
  };

  const getCategoryData = () => {
      const colors = ['#0d47a1', '#26a69a', '#ef5350', '#ffca28', '#5c6bc0', '#90a4ae'];
      const data: any[] = [];
      categories.forEach((cat, idx) => {
          const count = items.filter(i => i.categoryId === cat.id).length;
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
                      <input type="text" className="form-control" value={loginUsername} onChange={e => setLoginUsername(e.target.value)} required />
                  </div>
                  <div className="form-group">
                      <label>Password</label>
                      <input type="password" className="form-control" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
                  </div>
                  <button type="submit" className="btn btn-primary">Login</button>
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
                <span className="username">Welcome, <strong>{currentUser}</strong></span>
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

                            <div className={`item-container view-mode-${viewMode}`}>
                                {filteredItems.map(item => (
                                    <div key={item.id} className={`item-card view-${viewMode} ${item.quantity === 0 ? 'out-of-stock' : ''}`}>
                                        <img src={item.imageUrl} alt={item.name} className="item-card-image" />
                                        <div className="item-card-content">
                                            <div className="item-card-info-wrapper">
                                                <div className="item-card-header">
                                                    <h3>{item.name}</h3>
                                                    {item.quantity === 0 && <span className="item-card-quantity-badge" style={{backgroundColor: '#ef5350'}}>Stok Habis</span>}
                                                </div>
                                                <div className="item-card-badges">
                                                    <span className="item-card-category-badge">
                                                        {categories.find(c => c.id === item.categoryId)?.name}
                                                    </span>
                                                    <span className="item-card-quantity-badge">Stok: {item.quantity}</span>
                                                </div>
                                                <p className="item-card-description">{item.description}</p>
                                            </div>
                                            <div className="item-card-actions">
                                                <button className="btn btn-warning btn-sm" onClick={() => setBorrowingItem(item)} disabled={item.quantity === 0}>Pinjam</button>
                                                <button className="btn btn-info btn-sm" onClick={() => setViewingHistoryItem(item)}>Riwayat</button>
                                                <button className="btn btn-primary btn-sm" onClick={() => setEditingItem(item)}>Edit</button>
                                                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteItem(item.id)}>Hapus</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {filteredItems.length === 0 && <div className="empty-state">Tidak ada barang ditemukan.</div>}
                            </div>
                        </div>
                    </>
                )}

                {/* --- LOANS TAB --- */}
                {activeTab === 'loans' && (
                    <>
                        <LoansSummaryDashboard loanHistory={loanHistory} items={items} users={users} categories={categories} />
                        
                        <div className="item-section">
                            <h2>Barang Sedang Dipinjam</h2>
                            {loanHistory.filter(l => l.status === 'borrowed').length === 0 ? (
                                <div className="empty-state">Tidak ada barang yang sedang dipinjam.</div>
                            ) : (
                                <div className="item-container view-mode-grid">
                                    {loanHistory.filter(l => l.status === 'borrowed').map(loan => (
                                        <div key={loan.id} className="item-card view-grid">
                                             <img src={loan.itemImage || 'https://via.placeholder.com/150'} alt={loan.itemName} className="item-card-image" style={{height: '150px'}} />
                                            <div className="item-card-content">
                                                <div className="item-card-header">
                                                    <h3>{loan.itemName}</h3>
                                                    <span className="item-card-borrower-badge">
                                                        {users.find(u => u.id === loan.borrowerId)?.name || loan.borrowerName}
                                                    </span>
                                                </div>
                                                <div className="borrowed-info">
                                                    <p><strong>Tanggal Pinjam:</strong> {formatDate(loan.borrowDate)}</p>
                                                    <p><strong>Rencana Peminjaman:</strong> {loan.expectedDuration || '-'} Hari</p>
                                                    {loan.purpose && (
                                                        <div className="borrowed-purpose">
                                                            <strong>Keperluan:</strong><br/>
                                                            {loan.purpose}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="item-card-actions">
                                                    <button className="btn btn-success btn-sm" onClick={() => handleReturnItem(loan.id)}>Kembalikan</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* --- HISTORY TAB --- */}
                {activeTab === 'history' && (
                    <div className="history-section">
                        <h2>Riwayat Transaksi</h2>
                         <div className="history-log">
                            <ul>
                                {loanHistory.map(log => (
                                    <li key={log.id} className="history-item-consolidated">
                                        <div className="history-img-wrapper">
                                            <img src={log.itemImage || 'https://via.placeholder.com/150'} alt={log.itemName} />
                                        </div>
                                        
                                        <div className="history-info-wrapper">
                                            <span className="history-item-name">{log.itemName}</span>
                                            <span className="history-item-borrower">
                                                Oleh: {users.find(u => u.id === log.borrowerId)?.name || log.borrowerName}
                                            </span>
                                            {log.purpose && <div className="history-item-purpose">{log.purpose}</div>}
                                        </div>

                                        <div className="history-date-wrapper">
                                            <div className="date-row">
                                                <span className="date-label">Pinjam:</span>
                                                <span>{formatDate(log.borrowDate)}</span>
                                            </div>
                                            {log.returnDate && (
                                                 <div className="date-row">
                                                    <span className="date-label">Kembali:</span>
                                                    <span>{formatDate(log.returnDate)}</span>
                                                </div>
                                            )}
                                            <span className="history-duration">Durasi: {calculateDuration(log.borrowDate, log.returnDate)}</span>
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
                    </div>
                )}

                {/* --- MANAGEMENT TAB (USERS & UNITS) --- */}
                {activeTab === 'management' && (
                    <div className="user-admin-grid">
                        <div className="management-section">
                            <div className="manager-header">
                                <h3>Manajemen Pengguna</h3>
                                <button className="btn btn-secondary btn-sm" onClick={() => exportToCSV(users, 'users.csv')}>Export CSV</button>
                            </div>
                            <div className="form-inline" style={{marginBottom: '1rem'}}>
                                <input type="text" className="form-control" placeholder="Nama User Baru" value={newUserName} onChange={e => setNewUserName(e.target.value)} />
                                <select className="form-control" value={newUserUnit} onChange={e => setNewUserUnit(Number(e.target.value))}>
                                    {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                                <button className="btn btn-primary" onClick={() => {
                                    if(newUserName) {
                                        setUsers([...users, { id: Date.now(), name: newUserName, unitId: newUserUnit }]);
                                        setNewUserName('');
                                        addNotification('User baru ditambahkan.', 'success');
                                    }
                                }}>Tambah</button>
                            </div>
                            
                            <div className="data-manager-section" style={{marginBottom: '1rem'}}>
                                <label style={{fontSize: '0.9rem', display: 'block', marginBottom: '0.5rem'}}>Import dari CSV:</label>
                                <input type="file" accept=".csv" onChange={handleUserCSVUpload} />
                            </div>

                            <ul className="category-list">
                                {users.map(u => (
                                    <li key={u.id} className="category-list-item">
                                        <div>
                                            <strong>{u.name}</strong> <br/>
                                            <small style={{color: '#90a4ae'}}>{units.find(un => un.id === u.unitId)?.name}</small>
                                        </div>
                                        <div className="category-actions">
                                            <button className="btn btn-info btn-sm" onClick={() => setViewingHistoryUser(u)}>Riwayat</button>
                                            <button className="btn btn-danger btn-sm" onClick={() => {
                                                if(confirm('Hapus user ini?')) setUsers(users.filter(x => x.id !== u.id));
                                            }}>Hapus</button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="management-section">
                            <div className="manager-header">
                                <h3>Manajemen Unit/Divisi</h3>
                                <button className="btn btn-secondary btn-sm" onClick={() => exportToCSV(units, 'units.csv')}>Export CSV</button>
                            </div>
                            <div className="form-inline" style={{marginBottom: '1rem'}}>
                                <input type="text" className="form-control" placeholder="Nama Unit Baru" value={newUnitName} onChange={e => setNewUnitName(e.target.value)} />
                                <button className="btn btn-primary" onClick={() => {
                                    if(newUnitName) {
                                        setUnits([...units, { id: Date.now(), name: newUnitName }]);
                                        setNewUnitName('');
                                        addNotification('Unit baru ditambahkan.', 'success');
                                    }
                                }}>Tambah</button>
                            </div>

                             <div className="data-manager-section" style={{marginBottom: '1rem'}}>
                                <label style={{fontSize: '0.9rem', display: 'block', marginBottom: '0.5rem'}}>Import dari CSV:</label>
                                <input type="file" accept=".csv" onChange={handleUnitCSVUpload} />
                            </div>

                            <ul className="category-list">
                                {units.map(u => (
                                    <li key={u.id} className="category-list-item">
                                        <span>{u.name}</span>
                                        <button className="btn btn-danger btn-sm" onClick={() => {
                                             if(confirm('Hapus unit ini?')) setUnits(units.filter(x => x.id !== u.id));
                                        }}>Hapus</button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
                
                {/* --- SETTINGS TAB (NEW ITEM, CATEGORY, & ADMIN) --- */}
                {activeTab === 'settings' && (
                    <div className="user-admin-grid">
                        <div className="add-item-section full-width-grid-item">
                            <div className="manager-header">
                                <h3>Tambah Barang Baru</h3>
                                <button className="btn btn-secondary btn-sm" onClick={handleExportItems}>Export CSV</button>
                            </div>
                            
                            <form className="add-item-form" onSubmit={handleAddItem}>
                                <div className="form-row-grid" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                                    <div className="form-group">
                                        <label>Nama Barang</label>
                                        <input type="text" className="form-control" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} required />
                                    </div>
                                    <div className="form-group">
                                        <label>Kategori</label>
                                        <select className="form-control" value={newItem.categoryId} onChange={e => setNewItem({ ...newItem, categoryId: Number(e.target.value) })}>
                                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Deskripsi</label>
                                    <textarea className="form-control" value={newItem.description} onChange={e => setNewItem({ ...newItem, description: e.target.value })} required />
                                </div>
                                <div className="form-row-grid" style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem'}}>
                                    <div className="form-group">
                                        <label>Jumlah</label>
                                        <input type="number" className="form-control" value={newItem.quantity} onChange={e => setNewItem({ ...newItem, quantity: Number(e.target.value) })} min="1" required />
                                    </div>
                                    <div className="form-group">
                                        <label>Tanggal Pembelian</label>
                                        <input type="date" className="form-control" value={newItem.purchaseDate} onChange={e => setNewItem({ ...newItem, purchaseDate: e.target.value })} required />
                                    </div>
                                    <div className="form-group">
                                        <label>Gambar Barang</label>
                                        <input 
                                            type="file" 
                                            className="form-control" 
                                            onChange={handleNewItemImageUpload} 
                                            accept="image/*" 
                                        />
                                        {newItem.imageUrl && (
                                            <div style={{marginTop: '0.5rem'}}>
                                                <img src={newItem.imageUrl} alt="Preview" style={{maxHeight: '80px', borderRadius: '4px'}} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <button type="submit" className="btn btn-success" style={{marginTop: '1rem', width: '100%'}}>Simpan Barang</button>
                            </form>

                            <div className="data-manager-section" style={{marginTop: '2rem'}}>
                                <label style={{fontSize: '0.9rem', display: 'block', marginBottom: '0.5rem'}}>Import Barang dari CSV:</label>
                                <p style={{fontSize: '0.8rem', color: '#90a4ae', marginBottom:'0.5rem'}}>Format: Nama, Deskripsi, Jumlah, Kategori, Tanggal (YYYY-MM-DD), URL Gambar</p>
                                <input type="file" accept=".csv" onChange={handleItemCSVUpload} />
                            </div>
                        </div>
                        
                        {/* Categories */}
                        <div className="management-section">
                            <div className="manager-header">
                                <h3>Manajemen Kategori</h3>
                            </div>
                            <div className="form-inline" style={{marginBottom: '1rem'}}>
                                <input type="text" className="form-control" placeholder="Nama Kategori Baru" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} />
                                <button className="btn btn-primary" onClick={handleAddCategory}>Tambah</button>
                            </div>

                            <ul className="category-list">
                                {categories.map(c => (
                                    <li key={c.id} className="category-list-item">
                                        <span>{c.name}</span>
                                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteCategory(c.id)}>Hapus</button>
                                    </li>
                                ))}
                            </ul>
                            <p style={{marginTop: '1rem', fontSize: '0.85rem', color: '#90a4ae'}}>
                                *Menghapus kategori akan mempengaruhi filter barang, tetapi tidak akan menghapus barang itu sendiri.
                            </p>
                        </div>

                         {/* Admin Management (NEW SECTION) */}
                        <div className="management-section">
                            <div className="manager-header">
                                <h3>Manajemen Admin</h3>
                                <button className="btn btn-primary btn-sm" onClick={() => setIsAdminModalOpen(true)}>+ Admin Baru</button>
                            </div>

                            <ul className="category-list">
                                {admins.map(admin => (
                                    <li key={admin.id} className="category-list-item">
                                        <div>
                                            <strong>{admin.username}</strong>
                                            {admin.username === currentUser && (
                                                <span className="current-user-badge">Anda</span>
                                            )}
                                        </div>
                                        <div className="category-actions">
                                            <button className="btn btn-info btn-sm" onClick={() => {
                                                setSelectedAdminForEdit(admin);
                                                setIsAdminModalOpen(true);
                                            }}>Edit / Reset</button>
                                            {admin.username !== currentUser && (
                                                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteAdmin(admin.id)}>Hapus</button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
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

                        {/* Section 1: Summary & Statistics */}
                        <div className="report-grid">
                            <div className="report-card stats-summary">
                                <h3>Ringkasan Status</h3>
                                <div className="summary-stats-vertical">
                                    <div className="stat-row">
                                        <span className="stat-label">Total Aset</span>
                                        <span className="stat-value">{items.length}</span>
                                    </div>
                                    <div className="stat-row">
                                        <span className="stat-label">Sedang Dipinjam</span>
                                        <span className="stat-value highlight-warning">{loanHistory.filter(l => l.status === 'borrowed').length}</span>
                                    </div>
                                    <div className="stat-row">
                                        <span className="stat-label">Total Selesai</span>
                                        <span className="stat-value highlight-success">{loanHistory.filter(l => l.status === 'returned').length}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="report-card popular-items">
                                <h3>Barang Paling Sering Dipinjam</h3>
                                <SimpleBarChart data={popularItems} />
                            </div>

                            {/* New Charts */}
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
                                                            {loan.itemImage && <img src={loan.itemImage} alt="" />}
                                                            <span>{loan.itemName}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        {users.find(u => u.id === loan.borrowerId)?.name || loan.borrowerName}
                                                    </td>
                                                    <td>
                                                        <div className="date-cell">
                                                            <small>Pinjam:</small> {formatDate(loan.borrowDate)}<br/>
                                                            {loan.returnDate && <><small>Kembali:</small> {formatDate(loan.returnDate)}<br/></>}
                                                            <small style={{color: 'var(--info-color)', fontWeight: 'bold'}}>Durasi: {calculateDuration(loan.borrowDate, loan.returnDate)}</small>
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
    </div>
                 )}
            </div>
        </main>

        <footer>
            <p>&copy; {new Date().getFullYear()} LendifyIT - Sistem Peminjaman Barang IT</p>
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
                loanHistory={loanHistory}
                units={units}
                onClose={() => setViewingHistoryUser(null)}
            />
        )}
        {viewingHistoryItem && (
            <ItemHistoryModal 
                item={viewingHistoryItem}
                loanHistory={loanHistory}
                users={users}
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