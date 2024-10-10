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

    // Маршрут для обработки обмена валют
    app.post('/user/exchange', requireLogin, async function (req, res) {
        const { fromCurrency, toCurrency, amount } = req.body;
        const MAX_AMOUNT = 10000;

        try {
            if (amount > MAX_AMOUNT) {
                return res.status(400).send(`Сумма обмена не может превышать ${MAX_AMOUNT}`);
            }

            // Получаем информацию о валютах
            const [fromCurrencyData] = await pool.query('SELECT * FROM currency WHERE id = ?', [fromCurrency]);
            const [toCurrencyData] = await pool.query('SELECT * FROM currency WHERE id = ?', [toCurrency]);

            if (fromCurrencyData.length === 0 || toCurrencyData.length === 0) {
                return res.status(404).send('Валюта не найдена');
            }

            // Получаем курсы обмена
            const fromCurrencyRate = fromCurrencyData[0].rate; // Исходная валюта к BYN
            const toCurrencyRate = toCurrencyData[0].rate;     // Целевая валюта к BYN

            // Рассчитываем сумму в BYN
            const amountInBYN = amount / fromCurrencyRate;

            // Рассчитываем сумму в целевой валюте
            const sumInTargetCurrency = amountInBYN * toCurrencyRate;

            // Записываем обмен в таблицу истории
            const currentDate = new Date();
            await pool.query('INSERT INTO history (date, rate, sum, amount, currency, user) VALUES (?, ?, ?, ?, ?, ?)', [
                currentDate,
                toCurrencyRate,
                sumInTargetCurrency,
                amount,
                toCurrency,
                req.session.userId
            ]);

            // Сохраняем действие в сессии
            saveActionInSession(req, `
        Обменяно ${amount} ${fromCurrencyData[0].currency_from} в ${toCurrencyData[0].currency_to} через белорусский рубль по курсам:
        <br>1 ${fromCurrencyData[0].currency_from} = ${fromCurrencyRate} BYN
        <br>1 BYN = ${toCurrencyRate} ${toCurrencyData[0].currency_to}
        <br>Получено: ${sumInTargetCurrency} ${toCurrencyData[0].currency_to}
        `);

            const content = `
        <br>
        Обмен произведен и сохранен в историю! 
        <br>
        <button onclick="location.href='/user/exchange'">Вернуться на страницу обмена валют</button>
        `;
            res.send(baseHTML('Обмен произведен и сохранен в историю!', content));
        } catch (error) {
            console.error('Ошибка при обработке обмена:', error);
            res.status(500).send('Не удалось обработать обмен.');
        }
    });


    // Маршрут для отображения доступных валют и формы для обмена
    app.get('/user/exchange', requireLogin, async function (req, res) {
        try {
            const [currencies] = await pool.query('SELECT * FROM currency');

            let currencyOptions = '';
            currencies.forEach(currency => {
                currencyOptions += `<option value="${currency.id}">${currency.currency_from} (${currency.currency_to})</option>`;
            });

            const content = `
            <h1>Доступные валюты для обмена:</h1>
            <form action="/user/exchange" method="POST">
                <label for="fromCurrency">В:</label>
                <select name="fromCurrency" id="fromCurrency" required>
                    ${currencyOptions}
                </select>
                
                <label for="toCurrency">Из:</label>
                <select name="toCurrency" id="toCurrency" required>
                    ${currencyOptions}
                </select>
                
                <input type="number" name="amount" min="1" placeholder="Сумма" required>
                <button type="submit">Обмен</button>
            </form>
            <br>
            <button onclick="location.href='/user/session-history'" class="history-button">История операций за сессию</button>
        `;

            res.send(baseHTML('Обмен валют', content));
        } catch (error) {
            console.error('Ошибка при получении валют:', error);
            res.status(500).send('Не удалось загрузить валюты.');
        }
    });



};
