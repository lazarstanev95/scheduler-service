import express from "express";

const router = express.Router();

router.get('/check', (req, res) => {
    res.send('Up and running');
});

export default router;