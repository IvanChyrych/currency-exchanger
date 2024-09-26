module.exports = function (app,pool,requireAdmin,baseHTML) {

app.get('/admin/exchange-history', requireAdmin, async function (req, res) {
    try {
        // Fetch all exchange history with user and currency details
        const [history] = await pool.query(`
            SELECT h.id, h.date, h.rate, h.amount, c.currency_to AS currency, user
            FROM history h
            JOIN currency c ON h.currency = c.id
            JOIN users ON user = users.id
        `);

        // Render the history with search and filter options (UI part comes next)
        let historyTable = `
            <table>
                <tr>
                    <th>ID</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Currency</th>
                    <th>Rate</th>
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
                    <td>${entry.user}</td>
                </tr>
            `;
        });

        historyTable += '</table>';

        const content = `
            <h1>All Exchange History</h1>
            ${historyTable}
            <br>
            <form method="GET" action="/admin/exchange-history">
    <input type="date" name="date" placeholder="Date" value="<%= date || '' %>">
    <input type="text" name="user" placeholder="User" value="<%= user || '' %>">
    <input type="text" name="currency" placeholder="Currency" value="<%= currency || '' %>">
    <button type="submit">Filter</button>
</form>

            <a href="/admin/currency/">Back to Admin Panel</a>
        `;

        res.send(baseHTML('Admin Exchange History', content));
    } catch (error) {
        console.error('Error fetching exchange history:', error);
        res.status(500).send('Failed to load exchange history.');
    }
});

app.get('/admin/exchange-history', requireAdmin, async function (req, res) {
    const { date, user, currency, sort } = req.query;

    let query = `
        SELECT h.id, h.date, h.rate, h.amount, c.currency_to AS currency, u.username AS user
        FROM history h
        JOIN currency c ON h.currency = c.id
        JOIN users u ON h.user = u.id
        WHERE 1=1
    `;

    const params = [];

    // Filter by date
    if (date) {
        query += ` AND DATE(h.date) = ?`;
        params.push(date);
    }

    // Filter by user
    if (user) {
        query += ` AND u.username LIKE ?`;
        params.push(`%${user}%`);
    }

    // Filter by currency
    if (currency) {
        query += ` AND c.currency_to LIKE ?`;
        params.push(`%${currency}%`);
    }

    // Sorting
    if (sort) {
        if (sort === 'date') query += ` ORDER BY h.date`;
        if (sort === 'user') query += ` ORDER BY u.username`;
        if (sort === 'currency') query += ` ORDER BY c.currency_to`;
    } else {
        query += ` ORDER BY h.date DESC`; // Default sorting by date, newest first
    }

    try {
        const [history] = await pool.query(query, params);

        let historyTable = `
            <table>
                <tr>
                    <th><a href="/admin/exchange-history?sort=id">ID</a></th>
                    <th><a href="/admin/exchange-history?sort=date">Date</a></th>
                    <th>Amount</th>
                    <th><a href="/admin/exchange-history?sort=currency">Currency</a></th>
                    <th>Rate</th>
                    <th><a href="/admin/exchange-history?sort=user">User</a></th>
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
                    <td>${entry.user}</td>
                </tr>
            `;
        });

        historyTable += '</table>';

        const content = `
            <h1>All Exchange History</h1>
            <form method="GET" action="/admin/exchange-history">
                <input type="date" name="date" placeholder="Date" value="${date || ''}">
                <input type="text" name="user" placeholder="User" value="${user || ''}">
                <input type="text" name="currency" placeholder="Currency" value="${currency || ''}">
                <button type="submit">Filter</button>
            </form>
            ${historyTable}
            <br>
            <a href="/admin/currency">Back to Admin Panel</a>
        `;

        res.send(baseHTML('Admin Exchange History', content));
    } catch (error) {
        console.error('Error fetching exchange history:', error);
        res.status(500).send('Failed to load exchange history.');
    }
});
}