const { createServer } = require("http");
const express = require('express');
const redis = require("redis");
const cors = require('cors');
const encryptionFunc = require('./encryptionFunctions');
const { Server } = require("socket.io");
const port = 3500;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let redisClient;

(async () => {
    redisClient = redis.createClient();

    redisClient.on("error", (error) => console.error(`Error : ${error}`));

    await redisClient.connect();
})();


app.get('/', (req,res) => {
    res.send('Server is working');
})

app.get('/test', async (req, res) => {
    const encryptedAppBundleVerifier = await redisClient.get('encryptedBundle');

    const appBundle = req.headers['app-bundle'];
    const encryptedAppBundleHeader = encryptionFunc.encrypt(appBundle).encryptedData;

    if (encryptedAppBundleVerifier === encryptedAppBundleHeader) {
        res.status(200).send({
            success: true,
            message: "Accessed Successfully",
        });

        await redisClient.del('encryptedBundle');
    } else {
        res.status(500).send({
            success: false,
            message: "Accessed Denied, Verification Failed",
        });
    }
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

io.on("connection", (socket) => {
    console.log("We are live and connected");

    socket.on('verificationData', data => {
        redisClient.set('encryptedBundle', encryptionFunc.encrypt(data).encryptedData)
        redisClient.expire('encryptedBundle', 10);

        socket.emit('verificationResponse', 'App Verified');
    });
});

httpServer.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});