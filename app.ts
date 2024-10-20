import { log } from 'console'
import express from 'express'
import { JsonDB, Config } from 'node-json-db'
import jwt from 'jsonwebtoken'
import { nanoid } from 'nanoid';
// 初始化数据库
const db = new JsonDB(new Config("db.json", true, true, '/'));
const playload = { username: 'gachi' }
const secret = nanoid()
const token = jwt.sign(playload, secret, {
  expiresIn: 60
})
jwt.verify(token, secret, (err, data) => {
  log(data)
})

const app = express()



interface Image {
  id: number
  src: string
  alt: string
}

app.get('/image', async (req, res) => {
  res.json(await db.getData('/carouselImages'))
})



app.listen('900', async () => {
  log('qidong!')
})