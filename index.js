console.log(`node.js ${process.version}`);
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
const helmet = require("helmet");
const sprightly = require("sprightly");
const rateLimit = require("express-rate-limit");
const fingerprint = require('express-fingerprint');
const osu = require('node-os-utils');
const { cpu, drive, mem, netstat, os } = osu;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
app.engine("html", sprightly);
app.set("view engine", "html");
app.set("views", "static");
app.set("json spaces", 2);
app.set("trust proxy", 1);
app.use(timeout(5000));
app.use(haltOnTimedout);
app.use('/css/bootstrap-dark', express.static(path.join(__dirname, 'node_modules/bootstrap-dark-5/dist/css')))
app.use('/css', express.static(path.join(__dirname, 'static/css')))
app.use('/js', express.static(path.join(__dirname, 'static/js')))
app.use('/assets', express.static(path.join(__dirname, 'static/assets')))
app.use(fingerprint({
	parameters: [
		fingerprint.useragent,
		fingerprint.geoip
	]
}));
app.use(morgan(function(tokens, req, res) {
	var status = tokens.status(req, res);
	var color = status >= 500 ? 31 // red
		: status >= 400 ? 33 // yellow
	    	: status >= 300 ? 36 // cyan
                : status >= 200 ? 32 // green
                    : 0 // no color
	function random(min, max) {
		let range = max - min + 1;
		return Math.floor(Math.random() * range) + min
	}
	return `\x1b[0m${tokens.method(req, res)} ${tokens.url(req, res)} \x1b[${color}m${status}\x1b[0m ${tokens.res(req, res, 'content-length')} - ${tokens['response-time'](req, res)}ms\nfingerprint: ${req.fingerprint.hash}\x1b[0m`
}));
app.use(helmet({
	contentSecurityPolicy: false,
    frameguard: false
}));
app.use(cookieParser(process.env.SIGNING_KEY));

function skip(req, res) {
	if (!!req.headers.pinger) {
		process.stdout.clearLine();
		process.stdout.cursorTo(0);
		pingCounts++;
		process.stdout.write(`Ping count: ${pingCounts}`);
	}
	return !!req.headers.pinger
}

function haltOnTimedout(req, res, next) {
	if (!req.timedout) next();
}
const cookieOptions = {
	maxAge: 1000 * 60 ** 2 * 2, // would expire after 2 hours
	httpOnly: true, // The cookie only accessible by the web server
	signed: true, // Indicates if the cookie should be signed
	sameSite: "Strict",
	secure: true
};
// app.use('/css/bootstrap', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/css')))
const JSONDB = require("./chatDatabase.js")
var db;
(async (_) => {db = await JSONDB.connect("./chat/database.json");})()
const verifyAdmin = (req, res, next) => {
    if (!db.checkAdmin(req.signedCookies.username)) {
        return res.status(403).json({
            message: "User is not an admin.",
            error: "not_admin"
        });
    }
    next();
}
const limiter = rateLimit({
	windowMs: 2 * 60 * 1000, // 2 minutes
	max: function(req, res) {
		if (db.checkAdmin(req.signedCookies.username)) {
			return 128;
		}
		return 64;
	},
	message: {
		"message": "You are being ratelimited.",
		"error": "ratelimited"
	},
	keyGenerator: (req) => {
		return req.fingerprint.hash
	}
});
app.get("/", (req, res, next) => {
	return res.render("index.html");
});
app.get("/login", (req, res, next) => {
	return res.render("login.html");
});
app.get("/register", (req, res, next) => {
	return res.render("register.html");
});

// var statsObject = {};
// statsObject.cpuUsage = await cpu.usage();
// statsObject.cpuFree = await cpu.free();
// statsObject.drive = await drive.info();
// statsObject.memory = await mem.info();
// statsObject.os = os.platform();
// statsObject.uptime = os.uptime();
// statsObject.hostname = os.hostname();
// statsObject.ip = os.ip();
// statsObject.type = os.type();
// statsObject.arch = os.arch();
app.post("/login", bodyParser.json(), async (req, res, next) => {
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
		const user = await db.findUser(username);
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
			res.cookie("token", token, cookieOptions);
			res.cookie("username", username, cookieOptions);
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
app.post("/register", bodyParser.json(), async (req, res, next) => {
	try {
		var {
			username,
			password
		} = req.body;
		username = username.replace(/[^\w\s.,!@#$%^&*()=+~`-]/g, "");
		if (!(/^[a-zA-Z0-9-]{4,32}$/.test(username))) {
			return res.status(400).json({
				message: "Username must only contain 0-9, a-z, or hyphen and must be between 4 and 32 characters.",
				error: "invalid_username"
			});
		}
		// Validate user input
		if (!(!!username && !!password)) {
			return res.status(400).json({
				message: "All input is required.",
				error: "incomplete_request"
			});
		}
		const oldUser = await db.findUser(username);
		if (oldUser) {
			return res.status(409).json({
				message: "User Already Exists. Please Login.",
				error: "user_exists"
			});
		} else {
			encryptedPassword = await bcrypt.hash(password, 10);
			var user = await db.addUser({
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
			res.cookie("token", token, cookieOptions);
			res.cookie("username", username, cookieOptions);
			return res.status(200).redirect("/");
		}
	} catch (e) {
		console.error(e);
	}
})
app.get("/chat/messages", (req, res) => {
	return res.json(db.getMessages());
});
app.get("/username", (req, res) => {
	return res.status(req.signedCookies.username ? 200 : 403).json(req.signedCookies.username ? {
		username: req.signedCookies.username
	} : {
		error: "logged_out"
	});
});
app.post("/chat/add", auth.verifyToken, limiter, bodyParser.json(), async (req, res) => {
	const {
		content
	} = req.body;
	if (!!content && /^(?!\s*$).+/g.test(content) && content.length <= 500) {
		console.log(`Message: ${content}`)
		var message = await db.addMessage({
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
app.delete("/chat/delete", limiter, auth.verifyToken, bodyParser.json(), async (req, res) => {
	const {
		id
	} = req.body;
	if (!(/^[0-9a-f]{32}$/g.test(id))) {
		return res.status(400).json({
			"message": "Malformed id.",
			"error": "malformed_id"
		});
	}
	const message = await db.findMessage(id) || {};
	if (message.username != req.signedCookies.username && !db.checkAdmin(req.signedCookies.username)) {
		return res.status(403).json({
			"message": "Insufficient permissions.",
			"error": "insufficient_perms"
		});
	}
	io.emit("message remove", id);
	return res.json(await db.deleteMessage(id));
});
app.delete("/chat/purge", auth.verifyToken, verifyAdmin, bodyParser.json(), async (req, res) => {
	const messages = db.getMessages();
	for (const message of messages) {
		io.emit("message remove", message.id);
	}
	return res.json({
		chat: await db.purgeMessages()
	});
});
app.get("/admin", (req, res) => {
	return res.json({
		admin: db.checkAdmin(req.signedCookies.username)
	});
});
app.delete("/users/purge", auth.verifyToken, verifyAdmin, bodyParser.json(), async (req, res) => {
	return res.json({
		users: await (db.purgeUsers.bind(db))()
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
app.use(function(req, res, next) {
	res.status(404);
	// respond with html page
	if (req.accepts('html')) {
		res.render('404', {
			url: req.url.substring(1)
		});
		return;
	}
	// respond with json
	if (req.accepts('json')) {
		res.json({
			error: 'Not found'
		});
		return;
	}
	// default to plain-text. send()
	res.type('txt').send('Not found');
});
var server = http.listen(5000, () => {
	console.log("server is running on port", server.address().port);
});