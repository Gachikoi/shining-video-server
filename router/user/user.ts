import { log } from 'console'
import { JsonDB, Config } from 'node-json-db'
import { nanoid } from 'nanoid';
import { fileURLToPath } from 'url';
import formidable from 'formidable';
import jwt, { JwtPayload } from 'jsonwebtoken'
import bodyParser from 'body-parser';
import fs from 'fs'
import { Router } from 'express';

const privateKey = 'fh2fRyBHtTR_pnxLWmhcJ'
const projectRootDirectory = fileURLToPath(import.meta.url).split('/router')[0]
const router = Router()
export default router

//辅助更改用户信息
async function deletePreviousAvatar(previousPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.unlink(projectRootDirectory + "/data/images" + previousPath, (err) => {
      log(err)
      if (err) {
        //reject的reason会作为错误信息传递给后续通过catch捕捉
        reject(err)
        return
      } else {
        //resolve,reject不会阻挡后续代码的执行，所以有时要加return
        resolve()
        return
      }
    });
  })
}

//更改用户信息
router.patch('/userInfo', async (req, res) => {
  let decoded
  let id
  try {
    decoded = jwt.verify(req.headers.token as string, privateKey)
    id = (decoded as JwtPayload).id
  } catch {
    res.status(401).send('token校验失败')
    return
  }
  const form = formidable({
    uploadDir: projectRootDirectory + '/data/images/avatars/',
    keepExtensions: true
  })
  try {
    const [fields, files] = await form.parse(req)
    const usersDB = new JsonDB(new Config("./data/json/users.json", true, true, '/'))
    let async1, async2, async3, async4
    if (fields.name) {
      const name = fields.name![0]
      async1 = usersDB.push(`/${id}/name`, name)
    }
    if (fields.password) {
      const password = fields.password![0]
      async2 = usersDB.push(`/${id}/password`, password)
    }
    let avatarPath
    if (files.avatar) {
      const previousPath = await usersDB.getData(`/${id}/avatarPath`)
      async4 = deletePreviousAvatar(previousPath)
      avatarPath = files.avatar![0].filepath.split('/images')[1]
      async3 = usersDB.push(`/${id}/avatarPath`, avatarPath)
    }
    await Promise.all([async1, async2, async3, async4])
    if (avatarPath) {
      res.send(avatarPath)
    } else {
      res.send()
    }
  }
  catch (error) {
    log(error)
    res.status(500).send('500 Internal Server Error')
  }
})

//提交+修改成员信息
router.patch('/memberInfo/submit', bodyParser.json(), async (req, res) => {
  let decoded
  let id
  try {
    decoded = jwt.verify(req.headers.token as string, privateKey)
    id = (decoded as JwtPayload).id
  } catch {
    res.status(401).send('token校验失败')
    return
  }
  try {
    const usersDB = new JsonDB(new Config("./data/json/users.json", true, true, '/'))
    const membersDB = new JsonDB(new Config("./data/json/members.json", true, true, '/'))
    const async1 = usersDB.getData(`/${id}`)
    let previousIndex
    const async2 = membersDB.find('/otherMembers', (otherMember, index) => {
      previousIndex = index
      return otherMember.id === id
    })
    const { avatarPath, name } = await async1
    const result = await async2
    if (result) {
      await membersDB.push(`/otherMembers[${previousIndex}]`, {
        title: req.body.title,
        contact: req.body.contact,
        bililink: req.body.fullLink
      }, false)//merge date rather than replace old value
    } else {
      await membersDB.push('/otherMembers[]', {
        id,
        path: avatarPath,
        name,
        title: req.body.title,
        contact: req.body.contact,
        bililink: req.body.fullLink
      })
    }
    res.send('提交成功')
  } catch {
    res.status(500).send('500 Internal Server Error')
  }
})

//编辑作品信息
router.post('/worksInfo/submit', async (req, res) => {
  let decoded
  let id
  try {
    decoded = jwt.verify(req.headers.token as string, privateKey)
    id = (decoded as JwtPayload).id
  } catch {
    res.status(401).send('token校验失败')
    return
  }
  try {
    const form = formidable({
      uploadDir: projectRootDirectory + '/data/images/works/',
      keepExtensions: true,
      filename: (name, ext, { originalFilename, mimetype }, form) => {
        return `${Date.now()}` + '.' + mimetype?.split('/')[1]
      }
    })
    const async1 = form.parse(req)
    const usersDB = new JsonDB(new Config("./data/json/users.json", true, true, '/'))
    const worksDB = new JsonDB(new Config("./data/json/works.json", true, true, '/'))
    const async2 = usersDB.getData(`/${id}`)
    const [[fields, files], { name, avatarPath }] = await Promise.all([async1, async2])
    worksDB.push(`/${id}`, {
      name,
      avatarPath,
    })
    await Promise.all([
      Promise.all(
        files.videoCovers?.map(async (cover, index) => {
          await worksDB.push(`/${id}/videos[]`, {
            id: fields.videoIDs![index],
            title: fields.videoTitles![index],
            path: cover.filepath.split('/images')[1],
            link: fields.videoLinks![index],
          })

        }) || [await worksDB.push(`/${id}/videos`, [])]
      ),
      Promise.all(
        files.typesettingImgs?.map(async (img, index) => {
          log(img)
          await worksDB.push(`/${id}/typesettings[]`, {
            id: fields.typesettingIDs![index],
            path: img.filepath.split('/images')[1]
          })
        }) || [await worksDB.push(`/${id}/typesettings`, [])]
      )
    ])
    res.send('编辑成功')
  } catch (err) {
    log(err)
    res.status(500).send('500 Internal Server Error')
  }
})