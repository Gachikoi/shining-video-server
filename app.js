import { log } from 'console';
import express from 'express';
import { JsonDB, Config } from 'node-json-db';
// 初始化数据库
const db = new JsonDB(new Config("/data/json/home.json", true, true, '/'));
const app = express();
app.get('/image', async (req, res) => {
    res.json(await db.getData('/carouselImages'));
});
app.listen('777', async () => {
    log('qidong!');
});
