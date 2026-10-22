import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { STORAGE_KEY, DEFAULT_DURATION_SECONDS } from './constants';
import HomeScreen from './components/HomeScreen';
import ExamScreen from './components/ExamScreen';
import ConfirmScreen from './components/ConfirmScreen';
import ResultScreen from './components/ResultScreen';

function App() {
  const [view, setView] = useState('home');
  const [attemptId, setAttemptId] = useState(null);
  const [attemptData, setAttemptData] = useState(null);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_DURATION_SECONDS);
  const [saveStatus, setSaveStatus] = useState('idle'); // idle, saving, saved, error

  const loadAttempt = useCallback(async (id) => {
    setSaveStatus('saving');
    const { data, error } = await supabase.rpc('get_attempt', { p_attempt: id });
    if (error || !data) {
      setSaveStatus('error');
      return;
    }
    setAttemptData(data);
    setAttemptId(id);
    
    if (data.submitted) {
      setView('result');
    } else {
      setView('exam');
      const deadline = new Date(data.deadline).getTime();
      const updateTimer = () => {
        const left = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
        setTimeLeft(left);
        if (left <= 0) {
          handleSubmit(id);
        }
      };
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const history = JSON.parse(saved);
      const active = history.find(h => !h.submitted && new Date(h.deadline).getTime() > Date.now());
      if (active) {
        loadAttempt(active.attemptId);
      }
    }
  }, [loadAttempt]);

  const handleStart = async (name, grade) => {
    const { data, error } = await supabase.rpc('start_attempt', { 
      p_name: name, 
      p_grade: grade 
    });
    if (error) {
      alert('Gagal memulai: ' + error.message);
      return;
    }
    const newHistory = {
      attemptId: data,
      name,
      grade,
      startedAt: new Date().toISOString(),
      deadline: new Date(Date.now() + DEFAULT_DURATION_SECONDS * 1000).toISOString(),
      submitted: false
    };
    const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...history, newHistory]));
    loadAttempt(data);
  };

  const handleSaveAnswer = async (questionId, chosen, flagged) => {
    if (!attemptId || attemptData?.submitted) return;
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
    } else {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
      loadAttempt(attemptId);
    }
  };

  const handleSubmit = async (id = attemptId) => {
    const { data, error } = await supabase.rpc('submit_attempt', { p_attempt: id });
    if (error) {
      alert('Gagal mengumpulkan: ' + error.message);
      return;
    }
    const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const updated = history.map(h => h.attemptId === id ? { ...h, submitted: true, score: data } : h);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setView('result');
    loadAttempt(id);
  };

  const handleReset = () => {
    setAttemptId(null);
    setAttemptData(null);
    setView('home');
  };

  if (view === 'home') return <HomeScreen onStart={handleStart} />;
  if (view === 'exam') return (
    <ExamScreen 
      data={attemptData} 
      timeLeft={timeLeft} 
      saveStatus={saveStatus}
      onSave={handleSaveAnswer}
      onConfirm={() => setView('confirm')}
    />
  );
  if (view === 'confirm') return (
    <ConfirmScreen 
      data={attemptData}
      onBack={() => setView('exam')}
      onSubmit={() => handleSubmit()}
    />
  );
  if (view === 'result') return (
    <ResultScreen 
      data={attemptData} 
      onReset={handleReset} 
    />
  );
  return null;
}

export default App;