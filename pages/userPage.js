const axios = require('axios');

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

    // Функция для получения текущего MAX_AMOUNT из базы данных
    async function getMaxAmount(pool) {
        try {
            const [rows] = await pool.query('SELECT max_amount FROM exchange_settings WHERE id = 1');
            if (rows.length > 0) {
                return parseFloat(rows[0].max_amount);
            } else {
                // Если запись отсутствует, создайте её с дефолтным значением
                await pool.query('INSERT INTO exchange_settings (max_amount) VALUES (?)', [10000]);
                return 10000;
            }
        } catch (error) {
            console.error('Ошибка при получении MAX_AMOUNT из базы данных:', error);
            throw error;
        }
    }

    // Функция для обновления MAX_AMOUNT в базе данных
    async function updateMaxAmount(pool, newAmount) {
        try {
            await pool.query('UPDATE exchange_settings SET max_amount = ? WHERE id = 1', [newAmount]);
        } catch (error) {
            console.error('Ошибка при обновлении MAX_AMOUNT в базе данных:', error);
            throw error;
        }
    }

    // Маршрут для обработки обмена валют
    app.post('/user/exchange', requireLogin, async function (req, res) {
        const { fromCurrency, toCurrency, amount } = req.body;

        try {
            // Начать транзакцию
            await pool.query('START TRANSACTION');

            // Получить текущий MAX_AMOUNT
            const currentMax = await getMaxAmount(pool);

            if (parseFloat(amount) <= 0) {
                await pool.query('ROLLBACK');
                return res.status(400).send('Сумма обмена должна быть положительной.');
            }

            if (amount > currentMax) {
                await pool.query('ROLLBACK');
                return res.status(400).send(`Сумма обмена не может превышать ${currentMax.toFixed(2)} BYN`);
            }

            if (fromCurrency === toCurrency) {
                await pool.query('ROLLBACK');
                return res.status(400).send('Исходная и целевая валюты не могут быть одинаковыми.');
            }

            // Получаем информацию о валютах
            const [fromCurrencyData] = await pool.query('SELECT * FROM currency WHERE id = ?', [fromCurrency]);
            const [toCurrencyData] = await pool.query('SELECT * FROM currency WHERE id = ?', [toCurrency]);

            if (fromCurrencyData.length === 0 || toCurrencyData.length === 0) {
                await pool.query('ROLLBACK');
                return res.status(404).send('Валюта не найдена');
            }

            // Получаем курсы обмена
            const fromCurrencyRate = parseFloat(fromCurrencyData[0].rate); // Исходная валюта к BYN
            const toCurrencyRate = parseFloat(toCurrencyData[0].rate);     // Целевая валюта к BYN

            const fromCurrencyName = fromCurrencyData[0].currency_from;
            const toCurrencyName = toCurrencyData[0].currency_to;

            // Рассчитываем сумму в BYN
            const amountInBYN = parseFloat(amount) / fromCurrencyRate;

            // Проверка, достаточно ли средств для обмена
            if (amountInBYN > currentMax) {
                await pool.query('ROLLBACK');
                return res.status(400).send(`Обмен невозможен. Требуемая сумма в BYN (${amountInBYN.toFixed(2)}) превышает доступные средства (${currentMax.toFixed(2)} BYN).`);
            }

            // Рассчитываем сумму в целевой валюте
            const sumInTargetCurrency = amountInBYN * toCurrencyRate;

            // Обновляем MAX_AMOUNT: уменьшаем на amountInBYN
            const newMax = currentMax - amountInBYN;
            await updateMaxAmount(pool, newMax);

            // Записываем обмен в таблицу истории
            const currentDate = new Date();
            await pool.query(
                'INSERT INTO history (date, rate, purchased_currency, selling_currency, user) VALUES (?, ?, ?, ?, ?)', [
                    currentDate,
                    toCurrencyRate,
                    sumInTargetCurrency,
                    fromCurrency, // Исправлено на fromCurrency
                    req.session.userId
                ]
            );

            // Сохраняем действие в сессии
            saveActionInSession(req, `
                Получено ${sumInTargetCurrency.toFixed(2)} ${toCurrencyName}
                <br>
                Продано ${amount} ${fromCurrencyName}
                <br>
                Дата: ${currentDate.toLocaleString()}
            `);

            // Фиксируем транзакцию
            await pool.query('COMMIT');

            const content = `
                <br>
                Обмен произведен и сохранен в историю! 
                <br>
                <button onclick="location.href='/user/exchange'">Вернуться на страницу обмена валют</button>
            `;
            res.send(baseHTML('Обмен произведен и сохранен в историю!', content));
        } catch (error) {
            // Откат транзакции в случае ошибки
            try {
                await pool.query('ROLLBACK');
            } catch (rollbackError) {
                console.error('Ошибка при откате транзакции:', rollbackError);
            }
            console.error('Ошибка при обработке обмена:', error);
            res.status(500).send('Не удалось обработать обмен.');
        }
    });

    // Маршрут для отображения доступных валют и формы для обмена
    app.get('/user/exchange', requireLogin, async function (req, res) {
        try {
            const [currencies] = await pool.query('SELECT * FROM currency');
            const currentMax = await getMaxAmount(pool); // Получаем текущий MAX_AMOUNT

            let currencyOptions = '';
            currencies.forEach(currency => {
                currencyOptions += `<option value="${currency.id}">${currency.currency_from}</option>`;
            });

            const content = `
                <h1>Доступные валюты для обмена:</h1>
                <p>Доступное количество денег в обменнике: ${currentMax.toFixed(2)} BYN</p>
                <form action="/user/exchange" method="POST">
                    <label for="fromCurrency">Из:</label>
                    <select name="fromCurrency" id="fromCurrency" required>
                        ${currencyOptions}
                    </select>
                    
                    <label for="toCurrency">В:</label>
                    <select name="toCurrency" id="toCurrency" required>
                        ${currencyOptions}
                    </select>
                    
                    <input type="number" name="amount" min="1" step="0.01" placeholder="Сумма" required>
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
