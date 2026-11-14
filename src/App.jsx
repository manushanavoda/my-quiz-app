import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { Upload, CheckCircle, XCircle, Award, History, Sparkles, Clock, FileText } from 'lucide-react';

// Initialize Gemini AI and Supabase clients
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

export default function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [history, setHistory] = useState([]);
  const [seconds, setSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(false);

  // Load past quiz history on component mount
  useEffect(() => {
    fetchHistory();
  }, []);

  // Handle live quiz timer
  useEffect(() => {
    let interval = null;
    if (timerActive && !submitted) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timerActive, submitted]);

  // Fetch recent quiz records from Supabase
  const fetchHistory = async () => {
    const { data } = await supabase
      .from('quizzes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    if (data) setHistory(data);
  };

  // Convert uploaded file into base64 inlineData format for Gemini SDK
  const fileToGenerativePart = async (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result.split(',')[1];
        resolve({
          inlineData: {
            data: base64Data,
            mimeType: file.type
          }
        });
      };
      reader.readAsDataURL(file);
    });
  };

  // Generate MCQs from the uploaded PDF or image using Gemini API
  const handleGenerateQuiz = async () => {
    if (!file) return alert('කරුණාකර PDF හෝ Photo එකක් තෝරන්න!');
    setLoading(true);
    setSubmitted(false);
    setAnswers({});
    setQuestions([]);
    setSeconds(0);

    try {
      const filePart = await fileToGenerativePart(file);
      const prompt = `
        Analyze this document or image and create 5 multiple-choice questions (MCQs).
        Return ONLY a valid JSON array with no markdown formatting. Format:
        [
          {
            "question": "Question text?",
            "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
            "correctAnswer": 0
          }
        ]
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [filePart, prompt],
      });

      const rawText = response.text || '';
      const cleanJson = rawText.replace(/```json|```/g, '').trim();
      const parsedQuestions = JSON.parse(cleanJson);
      
      setQuestions(parsedQuestions);
      setTimerActive(true); // Start timer once questions are loaded
    } catch (error) {
      console.error('Error generating quiz:', error);
      alert('Quiz එක හදද්දී දෝෂයක් ආවා. නැවත උත්සාහ කරන්න.');
    }
    setLoading(false);
  };

  // Calculate score and save the attempt to Supabase
  const handleSubmit = async () => {
    setTimerActive(false);
    let currentScore = 0;
    questions.forEach((q, index) => {
      if (answers[index] === q.correctAnswer) currentScore++;
    });
    setScore(currentScore);
    setSubmitted(true);

    const { error } = await supabase.from('quizzes').insert([
      {
        title: file ? file.name : 'Untitled Quiz',
        questions: questions,
        score: currentScore,
        total: questions.length,
      },
    ]);

    if (!error) {
      fetchHistory();
    }
  };

  // Format elapsed seconds into MM:SS
  const formatTime = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', padding: '40px 20px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#f8fafc' }}>
      <div style={{ maxWidth: '850px', margin: '0 auto' }}>
        
        {/* Application Header */}
        <header style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: 'rgba(99, 102, 241, 0.1)', padding: '8px 16px', borderRadius: '50px', border: '1px solid rgba(99, 102, 241, 0.3)', marginBottom: '15px' }}>
            <Sparkles size={18} color="#818cf8" />
            <span style={{ fontSize: '0.85rem', color: '#c7d2fe', fontWeight: '600', letterSpacing: '0.5px' }}>POWERED BY GEMINI AI & SUPABASE</span>
          </div>
          <h1 style={{ fontSize: '2.8rem', fontWeight: '800', background: 'linear-gradient(to right, #818cf8, #c084fc, #f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '12px' }}>
            AI Study Quiz Generator 🧠
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '1.1rem' }}>ඕනෑම PDF හෝ Note Photo එකක් upload කර ක්ෂණිකව Smart Quiz එකක් සාදාගන්න</p>
        </header>

        {/* File Upload Card */}
        <div style={{ background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '20px', padding: '35px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', marginBottom: '30px' }}>
          <div style={{ width: '70px', height: '70px', background: 'rgba(99, 102, 241, 0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
            <Upload size={32} color="#818cf8" />
          </div>
          
          <input
            type="file"
            accept="application/pdf, image/*"
            onChange={(e) => setFile(e.target.files[0])}
            style={{ marginBottom: '20px', color: '#cbd5e1', fontSize: '0.95rem' }}
          />

          <br />
          <button
            onClick={handleGenerateQuiz}
            disabled={loading}
            style={{
              background: loading ? '#475569' : 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              color: 'white', border: 'none', padding: '14px 32px',
              borderRadius: '12px', fontSize: '1.1rem', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold',
              boxShadow: '0 10px 20px rgba(99, 102, 241, 0.4)', transition: 'all 0.3s ease',
              display: 'inline-flex', alignItems: 'center', gap: '10px'
            }}
          >
            {loading ? 'AI මගින් ප්‍රශ්න සකසමින් පවතී...' : 'Generate Quiz ✨'}
          </button>
        </div>

        {/* Active Quiz Timer Bar */}
        {questions.length > 0 && !submitted && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(30, 41, 59, 0.8)', padding: '15px 25px', borderRadius: '14px', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ fontWeight: '600', color: '#e2e8f0' }}>🎯 ප්‍රශ්න මාලාව සූදානම්!</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontWeight: 'bold' }}>
              <Clock size={18} />
              <span>ගතවූ කාලය: {formatTime(seconds)}</span>
            </div>
          </div>
        )}

        {/* Questions List Section */}
        {questions.length > 0 && (
          <div style={{ background: 'rgba(30, 41, 59, 0.85)', backdropFilter: 'blur(12px)', padding: '35px', borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', marginBottom: '40px' }}>
            {questions.map((q, qIndex) => (
              <div key={qIndex} style={{ marginBottom: '30px', paddingBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <h3 style={{ marginBottom: '15px', fontSize: '1.2rem', color: '#f1f5f9', lineHeight: '1.5' }}>
                  {qIndex + 1}. {q.question}
                </h3>
                {q.options.map((opt, optIndex) => {
                  const isSelected = answers[qIndex] === optIndex;
                  const isCorrect = q.correctAnswer === optIndex;
                  let bgOption = 'rgba(15, 23, 42, 0.6)';
                  let borderColor = 'rgba(255, 255, 255, 0.1)';

                  if (isSelected) {
                    bgOption = 'rgba(99, 102, 241, 0.2)';
                    borderColor = '#818cf8';
                  }

                  if (submitted) {
                    if (isCorrect) {
                      bgOption = 'rgba(34, 197, 94, 0.2)';
                      borderColor = '#22c55e';
                    } else if (isSelected && !isCorrect) {
                      bgOption = 'rgba(239, 68, 68, 0.2)';
                      borderColor = '#ef4444';
                    }
                  }

                  return (
                    <div
                      key={optIndex}
                      onClick={() => !submitted && setAnswers({ ...answers, [qIndex]: optIndex })}
                      style={{
                        padding: '14px 18px', margin: '10px 0', borderRadius: '12px', cursor: submitted ? 'default' : 'pointer',
                        backgroundColor: bgOption, border: `1px solid ${borderColor}`,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s ease'
                      }}
                    >
                      <span style={{ color: '#e2e8f0', fontSize: '1rem' }}>{opt}</span>
                      {submitted && isCorrect && <CheckCircle color="#22c55e" size={20} />}
                      {submitted && isSelected && !isCorrect && <XCircle color="#ef4444" size={20} />}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Submit Button or Final Score Display */}
            {!submitted ? (
              <button
                onClick={handleSubmit}
                style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 10px 20px rgba(34, 197, 94, 0.3)', transition: 'all 0.3s ease' }}
              >
                Submit Answers & Save Score
              </button>
            ) : (
              <div style={{ textAlign: 'center', padding: '30px', background: 'rgba(15, 23, 42, 0.8)', borderRadius: '16px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                <Award size={56} color="#22c55e" style={{ marginBottom: '10px' }} />
                <h2 style={{ fontSize: '2rem', color: '#4ade80', marginBottom: '8px' }}>ඔබේ ලකුණු: {score} / {questions.length}</h2>
                <p style={{ color: '#94a3b8', fontSize: '1rem' }}>කාලය: {formatTime(seconds)} | ලකුණු Database එකේ සාර්ථකව Save විය!</p>
              </div>
            )}
          </div>
        )}

        {/* Recent Quiz History Section */}
        {history.length > 0 && (
          <div style={{ background: 'rgba(30, 41, 59, 0.6)', backdropFilter: 'blur(12px)', padding: '30px', borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.3rem', marginBottom: '20px', color: '#cbd5e1' }}>
              <History size={22} color="#818cf8" /> මෑතකදී කළ Quizzes ඉතිහාසය
            </h3>
            {history.map((item) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', backgroundColor: 'rgba(15, 23, 42, 0.5)', margin: '10px 0', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#e2e8f0' }}>
                  <FileText size={18} color="#94a3b8" /> {item.title}
                </span>
                <span style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', padding: '6px 14px', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.9rem', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                  ලකුණු: {item.score} / {item.total}
                </span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}