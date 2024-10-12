module.exports = function (app, requireLogin, baseHTML) {

    app.get('/user/session-history', requireLogin, function (req, res) {
        const actions = req.session.actions || []; 
        let actionList = '<h1>История операций за сессию</h1><ul>';
        actions.forEach(action => {
            actionList += `<li>${action.action} - ${action.timestamp.toLocaleString()}</li>`;
        });
        actionList += '</ul>';
        const content = `
            ${actionList}
            <br>
            <button onclick="location.href='/user/exchange'" class="history-button">Вернуться к странице обмена валют</button>
        `;
        res.send(baseHTML('История операций за сессию', content));
    });
}