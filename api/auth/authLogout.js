const express = require('express');
const router = express.Router();

/* SETTING UP */
const app = express();

router.post('/', (req, res) => {
    refreshTokens = refreshTokens.filter(token => token !== req.body.token)
    res.sendStatus(204)
});

module.exports = router;