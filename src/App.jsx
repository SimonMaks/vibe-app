import React, { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import ChatArea from './components/ChatArea.jsx';
import Login from './components/Login.jsx';

function App() {
    const [currentUser, setCurrentUser] = useState(null);
    const [activeChat, setActiveChat] = useState(null); // Стейт активного чата
    const [isLoading, setIsLoading] = useState(true);

    // 1. Проверка сессии при запуске
    useEffect(() => {
        const savedUser = localStorage.getItem('chat-user');
        if (savedUser) {
            setCurrentUser(savedUser);
        }
        setIsLoading(false);
    }, []);

    // Функция выхода (Logout)
    const handleLogout = () => {
        localStorage.removeItem('chat-user');
        setCurrentUser(null);
        setActiveChat(null);
    };

    if (isLoading) {
        return <div className="loading-screen">Загрузка...</div>;
    }

    // Если юзер не залогинен — показываем ТОЛЬКО логин
    if (!currentUser) {
        return (
            <Login onLoginSuccess={(email) => setCurrentUser(email)} />
        );
    }

    // Если залогинен — показываем весь интерфейс мессенджера
    return (
        <div className="app-container" style={{ display: 'flex', height: '100vh' }}>
            <Sidebar
                currentUser={currentUser}
                activeChat={activeChat}
                onSelectChat={(chatId, email) => {
                    setActiveChat({ id: chatId, email: email });
                }}
                onLogout={handleLogout} // Передаем выход в сайдбар, если нужно
            />
            <ChatArea
                activeChat={activeChat ? activeChat.id : null}
                otherEmail={activeChat ? activeChat.email : ''}
                currentUser={currentUser}
            />
        </div>
    );
}

export default App;