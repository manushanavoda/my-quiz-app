import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { Upload, CheckCircle, XCircle, Award, History, Sparkles, Clock, FileText, Check } from 'lucide-react';

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
    if (!file) return alert('Please select a PDF or image file first!');
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
        model: 'gemini-3.8-flash',
        contents: [filePart, prompt],
      });

      const rawText = response.text || '';
      const cleanJson = rawText.replace(/```json|```/g, '').trim();
      const parsedQuestions = JSON.parse(cleanJson);
      
      setQuestions(parsedQuestions);
      setTimerActive(true); // Start timer once questions are loaded
    } catch (error) {
      console.error('Error generating quiz:', error);
      alert('Failed to generate quiz. Please try again.');
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
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #090d16 0%, #13182e 100%)', padding: '50px 20px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#f8fafc' }}>
      <div style={{ maxWidth: '850px', margin: '0 auto' }}>
        
        {/* Application Header */}
        <header style={{ textAlign: 'center', marginBottom: '45px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(99, 102, 241, 0.12)', padding: '8px 18px', borderRadius: '50px', border: '1px solid rgba(99, 102, 241, 0.3)', marginBottom: '18px' }}>
            <Sparkles size={16} color="#818cf8" />
            <span style={{ fontSize: '0.8rem', color: '#c7d2fe', fontWeight: '700', letterSpacing: '0.8px' }}>POWERED BY GEMINI AI & SUPABASE</span>
          </div>
          <h1 style={{ fontSize: '2.7rem', fontWeight: '800', color: '#ffffff', textShadow: '0 0 25px rgba(129, 140, 248, 0.4)', marginBottom: '12px' }}>
            AI Study Quiz Generator 🧠
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>Upload any PDF or Note Photo to instantly generate a smart quiz</p>
        </header>

        {/* File Upload Card */}
        <div style={{ background: 'rgba(20, 27, 45, 0.75)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '24px', padding: '40px', textAlign: 'center', boxShadow: '0 25px 50px rgba(0,0,0,0.5)', marginBottom: '35px' }}>
          <div style={{ width: '75px', height: '75px', background: 'rgba(99, 102, 241, 0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
            <Upload size={34} color="#818cf8" />
          </div>

          <label style={{ display: 'inline-block', background: 'rgba(99, 102, 241, 0.15)', color: '#c7d2fe', padding: '12px 24px', borderRadius: '12px', cursor: 'pointer', border: '1px solid rgba(99, 102, 241, 0.3)', fontWeight: '600', marginBottom: '15px', transition: 'all 0.2s ease' }}>
            {file ? file.name : '📂 Choose PDF or Image File'}
            <input
              type="file"
              accept="application/pdf, image/*"
              onChange={(e) => setFile(e.target.files[0])}
              style={{ display: 'none' }}
            />
          </label>
          
          {file && (
            <p style={{ color: '#38bdf8', fontSize: '0.9rem', marginBottom: '20px' }}>Selected: {file.name}</p>
          )}

          <div>
            <button
              onClick={handleGenerateQuiz}
              disabled={loading}
              style={{
                background: loading ? '#475569' : 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                color: 'white', border: 'none', padding: '15px 36px',
                borderRadius: '14px', fontSize: '1.1rem', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold',
                boxShadow: '0 10px 25px rgba(99, 102, 241, 0.4)', transition: 'all 0.3s ease',
                display: 'inline-flex', alignItems: 'center', gap: '10px'
              }}
            >
              {loading ? 'AI is generating questions...' : 'Generate Quiz ✨'}
            </button>
          </div>
        </div>

        {/* Active Quiz Timer Bar */}
        {questions.length > 0 && !submitted && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(20, 27, 45, 0.85)', padding: '18px 28px', borderRadius: '16px', marginBottom: '25px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ fontWeight: '600', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Check size={18} color="#22c55e" /> Quiz questions ready!
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontWeight: 'bold', background: 'rgba(56, 189, 248, 0.1)', padding: '6px 14px', borderRadius: '10px' }}>
              <Clock size={18} />
              <span>Time: {formatTime(seconds)}</span>
            </div>
          </div>
        )}

        {/* Questions List Section */}
        {questions.length > 0 && (
          <div style={{ background: 'rgba(20, 27, 45, 0.85)', backdropFilter: 'blur(16px)', padding: '40px', borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '0 25px 50px rgba(0,0,0,0.5)', marginBottom: '40px' }}>
            {questions.map((q, qIndex) => (
              <div key={qIndex} style={{ marginBottom: '35px', paddingBottom: '25px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <h3 style={{ marginBottom: '18px', fontSize: '1.2rem', color: '#f1f5f9', lineHeight: '1.6' }}>
                  {qIndex + 1}. {q.question}
                </h3>
                {q.options.map((opt, optIndex) => {
                  const isSelected = answers[qIndex] === optIndex;
                  const isCorrect = q.correctAnswer === optIndex;
                  let bgOption = 'rgba(15, 23, 42, 0.5)';
                  let borderColor = 'rgba(255, 255, 255, 0.08)';

                  if (isSelected) {
                    bgOption = 'rgba(99, 102, 241, 0.25)';
                    borderColor = '#818cf8';
                  }

                  if (submitted) {
                    if (isCorrect) {
                      bgOption = 'rgba(34, 197, 94, 0.25)';
                      borderColor = '#22c55e';
                    } else if (isSelected && !isCorrect) {
                      bgOption = 'rgba(239, 68, 68, 0.25)';
                      borderColor = '#ef4444';
                    }
                  }

                  return (
                    <div
                      key={optIndex}
                      onClick={() => !submitted && setAnswers({ ...answers, [qIndex]: optIndex })}
                      style={{
                        padding: '16px 20px', margin: '12px 0', borderRadius: '14px', cursor: submitted ? 'default' : 'pointer',
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
                style={{ width: '100%', padding: '18px', background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', color: 'white', border: 'none', borderRadius: '14px', fontSize: '1.15rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 10px 25px rgba(34, 197, 94, 0.35)', transition: 'all 0.3s ease' }}
              >
                Submit Answers & Save Score 🚀
              </button>
            ) : (
              <div style={{ textAlign: 'center', padding: '35px', background: 'rgba(15, 23, 42, 0.9)', borderRadius: '18px', border: '1px solid rgba(34, 197, 94, 0.4)' }}>
                <Award size={60} color="#22c55e" style={{ marginBottom: '12px' }} />
                <h2 style={{ fontSize: '2.2rem', color: '#4ade80', marginBottom: '8px' }}>Your Score: {score} / {questions.length}</h2>
                <p style={{ color: '#94a3b8', fontSize: '1.05rem' }}>Time Taken: {formatTime(seconds)} | Score successfully saved to Database! 🎉</p>
              </div>
            )}
          </div>
        )}

        {/* Recent Quiz History Section */}
        {history.length > 0 && (
          <div style={{ background: 'rgba(20, 27, 45, 0.75)', backdropFilter: 'blur(16px)', padding: '35px', borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.3rem', marginBottom: '20px', color: '#cbd5e1' }}>
              <History size={22} color="#818cf8" /> Recent Quiz History
            </h3>
            {history.map((item) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', backgroundColor: 'rgba(15, 23, 42, 0.6)', margin: '12px 0', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#e2e8f0', fontWeight: '500' }}>
                  <FileText size={18} color="#94a3b8" /> {item.title}
                </span>
                <span style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', padding: '6px 16px', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.9rem', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                  Score: {item.score} / {item.total}
                </span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}