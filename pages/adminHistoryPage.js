module.exports = function (app, pool, requireAdmin, baseHTML) {

    app.get('/admin/exchange-history', requireAdmin, async function (req, res) {
        try {
            // Получение всей истории обмена с информацией о пользователе и валюте
            const [history] = await pool.query(`
            SELECT h.id, h.date, h.rate, h.purchased_currency, h.selling_currency, user
            FROM history h
            JOIN users ON user = users.id
        `);

            // Отображение истории 
            let historyTable = `
            <table>
                <tr>
                    <th>ID</th>
                    <th>Дата</th>
                    <th>Продано</th>
                    <th>Курс</th>
                    <th>Куплено	</th>
                    <th>Пользователь</th>
                </tr>
        `;

            history.forEach(entry => {
                historyTable += `
                <tr>
                    <td>${entry.id}</td>
                    <td>${new Date(entry.date).toLocaleString()}</td>
                    <td>${entry.selling_currency}</td>
                    <td>${entry.rate}</td>
                    <td>${entry.purchased_currency}</td>
                    <td>${entry.user}</td>
                </tr>
            `;
            });

            historyTable += '</table>';

            const content = `
            <h1>История операций</h1>
            ${historyTable}
            <br>
                 <button onclick="location.href='/admin/currency/'" class="history-button">Вернуться в Админ панель</button>
                 
        `;

            res.send(baseHTML('История операций', content));
        } catch (error) {
            console.error('Error fetching exchange history:', error);
            res.status(500).send('Failed to load exchange history.');
        }
    });







}