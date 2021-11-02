const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const crypto = require('crypto');
const { validateParams } = require('./validateParams.js');


var jsonParser = bodyParser.json();
app.use('/', express.static('static'));
app.use(morgan('combined'));
let db = new sqlite3.Database('./chat/database.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the chat database.');
});

// db.run('DROP TABLE chat;')

db.run(`CREATE TABLE IF NOT EXISTS chat (
    id TEXT,
    username TEXT,
    message TEXT
);`);

app.post('/api/messages', jsonParser, validateParams([{
    param_key: 'username',
    required: true,
    type: 'string',
    validator_functions: [(param) => {
        return !!param;
    }]
}, {
    param_key: 'message',
    required: true,
    type: 'string',
    validator_functions: [(param) => {
        return !!param;
    }]
}]), (req, res) => {
    var id = crypto.randomBytes(16).toString('hex')
    db.run('INSERT INTO chat(id, username, message) VALUES(?, ?, ?)', [id, req.body.username, req.body.message], err => {
        if (err) {
            throw err;
        } else {
            console.log('Added message to chat', req.body.username, req.body.message)
            io.emit('message', req.body);
        }
    });
    return res.send({
        ...req.body,
        id: id
    });
});


app.get('/api/messages', (req, res) => {
    db.all('SELECT * FROM chat;', [], (err, result) => {
        if (err) {
            throw err;
        } else {
            return end(result);
        }
    })

    function end(result) {
        return res.send(result);
    }
});

app.delete('/api/messages', jsonParser, (req, res) => {
    return res.send({
        "deleted": req.body.id
    });
})
io.on('connection', () => {
    console.log('a user is connected');
});


var server = http.listen(80, () => {
    console.log('server started on port', server.address().port);
});