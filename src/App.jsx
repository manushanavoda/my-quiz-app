import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { Upload, CheckCircle, XCircle, Award, History, Sparkles, Clock, FileText, Check, LogOut, Loader2 } from 'lucide-react';

// Initialize Gemini AI and Supabase clients
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

export default function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const [file, setFile] = useState(null);
  const [numQuestions, setNumQuestions] = useState(5); // Default 5
  const [difficulty, setDifficulty] = useState('Medium');

  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [history, setHistory] = useState([]);
  const [seconds, setSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(false);

  // Check active user session on load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) fetchHistory();
    else setHistory([]);
  }, [user]);

  // Handle live quiz timer
  useEffect(() => {
    let interval = null;
    if (timerActive && !submitted) {
      interval = setInterval(() => setSeconds((prev) => prev + 1), 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timerActive, submitted]);

  const handleAuth = async (e) => {
    e.preventDefault();
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) alert(error.message);
      else alert('Sign up successful! Please log in.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const fetchHistory = async () => {
    const { data } = await supabase
      .from('quizzes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    if (data) setHistory(data);
  };

  const fileToGenerativePart = async (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result.split(',')[1];
        resolve({
          inlineData: { data: base64Data, mimeType: file.type }
        });
      };
      reader.readAsDataURL(file);
    });
  };

  // Generate MCQs using Gemini AI with Fallback
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
        Read this document carefully and generate exactly ${numQuestions} multiple-choice questions (MCQs) of ${difficulty} difficulty.
        Return ONLY a raw JSON array. No markdown formatting, no backticks, no extra text. Format:
        [
          {
            "question": "Question text?",
            "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
            "correctAnswer": 0
          }
        ]
      `;

      let response;
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [filePart, prompt],
        });
      } catch (primaryError) {
        console.warn('Primary model busy, switching to fallback model...');
        response = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: [filePart, prompt],
        });
      }

      const rawText = response.text || '';
      const cleanJson = rawText.replace(/```json|```/g, '').trim();
      const parsedQuestions = JSON.parse(cleanJson);
      
      setQuestions(parsedQuestions);
      setTimerActive(true);
    } catch (error) {
      console.error('Error generating quiz:', error);
      alert('Failed to generate quiz due to high server traffic or large question count. Please try again.');
    }
    setLoading(false);
  };

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
        title: file ? `${file.name} (${difficulty})` : 'Untitled Quiz',
        questions: questions,
        score: currentScore,
        total: questions.length,
      },
    ]);

    if (!error) fetchHistory();
  };

  const formatTime = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #090d16 0%, #13182e 100%)', padding: '40px 20px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#f8fafc' }}>
      <div style={{ maxWidth: '850px', margin: '0 auto' }}>
        
        {/* Top Bar with Login/Logout Status */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(20, 27, 45, 0.8)', padding: '8px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>👤 {user.email}</span>
              <button onClick={handleLogout} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                <LogOut size={14} /> Logout
              </button>
            </div>
          )}
        </div>

        {/* Application Header */}
        <header style={{ textAlign: 'center', marginBottom: '35px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(99, 102, 241, 0.12)', padding: '8px 18px', borderRadius: '50px', border: '1px solid rgba(99, 102, 241, 0.3)', marginBottom: '18px' }}>
            <Sparkles size={16} color="#818cf8" />
            <span style={{ fontSize: '0.8rem', color: '#c7d2fe', fontWeight: '700', letterSpacing: '0.8px' }}>POWERED BY GEMINI AI & SUPABASE</span>
          </div>
          <h1 style={{ fontSize: '2.7rem', fontWeight: '800', color: '#ffffff', textShadow: '0 0 25px rgba(129, 140, 248, 0.4)', marginBottom: '12px' }}>
            AI Study Quiz Generator 🧠
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>Upload any PDF or Note Photo to instantly generate a smart quiz</p>
        </header>

        {!user ? (
          <div style={{ background: 'rgba(20, 27, 45, 0.8)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '24px', padding: '40px', maxWidth: '450px', margin: '0 auto', boxShadow: '0 25px 50px rgba(0,0,0,0.5)', textAlign: 'center' }}>
            <h2 style={{ marginBottom: '20px', color: '#f1f5f9' }}>{isSignUp ? 'Create an Account' : 'Welcome Back! Please Login'}</h2>
            <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ padding: '14px', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '1rem' }}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ padding: '14px', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '1rem' }}
              />
              <button type="submit" style={{ padding: '14px', background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 10px 20px rgba(99, 102, 241, 0.3)' }}>
                {isSignUp ? 'Sign Up' : 'Login'}
              </button>
            </form>
            <p style={{ marginTop: '20px', color: '#94a3b8', fontSize: '0.9rem' }}>
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <span onClick={() => setIsSignUp(!isSignUp)} style={{ color: '#818cf8', cursor: 'pointer', fontWeight: 'bold' }}>
                {isSignUp ? 'Login here' : 'Sign up here'}
              </span>
            </p>
          </div>
        ) : (
          <>
            <div style={{ background: 'rgba(20, 27, 45, 0.75)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '24px', padding: '40px', textAlign: 'center', boxShadow: '0 25px 50px rgba(0,0,0,0.5)', marginBottom: '35px' }}>
              <div style={{ width: '75px', height: '75px', background: 'rgba(99, 102, 241, 0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                <Upload size={34} color="#818cf8" />
              </div>

              <label style={{ display: 'inline-block', background: 'rgba(99, 102, 241, 0.15)', color: '#c7d2fe', padding: '12px 24px', borderRadius: '12px', cursor: 'pointer', border: '1px solid rgba(99, 102, 241, 0.3)', fontWeight: '600', marginBottom: '20px', transition: 'all 0.2s ease' }}>
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

              <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '25px', flexWrap: 'wrap' }}>
                
                {/* Number of Questions Selector (Updated with 25, 30, 40, 50) */}
                <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '12px 20px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'left' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>Number of Questions:</label>
                  <select
                    value={numQuestions}
                    onChange={(e) => setNumQuestions(Number(e.target.value))}
                    style={{ background: '#1e293b', color: 'white', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.95rem', cursor: 'pointer' }}
                  >
                    <option value={5}>5 Questions</option>
                    <option value={10}>10 Questions</option>
                    <option value={15}>15 Questions</option>
                    <option value={25}>25 Questions</option>
                    <option value={30}>30 Questions</option>
                    <option value={40}>40 Questions</option>
                    <option value={50}>50 Questions</option>
                  </select>
                </div>

                <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '12px 20px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'left' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>Difficulty Level:</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    style={{ background: '#1e293b', color: 'white', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.95rem', cursor: 'pointer' }}
                  >
                    <option value="Easy">Easy 🟢</option>
                    <option value="Medium">Medium 🟡</option>
                    <option value="Hard">Hard 🔴</option>
                  </select>
                </div>
              </div>

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
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={20} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>AI is generating {numQuestions} questions... ⏳</span>
                    </>
                  ) : (
                    'Generate Quiz ✨'
                  )}
                </button>
              </div>
            </div>

            {questions.length > 0 && !submitted && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(20, 27, 45, 0.85)', padding: '18px 28px', borderRadius: '16px', marginBottom: '25px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ fontWeight: '600', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={18} color="#22c55e" /> Quiz ready ({difficulty} - {questions.length} Questions)!
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontWeight: 'bold', background: 'rgba(56, 189, 248, 0.1)', padding: '6px 14px', borderRadius: '10px' }}>
                  <Clock size={18} />
                  <span>Time: {formatTime(seconds)}</span>
                </div>
              </div>
            )}

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
                            display: 'flex', justifyContent: 'space-linejoin', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s ease'
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
          </>
        )}

      </div>
    </div>
  );
}