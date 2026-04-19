import React, { useState, useEffect, useCallback, useRef } from 'react';
import { API_URL } from '../api/config';
import './Sidebar.css';

export default function Sidebar({ currentUser, activeChat, onSelectChat, onLogout }) {
  const [chats, setChats] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // --- ЛОГИКА ИЗМЕНЕНИЯ РАЗМЕРА (Твоя оригинальная) ---
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef(null);

  const startResizing = useCallback((e) => { setIsResizing(true); e.preventDefault(); }, []);
  const stopResizing = useCallback(() => { setIsResizing(false); }, []);
  const resize = useCallback((e) => {
    if (isResizing && sidebarRef.current) {
      let newWidth = e.clientX;
      if (newWidth < 250) newWidth = 250;
      if (newWidth > window.innerWidth * 0.6) newWidth = window.innerWidth * 0.6;
      setSidebarWidth(newWidth);
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    } else {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  // --- ИСПРАВЛЕННАЯ ЛОГИКА ЗАГРУЗКИ (Чтобы чаты не пропадали) ---
  const fetchMyChats = async () => {
    try {
      const token = localStorage.getItem('chat-token'); // Берем твой новый JWT
      const response = await fetch(`${API_URL}/api/chats?email=${currentUser}`, {
        headers: { 'Authorization': `Bearer ${token}` } // Добавляем паспорт для входа
      });
      const data = await response.json();
      if (Array.isArray(data)) setChats(data);
    } catch (err) {
      console.error("Ошибка загрузки чатов:", err);
    }
  };

  useEffect(() => {
    if (currentUser) fetchMyChats();
  }, [currentUser]);

  // --- ЛОГИКА ПОИСКА (С авторизацией) ---
  const handleSearch = async (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (val.trim().length > 1) {
      try {
        const token = localStorage.getItem('chat-token');
        const response = await fetch(`${API_URL}/api/search?name=${encodeURIComponent(val)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        setSearchResults(data.filter(u => u.email !== currentUser));
      } catch (err) {
        console.error("Ошибка поиска:", err);
      }
    } else {
      setSearchResults([]);
    }
  };

  // --- ЛОГИКА СОЗДАНИЯ ЧАТА (Оптимистичное обновление) ---
  const startChat = async (targetUser) => {
    try {
      const token = localStorage.getItem('chat-token');
      const existing = chats.find(c => {
        let p = [];
        try { p = Array.isArray(c.participants) ? c.participants : JSON.parse(c.participants); } catch(e) {}
        return p.includes(targetUser.email);
      });

      if (existing) {
        onSelectChat(existing.id, targetUser.email);
      } else {
        const response = await fetch(`${API_URL}/api/chats`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ participants: [currentUser, targetUser.email] })
        });
        const newChat = await response.json();
        if (newChat.id) {
          setChats(prev => [newChat, ...prev]); // Добавляем сразу в список
          onSelectChat(newChat.id, targetUser.email);
        }
      }
    } catch (err) {
      console.error("Ошибка при создании чата:", err);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <aside className="sidebar" ref={sidebarRef} style={{ width: `${sidebarWidth}px` }}>
      <div className="sidebar-inner-content">
        <div className="search-section">
          <input type="text" placeholder="Поиск по имени..." value={searchQuery} onChange={handleSearch} className="search-input" />
          {searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map(user => (
                <div key={user.email} onClick={() => startChat(user)} className="search-result-item">
                  <div className="search-result-name">{user.name}</div>
                  <div className="search-result-email">{user.email}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="chat-list-wrapper">
          <div className="chat-list-header">ДИАЛОГИ</div>
          {chats.map(chat => {
            let p = [];
            try { p = Array.isArray(chat.participants) ? chat.participants : JSON.parse(chat.participants); } catch(e) {}
            const otherEmail = p.find(email => email !== currentUser) || "Чат";
            const isActive = activeChat?.id === chat.id;

            return (
              <div key={chat.id} onClick={() => onSelectChat(chat.id, otherEmail)} className={`chat-list-item ${isActive ? 'active' : ''}`}>
                <div className="chat-avatar">{otherEmail[0].toUpperCase()}</div>
                <div className="chat-info">
                  <div className="chat-name">{otherEmail}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="sidebar-footer">
          <button className="settings-btn" onClick={() => setIsSettingsOpen(true)}>⚙️</button>
        </div>

        {isSettingsOpen && (
          <div className="settings-overlay" onClick={() => setIsSettingsOpen(false)}>
            <div className="settings-modal" onClick={e => e.stopPropagation()}>
              <div className="settings-header">
                <span>Настройки</span>
                <button className="settings-close" onClick={() => setIsSettingsOpen(false)}>×</button>
              </div>
              <div className="settings-content">
                <div className="settings-user-info">
                  <div className="settings-avatar">{currentUser[0].toUpperCase()}</div>
                  <div className="settings-email">{currentUser}</div>
                </div>
                <button className="logout-btn" onClick={onLogout}>🚪 Выйти</button>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="sidebar-resizer" onMouseDown={startResizing}></div>
    </aside>
  );
}