import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { STORAGE_KEY, DEFAULT_DURATION_SECONDS } from './constants';
import HomeScreen from './components/HomeScreen';
import ExamScreen from './components/ExamScreen';
import ConfirmScreen from './components/ConfirmScreen';
import ResultScreen from './components/ResultScreen';

function readHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeHistory(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function App() {
  const [view, setView] = useState('home');
  const [attemptId, setAttemptId] = useState(null);
  const [attemptData, setAttemptData] = useState(null);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_DURATION_SECONDS);
  const [saveStatus, setSaveStatus] = useState('idle');

  const removeHistory = (id) => {
    writeHistory(readHistory().filter(h => h.attemptId !== id));
  };

  const loadAttempt = useCallback(async (id) => {
    const { data, error } = await supabase.rpc('get_attempt', { p_attempt: id });
    if (error || !data) {
      removeHistory(id);
      alert('Gagal memuat latihan: ' + (error ? error.message : 'data tidak ditemukan'));
      setView('home');
      return;
    }
    if (!data.questions || data.questions.length === 0) {
      removeHistory(id);
      alert('Latihan ini tidak memiliki soal (bank soal masih kosong saat dibuat). Silakan mulai latihan baru.');
      setView('home');
      return;
    }
    setAttemptId(id);
    setAttemptData({ ...data, answers: data.answers || [] });
    setView(data.submitted ? 'result' : 'exam');
  }, []);

  useEffect(() => {
    const active = readHistory().find(h => !h.submitted && new Date(h.deadline).getTime() > Date.now());
    if (active) loadAttempt(active.attemptId);
  }, [loadAttempt]);

  useEffect(() => {
    if (view !== 'exam' || !attemptData || attemptData.submitted) return;
    const deadline = new Date(attemptData.deadline).getTime();
    const tick = () => {
      const left = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      setTimeLeft(left);
      if (left <= 0) handleSubmit(attemptId);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [view, attemptId, attemptData]);

  const handleStart = async (name, grade) => {
    const { data, error } = await supabase.rpc('start_attempt', { p_name: name, p_grade: grade });
    if (error) {
      alert('Gagal memulai: ' + error.message);
      return;
    }
    const entry = {
      attemptId: data,
      name,
      grade,
      startedAt: new Date().toISOString(),
      deadline: new Date(Date.now() + DEFAULT_DURATION_SECONDS * 1000).toISOString(),
      submitted: false
    };
    writeHistory([...readHistory(), entry]);
    loadAttempt(data);
  };

  const handleSaveAnswer = async (questionId, chosen, flagged) => {
    if (!attemptId || !attemptData || attemptData.submitted) return;
    setSaveStatus('saving');
    const { error } = await supabase.rpc('save_answer', {
      p_attempt: attemptId,
      p_question: questionId,
      p_chosen: chosen,
      p_flagged: flagged
    });
    if (error) {
      setSaveStatus('error');
      setTimeout(() => handleSaveAnswer(questionId, chosen, flagged), 2000);
      return;
    }
    setAttemptData(prev => {
      const others = (prev.answers || []).filter(a => a.question_id !== questionId);
      return { ...prev, answers: [...others, { question_id: questionId, chosen, flagged }] };
    });
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 1500);
  };

  const handleSubmit = async (id = attemptId) => {
    if (!id) return;
    const { data, error } = await supabase.rpc('submit_attempt', { p_attempt: id });
    if (error) {
      alert('Gagal mengumpulkan: ' + error.message);
      return;
    }
    writeHistory(readHistory().map(h => (h.attemptId === id ? { ...h, submitted: true, score: data } : h)));
    setView('result');
  };

  const handleReset = () => {
    setAttemptId(null);
    setAttemptData(null);
    setTimeLeft(DEFAULT_DURATION_SECONDS);
    setView('home');
  };

  if (view === 'home') return <HomeScreen onStart={handleStart} />;
  if (view === 'exam')
    return (
      <ExamScreen
        data={attemptData}
        timeLeft={timeLeft}
        saveStatus={saveStatus}
        onSave={handleSaveAnswer}
        onConfirm={() => setView('confirm')}
      />
    );
  if (view === 'confirm')
    return <ConfirmScreen data={attemptData} onBack={() => setView('exam')} onSubmit={() => handleSubmit()} />;
  if (view === 'result') return <ResultScreen attemptId={attemptId} onReset={handleReset} />;
  return null;
}

export default App;
