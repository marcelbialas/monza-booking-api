const express = require('express');
const router = express.Router();

/* SETTING UP */
const jwt = require("jsonwebtoken")
let refreshTokens = []

router.post('/', (req, res) => {
    /**
    * * GENERATE A NEW ACCESS TOKEN WITH GIVEN REFRESH TOKEN
    */

    refreshToken = req.body.token
    console.log(123)

    if (refreshToken === null) return res.sendStatus(401)
    if (!refreshTokens.includes(refreshToken)) return res.sendStatus(403)

    jwt.verify(refreshToken, process.env.REFRESH_ROKEN_SECRET, (err, user) => {
        if (err) return res.sendStatus(403)
        const accessToken = generateAccessToken({ name: user.name })
        res.json({ accessToken })
    })

});

module.exports = router;