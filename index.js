const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);


var jsonParser = bodyParser.json();
app.use('/', express.static('static'));
app.use(morgan('combined'));
let db = new sqlite3.Database('./chat/database.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the chat database.');
});

db.run(`CREATE TABLE IF NOT EXISTS chat (
    username TEXT,
    message TEXT
);`);

app.post('/api/send', jsonParser, (req, res) => {
    res.send(req.body);
    db.run('INSERT INTO chat(username, message) VALUES(?, ?)', [req.body.username, req.body.message], err => {
        if (err) {
            throw err;
        } else { 
            console.log('Added message to chat', req.body.username, req.body.message)
            io.emit('message', req.body);
        }
    });
});


app.get('/api/chat', (req, res) => {
    db.all('SELECT * FROM chat;', [] ,(err, result) => {
        if (err) {
            throw err;
        } else { 
            // console.log(result);
            end(result);
        }
    })
    function end(result) {
        res.send(result);
    }
});

io.on('connection', () => {
  console.log('a user is connected');
});


var server = http.listen(80, () => {
    console.log('server started on port', server.address().port);
});
