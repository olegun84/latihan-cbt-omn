import { useState, useEffect } from 'react';
import { STORAGE_KEY } from '../constants';

export default function HomeScreen({ onStart }) {
  const [name, setName] = useState('');
  const [grade, setGrade] = useState(1);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setHistory(JSON.parse(saved).reverse());
  }, []);

  const handleStart = () => {
    if (!name.trim()) {
      alert('Mohon isi nama panggilan.');
      return;
    }
    onStart(name.trim(), grade);
  };

  const resumeAttempt = (attemptId) => {
    // Triggered via parent by reloading or custom event, but simpler:
    // We'll just let App.jsx handle auto-resume on mount. 
    // For explicit click, we can force reload or pass a prop. 
    // Simpler: just show info, user can refresh or we add a resume prop.
    window.location.reload(); 
  };

  return (
    <div className="container">
      <h1>Latihan CBT OMN</h1>
      <p className="note">⚠️ Tanpa kalkulator. Kerjakan dengan jujur.</p>
      
      <div className="card">
        <label>Nama Panggilan</label>
        <input 
          type="text" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          placeholder="Misal: Budi"
          maxLength={20}
        />
        
        <label>Kelas</label>
        <select value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
          {[1,2,3,4,5,6].map(g => <option key={g} value={g}>Kelas {g} SD</option>)}
        </select>
        
        <button className="primary full-width" onClick={handleStart}>Mulai Latihan</button>
      </div>

      {history.length > 0 && (
        <div className="history-section">
          <h3>Riwayat Latihan</h3>
          {history.map((h, i) => (
            <div key={i} className="history-item">
              <div>
                <strong>{h.name}</strong> - Kelas {h.grade}<br/>
                <small>{new Date(h.startedAt).toLocaleDateString('id-ID')}</small>
              </div>
              <div>
                {h.submitted ? (
                  <span className="score-badge">Nilai: {h.score}</span>
                ) : (
                  <button className="small" onClick={resumeAttempt}>Lanjutkan</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}