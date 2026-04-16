import React, { useState, useEffect } from 'react';
import { API_URL } from '../api/config';
import './Sidebar.css';

export default function Sidebar({ currentUser, activeChat, onSelectChat, onLogout }) {
  const [chats, setChats] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false); // Состояние модалки

  const fetchMyChats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/chats?email=${currentUser}`);
      const data = await response.json();
      if (Array.isArray(data)) setChats(data);
    } catch (err) {
      console.error("Ошибка загрузки чатов:", err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchMyChats();
      const interval = setInterval(fetchMyChats, 10000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  const handleSearch = async (e) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (val.trim().length > 1) {
      try {
        const response = await fetch(`${API_URL}/api/search?name=${encodeURIComponent(val)}`);
        const data = await response.json();
        setSearchResults(data.filter(u => u.email !== currentUser));
      } catch (err) {
        console.error("Ошибка поиска:", err);
      }
    } else {
      setSearchResults([]);
    }
  };

  const startChat = async (targetUser) => {
    try {
      const existing = chats.find(c => c.participants.includes(targetUser.email));
      if (existing) {
        onSelectChat(existing.id, targetUser.email);
      } else {
        const response = await fetch(`${API_URL}/api/chats`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participants: [currentUser, targetUser.email] })
        });
        const newChat = await response.json();
        if (newChat.id) {
          await fetchMyChats();
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
      <aside className="sidebar">
        <div className="search-section">
          <input
              type="text"
              placeholder="Поиск по имени..."
              value={searchQuery}
              onChange={handleSearch}
              className="search-input"
          />
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
            const otherEmail = chat.participants.find(p => p !== currentUser);
            const isActive = activeChat?.id === chat.id;
            return (
                <div
                    key={chat.id}
                    onClick={() => onSelectChat(chat.id, otherEmail)}
                    className={`chat-list-item ${isActive ? 'active' : ''}`}
                >
                  <div className="chat-avatar">
                    {otherEmail ? otherEmail[0].toUpperCase() : '?'}
                  </div>
                  <div className="chat-info">
                    <div className="chat-name">{otherEmail}</div>
                  </div>
                </div>
            );
          })}
        </div>

        {/* НИЖНЯЯ ПАНЕЛЬ С НАСТРОЙКАМИ */}
        <div className="sidebar-footer">
          <button className="settings-btn" onClick={() => setIsSettingsOpen(true)}>
            ⚙️
          </button>
        </div>

        {/* МОДАЛКА НАСТРОЕК */}
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
                  <button className="logout-btn" onClick={onLogout}>🚪 Выйти из аккаунта</button>
                </div>
              </div>
            </div>
        )}
      </aside>
  );
}