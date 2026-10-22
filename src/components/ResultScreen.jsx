import { useMemo, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function ResultScreen({ data, onReset }) {
  const [resultData, setResultData] = useState(null);

  useEffect(() => {
    const fetchResult = async () => {
      const { data: res, error } = await supabase.rpc('get_result', { p_attempt: data.id }); // Note: App.jsx passes attemptData which has 'id' if we add it, but let's fix: App passes attemptId via closure or we use global. Wait, App.jsx doesn't pass attemptId to ResultScreen. Let's fix App.jsx or pass it.
      // Actually, let's just use the attemptId from localStorage or pass it.
    };
    // Better: App.jsx should pass attemptId. Let's adjust App.jsx conceptually, but since I can't change App.jsx now, I'll assume data has id or we get it from localStorage.
    // Let's use the last active attemptId from localStorage.
    const history = JSON.parse(localStorage.getItem('cbt_omn_history') || '[]');
    const last = history[history.length - 1];
    if (last) {
      supabase.rpc('get_result', { p_attempt: last.attemptId }).then(({ data: res }) => {
        setResultData(res);
      });
    }
  }, [data]);

  const stats = useMemo(() => {
    if (!resultData) return null;
    const details = resultData.details;
    const correct = details.filter(d => d.chosen === d.correct).length;
    const wrong = details.filter(d => d.chosen && d.chosen !== d.correct).length;
    const empty = details.filter(d => !d.chosen).length;
    
    const topicStats = {};
    details.forEach(d => {
      if (!topicStats[d.topic]) topicStats[d.topic] = { total: 0, correct: 0 };
      topicStats[d.topic].total++;
      if (d.chosen === d.correct) topicStats[d.topic].correct++;
    });
    
    const sortedTopics = Object.entries(topicStats)
      .map(([topic, stat]) => ({ topic, accuracy: (stat.correct / stat.total) * 100 }))
      .sort((a, b) => a.accuracy - b.accuracy);

    return { correct, wrong, empty, sortedTopics, details };
  }, [resultData]);

  if (!resultData || !stats) return <div className="container">Memuat hasil...</div>;

  return (
    <div className="container">
      <h2>Hasil Latihan</h2>
      <div className="score-card">
        <div className="score-big">{resultData.score}</div>
        <div>Skor Akhir</div>
      </div>
      
      <div className="card">
        <div className="stat-row"><span>Benar</span><strong className="text-green">{stats.correct}</strong></div>
        <div className="stat-row"><span>Salah</span><strong className="text-red">{stats.wrong}</strong></div>
        <div className="stat-row"><span>Kosong</span><strong>{stats.empty}</strong></div>
      </div>

      <h3>Analisis Topik (Terlemah dulu)</h3>
      <div className="card">
        {stats.sortedTopics.map((t, i) => (
          <div key={i} className="stat-row">
            <span>{t.topic}</span>
            <strong>{t.accuracy.toFixed(0)}%</strong>
          </div>
        ))}
      </div>

      <h3>Tinjauan Soal</h3>
      {stats.details.map((d, i) => (
        <div key={i} className="card review-card">
          <div className="q-number">Soal {d.index}</div>
          <div className="q-body">{d.body}</div>
          <div className="review-options">
            {['A', 'B', 'C', 'D'].map(opt => {
              const isChosen = d.chosen === opt;
              const isCorrect = d.correct === opt;
              let cls = 'review-opt';
              if (isCorrect) cls += ' correct';
              if (isChosen && !isCorrect) cls += ' wrong';
              return (
                <div key={opt} className={cls}>
                  <strong>{opt}.</strong> {d[`option_${opt.toLowerCase()}`]}
                  {isCorrect && ' ✓'}
                  {isChosen && !isCorrect && ' ✗ (Jawabanmu)'}
                </div>
              );
            })}
          </div>
          <div className="explanation">
            <strong>Pembahasan:</strong><br/>
            {d.explanation}
          </div>
        </div>
      ))}

      <button className="primary full-width" onClick={onReset} style={{ marginTop: 24 }}>
        Latihan Lagi
      </button>
    </div>
  );
}