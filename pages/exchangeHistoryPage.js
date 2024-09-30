module.exports = function (app, pool, requireAdmin, baseHTML) {

    app.get('/admin/exchange-history', requireAdmin, async function (req, res) {
        try {
            // Получение всей истории обмена с информацией о пользователе и валюте
            const [history] = await pool.query(`
            SELECT h.id, h.date, h.rate, h.sum, h.amount, c.currency_to AS currency, user
            FROM history h
            JOIN currency c ON h.currency = c.id
            JOIN users ON user = users.id
        `);

            // Отображение истории 
            let historyTable = `
            <table>
                <tr>
                    <th>ID</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Currency</th>
                    <th>Rate</th>
                    <th>Sum</th>
                    <th>User</th>
                </tr>
        `;

            history.forEach(entry => {
                historyTable += `
                <tr>
                    <td>${entry.id}</td>
                    <td>${new Date(entry.date).toLocaleString()}</td>
                    <td>${entry.amount}</td>
                    <td>${entry.currency}</td>
                    <td>${entry.rate}</td>
                    <td>${entry.sum}</td>
                    <td>${entry.user}</td>
                </tr>
            `;
            });

            historyTable += '</table>';

            const content = `
            <h1>История операций</h1>
            ${historyTable}
            <br>
                 <a href="/admin/currency/">Вернуться в Админ панель</a>
        `;

            res.send(baseHTML('История операций', content));
        } catch (error) {
            console.error('Error fetching exchange history:', error);
            res.status(500).send('Failed to load exchange history.');
        }
    });







}