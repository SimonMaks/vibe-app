import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL, API_URL } from '../api/config';
import { formatTime, getRelativeDate } from '../utils/dateUtils';
import { getAuth } from 'firebase/auth';
// ⚡ УДАЛИЛИ FIREBASE STORAGE - он нам больше не нужен!
import bookmarkIcon from '../assets/clip.svg'; 
import './ChatArea.css';
import './Messages.css';
import './FileModal.css';
import './UIComponents.css';

// Инициализация сокета (пока без подключения)
const socket = io(SOCKET_URL, { autoConnect: false });

export default function ChatArea({ activeChat, otherEmail, currentUser }) {
  // --- БАЗОВЫЕ СТЕЙТЫ ---
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [toast, setToast] = useState(null);
  
  // --- СТЕЙТЫ СКРОЛЛА И ДАТЫ ---
  const [showFloatingDate, setShowFloatingDate] = useState(false);
  const [floatingDate, setFloatingDate] = useState('');
  
  // --- СТЕЙТЫ ДЛЯ ФАЙЛОВ ---
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileCaption, setFileCaption] = useState('');
  const [showFileModal, setShowFileModal] = useState(false);

  const [isUploading, setIsUploading] = useState(false);

  const listRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // ==========================================
  // ЗАГРУЗКА СООБЩЕНИЙ И СОКЕТЫ
  // ==========================================
  useEffect(() => {
    if (!activeChat) return;

    const auth = getAuth();

    // 1. Загрузка старых сообщений из БД
    const fetchMessages = async () => {
      try {
        const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
        
        const response = await fetch(`${API_URL}/api/messages/${activeChat}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        if (Array.isArray(data)) {
          setMessages(data);
        }
      } catch (err) {
        console.error("Ошибка загрузки сообщений:", err);
      }
    };

    // 2. Настройка и подключение к Socket.io
    const setupSockets = async () => {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      
      // ⚡ ПЕРЕДАЕМ ТОКЕН В СОКЕТ, ЧТОБЫ ПРОЙТИ ФЕЙСКОНТРОЛЬ НА БЭКЕНДЕ ⚡
      socket.auth = { token };
      socket.connect();
      
      // ⚡ ИСПРАВИЛИ НАЗВАНИЕ СОБЫТИЯ НА join_chat (как ждет бэкенд)
      socket.emit('join_chat', activeChat);
    };

    fetchMessages();
    setupSockets();

    const handleNewMessage = (newMsg) => {
      setMessages((prev) => {
        // Защита от дубликатов
        if (prev.find((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });

      // Показ уведомления, если окно свернуто
      if (newMsg.sender !== currentUser && document.visibilityState === 'hidden') {
        setToast(newMsg);
      }
    };

    socket.on('message', handleNewMessage);

    // Очистка при смене чата
    return () => {
      socket.off('message', handleNewMessage);
      socket.disconnect(); // Просто отключаемся, бэкенд сам поймет, что мы ушли
    };
  }, [activeChat, currentUser]);

  // ==========================================
  // ФУНКЦИИ СКРОЛЛА
  // ==========================================
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToMessage = (id) => {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight');
      setTimeout(() => el.classList.remove('highlight'), 2000);
    }
  };

  const handleScroll = () => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('.message-wrapper');
    let visibleDate = '';
    for (const item of items) {
      const rect = item.getBoundingClientRect();
      if (rect.top >= 0 && rect.top <= window.innerHeight / 2) {
        visibleDate = item.getAttribute('data-date');
        break;
      }
    }
    if (visibleDate && visibleDate !== floatingDate) {
      setFloatingDate(visibleDate);
      setShowFloatingDate(true);
      setTimeout(() => setShowFloatingDate(false), 2000);
    }
  };

  // ==========================================
  // ЛОГИКА ФАЙЛОВ
  // ==========================================
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
      setShowFileModal(true);
    }
    e.target.value = null; // Сбрасываем инпут
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => {
      const newFiles = prev.filter((_, i) => i !== index);
      if (newFiles.length === 0) setShowFileModal(false);
      return newFiles;
    });
  };

  const cancelFileSelection = () => {
    setSelectedFiles([]);
    setFileCaption('');
    setShowFileModal(false);
    setIsUploading(false); 
  };

  // ==========================================
  // ОТПРАВКА СООБЩЕНИЯ
  // ==========================================
  const handleSend = async () => {
    const textToSend = showFileModal ? fileCaption : inputText;
    if (!textToSend.trim() && selectedFiles.length === 0) return;
    if (isUploading) return; 

    setIsUploading(true);
    const filesToUpload = [...selectedFiles]; 
    
    // Очищаем инпуты сразу для отзывчивости
    setInputText('');
    cancelFileSelection();
    setReplyTo(null); // Сбрасываем ответ после отправки

    try {
        const formData = new FormData();
        formData.append('text', textToSend);
        formData.append('sender', currentUser);
        if (replyTo) formData.append('replyTo', JSON.stringify(replyTo));
        
        filesToUpload.forEach(file => {
            formData.append('files', file);
        });

        const auth = getAuth();
        const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;

        const response = await fetch(`${API_URL}/api/messages/${activeChat}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (!response.ok) throw new Error("Ошибка сервера");
        // Примечание: Мы убрали "оптимистичное добавление", так как SQLite генерирует
        // настоящий ID, а сокеты работают мгновенно. Сообщение появится само через сокет!

    } catch (err) {
        console.error("Ошибка при отправке:", err);
        alert("Ошибка при отправке. Попробуйте снова.");
    } finally {
        setIsUploading(false); 
    }
  };

  // ==========================================
  // РЕНДЕР ИНТЕРФЕЙСА
  // ==========================================
  return (
      <div className="chat-container">
        {/* Шапка чата */}
        <header className="chat-header">
          <div className="avatar">{otherEmail ? otherEmail[0].toUpperCase() : '?'}</div>
          <div className="user-name">{otherEmail}</div>
        </header>

        {/* Список сообщений */}
        <div className="messages-list" ref={listRef} onScroll={handleScroll}>
          <div className="floating-date-wrapper">
            <div className={`floating-date ${showFloatingDate ? 'visible' : ''}`}>
              {floatingDate}
            </div>
          </div>

          {messages.map((msg, i) => {
            const msgDate = getRelativeDate(msg.createdAt);
            const isNewDay = i === 0 || msgDate !== getRelativeDate(messages[i-1].createdAt);
            return (
                <React.Fragment key={msg.id || i}>
                  {isNewDay && <div className="date-separator"><span>{msgDate}</span></div>}
                  <div id={`msg-${msg.id}`} className={`message-wrapper ${msg.sender === currentUser ? 'me' : 'other'}`} data-date={msgDate} onDoubleClick={() => setReplyTo(msg)}>
                    <div className="message-bubble">
                      
                      {/* Блок ответа на сообщение */}
                      {msg.replyTo && (
                        <div className="message-reply-box" onClick={() => scrollToMessage(msg.replyTo.id)}>
                          <div className="reply-sender">{msg.replyTo.sender}</div>
                          <div className="reply-text">{msg.replyTo.text}</div>
                        </div>
                      )}
                      
                      {/* Отображение прикрепленных файлов */}
                      {msg.files && msg.files.map((f, idx) => {
                        const isImage = f.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(f.name);

                        return (
                          <div key={idx} className="message-attachment-container">
                            {isImage ? (
                              <img 
                                src={f.url} 
                                alt={f.name} 
                                className="chat-inline-image" 
                                onClick={() => window.open(f.url, '_blank')} 
                              />
                            ) : (
                              <a href={f.url} target="_blank" rel="noopener noreferrer" className="message-file-attachment">
                                <div className="file-icon-circle">
                                  <svg viewBox="0 0 24 24" fill="currentColor" className="document-icon">
                                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                                  </svg>
                                </div>
                                <div className="file-attachment-info">
                                  <div className="file-attachment-name">{f.name}</div>
                                <div className="file-attachment-size">{(f.size / 1024).toFixed(1)} KB</div>
                                </div>
                              </a>
                            )}
                          </div>
                        );
                      })}

                      {/* Текст и время */}
                      <div className="message-text">{msg.text}</div>
                      <span className="message-time">{formatTime(msg.createdAt)}</span>
                    </div>
                  </div>
                </React.Fragment>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Тост-уведомление */}
        {toast && (
            <div className="custom-toast" onClick={() => { window.focus(); setToast(null); }}>
              <div className="toast-avatar">{toast.sender[0].toUpperCase()}</div>
              <div className="toast-content">
                <div className="toast-sender">{toast.sender}</div>
                <div className="toast-text">{toast.text}</div>
              </div>
            </div>
        )}

        {/* ВСПЛЫВАЮЩЕЕ ОКНО ФАЙЛОВ */}
        {showFileModal && (
          <div className="file-modal-overlay">
            <div className="file-modal">
              <div className="file-modal-header">
                <span>Отправить как файл</span>
                <button className="icon-btn" onClick={cancelFileSelection}>✕</button>
              </div>

              <div className="file-modal-list">
                {selectedFiles.map((file, index) => (
                  <div className="file-item" key={index}>
                    <div className="file-icon-box">📄</div>
                    <div className="file-details">
                      <span className="file-name">{file.name}</span>
                      <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
                    </div>
                    <div className="file-remove-btn" onClick={() => removeFile(index)}>
                    ✕
                    </div>                  
                  </div>
                ))}
              </div>

              <div className="file-modal-caption">
                <input 
                  type="text" 
                  placeholder="Подпись..." 
                  value={fileCaption} 
                  onChange={(e) => setFileCaption(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  autoFocus
                />
              </div>

              <div className="file-modal-footer">
                <button className="file-action-btn add-more" onClick={() => fileInputRef.current.click()}>
                  Добавить
                </button>
                <div className="file-modal-right-actions">
                  <button className="file-action-btn cancel" onClick={cancelFileSelection}>
                    Отмена
                  </button>
                  <button 
                    className="file-action-btn send" 
                    onClick={handleSend}
                    disabled={isUploading}
                  >
                    {isUploading ? "Загрузка..." : "Отправить"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* НИЖНЯЯ ПАНЕЛЬ ВВОДА */}
        <div className="input-container">
          {/* Предпросмотр ответа */}
          {replyTo && (
              <div className="reply-preview">
                <div className="reply-preview-info">
                  <div className="reply-preview-sender">{replyTo.sender}:</div>
                  <div className="reply-preview-text">{replyTo.text}</div>
                </div>
                <button className="reply-cancel" onClick={() => setReplyTo(null)}>✖</button>
              </div>
          )}

          <footer className="chat-input-area">
            {/* Скрытый инпут для файлов */}
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              multiple 
              onChange={handleFileChange}
            />
            
            {/* Кнопка скрепки */}
            <button className="attach-btn" onClick={() => fileInputRef.current.click()}>
              <img src={bookmarkIcon} alt="attach" />
            </button>

            {/* Основное поле ввода */}
            <input 
                value={inputText} 
                onChange={(e) => setInputText(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
                placeholder="Написать сообщение..." 
            />
            <button onClick={handleSend} className="send-btn">ОТПРАВИТЬ</button>
          </footer>
        </div>
      </div>
  );
}