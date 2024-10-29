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
const projectRootDirectory = fileURLToPath(import.meta.url).split('/app.js')[0];
const app = express();
//必须放在前面，否则因为请求json数据的路径也是/members，images/members下的静态资源将无法响应
app.use(express.static(projectRootDirectory + '/data/images'));
app.use(express.static(projectRootDirectory + '/data/journal'));
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
app.get('/activity/:key', async (req, res) => {
    try {
        const { key } = req.params;
        const activitiesDB = new JsonDB(new Config("./data/json/activities.json", true, true, '/'));
        res.send(await activitiesDB.getData(`/${key}`));
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
        uploadDir: projectRootDirectory + '/data/images/avatars/',
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
    return new Promise((resolve, reject) => {
        fs.unlink(fileSavedPath, (err) => {
            log(err);
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}
async function deletePreviousAvatar(previousPath) {
    return new Promise((resolve, reject) => {
        fs.unlink(projectRootDirectory + "/data/images" + previousPath, (err) => {
            log(err);
            if (err) {
                //reject的reason会作为错误信息传递给后续通过catch捕捉
                reject(err);
                return;
            }
            else {
                //resolve,reject不会阻挡后续代码的执行，所以有时要加return
                resolve();
                return;
            }
        });
    });
}
//更改用户信息
app.patch('/user/info', async (req, res) => {
    let decoded;
    let id;
    try {
        decoded = jwt.verify(req.headers.token, privateKey);
        id = decoded.id;
    }
    catch (_a) {
        res.status(401).send('token校验失败');
        return;
    }
    const form = formidable({
        uploadDir: projectRootDirectory + '/data/images/avatars/',
        keepExtensions: true
    });
    try {
        const [fields, files] = await form.parse(req);
        const usersDB = new JsonDB(new Config("./data/json/users.json", true, true, '/'));
        let async1, async2, async3, async4;
        if (fields.name) {
            const name = fields.name[0];
            async1 = usersDB.push(`/${id}/name`, name);
        }
        if (fields.password) {
            const password = fields.password[0];
            async2 = usersDB.push(`/${id}/password`, password);
        }
        let avatarPath;
        if (files.avatar) {
            const previousPath = await usersDB.getData(`/${id}/avatarPath`);
            async4 = deletePreviousAvatar(previousPath);
            avatarPath = files.avatar[0].filepath.split('/images')[1];
            async3 = usersDB.push(`/${id}/avatarPath`, avatarPath);
        }
        await Promise.all([async1, async2, async3, async4]);
        if (avatarPath) {
            res.send(avatarPath);
        }
        else {
            res.send();
        }
    }
    catch (error) {
        log(error);
        res.status(500).send('500 Internal Server Error');
    }
});
//发送评论
app.post('/postComment', bodyParser.json(), async (req, res) => {
    let decoded;
    let id;
    try {
        decoded = jwt.verify(req.headers.token, privateKey);
        id = decoded.id;
    }
    catch (_a) {
        res.status(401).send('token校验失败');
        return;
    }
    try {
        const commentsDB = new JsonDB(new Config("./data/json/comments.json", true, true, '/'));
        await commentsDB.push('/comments[]', {
            id: req.body.id,
            date: req.body.date,
            user: {
                id
            },
            content: req.body.content
        });
        res.send('评论成功');
    }
    catch (_b) {
        res.status(500).send('500 Internal Server Error');
    }
});
//获取评论
app.get('/getComments', async (req, res) => {
    try {
        const commentDB = new JsonDB(new Config("./data/json/comments.json", true, true, '/'));
        const usersDB = new JsonDB(new Config("./data/json/users.json", true, true, '/'));
        let comments = await commentDB.getData("/comments");
        //注意，forEach的回调期待为一个同步函数，不会等待Promise返回
        //如果不“await Promise.all()， map 返回的就是一个 Promise 数组(Promise < Comment > [])。
        //await comments.map(...) 只是等待了 map 本身的同步执行，而没有等待每个 Promise 的完成。
        //这导致 comments 最终是 Promise < Comment > [] 类型，不符合 CommentArr 的类型要求。
        // 要解决这个问题，可以用 Promise.all 来等待 comments.map 中的所有 Promise 完成，从而确保得到的是 Comment 数组，而不是 Promise < Comment > []。
        comments = await Promise.all(comments.map(async (comment) => {
            const { name, avatarPath } = await usersDB.getData(`/${comment.user.id}`);
            comment.user.name = name;
            comment.user.avatarPath = avatarPath;
            if (comment.replies) {
                comment.replies = await Promise.all(comment.replies.map(async (reply) => {
                    const { name, avatarPath } = await usersDB.getData(`/${reply.user.id}`);
                    reply.user.name = name;
                    reply.user.avatarPath = avatarPath;
                    return reply;
                }));
            }
            return comment;
        }));
        // 采用for...of遍历更易于理解，但是如果要最大化并发性能，map更加方便，因为map已经为我们封装好了遍历数组的同时并发、再统一等待的行为。
        // for (const comment of comments){
        //   const { name, avatarPath } = await usersDB.getData(`/${comment.user.id}`)
        //   comment.user.name = name
        //   comment.user.avatarPath = avatarPath
        //   for (const reply of comment.replies) {
        //     const { name, avatarPath } = await usersDB.getData(`/${reply.user.id}`)
        //     reply.user.name = name
        //     reply.user.avatarPath = avatarPath
        //   }
        // }
        res.send(comments);
    }
    catch (error) {
        log(error);
        res.status(500).send('500 Internal Server Error');
    }
});
//发送回复
app.post('/postReply', bodyParser.json(), async (req, res) => {
    let decoded;
    let id;
    try {
        decoded = jwt.verify(req.headers.token, privateKey);
        id = decoded.id;
    }
    catch (_a) {
        res.status(401).send('token校验失败');
        return;
    }
    try {
        const commentsDB = new JsonDB(new Config("./data/json/comments.json", true, true, '/'));
        let repliedCommentIndex;
        await commentsDB.find('/comments', (comment, index) => {
            repliedCommentIndex = index;
            return comment.id === req.body.commentID;
        });
        await commentsDB.push(`/comments[${repliedCommentIndex}]/replies[]`, {
            id: req.body.id,
            date: req.body.date,
            user: {
                id
            },
            content: req.body.content
        });
        res.send('回复成功');
    }
    catch (_b) {
        res.status(500).send('500 Internal Server Error');
    }
});
//删除特定的回复
app.delete('/deleteReply/:commentID/:replyID', async (req, res) => {
    let decoded;
    let id;
    try {
        decoded = jwt.verify(req.headers.token, privateKey);
        id = decoded.id;
    }
    catch (_a) {
        res.status(401).send('token校验失败');
        return;
    }
    const { commentID, replyID } = req.params;
    try {
        let ifUserIDConfirmed = false;
        const commentsDB = new JsonDB(new Config("./data/json/comments.json", true, true, '/'));
        let commentIndex;
        let replyIndex;
        await commentsDB.find(`/comments`, (comment, index) => {
            if (comment.id === commentID) {
                commentIndex = index;
                comment.replies.find((reply, index) => {
                    if (reply.id === replyID) {
                        if (reply.user.id === id) {
                            ifUserIDConfirmed = true;
                            replyIndex = index;
                        }
                    }
                    return reply.id === replyID;
                });
            }
            return comment.id === commentID;
        });
        if (ifUserIDConfirmed) {
            await commentsDB.delete(`/comments[${commentIndex}]/replies[${replyIndex}]`);
            res.send('删除成功');
        }
        else {
            res.status(401).send('你正在删除一个不属于自己的回复，删除失败');
        }
    }
    catch (_b) {
        res.status(500).send('500 Internal Server Error');
    }
});
//删除特定的评论
app.delete('/deleteComment/:commentID', async (req, res) => {
    let decoded;
    let id;
    try {
        decoded = jwt.verify(req.headers.token, privateKey);
        id = decoded.id;
    }
    catch (_a) {
        res.status(401).send('token校验失败');
        return;
    }
    const { commentID } = req.params;
    try {
        let ifUserIDConfirmed = false;
        const commentsDB = new JsonDB(new Config("./data/json/comments.json", true, true, '/'));
        let commentIndex;
        await commentsDB.find('/comments', (comment, index) => {
            if (comment.id === commentID) {
                if (comment.user.id === id) {
                    commentIndex = index;
                    ifUserIDConfirmed = true;
                }
            }
            return comment.id === commentID;
        });
        if (ifUserIDConfirmed) {
            await commentsDB.delete(`/comments[${commentIndex}]`);
            res.send('删除成功');
        }
        else {
            res.status(401).send('你正在删除一个不属于自己的评论，删除失败');
        }
    }
    catch (_b) {
        res.status(500).send('500 Internal Server Error');
    }
});
//获取社刊数据
app.get('/getJournals', async (req, res) => {
    try {
        const journalsDB = new JsonDB(new Config("./data/json/journals.json", true, true, '/'));
        res.send(await journalsDB.getData('/journals'));
    }
    catch (_a) {
        res.status(500).send('500 Internal Server Error');
    }
});
//用来处理所有未定义的接口。
//一定要放到最后，否则这段代码后边的所有请求都会被拦截。
app.use((req, res) => {
    res.status(404).send('404 Not Found');
});
app.listen('777', async () => {
    log('qidong!');
});
