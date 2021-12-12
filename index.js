const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const auth = require("./auth");
const morgan = require("morgan");
const http = require("http").Server(app);
const io = require("socket.io")(http);
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const timeout = require("connect-timeout");
const path = require("path");
const fs = require('fs');
const minify = require('express-minify');

app.use(timeout(5000));
app.use(haltOnTimedout);

function haltOnTimedout(req, res, next) {
    if (!req.timedout) next();
}

const httpOnlyOptions = {
    maxAge: 1000 * 60 ** 2 * 2, // would expire after 2 hours
    httpOnly: true, // The cookie only accessible by the web server
    signed: true, // Indicates if the cookie should be signed
    sameSite: "Strict"
};

const cookieOptions = {
    maxAge: 1000 * 60 ** 2 * 2, // would expire after 2 hours
    httpOnly: false, // The cookie only accessible by the web server
    signed: false, // Indicates if the cookie should be signed
    sameSite: "Strict"
};


app.use('/css/bootstrap', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/css')))
app.use('/css/bootstrap-dark', express.static(path.join(__dirname, 'node_modules/bootstrap-dark-5/dist/css')))


const JSONDB = require("./chatDatabase.js")

var db = JSONDB.connect("./chat/database.json");

pingCounts = 0
// My stupid idea
// app.use(function (req, res, next) {
//     var filename = req.url;
//     filename = (filename == "/") ? "index.html" : filename.substring(1)
//     var isHtml = path.extname(filename) == ".html"
//     if (!isHtml && fs.existsSync("./static/" + filename + ".html")) {
//         isHtml = true
//     }
//     if (fs.existsSync("./static" + filename)) {
//         console.log(filename)
//     }
//     void (isHtml ? res.render(filename.replace(".html", "") + ".html") : undefined)
//     return next();
// });

// app.use(minify({
//     uglifyJsModule: uglifyJs
// }));

app.engine("html", require("ejs").renderFile);
app.set("view engine", "html");
app.set("views", "static");
app.set("json spaces", 2);
app.use(
    morgan("dev", {
        skip: function(req, res) {
            if (!!req.headers.pinger) {
                process.stdout.clearLine();
                process.stdout.cursorTo(0);
                pingCounts++;
                process.stdout.write(`Ping count: ${pingCounts}`);
            }
            return !!req.headers.pinger
        }
    }));

// app.use(sass({
//     src: __dirname + "/sass", // Input SASS files
//     dest: __dirname + "/static", // Output CSS
//     debug: false
// }));
app.use(express.static("static", {
    extensions: ["html"]
}));
app.use(cookieParser(process.env.SIGNING_KEY));

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Access-Control-Expose-Headers", "*")
    next();
});



app.post("/login/submit", bodyParser.urlencoded({ extended: true }), async (req, res, next) => {
    try {
        const {
            username,
            password
        } = req.body;

        // Validate user input
        if (!(username && password)) {
            res.status(400).json({
                message: "All input is required.",
                error: "incomplete_request"
            });
        }
        // Validate if user exist in our database
        const user = db.findUser(username);

        if (user && (await bcrypt.compare(password, user.password))) {
            // Create token
            const token = jwt.sign({
                user_id: user.id,
                username
            },
                process.env.TOKEN_KEY, {
                    expiresIn: "2h",
                }
            );

            // save user token
            // db.setUserToken(username, token);

            // user
            res.cookie("token", token, httpOnlyOptions);
            res.cookie("username", username, httpOnlyOptions);
            res.cookie("loggedIn", true, cookieOptions);
            return res.status(200).redirect("/");
        }
        return res.status(400).json({
            message: "Invalid Credentials.",
            error: "invalid"
        });
    } catch (e) {
        console.error(e);
    }
})

app.post("/register/submit", bodyParser.urlencoded({ extended: true }), async (req, res, next) => {
    try {
        const {
            username,
            password
        } = req.body;
        // Validate user input
        
        if (!(username && password)) {
            res.status(400).json({
                message: "All input is required.",
                error: "incomplete_request"
            });
        }

        const oldUser = db.findUser(username);

        if (oldUser) {
            return res.status(409).json({
                message: "User Already Exists. Please Login.",
                error: "user_exists"
            });
        }

        encryptedPassword = await bcrypt.hash(password, 10);


        var user = db.addUser({
            username: username,
            password: encryptedPassword
        });
        var token = jwt.sign({
            user_id: user.id,
            username
        },
            process.env.TOKEN_KEY, {
                expiresIn: "2h",
            }
        );

        // db.setUserToken(username, token);
        res.cookie("token", token, httpOnlyOptions);
        res.cookie("username", username, httpOnlyOptions);
        res.cookie("loggedIn", true, cookieOptions);
        return res.status(200).redirect("/");
    } catch (e) {
        console.error(e);
    }
})

app.get("/chat/messages", (req, res) => {
    return res.json(db.getMessages());
});

app.get("/username", (req, res) => {
    return res.status(req.signedCookies.username ? 200 : 403).json(req.signedCookies.username ? { username: req.signedCookies.username } : { error: "logged_out" });
});

app.post("/chat/add", auth.verifyToken, bodyParser.json(), (req, res) => {
    const { content } = req.body;
    if (!!content && /^(?!\s*$).+/g.test(content) && content.length <= 500) {
        console.log(`Message: ${content}`)
        var message = db.addMessage({
            content: content.replace(/^\s*$(?:\r\n?|\n)/gm, ""),
            username: req.signedCookies.username
        });

        io.emit("message", message);
        return res.json(message);
    } else if (!(!!content && /^(?!\s*$).+/g.test(content))) {
        return res.status(400).json({
            "message": "No content in body.",
            "error": "content_required"
        });
    } else {
        return res.status(400).json({
            "message": "Message too long.",
            "error": "too_long"
        });
    }
});

app.delete("/chat/delete", auth.verifyToken, bodyParser.json(), (req, res) => {
    const { id } = req.body;
    if (!(/^[0-9a-f]{32}$/g.test(id))) {
        return res.status(400).json({
            "message": "Malformed id.",
            "error": "malformed_id"
        });
    }
    const message = db.findMessage(id) || {};
    if (message.username != req.signedCookies.username && !db.checkAdmin(req.signedCookies.username)) {
        return res.status(403).json({
            "message": "Insufficient permissions.",
            "error": "insufficient_perms"
        });
    }
    io.emit("message remove", id);
    return res.json(db.deleteMessage(id));
});

app.delete("/chat/purge", auth.verifyToken, auth.verifyAdmin(db), bodyParser.json(), (req, res) => {
    const messages = db.getMessages();
    for (const message of messages) {
        io.emit("message remove", message.id);
    }
    return res.json({
        chat: db.purgeMessages()
    });
});

app.get("/admin", (req, res) => {
    return res.json({
        admin: db.checkAdmin(req.signedCookies.username)
    });
});

app.delete("/users/purge", auth.verifyToken, auth.verifyAdmin(db), bodyParser.json(), (req, res) => {
    return res.json({
        users: (db.purgeUsers.bind(db))()
    });
});


io.on("connection", (socket) => {
    let usernameSet = false;

    // when the client emits 'set username', this listens and executes
    socket.on('set username', (username) => {
        if (usernameSet) return;

        // we store the username in the socket session for this client
        socket.username = username;
        usernameSet = true;
    });

    // when the client emits 'typing', we broadcast it to others
    socket.on('typing', () => {
        socket.broadcast.emit('typing', {
            username: socket.username
        });
    });

    // when the client emits 'stop typing', we broadcast it to others
    socket.on('stop typing', () => {
        socket.broadcast.emit('stop typing', {
            username: socket.username
        });
    });
    socket.on('disconnect', () => {
        socket.broadcast.emit('stop typing', {
            username: socket.username
        });
    });
    console.log("a user is connected > ", socket.id)
});

// app.all("*", function (req, res, next) {
//     
//     next();
// })

var server = http.listen(5000, () => {
    console.log("server is running on port", server.address().port);
});