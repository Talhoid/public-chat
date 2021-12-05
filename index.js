const express = require("express");
const sass = require("node-sass-middleware");
const punycode = require("punycode");
const bodyParser = require("body-parser");
const app = express();
const auth = require("./auth");
const morgan = require("morgan");
const http = require("http").Server(app);
const io = require("socket.io")(http);
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const {
	validateParams
} = require("./validateParams.js");
const timeout = require("connect-timeout");

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


const JSONDB = require("./jsonDatabase.js")

var db;

(async function() {
    db = await JSONDB.connect("./chat/database.json");
})();

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

app.use(sass({
	src: __dirname + "/sass", // Input SASS files
	dest: __dirname + "/static", // Output CSS
	debug: false
}));
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
                message: "All input is required",
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
			db.setUserToken(username, token);

			// user
			res.cookie("token", token, httpOnlyOptions);
            res.cookie("username", username, httpOnlyOptions);
            res.cookie("loggedIn", true, cookieOptions);
			return res.status(200).redirect("/");
		}
		return res.status(400).json({
            message: "Invalid Credentials",
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
                message: "All input is required",
                error: "incomplete_request"
            });
		}

		const oldUser = db.findUser(username);

		if (oldUser) {
			return res.status(409).json({
                message: "User Already Exist. Please Login",
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

        db.setUserToken(username, token);
		res.cookie("token", token, httpOnlyOptions);
        res.cookie("username", username, httpOnlyOptions);
        res.cookie("loggedIn", true, cookieOptions);
		return res.status(200).redirect("/");
	} catch (e) {
		console.error(e);
	}
})

app.get("/chat/messages", (req, res) => {
    res.json(db.getMessages());
});

app.get("/username", (req, res) => {
    return res.status(req.signedCookies.username ? 200 : 403).json(req.signedCookies.username ? {username: req.signedCookies.username} : {error: "logged_out"});
});

app.post("/chat/add", auth, bodyParser.json(), (req, res) => {
    const { content } = req.body;
    if (!!content) {
        console.log(`Message: ${content}`)
        var message = db.addMessage({
            content: content,
            username: req.signedCookies.username
        });
        io.emit("message", message);
        return res.json(message);
    } else {
        return res.status(400).json({
            "message": "No content in body.",
            "error": "content_required"
        });
    }
});

io.on("connection", (user) => {
	console.log("a user is connected > ", user.id)
});
// app.all("*", function (req, res, next) {
//     
//     next();
// })

var server = http.listen(80, () => {
	console.log("server is running on port", server.address().port);
});