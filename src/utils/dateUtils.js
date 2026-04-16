export const formatTime = (ts) => {
    if (!ts) return ''; // Если даты вообще нет, ничего не пишем

    try {
        let date;

        // Если это объект Firestore {seconds: ...}
        if (ts.seconds) {
            date = new Date(ts.seconds * 1000);
        }
        // Если это нормальная строка даты или миллисекунды
        else if (typeof ts === 'string' || typeof ts === 'number') {
            date = new Date(ts);
        }
        else {
            return '';
        }

        // Если дата распарсилась криво (Invalid Date), возвращаем пустоту
        if (isNaN(date.getTime())) {
            return '';
        }

        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return '';
    }
};