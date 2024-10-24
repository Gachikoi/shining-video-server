import { log } from 'console';
import express from 'express';
import { JsonDB, Config } from 'node-json-db';
import { nanoid } from 'nanoid';
import { fileURLToPath } from 'url';
import formidable from 'formidable';
import jwt from 'jsonwebtoken';
import bodyParser from 'body-parser';
import nodemailer from 'nodemailer';
import fs from 'fs';
const transporter = nodemailer.createTransport({
    host: 'smtp.qq.com',
    port: 465,
    secure: true,
    auth: {
        user: '1131997238@qq.com',
        pass: 'txgaymgsugcjjjbg'
    }
});
const privateKey = 'fh2fRyBHtTR_pnxLWmhcJ';
const __filename = fileURLToPath(import.meta.url);
const app = express();
//必须放在前面，否则因为请求json数据的路径也是/members，images/members下的静态资源将无法响应
app.use(express.static(__filename + '/../data/images'));
//声明中间件，限制向服务器发送请求的ip
// function 
//响应前端请求的主页资源
app.get('/home/:key', async (req, res) => {
    try {
        const db = new JsonDB(new Config("./data/json/home.json", true, true, '/'));
        let { key } = req.params;
        if (key === 'lastestVideos' || 'lastestTypesettings' || 'carouselImages') {
            res.json(await db.getData(`/${key}`));
        }
        else {
            res.status(404).send('404 Not Found');
        }
    }
    catch (_a) {
        res.status(500).send('500 Internal Server Error');
    }
});
//响应前端请求的About.vue内的members数据
app.get('/members/:key', async (req, res) => {
    try {
        const db = new JsonDB(new Config("./data/json/members.json", true, true, '/'));
        let { key } = req.params;
        if (key === 'activeDuty' || 'historicalDuty' || 'founder' || 'otherMembers') {
            res.json(await db.getData(`/${key}`));
        }
        else {
            res.status(404).send('404 Not Found');
        }
    }
    catch (_a) {
        res.status(500).send('500 Internal Server Error');
    }
});
//响应前端请求的Activity.vue内的图片
app.get('/activities', async (req, res) => {
    try {
        const db = new JsonDB(new Config("./data/json/activities.json", true, true, '/'));
        res.json(await db.getData(`/offline`));
    }
    catch (_a) {
        res.status(500).send('500 Internal Server Error');
    }
});
//响应登录请求
app.post('/login', bodyParser.json(), async (req, res) => {
    try {
        const { email, password } = req.body;
        const usersDB = new JsonDB(new Config("./data/json/users.json", true, true, '/'));
        let id = '';
        const loginEmail = await usersDB.find('/', (entry, index) => {
            id = index;
            return entry.email === email;
        });
        if (loginEmail) {
            if (loginEmail.password === password) {
                const { name, avatarPath } = loginEmail;
                res.send({ token: jwt.sign({ id }, privateKey), avatarPath, name });
            }
            else {
                res.status(401).send('密码错误');
            }
        }
        else {
            res.status(403).send('此邮箱还未注册');
        }
    }
    catch (_a) {
        res.status(500).send('500 Internal Server Error');
    }
});
//不做清除过期验证码的功能了，因为没什么用，还会增加程序开销。
//注册时，根据邮箱返回验证码
app.get('/code/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const code = `${Math.floor(1000 + Math.random() * 9000)}`;
        const db = new JsonDB(new Config("./data/json/registerPrepare.json", true, true, '/'));
        //使用方括号实现使用变量的值作为属性名
        //如果之前已经发送过验证码了，push会直接覆盖旧的验证码
        const dbPush = db.push('/', { [email]: code });
        const sendMail = transporter.sendMail({
            from: '"ガチ恋" <1131997238@qq.com>',
            to: email,
            subject: '验证码——晒你动漫社视频组官网',
            text: `${code}`
        });
        //先让前面两个异步函数并行执行，并在此等待。如果都没有问题再响应客户端
        await Promise.all([dbPush, sendMail]);
        res.send('successfully send the code');
    }
    catch (error) {
        log(error);
        res.status(500).send('500 Internal Server Error');
    }
});
//注册
app.post('/register', async (req, res) => {
    const form = formidable({
        uploadDir: __filename + '/../data/images/avatars/',
        keepExtensions: true
    });
    let fileSavedPath; // 记录文件的路径
    form.on('fileBegin', (_, file) => {
        fileSavedPath = file.filepath; // 记录上传的文件路径
    });
    //不需要错误处理也要加上前面的'_,'，因为js没有根据对应参数名传值的机制
    //form.parse是一个异步函数。在js中，如果异步代码中的错误未显式地传递给回调或promise，则外层的try...catch无法捕获这些错误。
    form.parse(req, async (error, fields, files) => {
        try {
            //如果form.parse时出现错误，服务器不再向下执行代码，而是return一个Error，将错误抛给外层的作用域。
            if (error) {
                log(error);
                res.status(500).send('500 Internal Server Error');
                return;
            }
            const code = fields.code[0];
            const email = fields.email[0];
            const registerPrepareDB = new JsonDB(new Config("./data/json/registerPrepare.json", true, true, '/'));
            if (await registerPrepareDB.exists(`/${email}`)) {
                if (code !== await registerPrepareDB.getData(`/${email}`)) {
                    await deleteTempAvatarOnRegister(fileSavedPath);
                    res.status(401).send('验证码错误');
                }
                else {
                    const usersDB = new JsonDB(new Config("./data/json/users.json", true, true, '/'));
                    const ifHasThisAccount = await usersDB.find('/', (entry, _) => {
                        return entry.email === email;
                    });
                    if (ifHasThisAccount) {
                        const asyncFunc1 = deleteTempAvatarOnRegister(fileSavedPath);
                        const asyncFunc2 = registerPrepareDB.delete(`/${email}`);
                        await Promise.all([asyncFunc1, asyncFunc2]);
                        res.status(403).send('此邮箱已被注册过');
                    }
                    else {
                        const id = nanoid();
                        const name = fields.name[0];
                        const password = fields.password[0];
                        const avatarPath = files.avatar[0].filepath.split('/images')[1];
                        const usersDBPush = usersDB.push(`/${id}`, {
                            name,
                            email,
                            password,
                            avatarPath,
                        });
                        const registerPrepareDBDelete = registerPrepareDB.delete(`/${email}`);
                        await Promise.all([usersDBPush, registerPrepareDBDelete]);
                        res.send({ token: jwt.sign({ id }, privateKey), avatarPath });
                    }
                }
            }
            else {
                await deleteTempAvatarOnRegister(fileSavedPath);
                res.status(403).send('还未发送验证码');
            }
        }
        catch (error) {
            log(error);
            await deleteTempAvatarOnRegister(fileSavedPath);
            res.status(500).send('500 Internal Server Error');
        }
    });
});
//如果还未发送验证码，用户就申请注册，则需要删除刚刚存储的文件。
async function deleteTempAvatarOnRegister(fileSavedPath) {
    try {
        await fs.unlink(fileSavedPath, () => {
            return new Error('删除文件时出现问题');
        });
    }
    catch (error) {
        log(error.message);
    }
}
app.listen('777', async () => {
    log('qidong!');
});
