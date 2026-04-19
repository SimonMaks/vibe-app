import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL, API_URL } from '../api/config';
import { formatTime, getRelativeDate } from '../utils/dateUtils';
import bookmarkIcon from '../assets/clip.svg'; 
import './ChatArea.css';
import './Messages.css';
import './FileModal.css';
import './UIComponents.css';

const socket = io(SOCKET_URL, { autoConnect: false });

export default function ChatArea({ activeChat, otherEmail, currentUser }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [toast, setToast] = useState(null);
  
  const [showFloatingDate, setShowFloatingDate] = useState(false);
  const [floatingDate, setFloatingDate] = useState('');
  
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileCaption, setFileCaption] = useState('');
  const [showFileModal, setShowFileModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const listRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // 🛡️ ЕСЛИ ЧАТ НЕ ВЫБРАН - ПОКАЗЫВАЕМ ЗАГЛУШКУ ИЗ ТВОЕГО СКРИНШОТА
 if (!activeChat) {
      return (
          <div className="chat-container" style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              backgroundColor: '#0f0f0f', // Цвет фона под твой Sidebar
              height: '100vh',
              userSelect: 'none'
          }}>
              <span style={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.05)', // Легкий полупрозрачный фон
                  padding: '5px 15px', 
                  borderRadius: '20px', 
                  color: '#aaaaaa', 
                  fontSize: '0.9rem',
                  fontWeight: '400'
              }}>
                  Выберите чат, чтобы начать общение
              </span>
          </div>
      );
  }

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const token = localStorage.getItem('chat-token');
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

    const setupSockets = async () => {
      const token = localStorage.getItem('chat-token');
      socket.auth = { token };
      socket.connect();
      socket.emit('join_chat', activeChat);
    };

    fetchMessages();
    setupSockets();

    const handleNewMessage = (newMsg) => {
      setMessages((prev) => {
        if (prev.find((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });

      if (newMsg.sender !== currentUser && document.visibilityState === 'hidden') {
        setToast(newMsg);
      }
    };

    socket.on('message', handleNewMessage);

    return () => {
      socket.off('message', handleNewMessage);
      socket.disconnect(); 
    };
  }, [activeChat, currentUser]);

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

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
      setShowFileModal(true);
    }
    e.target.value = null; 
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

  const handleSend = async () => {
    const textToSend = showFileModal ? fileCaption : inputText;
    
    // 1. Проверки
    if (!textToSend.trim() && selectedFiles.length === 0) return;
    if (isUploading) return; 

    const token = localStorage.getItem('chat-token');
    if (!token) return alert("Вы не авторизованы!");

    setIsUploading(true);
    const filesToUpload = [...selectedFiles]; 

    try {
        const formData = new FormData();
        formData.append('text', textToSend);
        formData.append('sender', currentUser); // Это твой email из App.jsx
        
        if (replyTo) {
            formData.append('replyTo', JSON.stringify(replyTo));
        }
        
        filesToUpload.forEach(file => {
            formData.append('files', file);
        });

        console.log(`Отправка на: ${API_URL}/api/messages/${activeChat}`);

        const response = await fetch(`${API_URL}/api/messages/${activeChat}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData // Content-Type НЕ ставим, браузер сделает это сам!
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Ошибка сервера");
        }

        // 2. Очищаем всё ТОЛЬКО после успешной отправки
        setInputText('');
        cancelFileSelection();
        setReplyTo(null); 

    } catch (err) {
        console.error("🔥 Ошибка при отправке:", err);
        alert(`Не удалось отправить: ${err.message}`);
    } finally {
        setIsUploading(false); 
    }
  };

  return (
      <div className="chat-container">
        <header className="chat-header">
          {/* 🛡️ БРОНЯ: Безопасное получение первой буквы */}
          <div className="avatar">{otherEmail && typeof otherEmail === 'string' ? otherEmail.charAt(0).toUpperCase() : '?'}</div>
          <div className="user-name">{otherEmail}</div>
        </header>

        <div className="messages-list" ref={listRef} onScroll={handleScroll}>
          <div className="floating-date-wrapper">
            <div className={`floating-date ${showFloatingDate ? 'visible' : ''}`}>
              {floatingDate}
            </div>
          </div>

          {/* 🛡️ БРОНЯ: Рендерим только если messages это массив */}
          {Array.isArray(messages) && messages.map((msg, i) => {
            const msgDate = msg.createdAt ? getRelativeDate(msg.createdAt) : '';
            const isNewDay = i === 0 || msgDate !== (messages[i-1]?.createdAt ? getRelativeDate(messages[i-1].createdAt) : '');
            return (
                <React.Fragment key={msg.id || i}>
                  {isNewDay && <div className="date-separator"><span>{msgDate}</span></div>}
                  <div id={`msg-${msg.id}`} className={`message-wrapper ${msg.sender === currentUser ? 'me' : 'other'}`} data-date={msgDate} onDoubleClick={() => setReplyTo(msg)}>
                    <div className="message-bubble">
                      
                      {msg.replyTo && (
                        <div className="message-reply-box" onClick={() => scrollToMessage(msg.replyTo.id)}>
                          <div className="reply-sender">{msg.replyTo.sender}</div>
                          <div className="reply-text">{msg.replyTo.text}</div>
                        </div>
                      )}
                      
                      {Array.isArray(msg.files) && msg.files.map((f, idx) => {
                        const isImage = f.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(f.name || '');

                        return (
                          <div key={idx} className="message-attachment-container">
                            {isImage ? (
                              <img 
                                src={f.url} 
                                alt={f.name || 'image'} 
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
                                  <div className="file-attachment-name">{f.name || 'Файл'}</div>
                                  <div className="file-attachment-size">{f.size ? (f.size / 1024).toFixed(1) : 0} KB</div>
                                </div>
                              </a>
                            )}
                          </div>
                        );
                      })}

                      <div className="message-text">{msg.text}</div>
                      <span className="message-time">{msg.createdAt ? formatTime(msg.createdAt) : ''}</span>
                    </div>
                  </div>
                </React.Fragment>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {toast && toast.sender && (
            <div className="custom-toast" onClick={() => { window.focus(); setToast(null); }}>
              <div className="toast-avatar">{typeof toast.sender === 'string' ? toast.sender.charAt(0).toUpperCase() : '?'}</div>
              <div className="toast-content">
                <div className="toast-sender">{toast.sender}</div>
                <div className="toast-text">{toast.text}</div>
              </div>
            </div>
        )}

        {showFileModal && (
          <div className="file-modal-overlay">
            <div className="file-modal">
              {/* ... (модалка файлов осталась без изменений, она работала отлично) ... */}
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
                    <div className="file-remove-btn" onClick={() => removeFile(index)}>✕</div>                  
                  </div>
                ))}
              </div>

              <div className="file-modal-caption">
                <input type="text" placeholder="Подпись..." value={fileCaption} onChange={(e) => setFileCaption(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} autoFocus />
              </div>

              <div className="file-modal-footer">
                <button className="file-action-btn add-more" onClick={() => fileInputRef.current.click()}>Добавить</button>
                <div className="file-modal-right-actions">
                  <button className="file-action-btn cancel" onClick={cancelFileSelection}>Отмена</button>
                  <button className="file-action-btn send" onClick={handleSend} disabled={isUploading}>{isUploading ? "Загрузка..." : "Отправить"}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="input-container">
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
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} multiple onChange={handleFileChange} />
            <button className="attach-btn" onClick={() => fileInputRef.current.click()}>
              <img src={bookmarkIcon} alt="attach" />
            </button>
            <input value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Написать сообщение..." />
            <button onClick={handleSend} className="send-btn">ОТПРАВИТЬ</button>
          </footer>
        </div>
      </div>
  );
}