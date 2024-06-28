require("dotenv").config();
const express = require("express");

const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const jwt = require("jsonwebtoken");

const addEventRoute = require("./api/endpoints/addEvent");
const getFreeTimeSlots = require("./api/endpoints/getFreeTimeSlots");
const authGenerateToken = require("./api/auth/authGenerateToken");
const authDeleteToken = require("./api/auth/authLogout");
const authLogin = require("./api/auth/authLogin");
const slots = require("./api/endpoints/getFreeTimeSlots");

/**
 * ? Setting up
 */

const app = express();
app.use(helmet());
app.use(
  cors({
    //origin: 'https://buchung.monza.de'
    origin: "*",
  })
);
//adding morgan to log HTTP requests #https://www.npmjs.com/package/morgan
app.use(
  morgan(":method :url status :status - :response-time[1] ms / :user-agent")
);
// adding jsonwebtoken for authentication
app.use(express.json());

let refreshTokens = [];

/**
 * ! ******************************
 * ! ******* API-ENDPOINTS ********
 * ! ******************************
 */

/**
 * * GENERATE A ACCESS TOKEN AND A REFRESH TOKEN
 */
//app.use(authLogin)
app.post("/auth/login", (req, res) => {
  const user_secret_key = req.body.user_secret_key;
  if (user_secret_key !== process.env.USER_SECRET_KEY)
    return res.sendStatus(403);

  const user = { name: user_secret_key };
  const accessToken = generateAccessToken(user);
  const refreshToken = jwt.sign(user, process.env.REFRESH_ROKEN_SECRET);
  refreshTokens.push(refreshToken);
  res.json({ accessToken, refreshToken });
});
/**
 * * DELETE ACCESS TOKEN SO NEW LOGIN IS REQUIRED
 */
//app.use(authDeleteToken)
app.delete("/auth/logout", (req, res) => {
  refreshTokens = refreshTokens.filter((token) => token !== req.body.token);
  res.sendStatus(204);
});
/**
 * * GENERATE A NEW ACCESS TOKEN WITH GIVEN REFRESH TOKEN
 */
//app.use(authGenerateToken)
app.post("/auth/token", (req, res) => {
  refreshToken = req.body.token;

  if (refreshToken === null) return res.sendStatus(401);
  if (!refreshTokens.includes(refreshToken)) return res.sendStatus(403);

  jwt.verify(refreshToken, process.env.REFRESH_ROKEN_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    const accessToken = generateAccessToken({ name: user.name });
    res.json({ accessToken });
  });
});

// ? GET / --> Doesn't return anything rn, not used
app.get("/", authenticateToken, (req, res) => {
  res.sendStatus(200);
  console.log(req.user.name);
});
// ? POST /, --> Returns event if successfully insertet
app.use(addEventRoute);
// ? POST /slots --> Returns free Slots for given day
app.use(slots, authenticateToken);

function generateAccessToken(user) {
  return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "10s" });
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token === null) {
    res.sendStatus(401);
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// ? Starting the Server
const server = app.listen(5000, "localhost", () => {
  var host = server.address().address;
  var port = server.address().port;
  console.log("API Server listening at http://" + host + ":" + port);
});
