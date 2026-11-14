import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { Upload, CheckCircle, XCircle, Award, History } from 'lucide-react';

// API සම්බන්ධතා
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

  useEffect(() => {
    fetchHistory();
  }, []);

  // Database එකෙන් පරණ ලකුණු ගැනීම
  const fetchHistory = async () => {
    const { data } = await supabase.from('quizzes').select('*').order('created_at', { ascending: false }).limit(5);
    if (data) setHistory(data);
  };

  // File එක AI SDK එකට ගැලපෙන format එකකට හැරවීම (Google Gen AI SDK standard format)
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

  // PDF/Photo එකෙන් Quiz එක හදන function එක
  const handleGenerateQuiz = async () => {
    if (!file) return alert('කරුණාකර PDF හෝ Photo එකක් තෝරන්න!');
    setLoading(true);
    setSubmitted(false);
    setAnswers({});
    setQuestions([]);

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

      // නිවැරදි Google Gen AI SDK model call එක
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [filePart, prompt],
      });

      const rawText = response.text || '';
      const cleanJson = rawText.replace(/```json|```/g, '').trim();
      const parsedQuestions = JSON.parse(cleanJson);
      setQuestions(parsedQuestions);
    } catch (error) {
      console.error(error);
      alert('Quiz එක හදද්දී දෝෂයක් ආවා. නැවත උත්සාහ කරන්න.');
    }
    setLoading(false);
  };

  // උත්තර පරීක්ෂා කර Database එකේ Save කිරීම
  const handleSubmit = async () => {
    let currentScore = 0;
    questions.forEach((q, index) => {
      if (answers[index] === q.correctAnswer) currentScore++;
    });
    setScore(currentScore);
    setSubmitted(true);

    // Supabase Database එකට Save කිරීම
    const { error } = await supabase.from('quizzes').insert([
      {
        title: file ? file.name : 'Untitled Quiz',
        questions: questions,
        score: currentScore,
        total: questions.length,
      },
    ]);

    if (error) {
      console.error('Supabase Error:', error);
    } else {
      fetchHistory();
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif', color: '#1e293b' }}>
      <header style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ fontSize: '2.2rem', color: '#2563eb', marginBottom: '8px' }}>AI Study Quiz Generator 🧠</h1>
        <p style={{ color: '#64748b' }}>ඕනෑම PDF හෝ Note Photo එකක් upload කර ක්ෂණිකව Quiz එකක් හදාගන්න</p>
      </header>

      {/* File Upload Section */}
      <div style={{ border: '2px dashed #93c5fd', borderRadius: '12px', padding: '30px', textAlign: 'center', backgroundColor: '#eff6ff', marginBottom: '25px' }}>
        <Upload size={40} color="#2563eb" style={{ marginBottom: '10px' }} />
        <br />
        <input
          type="file"
          accept="application/pdf, image/*"
          onChange={(e) => setFile(e.target.files[0])}
          style={{ marginBottom: '15px' }}
        />
        <br />
        <button
          onClick={handleGenerateQuiz}
          disabled={loading}
          style={{
            backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '12px 24px',
            borderRadius: '8px', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold'
          }}
        >
          {loading ? 'AI මගින් ප්‍රශ්න සකසමින් පවතී...' : 'Generate Quiz ✨'}
        </button>
      </div>

      {/* Questions Section */}
      {questions.length > 0 && (
        <div style={{ backgroundColor: '#ffffff', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          {questions.map((q, qIndex) => (
            <div key={qIndex} style={{ marginBottom: '25px', paddingBottom: '15px', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ marginBottom: '12px' }}>{qIndex + 1}. {q.question}</h3>
              {q.options.map((opt, optIndex) => {
                const isSelected = answers[qIndex] === optIndex;
                const isCorrect = q.correctAnswer === optIndex;
                let bgColor = isSelected ? '#dbeafe' : '#f8fafc';
                if (submitted) {
                  if (isCorrect) bgColor = '#dcfce7';
                  else if (isSelected && !isCorrect) bgColor = '#fee2e2';
                }

                return (
                  <div
                    key={optIndex}
                    onClick={() => !submitted && setAnswers({ ...answers, [qIndex]: optIndex })}
                    style={{
                      padding: '12px', margin: '8px 0', borderRadius: '8px', cursor: 'pointer',
                      backgroundColor: bgColor, border: isSelected ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}
                  >
                    <span>{opt}</span>
                    {submitted && isCorrect && <CheckCircle color="#16a34a" size={20} />}
                    {submitted && isSelected && !isCorrect && <XCircle color="#dc2626" size={20} />}
                  </div>
                );
              })}
            </div>
          ))}

          {!submitted ? (
            <button
              onClick={handleSubmit}
              style={{ width: '100%', padding: '14px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Submit Answers
            </button>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#f0fdf4', borderRadius: '8px' }}>
              <Award size={48} color="#16a34a" />
              <h2>ඔබේ ලකුණු: {score} / {questions.length}</h2>
              <p>ලකුණු Database එකේ සාර්ථකව Save විය!</p>
            </div>
          )}
        </div>
      )}

      {/* Recent History from Database */}
      {history.length > 0 && (
        <div style={{ marginTop: '40px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><History size={20} /> මෑතකදී කළ Quizzes (Database History)</h3>
          {history.map((item) => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: '#f1f5f9', margin: '8px 0', borderRadius: '8px' }}>
              <span>📄 {item.title}</span>
              <strong>ලකුණු: {item.score} / {item.total}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}