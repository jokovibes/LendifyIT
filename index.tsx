
import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from 'https://esm.sh/@supabase/supabase-js';

// --- Supabase Configuration ---
const SUPABASE_URL = 'https://dyghqoyntdyphzezbrne.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_wMnwQe2QrIyGA_Sa76OfJQ_v9FyW_KC';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
  password: string;
}

interface LoanRecord {
  id: number;
  itemId: number;
  itemName: string;
  itemImage?: string;
  borrowerName: string; 
  borrowerId?: number; 
  borrowDate: string;
  returnDate: string | null;
  status: 'borrowed' | 'returned';
  purpose?: string;
  expectedDuration?: number; 
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
    
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays === 0 ? '1 Hari' : `${diffDays} Hari`;
};

const parseCSV = (content: string) => {
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return []; 
  return lines.slice(1).map(line => line.trim());
};

// --- Mock Data (For Seeding if Empty) ---

const initialCategories = [
  { name: 'Laptop' },
  { name: 'Peripherals' },
  { name: 'Kabel & Adaptor' },
  { name: 'Monitor' },
  { name: 'Lainnya' },
];

const initialItems = [
  { name: 'MacBook Pro M1', description: 'Laptop untuk tim desain', imageUrl: 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&w=500&q=80', purchaseDate: '2023-01-15', categoryId: 1, quantity: 5 },
  { name: 'Logitech MX Master 3', description: 'Mouse wireless ergonomis', imageUrl: 'https://images.unsplash.com/photo-1605773527852-c546a8584ea3?auto=format&fit=crop&w=500&q=80', purchaseDate: '2023-03-10', categoryId: 2, quantity: 10 },
  { name: 'Dell UltraSharp 27"', description: 'Monitor 4K USB-C', imageUrl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=500&q=80', purchaseDate: '2022-11-20', categoryId: 4, quantity: 3 },
];

const initialUnits = [
    { name: 'IT Development' },
    { name: 'Human Resources' },
    { name: 'Finance' },
    { name: 'Marketing' },
];

// --- Components ---

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

const BorrowModal = ({ item, users, onConfirm, onCancel }: { item: Item, users: User[], onConfirm: (userId: number, purpose: string, duration: number) => void, onCancel: () => void }) => {
    const [selectedUserId, setSelectedUserId] = useState<number | ''>('');
    const [purpose, setPurpose] = useState('');
    const [duration, setDuration] = useState(1); 
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

const BorrowerHistoryModal = ({ user, loanHistory, units, onClose }: { user: User, loanHistory: LoanRecord[], units: Unit[], onClose: () => void }) => {
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 300);
    };

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

const ItemHistoryModal = ({ item, loanHistory, users, onClose }: { item: Item, loanHistory: LoanRecord[], users: User[], onClose: () => void }) => {
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 300);
    };

    const itemHistory = loanHistory.filter(loan => loan.itemId === item.id);
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
            password: password || undefined 
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

// --- Simple SVG Charts ---

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
                <polyline fill="none" stroke="var(--success-color)" strokeWidth="3" points={points} />
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
                        <rect x={labelWidth} y={10} width={Math.max(barWidth, 5)} height={20} fill="var(--primary-color)" rx="4" />
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
                <div className="donut-chart" style={{ background: `conic-gradient(${gradient})` }}>
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

const LoansSummaryDashboard = ({ loanHistory, items, users, categories }: { loanHistory: LoanRecord[], items: Item[], users: User[], categories: Category[] }) => {
    const activeLoans = loanHistory.filter(l => l.status === 'borrowed');
    
    const overdueLoans = activeLoans.filter(l => {
        const borrowDate = new Date(l.borrowDate);
        const today = new Date();
        const diffTime = Math.abs(today.getTime() - borrowDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        const limit = l.expectedDuration || 7;
        return diffDays > limit; 
    });

    const getActiveLoanCategoryData = () => {
        const colors = ['#0d47a1', '#ef5350', '#26a69a', '#ffca28', '#5c6bc0', '#90a4ae'];
        const data: any[] = [];
        
        categories.forEach((cat, idx) => {
            const catItemIds = items.filter(i => i.categoryId === cat.id).map(i => i.id);
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

const App = () => {
  const [currentUser, setCurrentUser] = useState<string | null>(() => sessionStorage.getItem('currentUser'));
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loanHistory, setLoanHistory] = useState<LoanRecord[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState('inventory');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<number | 'all'>('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [borrowingItem, setBorrowingItem] = useState<Item | null>(null);
  const [newItem, setNewItem] = useState<Partial<Item>>({
      name: '', description: '', imageUrl: '', purchaseDate: new Date().toISOString().split('T')[0], categoryId: 1, quantity: 1
  });
  const [viewingHistoryUser, setViewingHistoryUser] = useState<User | null>(null);
  const [viewingHistoryItem, setViewingHistoryItem] = useState<Item | null>(null);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [selectedAdminForEdit, setSelectedAdminForEdit] = useState<Admin | null>(null);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  const [newUserName, setNewUserName] = useState('');
  const [newUserUnit, setNewUserUnit] = useState<number>(0);
  const [newUnitName, setNewUnitName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');

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

  // --- Data Sync Logic ---

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: catData } = await supabase.from('categories').select('*').order('name');
      const { data: itemData } = await supabase.from('items').select('*').order('name');
      const { data: unitData } = await supabase.from('units').select('*').order('name');
      const { data: userData } = await supabase.from('users').select('*').order('name');
      const { data: adminData } = await supabase.from('admins').select('*');
      const { data: loanData } = await supabase.from('loan_records').select('*').order('borrowDate', { ascending: false });

      setCategories(catData || []);
      setItems(itemData || []);
      setUnits(unitData || []);
      setUsers(userData || []);
      setAdmins(adminData || []);
      setLoanHistory(loanData || []);

      if (userData && userData.length > 0 && newUserUnit === 0) {
          setNewUserUnit(unitData?.[0]?.id || 0);
      }

      // Initial Seed if Empty (Simple logic for demo)
      if (!catData?.length && !itemData?.length) {
         await seedInitialData();
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      addNotification('Gagal memuat data dari database.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const seedInitialData = async () => {
      addNotification('Menginisialisasi database...', 'info');
      const { data: cat } = await supabase.from('categories').insert(initialCategories).select();
      const { data: unt } = await supabase.from('units').insert(initialUnits).select();
      
      const adminExists = await supabase.from('admins').select('id').limit(1);
      if (!adminExists.data?.length) {
          await supabase.from('admins').insert({ username: 'admin', password: 'password' });
      }

      await fetchData();
  };

  useEffect(() => {
      if (currentUser && loanHistory.length > 0) {
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
            addNotification(`${overdueLoans.length} Barang terlambat dikembalikan!`, 'warning');
        }
      }
  }, [currentUser, loanHistory]);

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
          addNotification('Login gagal.', 'error');
      }
  };

  const initiateLogout = () => setIsLogoutModalOpen(true);
  const confirmLogout = () => {
      sessionStorage.removeItem('currentUser');
      setCurrentUser(null);
      setIsLogoutModalOpen(false);
      addNotification('Logout berhasil.', 'info');
  };

  const handleSaveAdmin = async (data: Partial<Admin>) => {
      if (selectedAdminForEdit) {
          const { error } = await supabase.from('admins').update({
              username: data.username,
              password: data.password
          }).eq('id', selectedAdminForEdit.id);

          if (error) {
              addNotification('Gagal update admin.', 'error');
          } else {
              addNotification('Data admin diperbarui.', 'success');
              if (currentUser === selectedAdminForEdit.username && data.username) {
                  setCurrentUser(data.username);
                  sessionStorage.setItem('currentUser', data.username);
              }
              await fetchData();
          }
      } else {
          if (admins.some(a => a.username === data.username)) {
              addNotification('Username sudah digunakan.', 'error');
              return;
          }
          const { error } = await supabase.from('admins').insert({
              username: data.username,
              password: data.password
          });
          if (error) {
              addNotification('Gagal tambah admin.', 'error');
          } else {
              addNotification('Admin baru ditambahkan.', 'success');
              await fetchData();
          }
      }
      setIsAdminModalOpen(false);
      setSelectedAdminForEdit(null);
  };

  const handleDeleteAdmin = async (id: number) => {
      const adminToDelete = admins.find(a => a.id === id);
      if (!adminToDelete) return;
      if (adminToDelete.username === currentUser) {
          addNotification('Anda tidak dapat menghapus diri sendiri.', 'error');
          return;
      }
      if (admins.length <= 1) {
          addNotification('Minimal harus ada satu admin.', 'error');
          return;
      }
      if (confirm(`Hapus admin "${adminToDelete.username}"?`)) {
          const { error } = await supabase.from('admins').delete().eq('id', id);
          if (error) addNotification('Gagal hapus admin.', 'error');
          else {
            addNotification('Admin dihapus.', 'info');
            await fetchData();
          }
      }
  };

  const handleAddItem = async (e: FormEvent) => {
      e.preventDefault();
      if (newItem.name && newItem.description) {
          const { error } = await supabase.from('items').insert({
              name: newItem.name,
              description: newItem.description,
              imageUrl: newItem.imageUrl || 'https://via.placeholder.com/150',
              purchaseDate: newItem.purchaseDate,
              categoryId: newItem.categoryId,
              quantity: newItem.quantity
          });

          if (error) {
              addNotification('Gagal menambah barang.', 'error');
          } else {
              setNewItem({ name: '', description: '', imageUrl: '', purchaseDate: new Date().toISOString().split('T')[0], categoryId: 1, quantity: 1 });
              addNotification('Barang berhasil ditambahkan!', 'success');
              await fetchData();
          }
      }
  };

  const handleDeleteItem = async (id: number) => {
      if (confirm('Hapus barang ini?')) {
          const { error } = await supabase.from('items').delete().eq('id', id);
          if (error) addNotification('Gagal menghapus barang.', 'error');
          else {
              addNotification('Barang dihapus.', 'info');
              await fetchData();
          }
      }
  };

  const handleUpdateItem = async (updatedItem: Item) => {
      const { error } = await supabase.from('items').update(updatedItem).eq('id', updatedItem.id);
      if (error) addNotification('Gagal update barang.', 'error');
      else {
          setEditingItem(null);
          addNotification('Data barang diperbarui.', 'success');
          await fetchData();
      }
  };

  const handleBorrowItem = async (userId: number, purpose: string, duration: number) => {
    if (borrowingItem && borrowingItem.quantity > 0) {
        const user = users.find(u => u.id === userId);
        const { error: loanError } = await supabase.from('loan_records').insert({
            itemId: borrowingItem.id,
            itemName: borrowingItem.name,
            itemImage: borrowingItem.imageUrl,
            borrowerId: userId,
            borrowerName: user?.name || 'Unknown',
            borrowDate: new Date().toISOString(),
            status: 'borrowed',
            purpose: purpose,
            expectedDuration: duration
        });

        if (loanError) {
            addNotification('Gagal mencatat peminjaman.', 'error');
            return;
        }

        const { error: itemError } = await supabase.from('items').update({
            quantity: borrowingItem.quantity - 1
        }).eq('id', borrowingItem.id);

        if (itemError) {
             addNotification('Peminjaman tercatat, tapi stok gagal update.', 'warning');
        } else {
             addNotification('Peminjaman berhasil dicatat.', 'success');
        }
        
        setBorrowingItem(null);
        await fetchData();
    }
  };

  const handleReturnItem = async (loanId: number) => {
      const loan = loanHistory.find(l => l.id === loanId);
      if (loan && loan.status === 'borrowed') {
          const { error: loanError } = await supabase.from('loan_records').update({
              returnDate: new Date().toISOString(),
              status: 'returned'
          }).eq('id', loanId);

          if (loanError) {
              addNotification('Gagal mencatat pengembalian.', 'error');
              return;
          }

          const item = items.find(i => i.id === loan.itemId);
          if (item) {
              await supabase.from('items').update({ quantity: item.quantity + 1 }).eq('id', item.id);
          }

          addNotification('Barang berhasil dikembalikan.', 'success');
          await fetchData();
      }
  };

  const handleAddCategory = async () => {
      if (newCategoryName.trim()) {
          const { error } = await supabase.from('categories').insert({ name: newCategoryName });
          if (error) addNotification('Gagal tambah kategori.', 'error');
          else {
              setNewCategoryName('');
              addNotification('Kategori baru ditambahkan.', 'success');
              await fetchData();
          }
      }
  };

  const handleDeleteCategory = async (id: number) => {
      if (confirm('Hapus kategori ini?')) {
          const { error } = await supabase.from('categories').delete().eq('id', id);
          if (error) addNotification('Gagal hapus kategori.', 'error');
          else {
              addNotification('Kategori dihapus.', 'info');
              await fetchData();
          }
      }
  };

  const handleNewItemImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onloadend = () => setNewItem({ ...newItem, imageUrl: reader.result as string });
          reader.readAsDataURL(file);
      }
  };

  const handleUserCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const reader = new FileReader();
          reader.onload = async (evt) => {
              const names = parseCSV(evt.target?.result as string);
              const { error } = await supabase.from('users').insert(names.map(name => ({ name, unitId: units[0]?.id })));
              if (error) addNotification('Gagal impor user.', 'error');
              else {
                  addNotification('Pengguna berhasil diimpor!', 'success');
                  await fetchData();
              }
          };
          reader.readAsText(e.target.files[0]);
      }
  };

  const handleUnitCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const reader = new FileReader();
          reader.onload = async (evt) => {
              const names = parseCSV(evt.target?.result as string);
              const { error } = await supabase.from('units').insert(names.map(name => ({ name })));
              if (error) addNotification('Gagal impor unit.', 'error');
              else {
                  addNotification('Unit berhasil diimpor!', 'success');
                  await fetchData();
              }
          };
          reader.readAsText(e.target.files[0]);
      }
  };

  const handleExportItems = () => {
    const data = items.map(i => ({
        Nama: i.name,
        Deskripsi: i.description,
        Kategori: categories.find(c => c.id === i.categoryId)?.name || 'Unknown',
        Jumlah: i.quantity,
        TanggalBeli: i.purchaseDate
    }));
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(obj => Object.values(obj).map(val => `"${val}"`).join(','));
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", 'inventaris.csv');
    link.click();
  };

  const handlePrint = () => window.print();
  const handleExportPDF = () => {
    const reportElement = document.querySelector('.report-container') as HTMLElement;
    if (reportElement) {
        addNotification('Sedang membuat PDF...', 'info');
        // @ts-ignore
        html2canvas(reportElement, { scale: 2 }).then((canvas) => {
            // @ts-ignore
            const { jsPDF } = window.jspdf;
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
              data.push({ name: cat.name, value: count, color: colors[idx % colors.length] });
          }
      });
      return data;
  };

  if (!currentUser) {
      return (
          <div className="login-container">
               <ToastContainer notifications={notifications} removeNotification={removeNotification} />
              <form className="login-form" onSubmit={handleLogin}>
                  <div className="login-logo"><h2>LendifyIT Login</h2></div>
                  {loginError && <div className="login-error">{loginError}</div>}
                  <div className="form-group">
                      <label>Username</label>
                      <input type="text" className="form-control" value={loginUsername} onChange={e => setLoginUsername(e.target.value)} required />
                  </div>
                  <div className="form-group">
                      <label>Password</label>
                      <input type="password" className="form-control" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={isLoading}>{isLoading ? 'Loading...' : 'Login'}</button>
              </form>
          </div>
      );
  }

  return (
    <div className="app">
        <ToastContainer notifications={notifications} removeNotification={removeNotification} />
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
            <p>Sistem Peminjaman Barang IT (Persistensi Supabase)</p>
        </header>

        <main>
            <nav className="main-nav">
                <a href="#" className={activeTab === 'inventory' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveTab('inventory'); }}>Inventaris</a>
                <a href="#" className={activeTab === 'loans' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveTab('loans'); }}>Peminjaman</a>
                <a href="#" className={activeTab === 'history' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveTab('history'); }}>Riwayat</a>
                <a href="#" className={activeTab === 'management' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveTab('management'); }}>Pengguna & Unit</a>
                <a href="#" className={activeTab === 'reports' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveTab('reports'); }}>Laporan</a>
                <a href="#" className={activeTab === 'settings' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveTab('settings'); }}>Pengaturan</a>
            </nav>

            {isLoading ? (
                <div className="empty-state">Sinkronisasi dengan database Supabase...</div>
            ) : (
                <div className="page-container">
                    {activeTab === 'inventory' && (
                        <>
                            <div className="global-controls">
                                <div className="view-mode-toggle">
                                    <button className={`btn ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('grid')}>Grid</button>
                                    <button className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('list')}>List</button>
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
                                                        <span className="item-card-category-badge">{categories.find(c => c.id === item.categoryId)?.name}</span>
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
                                </div>
                            </div>
                        </>
                    )}

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
                                                 <img src={loan.itemImage} className="item-card-image" style={{height: '150px'}} />
                                                <div className="item-card-content">
                                                    <div className="item-card-header">
                                                        <h3>{loan.itemName}</h3>
                                                        <span className="item-card-borrower-badge">{loan.borrowerName}</span>
                                                    </div>
                                                    <div className="borrowed-info">
                                                        <p><strong>Pinjam:</strong> {formatDate(loan.borrowDate)}</p>
                                                        <p><strong>Rencana:</strong> {loan.expectedDuration || '-'} Hari</p>
                                                        {loan.purpose && <div className="borrowed-purpose"><strong>Keperluan:</strong> {loan.purpose}</div>}
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

                    {activeTab === 'history' && (
                        <div className="history-section">
                            <h2>Riwayat Transaksi</h2>
                            <div className="history-log">
                                <ul>
                                    {loanHistory.map(log => (
                                        <li key={log.id} className="history-item-consolidated">
                                            <div className="history-img-wrapper"><img src={log.itemImage} /></div>
                                            <div className="history-info-wrapper">
                                                <span className="history-item-name">{log.itemName}</span>
                                                <span className="history-item-borrower">Oleh: {log.borrowerName}</span>
                                                {log.purpose && <div className="history-item-purpose">{log.purpose}</div>}
                                            </div>
                                            <div className="history-date-wrapper">
                                                <div className="date-row"><span className="date-label">Pinjam:</span><span>{formatDate(log.borrowDate)}</span></div>
                                                {log.returnDate && <div className="date-row"><span className="date-label">Kembali:</span><span>{formatDate(log.returnDate)}</span></div>}
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
                            </div>
                        </div>
                    )}

                    {activeTab === 'management' && (
                        <div className="user-admin-grid">
                            <div className="management-section">
                                <h3>Manajemen Pengguna</h3>
                                <div className="form-inline" style={{marginBottom: '1rem'}}>
                                    <input type="text" className="form-control" placeholder="Nama User" value={newUserName} onChange={e => setNewUserName(e.target.value)} />
                                    <select className="form-control" value={newUserUnit} onChange={e => setNewUserUnit(Number(e.target.value))}>
                                        {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                    <button className="btn btn-primary" onClick={async () => {
                                        if(newUserName) {
                                            await supabase.from('users').insert({ name: newUserName, unitId: newUserUnit });
                                            setNewUserName('');
                                            await fetchData();
                                        }
                                    }}>Tambah</button>
                                </div>
                                <input type="file" accept=".csv" onChange={handleUserCSVUpload} />
                                <ul className="category-list">
                                    {users.map(u => (
                                        <li key={u.id} className="category-list-item">
                                            <div><strong>{u.name}</strong> <small>{units.find(un => un.id === u.unitId)?.name}</small></div>
                                            <div className="category-actions">
                                                <button className="btn btn-info btn-sm" onClick={() => setViewingHistoryUser(u)}>Riwayat</button>
                                                <button className="btn btn-danger btn-sm" onClick={async () => {
                                                    if(confirm('Hapus user?')) { await supabase.from('users').delete().eq('id', u.id); await fetchData(); }
                                                }}>Hapus</button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="management-section">
                                <h3>Manajemen Unit</h3>
                                <div className="form-inline" style={{marginBottom: '1rem'}}>
                                    <input type="text" className="form-control" placeholder="Nama Unit" value={newUnitName} onChange={e => setNewUnitName(e.target.value)} />
                                    <button className="btn btn-primary" onClick={async () => {
                                        if(newUnitName) { await supabase.from('units').insert({ name: newUnitName }); setNewUnitName(''); await fetchData(); }
                                    }}>Tambah</button>
                                </div>
                                <input type="file" accept=".csv" onChange={handleUnitCSVUpload} />
                                <ul className="category-list">
                                    {units.map(u => (
                                        <li key={u.id} className="category-list-item">
                                            <span>{u.name}</span>
                                            <button className="btn btn-danger btn-sm" onClick={async () => {
                                                if(confirm('Hapus unit?')) { await supabase.from('units').delete().eq('id', u.id); await fetchData(); }
                                            }}>Hapus</button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="user-admin-grid">
                            <div className="add-item-section full-width-grid-item">
                                <h3>Tambah Barang Baru</h3>
                                <form className="add-item-form" onSubmit={handleAddItem}>
                                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                                        <div className="form-group"><label>Nama Barang</label><input type="text" className="form-control" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} required /></div>
                                        <div className="form-group"><label>Kategori</label><select className="form-control" value={newItem.categoryId} onChange={e => setNewItem({ ...newItem, categoryId: Number(e.target.value) })}>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                                    </div>
                                    <div className="form-group"><label>Deskripsi</label><textarea className="form-control" value={newItem.description} onChange={e => setNewItem({ ...newItem, description: e.target.value })} required /></div>
                                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem'}}>
                                        <div className="form-group"><label>Jumlah</label><input type="number" className="form-control" value={newItem.quantity} onChange={e => setNewItem({ ...newItem, quantity: Number(e.target.value) })} min="1" required /></div>
                                        <div className="form-group"><label>Tanggal Beli</label><input type="date" className="form-control" value={newItem.purchaseDate} onChange={e => setNewItem({ ...newItem, purchaseDate: e.target.value })} required /></div>
                                        <div className="form-group"><label>Gambar</label><input type="file" className="form-control" onChange={handleNewItemImageUpload} accept="image/*" /></div>
                                    </div>
                                    <button type="submit" className="btn btn-success" style={{marginTop: '1rem', width: '100%'}}>Simpan ke Supabase</button>
                                </form>
                                <button className="btn btn-secondary btn-sm" style={{marginTop: '1rem'}} onClick={handleExportItems}>Export CSV</button>
                            </div>
                            <div className="management-section">
                                <h3>Kategori</h3>
                                <div className="form-inline" style={{marginBottom: '1rem'}}>
                                    <input type="text" className="form-control" placeholder="Kategori Baru" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} />
                                    <button className="btn btn-primary" onClick={handleAddCategory}>Tambah</button>
                                </div>
                                <ul className="category-list">{categories.map(c => (<li key={c.id} className="category-list-item"><span>{c.name}</span><button className="btn btn-danger btn-sm" onClick={() => handleDeleteCategory(c.id)}>Hapus</button></li>))}</ul>
                            </div>
                            <div className="management-section">
                                <h3>Admin</h3>
                                <button className="btn btn-primary btn-sm" onClick={() => setIsAdminModalOpen(true)}>+ Admin Baru</button>
                                <ul className="category-list">
                                    {admins.map(admin => (
                                        <li key={admin.id} className="category-list-item">
                                            <div><strong>{admin.username}</strong>{admin.username === currentUser && <span className="current-user-badge">Anda</span>}</div>
                                            <div className="category-actions">
                                                <button className="btn btn-info btn-sm" onClick={() => { setSelectedAdminForEdit(admin); setIsAdminModalOpen(true); }}>Edit</button>
                                                {admin.username !== currentUser && <button className="btn btn-danger btn-sm" onClick={() => handleDeleteAdmin(admin.id)}>Hapus</button>}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}

                    {activeTab === 'reports' && (
                         <div className="report-container">
                            <div className="report-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                <h2>Laporan Real-time</h2>
                                <div className="report-actions"><button className="btn btn-secondary btn-sm" onClick={handlePrint}>Cetak</button><button className="btn btn-primary btn-sm" onClick={handleExportPDF}>PDF</button></div>
                            </div>
                            <div className="report-grid">
                                <div className="report-card"><h3>Ringkasan</h3><div className="summary-stats-vertical"><div className="stat-row"><span>Total Aset</span><span>{items.length}</span></div><div className="stat-row"><span>Dipinjam</span><span className="highlight-warning">{loanHistory.filter(l => l.status === 'borrowed').length}</span></div></div></div>
                                <div className="report-card"><h3>Populer</h3><SimpleBarChart data={popularItems} /></div>
                                <div className="report-card"><SimpleLineChart data={getLast7DaysData()} title="Tren 7 Hari" /></div>
                                <div className="report-card"><SimpleDonutChart data={getCategoryData()} /></div>
                            </div>
                            <div className="report-card">
                                <h3>Detail Transaksi</h3>
                                <table className="detailed-report-table">
                                    <thead><tr><th>Barang</th><th>Peminjam</th><th>Tanggal</th><th>Status</th></tr></thead>
                                    <tbody>
                                        {loanHistory.map(loan => (
                                            <tr key={loan.id}>
                                                <td>{loan.itemName}</td>
                                                <td>{loan.borrowerName}</td>
                                                <td>{formatDate(loan.borrowDate)}</td>
                                                <td><span className={`status-badge ${loan.status}`}>{loan.status}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </main>

        <footer><p>&copy; {new Date().getFullYear()} LendifyIT - Database Powered by Supabase</p></footer>

        {editingItem && <EditModal item={editingItem} onSave={handleUpdateItem} onCancel={() => setEditingItem(null)} categories={categories} />}
        {borrowingItem && <BorrowModal item={borrowingItem} users={users} onConfirm={handleBorrowItem} onCancel={() => setBorrowingItem(null)} />}
        {viewingHistoryUser && <BorrowerHistoryModal user={viewingHistoryUser} loanHistory={loanHistory} units={units} onClose={() => setViewingHistoryUser(null)} />}
        {viewingHistoryItem && <ItemHistoryModal item={viewingHistoryItem} loanHistory={loanHistory} users={users} onClose={() => setViewingHistoryItem(null)} />}
        {isLogoutModalOpen && <LogoutConfirmationModal onConfirm={confirmLogout} onCancel={() => setIsLogoutModalOpen(false)} />}
        {isAdminModalOpen && <AdminModal admin={selectedAdminForEdit} onSave={handleSaveAdmin} onCancel={() => { setIsAdminModalOpen(false); setSelectedAdminForEdit(null); }} />}
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}
