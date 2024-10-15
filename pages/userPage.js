module.exports = function (app, requireLogin, pool, baseHTML) {

    function saveActionInSession(req, action) {
        if (!req.session.actions) {
            req.session.actions = [];
        }
        req.session.actions.push({
            action,
            timestamp: new Date()
        });
    }

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



    app.post('/user/exchange', requireLogin, async function (req, res) {
        const { fromCurrency, inCurrency, amount } = req.body;
        try {
            const [fromCurrencyData] = await pool.query('SELECT * FROM currency_from_byn WHERE id = ?', [fromCurrency]);
            const [inCurrencyData] = await pool.query('SELECT * FROM currency_in_byn WHERE id = ?', [inCurrency]);
    
            if (fromCurrencyData.length === 0 || inCurrencyData.length === 0) {
                return res.status(404).send('Валюта не найдена');
            }
    
            const fromCurrencyRate = parseFloat(fromCurrencyData[0].rate);
            const inCurrencyRate = parseFloat(inCurrencyData[0].rate);
    
            const fromCurrencyName = fromCurrencyData[0].currency_from;
            const inCurrencyName = inCurrencyData[0].currency_in;
    
            if (parseFloat(amount) <= 0) {
                return res.status(400).send('Сумма обмена должна быть положительной.');
            }
    
            if (fromCurrencyName === inCurrencyName) {
                return res.status(400).send('Исходная и целевая валюты не могут быть одинаковыми.');
            }
    
            const amountInBYN = parseFloat(amount) * fromCurrencyRate;
    
            // Проверка текущего max_amount
            const currentMax = await getMaxAmount(pool);
            if (amountInBYN > currentMax) {
                return res.status(400).send(`Обмен невозможен. Требуемая сумма в BYN (${amountInBYN.toFixed(2)}) превышает доступные средства (${currentMax.toFixed(2)} BYN).`);
            }
    
            let sumInTargetCurrency = 0;
            if (fromCurrencyName === 'BYN') {
                sumInTargetCurrency = parseFloat(amount) / inCurrencyRate;
            } else if (inCurrencyName === 'BYN') {
                sumInTargetCurrency = parseFloat(amount) * fromCurrencyRate;
            } else {
                sumInTargetCurrency = amountInBYN / inCurrencyRate;
            }
    
            const currentDate = new Date();
    
            await pool.query(
                'INSERT INTO history (amount, fromCurrencyName, inCurrencyName, date, inCurrencySum, fromCurrencySum, user) VALUES (?, ?, ?, ?, ?, ?, ?)', [
                    amount,
                    fromCurrencyName,
                    inCurrencyName,
                    currentDate,
                    sumInTargetCurrency,
                    fromCurrency,
                    req.session.userId
                ]
            );
    
            saveActionInSession(req, `
                Получено ${sumInTargetCurrency.toFixed(2)}  ${inCurrencyName}
                <br>
                Продано ${amount} ${fromCurrencyName}
                <br>
                Дата: ${currentDate.toLocaleString()}
            `);
    
            const content = `
                <br>
                Обмен произведен и сохранен в историю! 
                <br>
                Получено ${sumInTargetCurrency.toFixed(2)}  ${inCurrencyName}
                <br>
                Продано ${amount} ${fromCurrencyName} 
                <br>
                <button onclick="location.href='/user/exchange'">Вернуться на страницу обмена валют</button>
            `;
            res.send(baseHTML('Обмен произведен и сохранен в историю!', content));
        } catch (error) {
            console.error('Ошибка при обработке обмена:', error);
            res.status(500).send('Не удалось обработать обмен.');
        }
    });
    
    

    app.get('/user/exchange', requireLogin, async function (req, res) {
        try {
            const [currencies_in] = await pool.query('SELECT * FROM currency_in_byn');
            const [currencies_from] = await pool.query('SELECT * FROM currency_from_byn');
            const currentMax = await getMaxAmount(pool);

            let currencyTableIn = '';
            currencies_in.forEach(currency => {
                currencyTableIn += `
                <tr>
                    <td>${currency.currency_in}</td>
                    
                    <td>${currency.rate}</td>
                </tr>`;
            });

            let currencyTableFrom = '';
            currencies_from.forEach(currency => {
                currencyTableFrom += `
                <tr>
                    
                    <td>${currency.currency_from}</td>
                    <td>${currency.rate}</td>
                </tr>`;
            });

            let currencyOptionsIn = '';
            currencies_in.forEach(currency => {
                currencyOptionsIn += `<option value="${currency.id}">${currency.currency_in}</option>`;
            });

            let currencyOptionsFrom = '';
            currencies_from.forEach(currency => {
                currencyOptionsFrom += `<option value="${currency.id}">${currency.currency_from}</option>`;
            });

            const content = `
                <h2>Доступное количество денег в обменнике: ${currentMax.toFixed(2)} BYN</h2>
                <h2>Валюты из базы данных</h2>
                <table>
                <h2>Покупка</h2>
                    <tr>
                        <th>валюта</th>
                        <th>курс</th>
                    </tr>
                    ${currencyTableIn}
                </table>

                <table>
                <h2>Продажа</h2>
                    <tr>
                        <th>валюта</th>
                        <th>курс</th>
                    </tr>
                    ${currencyTableFrom}
                </table>             


                <h1>Доступные валюты для обмена:</h1>
                <form action="/user/exchange" method="POST">
                <label for="fromCurrency">Из:</label>
                    <select name="fromCurrency" id="fromCurrency" required>
                        ${currencyOptionsFrom}
                    </select>
                <input type="number" name="amount" min="1" step="0.01" placeholder="Сумма" required>
                <label for="inCurrency">В:</label>
                    <select name="inCurrency" id="inCurrency" required>
                        ${currencyOptionsIn}
                    </select>                   
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
