import { log } from 'console'
import express from 'express'
import { JsonDB, Config } from 'node-json-db'
import { nanoid } from 'nanoid';
import path from 'path'
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url)


const app = express()

//必须放在前面，否则因为请求json数据的路径也是/members，images/members下的静态资源将无法响应
app.use(express.static(__filename + '/../data/images'))

//声明中间件，限制向服务器发送请求的ip
// function 

interface Image {
  id: number
  src: string
  alt: string
}

//响应前端请求的主页资源
app.get('/home/:key', async (req, res) => {
  const db = new JsonDB(new Config("./data/json/home.json", true, true, '/'));
  let { key } = req.params
  try {
    if (key === 'lastestVideos' || 'lastestTypesettings' || 'carouselImages') {
      res.json(await db.getData(`/${key}`))
    } else {
      res.status(404).send('404 Not Found')
    }
  } catch {
    res.status(500).send('500 Internal Server Error')
  }
})

//响应前端请求的About.vue内的members数据
app.get('/members/:key', async (req, res) => {
  const db = new JsonDB(new Config("./data/json/members.json", true, true, '/'));
  let { key } = req.params
  try {
    if (key === 'activeDuty' || 'historicalDuty' || 'founder' || 'otherMembers') {
      res.json(await db.getData(`/${key}`))
    } else {
      res.status(404).send('404 Not Found')
    }
  } catch {
    res.status(500).send('500 Internal Server Error')
  }
})

app.get('/activities', async (req, res) => {
  const db = new JsonDB(new Config("./data/json/activities.json", true, true, '/'));
  try {
    res.json(await db.getData(`/offline`))
  } catch {
    res.status(500).send('500 Internal Server Error')
  }
})





app.listen('777', async () => {
  log('qidong!')
})