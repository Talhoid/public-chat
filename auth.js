const jwt = require("jsonwebtoken");

const config = process.env;

const verifyToken = (req, res, next) => {
	const token = req.query.token || req.headers["x-access-token"] || req.signedCookies.token;

	if (!token) {
		return res.status(403).json({
			message: "A token is required for authentication.",
			error: "token_required"
		});
	}
	try {
		const decoded = jwt.verify(token, config.TOKEN_KEY);
		req.user = decoded;
	} catch (err) {
		return res.status(401).json({
			message: "Invalid token.",
			error: "invalid_token"
		});
	}
	return next();
};

const verifyAdmin = (database) => {
	return (req, res, next) => {
		if (!database.checkAdmin(req.signedCookies.username)) {
			return res.status(403).json({
				message: "User is not an admin.",
				error: "not_admin"
			});
		}
		next();
	}
}

module.exports = {
	verifyToken,
	verifyAdmin
};