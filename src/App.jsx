import React, { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import Login from './components/Login';

function App() {
  const [currentUser, setCurrentUser] = useState(localStorage.getItem('chat-user'));
  const [activeChat, setActiveChat] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = () => {
    localStorage.clear();
    setCurrentUser(null);
    setActiveChat(null);
  };

  if (!currentUser) {
    return <Login onLoginSuccess={(email) => setCurrentUser(email)} />;
  }

  return (
    <div className="app-container" style={{ display: 'flex', height: '100vh' }}>
      <Sidebar
        currentUser={currentUser}
        activeChat={activeChat}
        onSelectChat={(id, email) => setActiveChat({ id, email })}
        onLogout={handleLogout}
      />
      <ChatArea
        key={activeChat?.id} // ⚡ КРИТИЧНО ДЛЯ ПЕРЕЗАГРУЗКИ ЧАТА
        activeChat={activeChat?.id}
        otherEmail={activeChat?.email}
        currentUser={currentUser}
      />
    </div>
  );
}

export default App;