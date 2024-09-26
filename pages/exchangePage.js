module.exports = function (app, requireLogin, pool, baseHTML) {

    // Middleware для сохранения истории действий в сессии
    function saveActionInSession(req, action) {
        if (!req.session.actions) {
            req.session.actions = []; // Инициализация массива действий, если его еще нет
        }
        req.session.actions.push({
            action,
            timestamp: new Date() // Добавляем отметку времени
        });
    }

    // Маршрут для отображения доступных валют и формы для обмена
    app.get('/user/exchange', requireLogin, async function (req, res) {
        try {
            const [currencies] = await pool.query('SELECT * FROM currency');

            let currencyTable = '';
            currencies.forEach(currency => {
                currencyTable += `
                    <tr>
                        <td>${currency.currency_from}</td>
                        <td>${currency.currency_to}</td>
                        <td>${currency.rate}</td>
                        <td>
                            <form action="/user/exchange" method="POST">
                                <input type="hidden" name="currency_id" value="${currency.id}">
                                <input type="number" name="amount" min="1" placeholder="Amount" required>
                                <button type="submit" class="exchange-button">Preview Exchange</button>
                            </form>
                        </td>
                    </tr>`;
            });

            const content = `
                <h1>Available Currencies for Exchange</h1>
                <table>
                    <tr>
                        <th>From Currency</th>
                        <th>To Currency</th>
                        <th>Rate</th>
                    </tr>
                    ${currencyTable}
                </table>
                <br>
                <a href="/user/session-history" class="history-button">View Session Exchange History</a>
            `;

            res.send(baseHTML('Currency Exchange', content));
        } catch (error) {
            console.error('Error fetching currencies:', error);
            res.status(500).send('Failed to load currencies.');
        }
    });

    // Маршрут для обработки обмена валют
    app.post('/user/exchange', requireLogin, async function (req, res) {
        const { currency_id, amount } = req.body;

        try {
            // Получаем информацию о выбранной валюте
            const [currency] = await pool.query('SELECT * FROM currency WHERE id = ?', [currency_id]);
            if (currency.length === 0) {
                return res.status(404).send('Currency not found');
            }

            const exchangeRate = currency[0].rate;

            // Записываем обмен в таблицу истории
            const currentDate = new Date();
            await pool.query('INSERT INTO history (date, rate, amount, currency, user) VALUES (?, ?, ?, ?, ?)', [
                currentDate,
                exchangeRate,
                amount,
                currency_id,
                req.session.userId
            ]);

            // Сохраняем действие в сессии
            saveActionInSession(req, `Exchanged ${amount} from ${currency[0].currency_from} to ${currency[0].currency_to} at rate ${exchangeRate}`);

            res.send('Exchange successful and recorded in history!');
        } catch (error) {
            console.error('Error processing exchange:', error);
            res.status(500).send('Failed to process exchange.');
        }
    });

    // Маршрут для просмотра истории действий за сессию
    app.get('/user/session-history', requireLogin, function (req, res) {
        const actions = req.session.actions || []; // Если действий нет, используем пустой массив

        let actionList = '<h1>Session Exchange History</h1><ul>';
        actions.forEach(action => {
            actionList += `<li>${action.action} - ${action.timestamp.toLocaleString()}</li>`;
        });
        actionList += '</ul>';

        const content = `
            ${actionList}
            <br>
            <a href="/user/exchange" class="back-button">Back to Exchange</a>
        `;
        res.send(baseHTML('Session Exchange History', content));
    });
};
