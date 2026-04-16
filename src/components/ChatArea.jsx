import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL, API_URL } from '../api/config';
import { formatTime } from '../utils/dateUtils';
import { getAuth } from 'firebase/auth'; // 🔐 БРОНЯ: Импортируем Firebase Auth
import './ChatArea.css';

// 🔐 БРОНЯ: Отключаем автоматическое подключение. 
// Мы подключимся вручную только тогда, когда получим токен!
const socket = io(SOCKET_URL, { autoConnect: false });

export default function ChatArea({ activeChat, currentUser }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [toast, setToast] = useState(null);

  const [showScrollDown, setShowScrollDown] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const [floatingDate, setFloatingDate] = useState('');
  const [showFloatingDate, setShowFloatingDate] = useState(false);

  const messagesEndRef = useRef(null);
  const listRef = useRef(null);
  const dateTimeoutRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  const selectedChat = activeChat?.id;
  const otherEmail = activeChat?.email;

  // 🔐 БРОНЯ: Удобная функция для получения свежего токена
  const getToken = async () => {
    const auth = getAuth();
    if (auth.currentUser) {
      return await auth.currentUser.getIdToken();
    }
    return null;
  };

  const getRelativeDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === now.toDateString()) return 'Сегодня';
    if (date.toDateString() === yesterday.toDateString()) return 'Вчера';
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  };

  const scrollToBottom = (behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const fixMessageTime = (msg) => {
    let validTime = msg.createdAt;
    if (validTime && typeof validTime === 'object') {
      const seconds = validTime._seconds || validTime.seconds;
      validTime = seconds ? new Date(seconds * 1000).toISOString() : new Date().toISOString();
    }
    return { ...msg, createdAt: validTime };
  };

  useEffect(() => {
    if (!selectedChat) return;

    // Сбрасываем стейт при смене чата
    setMessages([]);
    setReplyTo(null);
    setHasMore(true);

    const initChat = async () => {
      const token = await getToken();
      if (!token) return; // Если нет токена, ничего не делаем

      // 🔐 БРОНЯ: Передаем токен в сокет и подключаемся
      socket.auth = { token };
      socket.connect();

      socket.on("reconnect_attempt", async () => {
        const freshToken = await getToken();
        socket.auth = { token: freshToken };
      });

      // 🔐 БРОНЯ: Добавляем токен в GET-запрос истории сообщений
      try {
        const res = await fetch(`${API_URL}/api/messages/${selectedChat}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error('Ошибка доступа');
        
        const data = await res.json();
        const fixedMessages = data.map(fixMessageTime);
        setMessages(fixedMessages);
        if (data.length < 30) setHasMore(false);
        setTimeout(() => scrollToBottom("auto"), 50);
      } catch (error) {
        console.error("Ошибка загрузки сообщений:", error);
      }

      // Заходим в комнату сокета
      socket.emit('join_chat', selectedChat);
    };

    initChat();

    const messageHandler = (msg) => {
      const fixedMsg = fixMessageTime(msg);
      setMessages((prev) => [...prev, fixedMsg]);

      if (msg.sender !== currentUser) {
        const isWindowActive = document.hasFocus() && document.visibilityState === 'visible';

        if (isWindowActive) {
          new Audio('./in-chat.mp3').play().catch(() => {});
        } else {
          new Audio('./notify.mp3').play().catch(() => {});

          setToast({ sender: msg.sender, text: msg.text });
          clearTimeout(toastTimeoutRef.current);
          toastTimeoutRef.current = setTimeout(() => setToast(null), 5000);

          if (Notification.permission === "granted") {
            new Notification(msg.sender, {
              body: msg.text,
              icon: './favicon.ico',
              silent: true
            }).onclick = () => window.focus();
          }
        }
      }
      setTimeout(() => scrollToBottom("smooth"), 100);
    };

    socket.on('receive_message', messageHandler);
    
    return () => {
      socket.off('receive_message', messageHandler);
      // Опционально: можно отключать сокет при закрытии чата
      // socket.disconnect(); 
    };
  }, [selectedChat, currentUser]);

  const handleScroll = async (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    setShowScrollDown(scrollHeight - scrollTop - clientHeight > 150);
    setShowFloatingDate(true);
    const wrappers = e.target.querySelectorAll('.message-wrapper');
    let currentTopDate = '';
    for (let el of wrappers) {
      if (el.offsetTop >= scrollTop) {
        currentTopDate = el.getAttribute('data-date');
        break;
      }
    }
    if (currentTopDate) setFloatingDate(currentTopDate);
    clearTimeout(dateTimeoutRef.current);
    dateTimeoutRef.current = setTimeout(() => setShowFloatingDate(false), 1500);

    if (scrollTop === 0 && hasMore && !isLoadingMore && messages.length > 0) {
      setIsLoadingMore(true);
      const oldScrollHeight = scrollHeight;
      const cursor = messages[0].id;
      
      try {
        const token = await getToken(); // 🔐 БРОНЯ
        const res = await fetch(`${API_URL}/api/messages/${selectedChat}?cursor=${cursor}`, {
          headers: { 'Authorization': `Bearer ${token}` } // 🔐 БРОНЯ
        });
        const data = await res.json();
        if (data.length < 30) setHasMore(false);
        const fixedData = data.map(fixMessageTime);
        setMessages(prev => [...fixedData, ...prev]);
        setTimeout(() => {
          if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight - oldScrollHeight;
        }, 0);
      } catch (err) { console.error(err); } finally { setIsLoadingMore(false); }
    }
  };

  const scrollToMessage = async (msgId) => {
    if (!msgId) return;
    const element = document.getElementById(`msg-${msgId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('highlight-animation');
      setTimeout(() => element.classList.remove('highlight-animation'), 2000);
      return;
    }
    if (!hasMore) return;
    setIsSearching(true);
    let currentCursor = messages[0]?.id;
    let fetchedData = [];
    let found = false;
    let stillHasMore = hasMore;
    let attempts = 0;
    
    while (!found && attempts < 5 && stillHasMore) {
      attempts++;
      try {
        const token = await getToken(); // 🔐 БРОНЯ
        const res = await fetch(`${API_URL}/api/messages/${selectedChat}?cursor=${currentCursor}`, {
          headers: { 'Authorization': `Bearer ${token}` } // 🔐 БРОНЯ
        });
        const data = await res.json();
        if (data.length < 30) stillHasMore = false;
        const fixedData = data.map(fixMessageTime);
        fetchedData = [...fixedData, ...fetchedData];
        if (fixedData.some(m => m.id === msgId)) found = true;
        else currentCursor = fixedData[0]?.id;
      } catch (err) { break; }
    }
    
    if (fetchedData.length > 0) {
      setMessages(prev => [...fetchedData, ...prev]);
      setHasMore(stillHasMore);
      setTimeout(() => {
        const el = document.getElementById(`msg-${msgId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'auto', block: 'center' });
          el.classList.add('highlight-animation');
          setTimeout(() => el.classList.remove('highlight-animation'), 2000);
        }
      }, 100);
    }
    setIsSearching(false);
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const text = inputText;
    const replyData = replyTo ? { id: replyTo.id, sender: replyTo.sender, text: replyTo.text } : null;
    setInputText('');
    setReplyTo(null);
    const payload = { text, sender: currentUser, replyTo: replyData, createdAt: new Date().toISOString() };
    
    try {
      const token = await getToken(); // 🔐 БРОНЯ
      await fetch(`${API_URL}/api/messages/${selectedChat}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // 🔐 БРОНЯ
        },
        body: JSON.stringify(payload)
      });
    } catch (err) { console.error(err); }
  };

  if (!selectedChat) return <div className="empty-chat"><h2>Выберите чат</h2></div>;

  return (
      <div className="chat-container">
        <header className="chat-header">
          <div className="avatar">{otherEmail ? otherEmail[0].toUpperCase() : '?'}</div>
          <div className="user-name">{otherEmail}</div>
        </header>

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
                      {msg.replyTo && <div className="message-reply-box" onClick={() => scrollToMessage(msg.replyTo.id)}><div className="reply-sender">{msg.replyTo.sender}</div><div className="reply-text">{msg.replyTo.text}</div></div>}
                      <div className="message-text">{msg.text}</div>
                      <span className="message-time">{formatTime(msg.createdAt)}</span>
                    </div>
                  </div>
                </React.Fragment>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {toast && (
            <div className="custom-toast" onClick={() => { window.focus(); setToast(null); }}>
              <div className="toast-avatar">{toast.sender[0].toUpperCase()}</div>
              <div className="toast-content">
                <div className="toast-sender">{toast.sender}</div>
                <div className="toast-text">{toast.text}</div>
              </div>
            </div>
        )}

        <div className="input-container">
          {replyTo && (
              <div className="reply-preview">
                <div className="reply-preview-info"><div className="reply-preview-sender">{replyTo.sender}:</div><div className="reply-preview-text">{replyTo.text}</div></div>
                <button className="reply-cancel" onClick={() => setReplyTo(null)}>✖</button>
              </div>
          )}
          <footer className="chat-input-area">
            <input value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Написать сообщение..." />
            <button onClick={handleSend} className="send-btn">ОТПРАВИТЬ</button>
          </footer>
        </div>
      </div>
  );
}