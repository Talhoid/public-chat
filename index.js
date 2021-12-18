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
const crypto = require('crypto');
const minify = require('express-minify');
const helmet = require("helmet");
const sprightly = require("sprightly");
const rateLimit = require("express-rate-limit");
const fingerprint = require('express-fingerprint')
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
app.use(async (_, __, next) => {
	await sleep(500);
	next();
});
app.use(minify());
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
	var coloredFingerprint = Array.from(req.fingerprint.hash);
	coloredFingerprint.forEach((element, index, string) => {
		color = random(31, 37);
		string[index] = `\x1b[${color}m${element}`
	});
	return `\x1b[0m${tokens.method(req, res)} ${tokens.url(req, res)} \x1b[${color}m${status}\x1b[0m ${tokens.res(req, res, 'content-length')} - ${tokens['response-time'](req, res)}ms\x1b[0m
fingerprint: ${req.fingerprint.hash}\x1b[0m`
}));
app.use(helmet({
	contentSecurityPolicy: false
}));

function skip(req, res) {
	if (!!req.headers.pinger) {
		process.stdout.clearLine();
		process.stdout.cursorTo(0);
		pingCounts++;
		process.stdout.write(`Ping count: ${pingCounts}`);
	}
	return !!req.headers.pinger
}
app.use(cookieParser(process.env.SIGNING_KEY));

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
var db = JSONDB.connect("./chat/database.json");
const limiter = rateLimit({
	windowMs: 2 * 60 * 1000, // 2 minutes
	max: function(req, res) {
		if (db.checkAdmin(req.signedCookies.username)) {
			return 0;
		}
		return 30;
	},
	message: {
		"message": "You are being ratelimited.",
		"error": "ratelimited"
	},
	keyGenerator: (req) => {
		return req.fingerprint.hash
	}
});
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
// app.use(sass({
//     src: __dirname + "/sass", // Input SASS files
//     dest: __dirname + "/static", // Output CSS
//     debug: false
// }));
// app.use((req, res, next) => {
// 	console.log(`"${req.url}": ${req.fingerprint.hash}`);
// 	next();
// })
app.get("/", (req, res, next) => {
	return res.render("index.html");
});
app.get("/login", (req, res, next) => {
	return res.render("login.html");
});
app.get("/register", (req, res, next) => {
	return res.render("register.html");
});
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
		if (!(/^[a-zA-Z0-9]*$/.test(username))) {
			return res.status(400).json({
				message: "Username must only contain 0-9, a-z, or hyphen",
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
		const oldUser = db.findUser(username);
		console.log("oldUser: ", oldUser);
		if (oldUser) {
			return res.status(409).json({
				message: "User Already Exists. Please Login.",
				error: "user_exists"
			});
		} else {
			encryptedPassword = await bcrypt.hash(password, crypto.randomBytes(128).toString("hex"));
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
app.post("/chat/add", auth.verifyToken, limiter, bodyParser.json(), (req, res) => {
	const {
		content
	} = req.body;
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
app.delete("/chat/delete", limiter, auth.verifyToken, bodyParser.json(), (req, res) => {
	const {
		id
	} = req.body;
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
app.use(function(req, res, next) {
	res.status(404);
	// respond with html page
	if (req.accepts('html')) {
		res.render('404', {
			url: req.url
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