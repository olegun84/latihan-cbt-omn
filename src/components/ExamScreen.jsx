import { useState, useMemo } from 'react';

export default function ExamScreen({ data, timeLeft, saveStatus, onSave, onConfirm }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showPanel, setShowPanel] = useState(false);

  const questions = data?.questions || [];
  const answers = data?.answers || [];
  const currentQ = questions[currentIndex];
  
  const currentAnswer = useMemo(() => 
    answers.find(a => a.question_id === currentQ?.id) || {}, 
  [answers, currentQ]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleOptionSelect = (opt) => {
    const newChosen = currentAnswer.chosen === opt ? null : opt;
    onSave(currentQ.id, newChosen, currentAnswer.flagged || false);
  };

  const handleFlag = () => {
    onSave(currentQ.id, currentAnswer.chosen || null, !currentAnswer.flagged);
  };

  const getStatusColor = (idx) => {
    const q = questions[idx];
    const ans = answers.find(a => a.question_id === q.id);
    if (idx === currentIndex) return 'active';
    if (ans?.flagged) return 'flagged';
    if (ans?.chosen) return 'answered';
    return 'unanswered';
  };

  if (!currentQ) return <div className="container">Memuat soal...</div>;

  return (
    <div className="exam-layout">
      <header className="exam-header">
        <div>
          <div className="app-title">Latihan CBT OMN</div>
          <div className="participant-name">{data.participant_name} (Kelas {data.grade})</div>
        </div>
        <div className={`timer ${timeLeft < 300 ? 'danger' : ''}`}>{formatTime(timeLeft)}</div>
        <button className="danger small" onClick={onConfirm}>Selesai</button>
      </header>

      <main className="exam-main">
        <div className="question-card">
          <div className="q-header">
            <span className="q-number">Soal {currentIndex + 1} dari {questions.length}</span>
            <label className="flag-checkbox">
              <input type="checkbox" checked={!!currentAnswer.flagged} onChange={handleFlag} />
              Ragu-ragu
            </label>
          </div>
          <div className="q-body">{currentQ.body}</div>
          <div className="options">
            {['A', 'B', 'C', 'D'].map(opt => (
              <button 
                key={opt} 
                className={`option-btn ${currentAnswer.chosen === opt ? 'selected' : ''}`}
                onClick={() => handleOptionSelect(opt)}
              >
                <span className="opt-label">{opt}.</span> {currentQ[`option_${opt.toLowerCase()}`]}
              </button>
            ))}
          </div>
          <div className="q-nav">
            <button 
              disabled={currentIndex === 0} 
              onClick={() => setCurrentIndex(i => i - 1)}
            >
              Sebelumnya
            </button>
            <button 
              className="primary"
              disabled={currentIndex === questions.length - 1} 
              onClick={() => setCurrentIndex(i => i + 1)}
            >
              Berikutnya
            </button>
          </div>
          <div className={`save-indicator ${saveStatus}`}>
            {saveStatus === 'saving' && 'Menyimpan...'}
            {saveStatus === 'saved' && '✓ Tersimpan'}
            {saveStatus === 'error' && '✗ Gagal, mencoba lagi...'}
          </div>
        </div>
      </main>

      <button className="panel-toggle" onClick={() => setShowPanel(true)}>
        Nomor Soal
      </button>

      {showPanel && (
        <div className="panel-backdrop" onClick={() => setShowPanel(false)}>
          <div className="question-panel" onClick={e => e.stopPropagation()}>
            <h3>Nomor Soal</h3>
            <div className="legend">
              <span className="dot active"></span> Aktif
              <span className="dot answered"></span> Dijawab
              <span className="dot flagged"></span> Ragu
              <span className="dot unanswered"></span> Kosong
            </div>
            <div className="q-grid">
              {questions.map((_, idx) => (
                <button 
                  key={idx} 
                  className={`q-btn ${getStatusColor(idx)}`}
                  onClick={() => { setCurrentIndex(idx); setShowPanel(false); }}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
            <button className="primary full-width" onClick={() => setShowPanel(false)}>Tutup</button>
          </div>
        </div>
      )}
    </div>
  );
}