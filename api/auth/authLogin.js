const express = require("express");
const router = express.Router();

/* SETTING UP */
const jwt = require("jsonwebtoken");

let refreshTokens = [];

router.post("/auth/login", (req, res) => {
  const user_secret_key = req.body.user_secret_key;
  if (user_secret_key !== process.env.USER_SECRET_KEY)
    return res.sendStatus(403);

  const user = { name: user_secret_key };
  const accessToken = generateAccessToken(user);
  const refreshToken = jwt.sign(user, process.env.REFRESH_ROKEN_SECRET);
  refreshTokens.push(refreshToken);
  res.json({ accessToken, refreshToken });
});

function generateAccessToken(user) {
  return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "10s" });
}

module.exports = router;
