import { log } from 'console';
import express from 'express';
import { JsonDB, Config } from 'node-json-db';
import { nanoid } from 'nanoid';
import { fileURLToPath } from 'url';
import formidable from 'formidable';
const __filename = fileURLToPath(import.meta.url);
const app = express();
//必须放在前面，否则因为请求json数据的路径也是/members，images/members下的静态资源将无法响应
app.use(express.static(__filename + '/../data/images'));
//响应前端请求的主页资源
app.get('/home/:key', async (req, res) => {
    const db = new JsonDB(new Config("./data/json/home.json", true, true, '/'));
    let { key } = req.params;
    try {
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
    const db = new JsonDB(new Config("./data/json/members.json", true, true, '/'));
    let { key } = req.params;
    try {
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
    const db = new JsonDB(new Config("./data/json/activities.json", true, true, '/'));
    try {
        res.json(await db.getData(`/offline`));
    }
    catch (_a) {
        res.status(500).send('500 Internal Server Error');
    }
});
app.post('/register', async (req, res) => {
    const form = formidable({
        uploadDir: __filename + '/../data/images/avatars/',
        keepExtensions: true
    });
    try {
        //不需要错误处理也要加上前面的'_,'，因为js没有根据对应参数名传值的机制
        form.parse(req, async (_, fields, files) => {
            const id = nanoid();
            const db = new JsonDB(new Config("./data/json/users.json", true, true, '/'));
            log(fields.other, files);
            db.push('/users[]', {
                id,
                avatarPath: files.avatar[0].filepath.split('/images')[1]
            });
            res.status(200).send('OK');
        });
    }
    catch (_a) {
        res.status(500).send('500 Internal Server Error');
    }
});
app.listen('777', async () => {
    log('qidong!');
});
