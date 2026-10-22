import { useMemo } from 'react';

export default function ConfirmScreen({ data, onBack, onSubmit }) {
  const stats = useMemo(() => {
    const total = data.questions.length;
    const answered = data.answers.filter(a => a.chosen).length;
    const flagged = data.answers.filter(a => a.flagged).length;
    return { total, answered, unanswered: total - answered, flagged };
  }, [data]);

  return (
    <div className="container">
      <h2>Kumpulkan Jawaban?</h2>
      <div className="card">
        <div className="stat-row">
          <span>Total Soal</span>
          <strong>{stats.total}</strong>
        </div>
        <div className="stat-row">
          <span>Sudah Dijawab</span>
          <strong className="text-green">{stats.answered}</strong>
        </div>
        <div className="stat-row">
          <span>Belum Dijawab</span>
          <strong className="text-red">{stats.unanswered}</strong>
        </div>
        <div className="stat-row">
          <span>Ditandai Ragu-ragu</span>
          <strong className="text-yellow">{stats.flagged}</strong>
        </div>
        
        <div className="nav-buttons">
          <button onClick={onBack}>Kembali Periksa</button>
          <button className="danger primary" onClick={onSubmit}>Ya, Kumpulkan</button>
        </div>
      </div>
    </div>
  );
}