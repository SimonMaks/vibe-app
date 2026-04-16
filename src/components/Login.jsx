import React, { useState } from 'react';
import { API_URL } from '../api/config';
import { auth } from '../api/firebase';
import { signInWithCustomToken } from 'firebase/auth'; // 🔐 ДОБАВИЛИ ИМПОРТ
import './Login.css';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ШАГ 1: Запрос кода
  const handleSendCode = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return setError('Введите почту');

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail })
      });

      const data = await response.json();

      if (response.ok) {
        setStep(2);
      } else {
        setError(data.error || 'Ошибка при отправке кода');
      }
    } catch (err) {
      setError('Не удалось связаться с сервером');
    } finally {
      setLoading(false);
    }
  };

  // ШАГ 2: Проверка кода
  const handleVerifyCode = async () => {
    if (!code) return setError('Введите код');
    setLoading(true);
    setError('');

    try {
      console.log("Отправляю код на проверку...");
      const response = await fetch(`${API_URL}/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim(), code })
      });

      const data = await response.json();
      console.log("Ответ от сервера:", data);

      if (data.success && data.token) {
        console.log("Код верный, токен получен. Пытаюсь войти в Firebase...");
        
        // 🔐 БРОНЯ: Используем ТОТ САМЫЙ auth, который мы импортировали сверху
        // Убедись, что в начале файла написано: import { auth } from '../api/firebase';
        const userCredential = await signInWithCustomToken(auth, data.token);
        
        console.log("Вход в Firebase успешен!", userCredential.user);

        localStorage.setItem('chat-user', email.toLowerCase().trim());
        onLoginSuccess(email.toLowerCase().trim());
      } else {
        setError(data.error || 'Неверный код или ошибка сервера');
      }
    } catch (err) {
      console.error("ПОЛНАЯ ОШИБКА НА ФРОНТЕ:", err);
      setError('Ошибка входа: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="login-page">
        <div className="login-box">
          <h2>Vibe Messenger</h2>
          <p className="login-subtitle">
            {step === 1 ? 'Введите вашу почту для входа' : `Код отправлен на ${email}`}
          </p>

          {error && <div className="login-error">{error}</div>}

          {step === 1 ? (
              <>
                <input
                    type="email"
                    placeholder="example@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="login-input"
                />
                <button onClick={handleSendCode} disabled={loading} className="login-button">
                  {loading ? 'Отправка...' : 'Получить код'}
                </button>
              </>
          ) : (
              <>
                <input
                    type="text"
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="login-input"
                />
                <button onClick={handleVerifyCode} disabled={loading} className="login-button">
                  {loading ? 'Проверка...' : 'Войти'}
                </button>
                <button onClick={() => setStep(1)} className="login-back-button">
                  Изменить почту
                </button>
              </>
          )}
        </div>
      </div>
  );
}